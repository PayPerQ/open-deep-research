import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  DEFAULT_AI_MODEL_ID,
  generateObject,
  isAIModel,
  parseLooseJson,
  resolveModelId,
  stripCodeFence,
} from './providers';

// A research report routinely contains fenced code blocks of its own. Those inner
// fences are what broke the old lazy `/```(?:json)?\s*([\s\S]*?)\s*```/` extraction:
// it terminated at the first one and truncated the payload mid-string, surfacing as
// "Unterminated string in JSON at position N".
const REPORT_WITH_INNER_FENCES = [
  '# Hardening Postgres',
  '',
  'Set the buffer pool to ~25% of RAM:',
  '',
  '```ini',
  'shared_buffers = 8GB',
  '```',
  '',
  'Then reload and verify:',
  '',
  '```bash',
  'pg_ctl reload && psql -c "SHOW shared_buffers;"',
  '```',
  '',
  'Sample output:',
  '',
  '```json',
  '{"shared_buffers": "8GB"}',
  '```',
].join('\n');

const fencedPayload = (obj: unknown, tag = 'json') =>
  '```' + tag + '\n' + JSON.stringify(obj, null, 2) + '\n```';

/** Minimal stand-in for the PPQ client: returns a canned completion body. */
const fakeModel = (content: string) => async () => ({
  choices: [{ message: { role: 'assistant', content } }],
});

describe('stripCodeFence', () => {
  it('unwraps a fence that spans the whole payload', () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('unwraps a fence with no language tag', () => {
    expect(stripCodeFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('leaves content alone when the fence does not wrap everything', () => {
    const partial = 'preamble ```json\n{"a":1}\n```';
    expect(stripCodeFence(partial)).toBe(partial);
  });
});

describe('parseLooseJson', () => {
  it('parses bare JSON (providers that honor response_format)', () => {
    expect(parseLooseJson('{"queries":[{"query":"a"}]}').queries).toHaveLength(1);
  });

  it('parses a fenced payload whose report contains inner code fences', () => {
    const parsed = parseLooseJson(fencedPayload({ reportMarkdown: REPORT_WITH_INNER_FENCES }));
    expect(parsed.reportMarkdown).toBe(REPORT_WITH_INNER_FENCES);
    // every inner fence survives — the regression the lazy regex caused
    expect(parsed.reportMarkdown.match(/```/g)).toHaveLength(6);
  });

  it('is not fooled by an inner ```json block', () => {
    const parsed = parseLooseJson(fencedPayload({ reportMarkdown: REPORT_WITH_INNER_FENCES }));
    expect(parsed.reportMarkdown).toContain('{"shared_buffers": "8GB"}');
  });

  it('recovers JSON surrounded by prose', () => {
    const parsed = parseLooseJson('Here you go:\n```json\n{"questions":["q1","q2"]}\n```\nHope that helps!');
    expect(parsed.questions).toEqual(['q1', 'q2']);
  });

  it('handles CRLF line endings', () => {
    expect(parseLooseJson('```json\r\n{\r\n  "reportMarkdown": "# T"\r\n}\r\n```').reportMarkdown).toBe('# T');
  });

  it('throws on content that holds no JSON at all', () => {
    expect(() => parseLooseJson('I could not complete this request.')).toThrow();
  });
});

describe('generateObject', () => {
  it('returns the report from a fenced response containing inner fences', async () => {
    const { object } = await generateObject({
      model: fakeModel(fencedPayload({ reportMarkdown: REPORT_WITH_INNER_FENCES })),
      system: 's',
      prompt: 'p',
      schema: z.object({ reportMarkdown: z.string() }),
    });
    expect(object.reportMarkdown).toBe(REPORT_WITH_INNER_FENCES);
  });

  it('applies provider field remapping on the fenced parse path too', async () => {
    const { object } = await generateObject({
      model: fakeModel(fencedPayload({ serp_queries: [{ query: 'a', researchGoal: 'b' }] })),
      system: 's',
      prompt: 'p',
      schema: z.object({ queries: z.array(z.object({ query: z.string() })) }),
    });
    expect(object.queries).toHaveLength(1);
  });

  it('remaps report -> reportMarkdown', async () => {
    const { object } = await generateObject({
      model: fakeModel(fencedPayload({ report: '# R' })),
      system: 's',
      prompt: 'p',
      schema: z.object({ reportMarkdown: z.string() }),
    });
    expect(object.reportMarkdown).toBe('# R');
  });

  it('salvages questions from prose, but only for the questions schema', async () => {
    const prose = '1. What is your budget?\n2. Which region?';
    const { object } = await generateObject({
      model: fakeModel(prose),
      system: 's',
      prompt: 'p',
      schema: z.object({ questions: z.array(z.string()) }),
    });
    expect(object.questions).toContain('What is your budget?');

    await expect(
      generateObject({
        model: fakeModel(prose),
        system: 's',
        prompt: 'p',
        schema: z.object({ reportMarkdown: z.string() }),
      }),
    ).rejects.toThrow(/Could not extract JSON/);
  });
});

describe('resolveModelId', () => {
  it('accepts ids in the catalog', () => {
    expect(resolveModelId('claude-sonnet-5')).toBe('claude-sonnet-5');
    expect(isAIModel('claude-sonnet-5')).toBe(true);
  });

  it('falls back for retired ids rather than forwarding an upstream 404', () => {
    // openai/gpt-5.3-chat was retired upstream on 2026-07-18
    expect(resolveModelId('openai/gpt-5.3-chat')).toBe(DEFAULT_AI_MODEL_ID);
    expect(resolveModelId(undefined)).toBe(DEFAULT_AI_MODEL_ID);
    expect(isAIModel('openai/gpt-5.3-chat')).toBe(false);
  });
});

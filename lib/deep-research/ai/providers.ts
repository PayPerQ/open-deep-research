import { getEncoding } from 'js-tiktoken';

import { RecursiveCharacterTextSplitter } from './text-splitter';

// Custom implementation for PPQ.ai API
const PPQ_API_ENDPOINT = `${process.env.NEXT_PUBLIC_API_BASE_URL}/chat/completions`;

// Helper function to create headers
const createHeaders = (creditId: string) => ({
  'Content-Type': 'application/json',
  'Referer': 'https://deepresearch.ppq.ai',
  'X-Credit-ID': creditId,
});

// Model Display Information
export const AI_MODEL_DISPLAY = {
    'openai/gpt-5.6-terra': {
      id: 'openai/gpt-5.6-terra',
      name: 'GPT-5.6 Terra (~75¢)',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: true,
    },
    'claude-sonnet-5': {
      id: 'claude-sonnet-5',
      name: 'Claude Sonnet 5 (~70¢)',
      logo: 'https://deepresearch.ppq.ai/providers/anthropic.svg',
      vision: true,
    },
    'openai/gpt-5.6-luna': {
      id: 'openai/gpt-5.6-luna',
      name: 'GPT-5.6 Luna (~10¢)',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: true,
    },
  } as const;
  

export type AIModel = keyof typeof AI_MODEL_DISPLAY;
export type AIModelDisplayInfo = (typeof AI_MODEL_DISPLAY)[AIModel];
export const availableModels = Object.values(AI_MODEL_DISPLAY);

// Single source of truth for the default. Upstream retires model ids without notice
// (openai/gpt-5.3-chat started 404ing on 2026-07-18), so this must not be duplicated
// across the routes and the UI.
export const DEFAULT_AI_MODEL_ID = 'openai/gpt-5.6-terra' satisfies AIModel;

export function isAIModel(value: unknown): value is AIModel {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AI_MODEL_DISPLAY, value);
}

// Callers may pass a model id from a stale client or a hand-rolled API request.
// Fall back rather than forwarding an unknown id and taking an upstream 404.
export function resolveModelId(value: unknown): AIModel {
  if (isAIModel(value)) return value;
  if (value !== undefined) {
    console.warn(`Unknown model id ${JSON.stringify(value)}, falling back to ${DEFAULT_AI_MODEL_ID}`);
  }
  return DEFAULT_AI_MODEL_ID;
}

// Custom client implementation
const createPPQClient = (creditId: string) => {
  if (!creditId) {
    console.error("[PPQ CLIENT] No credit ID provided");
    throw new Error("No credit ID available");
  }

  return async (messages: any[], options?: any) => {
    const requestData = {
      model: options?.model || DEFAULT_AI_MODEL_ID,
      messages,
      ...options,
    };
    
    console.log('PPQ API Request:');
    
    try {
        
      const response = await fetch(PPQ_API_ENDPOINT, {
        method: 'POST',
        headers: createHeaders(creditId),
        body: JSON.stringify({...requestData, query_source: 'deep research' }),
      });
      
      const responseText = await response.text();
      console.log('PPQ API Response text: ', response);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}, Response: ${responseText}`);
      }
      
      try {
        return JSON.parse(responseText);
      } catch (err) {
        console.error('Failed to parse response as JSON:', responseText);
        // Return a response in OpenAI format with the text content
        return {
          choices: [
            {
              message: {
                role: 'assistant',
                content: responseText
              }
            }
          ]
        };
      }
    } catch (error) {
      console.error('Error making request to PPQ API:', error);
      throw error;
    }
  };
};

// Strip a markdown code fence that wraps the ENTIRE payload.
//
// Anchored to the whole string on purpose. A lazy `/```(?:json)?\s*([\s\S]*?)\s*```/`
// stops at the FIRST closing fence it finds, which — for a research report containing
// its own code blocks — is a fence *inside* the JSON string. That truncates the payload
// mid-string and surfaces as "Unterminated string in JSON at position N".
export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*)\r?\n```$/);
  return fenced ? fenced[1] : trimmed;
}

// Best-effort JSON parse. Models wrap the object in a fence, prepend a preamble, or
// append a sign-off; try progressively looser candidates and return the first that parses.
export function parseLooseJson(raw: string): any {
  const trimmed = raw.trim();
  const unfenced = stripCodeFence(raw);

  const candidates = [trimmed];
  if (unfenced !== trimmed) candidates.push(unfenced);

  // Outermost {...} slice — handles surrounding prose, and a leading fence whose
  // closing counterpart never arrived because the model was cut off.
  for (const source of unfenced === trimmed ? [trimmed] : [trimmed, unfenced]) {
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start !== -1 && end > start) candidates.push(source.slice(start, end + 1));
  }

  let lastError: unknown = new Error('No JSON candidates found');
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// Custom generateObject implementation
export async function generateObject({
  model,
  system,
  prompt,
  schema,
  abortSignal,
}: {
  model: any;
  system: string;
  prompt: string;
  schema: any;
  abortSignal?: AbortSignal;
}) {
  const messages = [
    { 
      role: 'system', 
      content: system + "\nYou must always respond with valid JSON that matches the specified schema. For example, if asked for questions, return: {\"questions\": [\"Question 1\", \"Question 2\"]}. If asked for learnings, return: {\"learnings\": [\"Learning 1\", \"Learning 2\"], \"followUpQuestions\": [\"Question 1\", \"Question 2\"]}. If asked to generate queries, return: {\"queries\": [{\"query\": \"Search query\", \"researchGoal\": \"Goal\"}]}. If asked for a report, return: {\"reportMarkdown\": \"# Report\\n\\nContent here\"}"
    },
    { role: 'user', content: prompt }
  ];
  
  // PPQ.ai doesn't support the 'signal' parameter, so don't include it
  const response = await model(messages, { 
    response_format: { type: "json_object" }
  });
  
  // Extract content from the response
  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    console.error('No content in response:', response);
    throw new Error('No content in response');
  }
  
  // Parse JSON from content if needed
  let object;
  try {
    object = parseLooseJson(content);
  } catch (e) {
    // Last resort: if we were expecting questions, salvage them from prose.
    if (schema?.shape?.questions) {
      const numbered = content.includes('1.') && content.includes('2.')
        ? content.split(/\d+\.\s+/).map((q: string) => q.trim()).filter(Boolean)
        : [];
      if (numbered.length > 0) {
        console.log('Extracted questions from numbered list:', numbered);
        return { object: { questions: numbered } };
      }

      const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        console.log('Using fallback parsing for questions');
        return { object: { questions: lines } };
      }
    }

    console.error('Failed to extract JSON, raw content:', content);
    throw new Error('Could not extract JSON from response: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Handle field name differences between providers. This runs for every parse
  // path above, not just the direct-parse one.
  if (schema?.shape?.questions && !object.questions && object.follow_up_questions) {
    console.log('Remapping follow_up_questions to questions');
    object.questions = object.follow_up_questions;
  }

  if (schema?.shape?.queries && !object.queries && object.serp_queries) {
    console.log('Remapping serp_queries to queries');
    object.queries = object.serp_queries;
  }

  if (schema?.shape?.learnings && !object.learnings && object.learning_points) {
    console.log('Remapping learning_points to learnings');
    object.learnings = object.learning_points;
  }

  if (schema?.shape?.followUpQuestions && !object.followUpQuestions && object.follow_up_questions) {
    console.log('Remapping follow_up_questions to followUpQuestions');
    object.followUpQuestions = object.follow_up_questions;
  }

  if (schema?.shape?.reportMarkdown && !object.reportMarkdown && object.report) {
    console.log('Remapping report to reportMarkdown');
    object.reportMarkdown = object.report;
  }

  return { object };
}

// Create model instances with configurations
export function createModel(modelId: AIModel, creditId: string) {
  // Create PPQ client with provided credit ID
  const ppqClient = createPPQClient(creditId);
  
  return (messages: any[], options?: any) => {
    return ppqClient(messages, {
      model: modelId,
      ...options
    });
  };
}

// Token handling
const MinChunkSize = 140;
const encoder = getEncoding('o200k_base');

// trim prompt to maximum context size
export function trimPrompt(prompt: string, contextSize = 120_000) {
  if (!prompt) {
    return '';
  }

  const length = encoder.encode(prompt).length;
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // on average it's 3 characters per token, so multiply by 3 to get a rough estimate of the number of characters
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? '';

  // last catch, there's a chance that the trimmed prompt is same length as the original prompt, due to how tokens are split & innerworkings of the splitter, handle this case by just doing a hard cut
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
}

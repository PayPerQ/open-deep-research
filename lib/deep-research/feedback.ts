import { generateObject } from 'ai';
import { z } from 'zod';

import { createModel, type AIModel, getPPQApiKey, generateWithPPQ } from './ai/providers';
import { systemPrompt } from './prompt';

export async function generateFeedback({
  query,
  numQuestions = 3,
  modelId = 'o3-mini',
  apiKey,
}: {
  query: string;
  numQuestions?: number;
  modelId?: AIModel;
  apiKey?: string;
}) {
  const model = createModel(modelId, apiKey);

  // Define the schema once for reuse
  const schema = z.object({
    questions: z
      .array(z.string())
      .describe(
        `Follow up questions to clarify the research direction, max of ${numQuestions}`,
      ),
  });
  
  // Prepare the prompt
  const prompt = `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear: <query>${query}</query>`;

  // Check if we should use PPQ API
  const usePPQ = typeof window !== 'undefined' && window.localStorage.getItem('use_ppq_api') === 'true';
  const ppqKey = getPPQApiKey();
  
  let userFeedback;
  if (usePPQ && ppqKey) {
    userFeedback = await generateWithPPQ({
      model,
      system: systemPrompt(),
      prompt,
      schema
    });
  } else {
    userFeedback = await generateObject({
      model,
      system: systemPrompt(),
      prompt,
      schema,
    });
  }

  return userFeedback.object.questions.slice(0, numQuestions);
}

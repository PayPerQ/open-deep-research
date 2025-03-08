import { z } from 'zod';

import { createModel, type AIModel, generateObject } from './ai/providers';
import { systemPrompt } from './prompt';

export async function generateFeedback({
  query,
  numQuestions = 3,
  modelId = 'o3-mini',
  creditId,
}: {
  query: string;
  numQuestions?: number;
  modelId?: AIModel;
  creditId: string;
}) {
  const model = createModel(modelId, creditId);

  const userFeedback = await generateObject({
    model,
    system: systemPrompt(),
    prompt: `Given the following query from the user, ask some follow up questions to clarify the research direction. Return a maximum of ${numQuestions} questions, but feel free to return less if the original query is clear: <query>${query}</query>`,
    schema: z.object({
      questions: z
        .array(z.string())
        .describe(
          `Follow up questions to clarify the research direction, max of ${numQuestions}`,
        ),
    }),
  });

  // Handle different response formats
  const questions = userFeedback.object.questions || userFeedback.object.follow_up_questions;
  
  if (!questions) {
    console.error('No questions found in response:', userFeedback);
    throw new Error('No questions found in API response');
  }
  
  return questions.slice(0, numQuestions);
}

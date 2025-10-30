import { getEncoding } from 'js-tiktoken';

import { RecursiveCharacterTextSplitter } from './text-splitter';

// Custom implementation for PPQ.ai API
const PPQ_API_ENDPOINT = `${process.env.NEXT_PUBLIC_API_BASE_URL}/chat/completions`;

// Helper function to create headers
const createHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'Referer': 'https://deepresearch.ppq.ai',
//   'Authorization': `Bearer ${apiKey}`,
});

// Model Display Information
export const AI_MODEL_DISPLAY = {
    'gpt-4o': {
      id: 'gpt-4o',
      name: 'GPT-4o (~$1)',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: true,
    },
    'gpt-4o-mini': {
      id: 'gpt-4o-mini',
      name: 'GPT-4o mini (~20¢)',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: true,
    },
    'o3-mini': {
      id: 'o3-mini',
      name: 'o3 mini (~40¢)',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: false,
    },
  } as const;
  

export type AIModel = keyof typeof AI_MODEL_DISPLAY;
export type AIModelDisplayInfo = (typeof AI_MODEL_DISPLAY)[AIModel];
export const availableModels = Object.values(AI_MODEL_DISPLAY);

// Custom client implementation
const createPPQClient = (creditId: string) => {
  if (!creditId) {
    console.error("[PPQ CLIENT] No credit ID provided");
    throw new Error("No credit ID available");
  }

  return async (messages: any[], options?: any) => {
    const requestData = {
      model: options?.model || 'gpt4o',
      messages,
      ...options,
    };
    
    console.log('PPQ API Request:');
    
    try {
        
      const response = await fetch(PPQ_API_ENDPOINT, {
        method: 'POST',
        headers: createHeaders(creditId),
        body: JSON.stringify({...requestData, credit_id: creditId, query_source: 'deep research',}),
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
    // First try to parse as JSON directly
    object = JSON.parse(content);
    console.log('Successfully parsed JSON directly');
    
    // Handle various field name differences between OpenAI and PPQ.ai
    if (schema?.shape?.questions && !object.questions && object.follow_up_questions) {
      console.log('Remapping follow_up_questions to questions');
      object.questions = object.follow_up_questions;
    }
    
    // Handle other potential field mapping issues
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
  } catch (e) {
    // If that fails, try to extract JSON from markdown
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        object = JSON.parse(jsonMatch[1]);
        console.log('Successfully parsed JSON from code block');
      } catch (e2) {
        console.error('Failed to parse JSON from code block:', jsonMatch[1]);
        
        // Handle the feedback questions case that appears in the error log
        if (schema?.shape?.questions && content.includes('1.') && content.includes('2.')) {
          // Extract questions from numbered list
          const questions = content.split(/\d+\.\s+/)
            .filter(Boolean)
            .map((q: string) => q.trim());
          
          console.log('Extracted questions from numbered list:', questions);
          if (questions.length > 0) {
            return { 
              object: { 
                questions 
              } 
            };
          }
        }
        
        console.error('Failed to parse JSON from code block, full content:', content);
        throw new Error('Invalid JSON in code block: ' + (e2 instanceof Error ? e2.message : String(e2)));
      }
    } else {
      // Final fallback - try to make a best-effort object from the content
      if (schema?.shape?.questions) {
        // If we're expecting questions, try to parse them from the text
        const lines = content.split('\n').filter((line: string) => line.trim());
        if (lines.length > 0) {
          console.log('Using fallback parsing for questions');
          return { 
            object: { 
              questions: lines 
            } 
          };
        }
      }
      
      console.error('Failed to extract JSON, raw content:', content);
      throw new Error('Could not extract JSON from response: ' + (e instanceof Error ? e.message : String(e)));
    }
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

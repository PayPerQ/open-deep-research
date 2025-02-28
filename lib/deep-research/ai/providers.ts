import { createOpenAI } from '@ai-sdk/openai';
import { getEncoding } from 'js-tiktoken';
import { z } from 'zod';

import { RecursiveCharacterTextSplitter } from './text-splitter';

// PPQ API Configuration
export const PPQ_CONFIG = {
  baseUrl: 'https://api.ppq.ai',
  defaultModel: 'claude-3.5-sonnet'
};

// Model Display Information
export const AI_MODEL_DISPLAY = {
    'gpt-4o': {
      id: 'gpt-4o',
      name: 'GPT-4o',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: true,
    },
    'gpt-4o-mini': {
      id: 'gpt-4o-mini',
      name: 'GPT-4o mini',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: true,
    },
    'o3-mini': {
      id: 'o3-mini',
      name: 'o3 mini',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: false,
    },
    'claude-3.5-sonnet': {
      id: 'claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      logo: 'https://deepresearch.ppq.ai/providers/openai.webp',
      vision: true,
    },
  } as const;
  

export type AIModel = keyof typeof AI_MODEL_DISPLAY;
export type AIModelDisplayInfo = (typeof AI_MODEL_DISPLAY)[AIModel];
export const availableModels = Object.values(AI_MODEL_DISPLAY);

// Helper to get the PPQ API key
export function getPPQApiKey(): string | null {
  // Try to get from localStorage if in browser
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('virtual_api_key');
  }
  return null;
}

// OpenAI Client
const openai = createOpenAI({
  apiKey: process.env.OPENAI_KEY!,
});

// Create model instances with configurations
export function createModel(modelId: AIModel, apiKey?: string) {
  // Check if we should use PPQ API
  const usePPQ = typeof window !== 'undefined' && window.localStorage.getItem('use_ppq_api') === 'true';
  const ppqKey = getPPQApiKey();
  
  if (usePPQ && ppqKey) {
    return createPPQModel(modelId, ppqKey);
  }
  
  // Fall back to regular OpenAI client
  const client = createOpenAI({
    apiKey: apiKey || process.env.OPENAI_KEY!,
  });

  return client(modelId, {
    structuredOutputs: true,
    ...(modelId === 'o3-mini' ? { reasoningEffort: 'medium' } : {}),
  });
}

// Create a PPQ API client
export function createPPQModel(modelId: AIModel, apiKey: string) {
  // Just return the OpenAI client, but we'll use our own API call logic in generateWithPPQ
  // This is a workaround for type compatibility issues
  const client = createOpenAI({
    apiKey: apiKey,
    baseURL: PPQ_CONFIG.baseUrl,
  });

  return client(modelId, {
    structuredOutputs: true,
  });
}

// Wrapper for generateObject that works with PPQ API
export async function generateWithPPQ({
  model,
  system,
  prompt,
  schema,
  abortSignal
}: {
  model: any;
  system: string;
  prompt: string;
  schema: z.ZodType<any>;
  abortSignal?: AbortSignal;
}) {
  // We'll fetch directly instead of using the model, since we need to customize the behavior
  try {
    // Get the PPQ API key and use it
    const ppqKey = getPPQApiKey() || '';
    
    const response = await fetch(`${PPQ_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ppqKey}`
      },
      body: JSON.stringify({
        model: 'claude-3.5-sonnet', // Use default model
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      throw new Error(`PPQ API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse the response
    let parsedContent;
    try {
      parsedContent = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error('Failed to parse JSON response:', e);
      throw new Error('Invalid JSON response from model');
    }

    // Validate with schema
    const parsed = schema.parse(parsedContent);
    
    return {
      object: parsed
    };
  } catch (error) {
    console.error('Error in generateWithPPQ:', error);
    throw error;
  }
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

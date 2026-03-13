import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, streamText } from 'ai';

export type AIProvider = 'openai' | 'anthropic' | 'ollama';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type LanguageModel = ReturnType<ReturnType<typeof createOpenAI>>;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'sk-placeholder',
});

const ollama = createOpenAICompatible({
  name: 'ollama',
  baseURL: 'http://localhost:11434/v1',
});

export const models = {
  openai: {
    default: openai('gpt-4o'),
    fast: openai('gpt-4o-mini'),
  },
  anthropic: {
    default: anthropic('claude-sonnet-4-20250514'),
    fast: anthropic('claude-3-5-haiku-20241022'),
  },
  ollama: {
    default: ollama('gpt-oss:120b-cloud'),
    fast: ollama('gpt-oss:120b-cloud'),
  },
} as const;

export function getModel(provider: AIProvider, fast = false): LanguageModel {
  const providerModels = models[provider];
  return fast ? providerModels.fast : providerModels.default;
}

export interface StreamChatOptions {
  provider: AIProvider;
  messages: AIMessage[];
  systemPrompt: string;
  fast?: boolean;
}

export async function streamChat({
  provider,
  messages,
  systemPrompt,
  fast = false,
}: StreamChatOptions) {
  const model = getModel(provider, fast);
  
  return streamText({
    model,
    system: systemPrompt,
    messages,
  });
}

export interface GenerateChatOptions {
  provider: AIProvider;
  messages: AIMessage[];
  systemPrompt: string;
  fast?: boolean;
}

export async function generateChat({
  provider,
  messages,
  systemPrompt,
  fast = false,
}: GenerateChatOptions) {
  const model = getModel(provider, fast);
  
  return generateText({
    model,
    system: systemPrompt,
    messages,
  });
}

export function isProviderConfigured(provider: AIProvider): boolean {
  if (provider === 'openai') {
    return !!process.env.OPENAI_API_KEY;
  }
  if (provider === 'anthropic') {
    return !!process.env.ANTHROPIC_API_KEY;
  }
  if (provider === 'ollama') {
    return true; // Ollama runs locally, always "configured"
  }
  return false;
}

export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = ['ollama']; // Ollama always available for local testing
  if (isProviderConfigured('openai')) providers.push('openai');
  if (isProviderConfigured('anthropic')) providers.push('anthropic');
  return providers;
}

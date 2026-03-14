import { describe, it, expect } from 'vitest';
import { getModel, isProviderConfigured, getAvailableProviders } from './providers';

describe('AI Provider Configuration', () => {
  it('ollama is always available', () => {
    const providers = getAvailableProviders();
    expect(providers).toContain('ollama');
  });

  it('ollama is always configured', () => {
    expect(isProviderConfigured('ollama')).toBe(true);
  });

  it('openai requires API key', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    expect(isProviderConfigured('openai')).toBe(false);
    
    process.env.OPENAI_API_KEY = originalKey;
  });

  it('anthropic requires API key', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    
    expect(isProviderConfigured('anthropic')).toBe(false);
    
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('returns a model for ollama provider', () => {
    const model = getModel('ollama');
    expect(model).toBeDefined();
  });

  it('returns fast model when requested', () => {
    const defaultModel = getModel('ollama', false);
    const fastModel = getModel('ollama', true);
    
    // Both should be defined (ollama uses same model for both)
    expect(defaultModel).toBeDefined();
    expect(fastModel).toBeDefined();
  });
});

describe('Provider Fallback Logic', () => {
  it('falls back to ollama when no cloud keys are set', () => {
    const originalOpenAI = process.env.OPENAI_API_KEY;
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    
    const providers = getAvailableProviders();
    
    // Ollama should always be first/available
    expect(providers[0]).toBe('ollama');
    
    process.env.OPENAI_API_KEY = originalOpenAI;
    process.env.ANTHROPIC_API_KEY = originalAnthropic;
  });
});

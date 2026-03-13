import { describe, it, expect } from 'vitest';
import { buildDaemonSystemPrompt, synthesizeTruthPacket } from './daemon';
import { getMockWorkContext } from '../mock/work-context';
import type { DaemonConfig } from './daemon';

describe('Pan System Prompt Builder', () => {
  const baseConfig: DaemonConfig = {
    name: 'Pan',
    personality: 'supportive',
    privacyLevel: 'balanced',
    provider: 'ollama',
    userId: 'test-user-1',
  };

  it('includes the Pan name in the prompt', () => {
    const prompt = buildDaemonSystemPrompt(baseConfig);
    
    expect(prompt).toContain('You are Pan');
    expect(prompt).toContain('personal Pan');
  });

  it('includes personality traits', () => {
    const analyticalConfig = { ...baseConfig, personality: 'analytical' as const };
    const prompt = buildDaemonSystemPrompt(analyticalConfig);
    
    expect(prompt).toContain('analytical');
    expect(prompt).toContain('data');
  });

  it('respects minimal privacy level', () => {
    const minimalConfig = { ...baseConfig, privacyLevel: 'minimal' as const };
    const prompt = buildDaemonSystemPrompt(minimalConfig);
    
    expect(prompt).toContain('minimal');
    expect(prompt).toContain('bare minimum');
  });

  it('respects balanced privacy level', () => {
    const prompt = buildDaemonSystemPrompt(baseConfig);
    
    expect(prompt).toContain('balanced');
    expect(prompt).toContain('project context');
  });

  it('respects open privacy level', () => {
    const openConfig = { ...baseConfig, privacyLevel: 'open' as const };
    const prompt = buildDaemonSystemPrompt(openConfig);
    
    expect(prompt).toContain('open');
    expect(prompt).toContain('freely');
  });

  it('includes work context when provided', () => {
    const workContext = getMockWorkContext('test-user-1');
    const prompt = buildDaemonSystemPrompt(baseConfig, workContext);
    
    expect(prompt).toContain('Current Work Context');
    expect(prompt).toContain('PR:'); // GitHub PR
    expect(prompt).toContain('Meeting:'); // Calendar
  });

  it('mentions Pan-to-Pan communication', () => {
    const prompt = buildDaemonSystemPrompt(baseConfig);
    
    expect(prompt).toContain('other Pans');
    expect(prompt).toContain('coordinate');
  });
});

describe('TruthPacket Synthesis', () => {
  it('synthesizes work context into a truth packet', () => {
    const workContext = getMockWorkContext('test-user-1');
    const packet = synthesizeTruthPacket(workContext, 'balanced');
    
    expect(packet).toHaveProperty('availability');
    expect(packet).toHaveProperty('workloadSummary');
    expect(packet).toHaveProperty('relevantExpertise');
  });

  it('determines workload from context size', () => {
    const context = getMockWorkContext('user-1');
    const packet = synthesizeTruthPacket(context, 'balanced');
    
    // With 10+ items, should be moderate to heavy
    expect(['Moderate workload', 'Heavy workload with multiple active projects']).toContain(packet.workloadSummary);
  });

  it('extracts relevant expertise from projects', () => {
    const context = getMockWorkContext('user-1');
    const packet = synthesizeTruthPacket(context, 'balanced');
    
    expect(packet.relevantExpertise).toBeInstanceOf(Array);
  });

  it('includes availability info', () => {
    const context = getMockWorkContext('user-1');
    const packet = synthesizeTruthPacket(context, 'balanced');
    
    expect(packet.availability).toBeInstanceOf(Array);
    expect(packet.availability.length).toBeGreaterThan(0);
  });
});

describe('Pan Personality Types', () => {
  const personalities = ['analytical', 'supportive', 'direct', 'creative'] as const;

  personalities.forEach(personality => {
    it(`generates valid prompt for ${personality} personality`, () => {
      const config: DaemonConfig = {
        name: 'TestPan',
        personality,
        privacyLevel: 'balanced',
        provider: 'ollama',
        userId: 'test-user',
      };
      
      const prompt = buildDaemonSystemPrompt(config);
      
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain('TestPan');
    });
  });
});

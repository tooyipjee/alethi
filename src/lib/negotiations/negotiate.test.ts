import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('@/lib/ai/providers', () => ({
  generateChat: vi.fn(async () => ({
    text: '{"intent":"accept","message":"Sounds good, let\'s schedule it."}',
  })),
}));

vi.mock('@/lib/ai/daemon', () => ({
  buildDaemonSystemPrompt: vi.fn(() => 'Mock system prompt'),
}));

vi.mock('@/lib/mock/work-context', () => ({
  getMockOtherUsers: vi.fn(() => [
    {
      id: 'mock-user-1',
      name: 'Mock User',
      daemonName: 'MockPan',
      role: 'Developer',
      workContext: [{ title: 'Available', summary: 'Mon-Fri 9-5' }],
    },
  ]),
}));

vi.mock('./store', () => {
  const negotiations = new Map();
  return {
    saveNegotiation: vi.fn((neg) => negotiations.set(neg.id, neg)),
    addNegotiationMessage: vi.fn((id, msg) => {
      const neg = negotiations.get(id);
      if (neg) neg.messages.push(msg);
    }),
    updateNegotiation: vi.fn((id, updates) => {
      const neg = negotiations.get(id);
      if (neg) Object.assign(neg, updates);
    }),
    getNegotiation: vi.fn((id) => negotiations.get(id)),
  };
});

vi.mock('@/lib/security/audit', () => ({
  logContextShare: vi.fn(),
}));

vi.mock('@/lib/users/user-service', () => ({
  findUserByName: vi.fn(async (name: string) => {
    if (name.toLowerCase().includes('sarah')) {
      return {
        id: 'sarah-id',
        name: 'Sarah Kim',
        email: 'sarah@example.com',
        daemonName: 'Luna',
        daemonPersonality: 'analytical',
        privacyLevel: 'balanced',
      };
    }
    return null;
  }),
  buildUserTruthPacket: vi.fn(() => ({
    availability: ['Mon 2pm', 'Tue 3pm'],
    workloadSummary: 'Light',
    relevantExpertise: ['React', 'TypeScript'],
  })),
}));

// Import the module under test AFTER mocking
import { runNegotiation, continueNegotiation } from './negotiate';
import { saveNegotiation, getNegotiation, addNegotiationMessage, updateNegotiation } from './store';
import { generateChat } from '@/lib/ai/providers';
import { logContextShare } from '@/lib/security/audit';

describe('negotiations/negotiate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runNegotiation', () => {
    it('creates a negotiation with initiator and target', async () => {
      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Schedule a meeting',
        userMessage: 'Let\'s set up a sync',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.initiator.name).toBe('Alex Chen');
      expect(result.initiator.daemonName).toBe('Nova');
      expect(result.target.name).toBe('Sarah Kim');
      expect(result.target.daemonName).toBe('Luna');
    });

    it('saves negotiation to store', async () => {
      await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Code review',
        userMessage: 'Need a review',
      });

      expect(saveNegotiation).toHaveBeenCalled();
    });

    it('generates messages via LLM', async () => {
      await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Design discussion',
        userMessage: 'Discuss designs',
      });

      // Should call generateChat for each turn
      expect(generateChat).toHaveBeenCalled();
    });

    it('adds messages to negotiation', async () => {
      await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Sprint planning',
        userMessage: 'Plan sprint',
      });

      expect(addNegotiationMessage).toHaveBeenCalled();
    });

    it('logs context sharing for audit', async () => {
      await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Audit test',
        userMessage: 'Test audit',
      });

      expect(logContextShare).toHaveBeenCalled();
    });

    it('sets final status and outcome', async () => {
      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Status test',
        userMessage: 'Test status',
      });

      expect(updateNegotiation).toHaveBeenCalled();
      // With mock returning "accept", should be completed
      expect(result.status).toBe('completed');
    });

    it('includes shared context', async () => {
      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Context test',
        userMessage: 'Test context',
      });

      expect(result.sharedContext).toBeDefined();
      expect(result.sharedContext?.initiator.userId).toBe('alex-id');
      expect(result.sharedContext?.target.userId).toBe('sarah-id');
    });

    it('falls back to mock user when real user not found', async () => {
      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Unknown Person',
        topic: 'Mock test',
        userMessage: 'Test mock',
      });

      // Should use mock user
      expect(result.target.name).toBe('Mock User');
      expect(result.target.daemonName).toBe('MockPan');
    });
  });

  describe('continueNegotiation', () => {
    it('adds new messages to existing negotiation', async () => {
      // First create a negotiation
      const initial = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Continue test',
        userMessage: 'Initial message',
      });

      const initialMessageCount = (addNegotiationMessage as ReturnType<typeof vi.fn>).mock.calls.length;

      // Then continue it
      await continueNegotiation({
        negotiationId: initial.id,
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        message: 'Follow up message',
      });

      // Should have added more messages
      expect((addNegotiationMessage as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(initialMessageCount);
    });

    it('reopens negotiation to in_progress status', async () => {
      const initial = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Reopen test',
        userMessage: 'Initial',
      });

      await continueNegotiation({
        negotiationId: initial.id,
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        message: 'Continue',
      });

      // Should have called updateNegotiation to set in_progress
      const calls = (updateNegotiation as ReturnType<typeof vi.fn>).mock.calls;
      const reopenCall = calls.find(c => c[1]?.status === 'in_progress');
      expect(reopenCall).toBeDefined();
    });

    it('throws error for non-existent negotiation', async () => {
      await expect(
        continueNegotiation({
          negotiationId: 'non-existent-id',
          userId: 'alex-id',
          userName: 'Alex Chen',
          userPanName: 'Nova',
          message: 'Test',
        })
      ).rejects.toThrow('Negotiation not found');
    });
  });

  describe('parseResponse (internal)', () => {
    // Test via behavior since parseResponse is not exported
    it('handles valid JSON response', async () => {
      vi.mocked(generateChat).mockResolvedValueOnce({
        text: '{"intent":"propose","message":"How about 2pm?"}',
      });

      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'JSON test',
        userMessage: 'Test',
      });

      expect(result).toBeDefined();
    });

    it('handles JSON wrapped in markdown code blocks', async () => {
      vi.mocked(generateChat).mockResolvedValueOnce({
        text: '```json\n{"intent":"accept","message":"Agreed!"}\n```',
      });

      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Markdown test',
        userMessage: 'Test',
      });

      expect(result).toBeDefined();
    });

    it('handles response with <think> tags', async () => {
      vi.mocked(generateChat).mockResolvedValueOnce({
        text: '<think>Let me consider...</think>{"intent":"accept","message":"OK"}',
      });

      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Think test',
        userMessage: 'Test',
      });

      expect(result).toBeDefined();
    });

    it('infers intent from keywords when JSON parsing fails', async () => {
      vi.mocked(generateChat).mockResolvedValueOnce({
        text: 'I accept your proposal. Let\'s do it!',
      });

      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Fallback test',
        userMessage: 'Test',
      });

      // Should still complete without error
      expect(result).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
    });
  });

  describe('negotiation flow', () => {
    it('creates at least 2 messages (one per Pan)', async () => {
      vi.clearAllMocks();
      
      await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Flow test',
        userMessage: 'Test',
      });

      // addNegotiationMessage should be called at least twice
      const calls = (addNegotiationMessage as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(calls).toBeGreaterThanOrEqual(2);
    });

    it('alternates between initiator and target Pans', async () => {
      const result = await runNegotiation({
        userId: 'alex-id',
        userName: 'Alex Chen',
        userPanName: 'Nova',
        targetPersonName: 'Sarah',
        topic: 'Alternation test',
        userMessage: 'Test',
      });

      const calls = (addNegotiationMessage as ReturnType<typeof vi.fn>).mock.calls;
      
      // First message should be from initiator
      expect(calls[0][1].fromPanName).toBe('Nova');
      
      // Second message should be from target
      if (calls.length >= 2) {
        expect(calls[1][1].fromPanName).toBe('Luna');
      }
    });
  });
});

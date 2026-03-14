import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { NegotiationIntent } from '@/types/daemon';

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '[]'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// Import after mocking
import {
  saveNegotiation,
  updateNegotiation,
  addNegotiationMessage,
  getNegotiation,
  getAllNegotiations,
  getUserNegotiations,
  addUpdateListener,
  type StoredNegotiation,
  type NegotiationMessage,
} from './store';

function createTestNegotiation(overrides?: Partial<StoredNegotiation>): StoredNegotiation {
  return {
    id: `neg-${Date.now()}`,
    topic: 'Test topic',
    status: 'in_progress',
    initiator: { id: 'user-1', name: 'Alice', daemonName: 'Nova' },
    target: { id: 'user-2', name: 'Bob', daemonName: 'Luna' },
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestMessage(overrides?: Partial<NegotiationMessage>): NegotiationMessage {
  return {
    id: `msg-${Date.now()}`,
    fromUserId: 'user-1',
    toUserId: 'user-2',
    fromPanName: 'Nova',
    toPanName: 'Luna',
    intent: 'request' as NegotiationIntent,
    content: 'Test message',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('negotiations/store', () => {
  describe('saveNegotiation', () => {
    it('saves a negotiation and retrieves it', () => {
      const neg = createTestNegotiation({ id: 'test-save-1' });
      saveNegotiation(neg);

      const retrieved = getNegotiation('test-save-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-save-1');
      expect(retrieved?.topic).toBe('Test topic');
    });

    it('stores initiator and target correctly', () => {
      const neg = createTestNegotiation({
        id: 'test-save-2',
        initiator: { id: 'alice-id', name: 'Alice', daemonName: 'Nova' },
        target: { id: 'bob-id', name: 'Bob', daemonName: 'Luna' },
      });
      saveNegotiation(neg);

      const retrieved = getNegotiation('test-save-2');
      expect(retrieved?.initiator.id).toBe('alice-id');
      expect(retrieved?.initiator.daemonName).toBe('Nova');
      expect(retrieved?.target.id).toBe('bob-id');
      expect(retrieved?.target.daemonName).toBe('Luna');
    });
  });

  describe('updateNegotiation', () => {
    it('updates status and outcome', () => {
      const neg = createTestNegotiation({ id: 'test-update-1', status: 'in_progress' });
      saveNegotiation(neg);

      updateNegotiation('test-update-1', {
        status: 'completed',
        outcome: 'Agreement reached',
      });

      const retrieved = getNegotiation('test-update-1');
      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.outcome).toBe('Agreement reached');
    });

    it('updates the updatedAt timestamp', () => {
      const oldDate = new Date('2024-01-01');
      const neg = createTestNegotiation({ id: 'test-update-2', updatedAt: oldDate });
      saveNegotiation(neg);

      updateNegotiation('test-update-2', { status: 'completed' });

      const retrieved = getNegotiation('test-update-2');
      expect(retrieved?.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('does nothing for non-existent negotiation', () => {
      updateNegotiation('non-existent-id', { status: 'completed' });
      expect(getNegotiation('non-existent-id')).toBeUndefined();
    });
  });

  describe('addNegotiationMessage', () => {
    it('appends message to negotiation', () => {
      const neg = createTestNegotiation({ id: 'test-msg-1', messages: [] });
      saveNegotiation(neg);

      const msg = createTestMessage({ content: 'Hello' });
      addNegotiationMessage('test-msg-1', msg);

      const retrieved = getNegotiation('test-msg-1');
      expect(retrieved?.messages.length).toBe(1);
      expect(retrieved?.messages[0].content).toBe('Hello');
    });

    it('appends multiple messages in order', () => {
      const neg = createTestNegotiation({ id: 'test-msg-2', messages: [] });
      saveNegotiation(neg);

      addNegotiationMessage('test-msg-2', createTestMessage({ content: 'First' }));
      addNegotiationMessage('test-msg-2', createTestMessage({ content: 'Second' }));
      addNegotiationMessage('test-msg-2', createTestMessage({ content: 'Third' }));

      const retrieved = getNegotiation('test-msg-2');
      expect(retrieved?.messages.length).toBe(3);
      expect(retrieved?.messages[0].content).toBe('First');
      expect(retrieved?.messages[1].content).toBe('Second');
      expect(retrieved?.messages[2].content).toBe('Third');
    });

    it('does nothing for non-existent negotiation', () => {
      const msg = createTestMessage();
      addNegotiationMessage('non-existent-id', msg);
      expect(getNegotiation('non-existent-id')).toBeUndefined();
    });
  });

  describe('getAllNegotiations', () => {
    it('returns negotiations sorted by updatedAt descending', () => {
      const neg1 = createTestNegotiation({
        id: 'test-all-1',
        updatedAt: new Date('2024-01-01'),
      });
      const neg2 = createTestNegotiation({
        id: 'test-all-2',
        updatedAt: new Date('2024-01-03'),
      });
      const neg3 = createTestNegotiation({
        id: 'test-all-3',
        updatedAt: new Date('2024-01-02'),
      });

      saveNegotiation(neg1);
      saveNegotiation(neg2);
      saveNegotiation(neg3);

      const all = getAllNegotiations();
      const testNegs = all.filter(n => n.id.startsWith('test-all-'));

      expect(testNegs[0].id).toBe('test-all-2');
      expect(testNegs[1].id).toBe('test-all-3');
      expect(testNegs[2].id).toBe('test-all-1');
    });
  });

  describe('getUserNegotiations', () => {
    it('returns negotiations where user is initiator', () => {
      const neg = createTestNegotiation({
        id: 'test-user-neg-1',
        initiator: { id: 'alice', name: 'Alice', daemonName: 'Nova' },
        target: { id: 'bob', name: 'Bob', daemonName: 'Luna' },
      });
      saveNegotiation(neg);

      const aliceNegs = getUserNegotiations('alice');
      expect(aliceNegs.some(n => n.id === 'test-user-neg-1')).toBe(true);
    });

    it('returns negotiations where user is target', () => {
      const neg = createTestNegotiation({
        id: 'test-user-neg-2',
        initiator: { id: 'alice', name: 'Alice', daemonName: 'Nova' },
        target: { id: 'charlie', name: 'Charlie', daemonName: 'Atlas' },
      });
      saveNegotiation(neg);

      const charlieNegs = getUserNegotiations('charlie');
      expect(charlieNegs.some(n => n.id === 'test-user-neg-2')).toBe(true);
    });

    it('does not return negotiations for unrelated users', () => {
      const neg = createTestNegotiation({
        id: 'test-user-neg-3',
        initiator: { id: 'alice', name: 'Alice', daemonName: 'Nova' },
        target: { id: 'bob', name: 'Bob', daemonName: 'Luna' },
      });
      saveNegotiation(neg);

      const daveNegs = getUserNegotiations('dave');
      expect(daveNegs.some(n => n.id === 'test-user-neg-3')).toBe(false);
    });
  });

  describe('addUpdateListener', () => {
    it('notifies listeners when negotiation is saved', () => {
      const listener = vi.fn();
      const unsubscribe = addUpdateListener(listener);

      const neg = createTestNegotiation({
        id: 'test-listener-1',
        initiator: { id: 'user-a', name: 'A', daemonName: 'Nova' },
        target: { id: 'user-b', name: 'B', daemonName: 'Luna' },
      });
      saveNegotiation(neg);

      expect(listener).toHaveBeenCalledWith(['user-a', 'user-b']);
      unsubscribe();
    });

    it('notifies listeners when negotiation is updated', () => {
      const neg = createTestNegotiation({
        id: 'test-listener-2',
        initiator: { id: 'user-x', name: 'X', daemonName: 'Nova' },
        target: { id: 'user-y', name: 'Y', daemonName: 'Luna' },
      });
      saveNegotiation(neg);

      const listener = vi.fn();
      const unsubscribe = addUpdateListener(listener);

      updateNegotiation('test-listener-2', { status: 'completed' });

      expect(listener).toHaveBeenCalledWith(['user-x', 'user-y']);
      unsubscribe();
    });

    it('notifies listeners when message is added', () => {
      const neg = createTestNegotiation({
        id: 'test-listener-3',
        initiator: { id: 'user-p', name: 'P', daemonName: 'Nova' },
        target: { id: 'user-q', name: 'Q', daemonName: 'Luna' },
      });
      saveNegotiation(neg);

      const listener = vi.fn();
      const unsubscribe = addUpdateListener(listener);

      addNegotiationMessage('test-listener-3', createTestMessage());

      expect(listener).toHaveBeenCalledWith(['user-p', 'user-q']);
      unsubscribe();
    });

    it('unsubscribe removes listener', () => {
      const listener = vi.fn();
      const unsubscribe = addUpdateListener(listener);
      unsubscribe();

      const neg = createTestNegotiation({ id: 'test-listener-4' });
      saveNegotiation(neg);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('SharedContext', () => {
    it('stores and retrieves shared context', () => {
      const neg = createTestNegotiation({
        id: 'test-shared-ctx',
        sharedContext: {
          initiator: {
            userId: 'user-1',
            truthPacket: {
              availability: ['Mon 2pm'],
              workloadSummary: 'Light',
              relevantExpertise: ['React'],
            },
            privacyLevel: 'balanced',
          },
          target: {
            userId: 'user-2',
            truthPacket: {
              availability: ['Tue 3pm'],
              workloadSummary: 'Heavy',
              relevantExpertise: ['Python'],
            },
            privacyLevel: 'minimal',
          },
        },
      });
      saveNegotiation(neg);

      const retrieved = getNegotiation('test-shared-ctx');
      expect(retrieved?.sharedContext).toBeDefined();
      expect(retrieved?.sharedContext?.initiator.truthPacket.availability).toContain('Mon 2pm');
      expect(retrieved?.sharedContext?.target.privacyLevel).toBe('minimal');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock embeddings module
vi.mock('./embeddings', () => ({
  embedBatch: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
  embedText: vi.fn(async () => [0.1, 0.2, 0.3]),
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    // Simple mock: return 1 if identical, otherwise 0.5
    return JSON.stringify(a) === JSON.stringify(b) ? 1 : 0.5;
  }),
}));

// Mock work context
vi.mock('@/lib/mock/work-context', () => ({
  getMockWorkContext: vi.fn((userId: string) => [
    {
      id: 'mock-1',
      userId,
      source: 'mock',
      title: 'Mock Context',
      summary: 'Mock summary for testing',
      timestamp: new Date(),
    },
  ]),
}));

import {
  setUserContexts,
  setUserContextsSync,
  getUserContexts,
  searchContexts,
  getConnectedSources,
  getLastSynced,
  hasRealContext,
  getContextCount,
  isSensitiveSource,
} from './context-store';

import type { WorkContext } from '@/types/daemon';

describe('integrations/context-store', () => {
  const testUserId = `test-user-${Date.now()}`;

  function createContext(overrides?: Partial<WorkContext>): WorkContext {
    return {
      id: `ctx-${Date.now()}-${Math.random()}`,
      userId: testUserId,
      source: 'github',
      title: 'Test Context',
      summary: 'Test summary',
      timestamp: new Date(),
      ...overrides,
    };
  }

  describe('isSensitiveSource', () => {
    it('identifies gmail as sensitive', () => {
      expect(isSensitiveSource('gmail')).toBe(true);
    });

    it('identifies calendar as sensitive', () => {
      expect(isSensitiveSource('calendar')).toBe(true);
    });

    it('identifies slack as sensitive', () => {
      expect(isSensitiveSource('slack')).toBe(true);
    });

    it('identifies github as not sensitive', () => {
      expect(isSensitiveSource('github')).toBe(false);
    });

    it('identifies linear as not sensitive', () => {
      expect(isSensitiveSource('linear')).toBe(false);
    });
  });

  describe('setUserContextsSync', () => {
    it('stores contexts for a user', () => {
      const userId = `sync-test-${Date.now()}`;
      const contexts = [
        createContext({ userId, source: 'github', title: 'PR #123' }),
        createContext({ userId, source: 'github', title: 'Issue #456' }),
      ];

      setUserContextsSync(userId, 'github', contexts);

      const retrieved = getUserContexts(userId);
      expect(retrieved.length).toBe(2);
      expect(retrieved.some(c => c.title === 'PR #123')).toBe(true);
    });

    it('replaces contexts from same source', () => {
      const userId = `replace-test-${Date.now()}`;
      
      setUserContextsSync(userId, 'github', [
        createContext({ userId, source: 'github', title: 'Old PR' }),
      ]);

      setUserContextsSync(userId, 'github', [
        createContext({ userId, source: 'github', title: 'New PR' }),
      ]);

      const retrieved = getUserContexts(userId);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].title).toBe('New PR');
    });

    it('keeps contexts from different sources', () => {
      const userId = `multi-source-${Date.now()}`;
      
      setUserContextsSync(userId, 'github', [
        createContext({ userId, source: 'github', title: 'GitHub item' }),
      ]);

      setUserContextsSync(userId, 'linear', [
        createContext({ userId, source: 'linear', title: 'Linear item' }),
      ]);

      const retrieved = getUserContexts(userId);
      expect(retrieved.length).toBe(2);
      expect(retrieved.some(c => c.source === 'github')).toBe(true);
      expect(retrieved.some(c => c.source === 'linear')).toBe(true);
    });
  });

  describe('setUserContexts (async)', () => {
    it('stores contexts with embeddings', async () => {
      const userId = `async-test-${Date.now()}`;
      const contexts = [
        createContext({ userId, source: 'github', title: 'Async PR' }),
      ];

      await setUserContexts(userId, 'github', contexts);

      const retrieved = getUserContexts(userId);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].title).toBe('Async PR');
    });
  });

  describe('getUserContexts', () => {
    it('returns mock context for user without real context', () => {
      const userId = `no-context-${Date.now()}`;
      const contexts = getUserContexts(userId);
      
      expect(contexts.length).toBeGreaterThan(0);
      expect(contexts[0].source).toBe('mock');
    });

    it('returns real context when available', () => {
      const userId = `has-context-${Date.now()}`;
      setUserContextsSync(userId, 'github', [
        createContext({ userId, source: 'github', title: 'Real context' }),
      ]);

      const contexts = getUserContexts(userId);
      expect(contexts[0].title).toBe('Real context');
    });
  });

  describe('searchContexts', () => {
    it('returns contexts for user with context', async () => {
      const userId = `search-test-${Date.now()}`;
      setUserContextsSync(userId, 'github', [
        createContext({ userId, title: 'API endpoint' }),
        createContext({ userId, title: 'Database schema' }),
      ]);

      const results = await searchContexts(userId, 'API');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns mock context for user without context', async () => {
      const userId = `search-no-ctx-${Date.now()}`;
      const results = await searchContexts(userId, 'something');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe('mock');
    });

    it('respects topK limit when embeddings exist', async () => {
      const userId = `search-topk-${Date.now()}`;
      const contexts = Array.from({ length: 20 }, (_, i) =>
        createContext({ userId, title: `Item ${i}` })
      );
      // Use async setter which generates embeddings
      await setUserContexts(userId, 'github', contexts);

      const results = await searchContexts(userId, 'item', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('returns all contexts when no embeddings (sync setter)', async () => {
      const userId = `search-no-embed-${Date.now()}`;
      const contexts = Array.from({ length: 10 }, (_, i) =>
        createContext({ userId, title: `Item ${i}` })
      );
      // Sync setter doesn't generate embeddings
      setUserContextsSync(userId, 'github', contexts);

      const results = await searchContexts(userId, 'item', 5);
      // Without embeddings, returns all contexts
      expect(results.length).toBe(10);
    });
  });

  describe('getConnectedSources', () => {
    it('returns empty array for new user', () => {
      const userId = `no-sources-${Date.now()}`;
      const sources = getConnectedSources(userId);
      expect(sources).toEqual([]);
    });

    it('returns sources after sync', () => {
      const userId = `has-sources-${Date.now()}`;
      setUserContextsSync(userId, 'github', [createContext({ userId })]);
      setUserContextsSync(userId, 'linear', [createContext({ userId, source: 'linear' })]);

      const sources = getConnectedSources(userId);
      expect(sources).toContain('github');
      expect(sources).toContain('linear');
    });
  });

  describe('getLastSynced', () => {
    it('returns undefined for new user', () => {
      const userId = `no-sync-${Date.now()}`;
      expect(getLastSynced(userId)).toBeUndefined();
    });

    it('returns date after sync', () => {
      const userId = `synced-${Date.now()}`;
      const before = new Date();
      setUserContextsSync(userId, 'github', [createContext({ userId })]);
      const after = new Date();

      const lastSynced = getLastSynced(userId);
      expect(lastSynced).toBeDefined();
      expect(lastSynced!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastSynced!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('hasRealContext', () => {
    it('returns false for new user', () => {
      const userId = `no-real-ctx-${Date.now()}`;
      expect(hasRealContext(userId)).toBe(false);
    });

    it('returns true after adding context', () => {
      const userId = `has-real-ctx-${Date.now()}`;
      setUserContextsSync(userId, 'github', [createContext({ userId })]);
      expect(hasRealContext(userId)).toBe(true);
    });
  });

  describe('getContextCount', () => {
    it('returns 0 for new user', () => {
      const userId = `no-count-${Date.now()}`;
      expect(getContextCount(userId)).toBe(0);
    });

    it('returns correct count after adding contexts', () => {
      const userId = `count-test-${Date.now()}`;
      setUserContextsSync(userId, 'github', [
        createContext({ userId }),
        createContext({ userId }),
        createContext({ userId }),
      ]);
      expect(getContextCount(userId)).toBe(3);
    });
  });
});

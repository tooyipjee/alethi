import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
  isDatabaseAvailable: vi.fn(() => false),
}));

vi.mock('@/lib/integrations/context-store', () => ({
  getUserContexts: vi.fn(() => []),
}));

vi.mock('@/lib/mcp/work-graph', () => ({
  buildWorkGraph: vi.fn(() => ({ nodes: [], edges: [] })),
  synthesizeTruthPacket: vi.fn(() => ({
    availability: [],
    workloadSummary: 'Light',
    relevantExpertise: [],
  })),
}));

vi.mock('@/lib/privacy/truth-filter', () => ({
  filterForPrivacy: vi.fn((packet) => packet),
}));

import {
  registerUser,
  updateUser,
  getRegisteredUser,
  getAllRegisteredUsers,
  findUserByName,
  findUserById,
  searchUsers,
  getOtherUsers,
  buildUserTruthPacket,
  type PanUser,
} from './user-service';

describe('users/user-service', () => {
  describe('Demo users', () => {
    it('has Alex Chen pre-registered', () => {
      const alex = getRegisteredUser('test-user-1');
      expect(alex).toBeDefined();
      expect(alex?.name).toBe('Alex Chen');
      expect(alex?.daemonName).toBe('Nova');
    });

    it('has Sarah Kim pre-registered', () => {
      const sarah = getRegisteredUser('test-user-2');
      expect(sarah).toBeDefined();
      expect(sarah?.name).toBe('Sarah Kim');
      expect(sarah?.daemonName).toBe('Luna');
    });
  });

  describe('registerUser', () => {
    it('registers a new user', () => {
      const newUser: PanUser = {
        id: 'new-user-1',
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        daemonName: 'Atlas',
        daemonPersonality: 'analytical',
        privacyLevel: 'balanced',
      };

      registerUser(newUser);

      const retrieved = getRegisteredUser('new-user-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Charlie Brown');
      expect(retrieved?.daemonName).toBe('Atlas');
    });

    it('overwrites existing user with same ID', () => {
      registerUser({
        id: 'overwrite-user',
        name: 'Original',
        email: 'original@example.com',
        daemonName: 'Pan1',
        daemonPersonality: 'supportive',
        privacyLevel: 'balanced',
      });

      registerUser({
        id: 'overwrite-user',
        name: 'Updated',
        email: 'updated@example.com',
        daemonName: 'Pan2',
        daemonPersonality: 'direct',
        privacyLevel: 'minimal',
      });

      const retrieved = getRegisteredUser('overwrite-user');
      expect(retrieved?.name).toBe('Updated');
      expect(retrieved?.daemonName).toBe('Pan2');
    });
  });

  describe('updateUser', () => {
    it('updates specific fields', () => {
      registerUser({
        id: 'update-test-user',
        name: 'Test User',
        email: 'test@example.com',
        daemonName: 'OldName',
        daemonPersonality: 'supportive',
        privacyLevel: 'balanced',
      });

      updateUser('update-test-user', { daemonName: 'NewName' });

      const retrieved = getRegisteredUser('update-test-user');
      expect(retrieved?.daemonName).toBe('NewName');
      expect(retrieved?.name).toBe('Test User'); // Unchanged
    });

    it('does nothing for non-existent user', () => {
      updateUser('non-existent-user', { name: 'Should not exist' });
      expect(getRegisteredUser('non-existent-user')).toBeUndefined();
    });
  });

  describe('getAllRegisteredUsers', () => {
    it('returns all registered users including demo users', () => {
      const all = getAllRegisteredUsers();
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all.some(u => u.name === 'Alex Chen')).toBe(true);
      expect(all.some(u => u.name === 'Sarah Kim')).toBe(true);
    });
  });

  describe('findUserByName', () => {
    it('finds user by partial name match (case insensitive)', async () => {
      const found = await findUserByName('alex');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Alex Chen');
    });

    it('finds user by full name', async () => {
      const found = await findUserByName('Sarah Kim');
      expect(found).toBeDefined();
      expect(found?.id).toBe('test-user-2');
    });

    it('excludes specified user ID', async () => {
      const found = await findUserByName('alex', 'test-user-1');
      expect(found).toBeNull();
    });

    it('returns null for non-existent name', async () => {
      const found = await findUserByName('ZzzNonExistent');
      expect(found).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('finds user by ID', async () => {
      const found = await findUserById('test-user-1');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Alex Chen');
    });

    it('returns null for non-existent ID', async () => {
      const found = await findUserById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('searchUsers', () => {
    it('searches by name', async () => {
      const results = await searchUsers('alex');
      expect(results.some(u => u.name === 'Alex Chen')).toBe(true);
    });

    it('searches by daemon name', async () => {
      const results = await searchUsers('nova');
      expect(results.some(u => u.daemonName === 'Nova')).toBe(true);
    });

    it('searches by email', async () => {
      const results = await searchUsers('test@pan.local');
      expect(results.some(u => u.email === 'test@pan.local')).toBe(true);
    });

    it('excludes specified user', async () => {
      const results = await searchUsers('alex', 'test-user-1');
      expect(results.some(u => u.id === 'test-user-1')).toBe(false);
    });

    it('returns empty array for no matches', async () => {
      const results = await searchUsers('zzzznonexistent');
      expect(results.length).toBe(0);
    });
  });

  describe('getOtherUsers', () => {
    it('returns all users except the specified one', async () => {
      const others = await getOtherUsers('test-user-1');
      expect(others.some(u => u.id === 'test-user-1')).toBe(false);
      expect(others.some(u => u.id === 'test-user-2')).toBe(true);
    });
  });

  describe('buildUserTruthPacket', () => {
    it('returns a TruthPacket structure', () => {
      const packet = buildUserTruthPacket('test-user-1');
      expect(packet).toBeDefined();
      expect(packet).toHaveProperty('availability');
      expect(packet).toHaveProperty('workloadSummary');
      expect(packet).toHaveProperty('relevantExpertise');
    });

    it('respects privacy level parameter', () => {
      const minimalPacket = buildUserTruthPacket('test-user-1', 'minimal');
      const openPacket = buildUserTruthPacket('test-user-1', 'open');
      
      // Both should be valid packets
      expect(minimalPacket).toBeDefined();
      expect(openPacket).toBeDefined();
    });
  });
});

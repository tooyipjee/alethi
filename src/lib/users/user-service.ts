import { db, isDatabaseAvailable } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, ilike, or, ne } from 'drizzle-orm';
import { getUserContexts } from '@/lib/integrations/context-store';
import { buildWorkGraph, synthesizeTruthPacket } from '@/lib/mcp/work-graph';
import { filterForPrivacy } from '@/lib/privacy/truth-filter';
import type { TruthPacket } from '@/types/daemon';

export interface PanUser {
  id: string;
  name: string;
  email: string;
  daemonName: string;
  daemonPersonality: 'analytical' | 'supportive' | 'direct' | 'creative';
  privacyLevel: 'minimal' | 'balanced' | 'open';
  image?: string | null;
}

// In-memory user registry for when DB is unavailable or for demo mode
const userRegistry = new Map<string, PanUser>();

// Pre-register demo users so they can always be found
const DEMO_USERS: PanUser[] = [
  {
    id: 'test-user-1',
    name: 'Alex Chen',
    email: 'test@pan.local',
    daemonName: 'Nova',
    daemonPersonality: 'supportive',
    privacyLevel: 'balanced',
  },
  {
    id: 'test-user-2',
    name: 'Sarah Kim',
    email: 'demo@pan.local',
    daemonName: 'Luna',
    daemonPersonality: 'analytical',
    privacyLevel: 'balanced',
  },
];

// Initialize with demo users
for (const user of DEMO_USERS) {
  userRegistry.set(user.id, user);
}

export function registerUser(user: PanUser): void {
  userRegistry.set(user.id, user);
}

export function updateUser(userId: string, updates: Partial<PanUser>): void {
  const existing = userRegistry.get(userId);
  if (existing) {
    userRegistry.set(userId, { ...existing, ...updates });
  }
}

export function getRegisteredUser(userId: string): PanUser | undefined {
  return userRegistry.get(userId);
}

export function getAllRegisteredUsers(): PanUser[] {
  return Array.from(userRegistry.values());
}

export async function findUserByName(name: string, excludeUserId?: string): Promise<PanUser | null> {
  const nameLower = name.toLowerCase();

  // First check in-memory registry
  for (const user of userRegistry.values()) {
    if (excludeUserId && user.id === excludeUserId) continue;
    if (user.name.toLowerCase().includes(nameLower)) {
      return user;
    }
  }

  // Then check database if available
  if (isDatabaseAvailable()) {
    try {
      const conditions = [ilike(users.name, `%${name}%`)];
      
      const found = await db.query.users.findFirst({
        where: excludeUserId 
          ? or(...conditions, ne(users.id, excludeUserId))
          : or(...conditions),
      });

      if (found) {
        return {
          id: found.id,
          name: found.name,
          email: found.email,
          daemonName: found.daemonName,
          daemonPersonality: found.daemonPersonality,
          privacyLevel: found.privacyLevel,
          image: found.image,
        };
      }
    } catch (err) {
      console.error('DB user lookup failed:', err);
    }
  }

  return null;
}

export async function findUserById(userId: string): Promise<PanUser | null> {
  // Check in-memory first
  const registered = userRegistry.get(userId);
  if (registered) return registered;

  // Then check database
  if (isDatabaseAvailable()) {
    try {
      const found = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (found) {
        return {
          id: found.id,
          name: found.name,
          email: found.email,
          daemonName: found.daemonName,
          daemonPersonality: found.daemonPersonality,
          privacyLevel: found.privacyLevel,
          image: found.image,
        };
      }
    } catch (err) {
      console.error('DB user lookup failed:', err);
    }
  }

  return null;
}

export async function searchUsers(query: string, excludeUserId?: string): Promise<PanUser[]> {
  const results: PanUser[] = [];
  const queryLower = query.toLowerCase();

  // Search in-memory registry
  for (const user of userRegistry.values()) {
    if (excludeUserId && user.id === excludeUserId) continue;
    if (
      user.name.toLowerCase().includes(queryLower) ||
      user.email.toLowerCase().includes(queryLower) ||
      user.daemonName.toLowerCase().includes(queryLower)
    ) {
      results.push(user);
    }
  }

  // Search database
  if (isDatabaseAvailable()) {
    try {
      const dbUsers = await db.query.users.findMany({
        where: excludeUserId ? ne(users.id, excludeUserId) : undefined,
        limit: 20,
      });

      for (const u of dbUsers) {
        // Skip if already in results
        if (results.some(r => r.id === u.id)) continue;
        
        if (
          u.name.toLowerCase().includes(queryLower) ||
          u.email.toLowerCase().includes(queryLower) ||
          u.daemonName.toLowerCase().includes(queryLower)
        ) {
          results.push({
            id: u.id,
            name: u.name,
            email: u.email,
            daemonName: u.daemonName,
            daemonPersonality: u.daemonPersonality,
            privacyLevel: u.privacyLevel,
            image: u.image,
          });
        }
      }
    } catch (err) {
      console.error('DB user search failed:', err);
    }
  }

  return results;
}

export async function getOtherUsers(excludeUserId: string): Promise<PanUser[]> {
  const results: PanUser[] = [];

  // Get from in-memory registry
  for (const user of userRegistry.values()) {
    if (user.id !== excludeUserId) {
      results.push(user);
    }
  }

  // Get from database
  if (isDatabaseAvailable()) {
    try {
      const dbUsers = await db.query.users.findMany({
        where: ne(users.id, excludeUserId),
        limit: 50,
      });

      for (const u of dbUsers) {
        if (results.some(r => r.id === u.id)) continue;
        results.push({
          id: u.id,
          name: u.name,
          email: u.email,
          daemonName: u.daemonName,
          daemonPersonality: u.daemonPersonality,
          privacyLevel: u.privacyLevel,
          image: u.image,
        });
      }
    } catch (err) {
      console.error('DB user list failed:', err);
    }
  }

  return results;
}

export function buildUserTruthPacket(userId: string, privacyLevel: 'minimal' | 'balanced' | 'open' = 'balanced'): TruthPacket {
  const contexts = getUserContexts(userId);
  const workGraph = buildWorkGraph(contexts);
  return filterForPrivacy(synthesizeTruthPacket(workGraph, privacyLevel), privacyLevel);
}

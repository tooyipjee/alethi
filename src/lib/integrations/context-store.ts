import type { WorkContext } from '@/types/daemon';
import { getMockWorkContext } from '@/lib/mock/work-context';

interface UserContext {
  contexts: WorkContext[];
  sources: Set<string>;
  lastSynced?: Date;
}

const store = new Map<string, UserContext>();

export function setUserContexts(userId: string, source: string, contexts: WorkContext[]) {
  const existing = store.get(userId);
  
  if (existing) {
    // Replace contexts from this source, keep others
    const filtered = existing.contexts.filter(c => c.source !== source);
    existing.contexts = [...filtered, ...contexts];
    existing.sources.add(source);
    existing.lastSynced = new Date();
  } else {
    store.set(userId, {
      contexts,
      sources: new Set([source]),
      lastSynced: new Date(),
    });
  }
}

export function getUserContexts(userId: string): WorkContext[] {
  const userCtx = store.get(userId);

  if (!userCtx || userCtx.contexts.length === 0) {
    // No real data yet — fall back to mock for the demo
    return getMockWorkContext(userId);
  }

  return userCtx.contexts;
}

export function getConnectedSources(userId: string): string[] {
  const userCtx = store.get(userId);
  return userCtx ? Array.from(userCtx.sources) : [];
}

export function getLastSynced(userId: string): Date | undefined {
  return store.get(userId)?.lastSynced;
}

export function hasRealContext(userId: string): boolean {
  const userCtx = store.get(userId);
  return !!userCtx && userCtx.contexts.length > 0;
}

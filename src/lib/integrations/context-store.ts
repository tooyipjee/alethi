import type { WorkContext } from '@/types/daemon';
import { getMockWorkContext } from '@/lib/mock/work-context';
import { embedBatch, embedText, cosineSimilarity } from './embeddings';

interface StoredContext extends WorkContext {
  embedding?: number[];
  encrypted?: boolean;
}

interface UserContext {
  contexts: StoredContext[];
  sources: Set<string>;
  lastSynced?: Date;
}

const store = new Map<string, UserContext>();

// Sensitive sources whose content gets encrypted (when crypto is available)
const SENSITIVE_SOURCES = new Set(['gmail', 'calendar', 'slack']);

export function isSensitiveSource(source: string): boolean {
  return SENSITIVE_SOURCES.has(source);
}

export async function setUserContexts(userId: string, source: string, contexts: WorkContext[]) {
  // Generate embeddings for all items
  let embeddings: number[][] = [];
  try {
    const texts = contexts.map(c => `${c.title} ${c.summary}`);
    embeddings = await embedBatch(texts);
  } catch (err) {
    console.warn('Embedding generation failed, storing without vectors:', err);
  }

  const stored: StoredContext[] = contexts.map((c, i) => ({
    ...c,
    embedding: embeddings[i] || undefined,
  }));

  const existing = store.get(userId);

  if (existing) {
    const filtered = existing.contexts.filter(c => c.source !== source);
    existing.contexts = [...filtered, ...stored];
    existing.sources.add(source);
    existing.lastSynced = new Date();
  } else {
    store.set(userId, {
      contexts: stored,
      sources: new Set([source]),
      lastSynced: new Date(),
    });
  }
}

// Synchronous setter for mock/non-embedded contexts
export function setUserContextsSync(userId: string, source: string, contexts: WorkContext[]) {
  const stored: StoredContext[] = contexts.map(c => ({ ...c }));
  const existing = store.get(userId);

  if (existing) {
    const filtered = existing.contexts.filter(c => c.source !== source);
    existing.contexts = [...filtered, ...stored];
    existing.sources.add(source);
    existing.lastSynced = new Date();
  } else {
    store.set(userId, {
      contexts: stored,
      sources: new Set([source]),
      lastSynced: new Date(),
    });
  }
}

export function getUserContexts(userId: string): WorkContext[] {
  const userCtx = store.get(userId);

  if (!userCtx || userCtx.contexts.length === 0) {
    return getMockWorkContext(userId);
  }

  return userCtx.contexts;
}

export async function searchContexts(
  userId: string,
  query: string,
  topK: number = 12,
): Promise<WorkContext[]> {
  const userCtx = store.get(userId);

  if (!userCtx || userCtx.contexts.length === 0) {
    return getMockWorkContext(userId);
  }

  // If no embeddings stored, fall back to returning all
  const hasEmbeddings = userCtx.contexts.some(c => c.embedding);
  if (!hasEmbeddings) {
    return userCtx.contexts;
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
  } catch {
    // Embedding service down, return all context
    return userCtx.contexts;
  }

  // Score each context item by cosine similarity to the query
  const scored = userCtx.contexts.map(ctx => ({
    ctx,
    score: ctx.embedding ? cosineSimilarity(queryEmbedding, ctx.embedding) : 0,
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(s => s.ctx);
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

export function getContextCount(userId: string): number {
  const userCtx = store.get(userId);
  return userCtx?.contexts.length || 0;
}

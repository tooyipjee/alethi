import type { NegotiationIntent, NegotiationStatus, TruthPacket } from '@/types/daemon';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface NegotiationMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromPanName: string;
  toPanName: string;
  intent: NegotiationIntent;
  content: string;
  createdAt: Date;
}

export interface SharedContext {
  initiator: {
    userId: string;
    truthPacket: TruthPacket;
    privacyLevel: string;
  };
  target: {
    userId: string;
    truthPacket: TruthPacket;
    privacyLevel: string;
  };
}

export interface StoredNegotiation {
  id: string;
  topic: string;
  status: NegotiationStatus;
  outcome?: string;
  initiator: { id: string; name: string; daemonName: string };
  target: { id: string; name: string; daemonName: string };
  messages: NegotiationMessage[];
  sharedContext?: SharedContext;
  createdAt: Date;
  updatedAt: Date;
}

// File-based persistence for dev mode (survives hot reloads)
const CACHE_DIR = join(process.cwd(), '.cache');
const STORE_FILE = join(CACHE_DIR, 'negotiations.json');

function loadFromDisk(): Map<string, StoredNegotiation> {
  try {
    if (existsSync(STORE_FILE)) {
      const data = JSON.parse(readFileSync(STORE_FILE, 'utf-8'));
      const map = new Map<string, StoredNegotiation>();
      for (const neg of data) {
        // Restore Date objects
        neg.createdAt = new Date(neg.createdAt);
        neg.updatedAt = new Date(neg.updatedAt);
        neg.messages = neg.messages.map((m: NegotiationMessage) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        }));
        map.set(neg.id, neg);
      }
      console.log(`[STORE] Loaded ${map.size} negotiations from disk`);
      return map;
    }
  } catch (err) {
    console.error('[STORE] Failed to load from disk:', err);
  }
  return new Map();
}

function saveToDisk(negotiations: Map<string, StoredNegotiation>) {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(STORE_FILE, JSON.stringify(Array.from(negotiations.values()), null, 2));
  } catch (err) {
    console.error('[STORE] Failed to save to disk:', err);
  }
}

// In-memory store for negotiations (loaded from disk on startup)
const negotiations = loadFromDisk();

// Listeners for real-time updates (full negotiation refresh)
type UpdateListener = (userIds: string[]) => void;
const listeners: UpdateListener[] = [];

// Listeners for individual message events (real-time per-message updates)
type MessageListener = (negotiationId: string, message: NegotiationMessage, userIds: string[]) => void;
const messageListeners: MessageListener[] = [];

export function addUpdateListener(listener: UpdateListener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function addMessageListener(listener: MessageListener) {
  messageListeners.push(listener);
  return () => {
    const idx = messageListeners.indexOf(listener);
    if (idx >= 0) messageListeners.splice(idx, 1);
  };
}

function notifyUpdate(negotiation: StoredNegotiation) {
  const userIds = [negotiation.initiator.id, negotiation.target.id];
  console.log(`[STORE] Notifying users of update:`, userIds);
  for (const listener of listeners) {
    try {
      listener(userIds);
    } catch {
      // ignore listener errors
    }
  }
}

function notifyMessage(negotiationId: string, message: NegotiationMessage, negotiation: StoredNegotiation) {
  const userIds = [negotiation.initiator.id, negotiation.target.id];
  console.log(`[STORE] Notifying users of new message:`, { negotiationId, messageId: message.id, userIds });
  for (const listener of messageListeners) {
    try {
      listener(negotiationId, message, userIds);
    } catch {
      // ignore listener errors
    }
  }
}

export function saveNegotiation(neg: StoredNegotiation) {
  console.log(`[STORE] Saving negotiation:`, {
    id: neg.id,
    initiator: { id: neg.initiator.id, name: neg.initiator.name },
    target: { id: neg.target.id, name: neg.target.name },
    status: neg.status,
  });
  negotiations.set(neg.id, neg);
  saveToDisk(negotiations);
  notifyUpdate(neg);
}

export function updateNegotiation(id: string, updates: Partial<StoredNegotiation>) {
  const existing = negotiations.get(id);
  if (existing) {
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    negotiations.set(id, updated);
    saveToDisk(negotiations);
    notifyUpdate(updated);
  }
}

export function addNegotiationMessage(id: string, message: NegotiationMessage) {
  const existing = negotiations.get(id);
  if (existing) {
    existing.messages.push(message);
    existing.updatedAt = new Date();
    saveToDisk(negotiations);
    // Notify with per-message event for real-time updates
    notifyMessage(id, message, existing);
    // Also notify full update for clients that prefer full refresh
    notifyUpdate(existing);
  }
}

export function getNegotiation(id: string): StoredNegotiation | undefined {
  return negotiations.get(id);
}

export function getAllNegotiations(): StoredNegotiation[] {
  return Array.from(negotiations.values()).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}

export function getUserNegotiations(userId: string): StoredNegotiation[] {
  return getAllNegotiations().filter(
    n => n.initiator.id === userId || n.target.id === userId
  );
}

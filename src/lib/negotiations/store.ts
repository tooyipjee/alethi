import type { NegotiationIntent, NegotiationStatus } from '@/types/daemon';

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

export interface StoredNegotiation {
  id: string;
  topic: string;
  status: NegotiationStatus;
  outcome?: string;
  initiator: { id: string; name: string; daemonName: string };
  target: { id: string; name: string; daemonName: string };
  messages: NegotiationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store for negotiations (no DB required)
const negotiations = new Map<string, StoredNegotiation>();

// Listeners for real-time updates
type UpdateListener = (userIds: string[]) => void;
const listeners: UpdateListener[] = [];

export function addUpdateListener(listener: UpdateListener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyUpdate(negotiation: StoredNegotiation) {
  const userIds = [negotiation.initiator.id, negotiation.target.id];
  for (const listener of listeners) {
    try {
      listener(userIds);
    } catch {
      // ignore listener errors
    }
  }
}

export function saveNegotiation(neg: StoredNegotiation) {
  negotiations.set(neg.id, neg);
  notifyUpdate(neg);
}

export function updateNegotiation(id: string, updates: Partial<StoredNegotiation>) {
  const existing = negotiations.get(id);
  if (existing) {
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    negotiations.set(id, updated);
    notifyUpdate(updated);
  }
}

export function addNegotiationMessage(id: string, message: NegotiationMessage) {
  const existing = negotiations.get(id);
  if (existing) {
    existing.messages.push(message);
    existing.updatedAt = new Date();
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

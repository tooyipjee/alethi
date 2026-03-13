import type { TruthPacket, NegotiationIntent, NegotiationStatus } from '@/types/daemon';

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

export function saveNegotiation(neg: StoredNegotiation) {
  negotiations.set(neg.id, neg);
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

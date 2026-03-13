export interface AuditEntry {
  id: string;
  timestamp: Date;
  type: 'context_share' | 'sync' | 'token_refresh';
  userId: string;
  details: ContextShareDetails | SyncDetails | TokenRefreshDetails;
}

interface ContextShareDetails {
  type: 'context_share';
  fromUserId: string;
  toUserId: string;
  negotiationId: string;
  sharedFields: string[];
  blockedFields: string[];
}

interface SyncDetails {
  type: 'sync';
  provider: string;
  emailCount?: number;
  eventCount?: number;
  contextCount?: number;
}

interface TokenRefreshDetails {
  type: 'token_refresh';
  provider: string;
  success: boolean;
  error?: string;
}

const auditLog: AuditEntry[] = [];
const MAX_ENTRIES = 10000;
let entryCounter = 0;

function addEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
  entryCounter++;
  auditLog.push({
    ...entry,
    id: `audit-${entryCounter}`,
    timestamp: new Date(),
  });

  if (auditLog.length > MAX_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_ENTRIES);
  }
}

export function logContextShare(
  fromUserId: string,
  toUserId: string,
  negotiationId: string,
  sharedFields: string[],
  blockedFields: string[],
) {
  addEntry({
    type: 'context_share',
    userId: fromUserId,
    details: {
      type: 'context_share',
      fromUserId,
      toUserId,
      negotiationId,
      sharedFields,
      blockedFields,
    },
  });
}

export function logSync(
  userId: string,
  provider: string,
  info: { emailCount?: number; eventCount?: number; contextCount?: number },
) {
  addEntry({
    type: 'sync',
    userId,
    details: {
      type: 'sync',
      provider,
      ...info,
    },
  });
}

export function logTokenRefresh(userId: string, provider: string, success: boolean, error?: string) {
  addEntry({
    type: 'token_refresh',
    userId,
    details: {
      type: 'token_refresh',
      provider,
      success,
      error,
    },
  });
}

export function getAuditLog(userId?: string): AuditEntry[] {
  if (!userId) return [...auditLog];
  return auditLog.filter(e => e.userId === userId);
}

export function getAuditLogCount(userId?: string): number {
  if (!userId) return auditLog.length;
  return auditLog.filter(e => e.userId === userId).length;
}

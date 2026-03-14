import { describe, it, expect } from 'vitest';
import { logContextShare, logSync, logTokenRefresh, getAuditLog, getAuditLogCount } from './audit';

describe('audit logging', () => {
  it('logs context share events', () => {
    const before = getAuditLogCount();
    logContextShare('user-1', 'user-2', 'neg-123', ['availability', 'workloadSummary'], ['recentActivity']);
    const after = getAuditLogCount();
    expect(after).toBe(before + 1);

    const log = getAuditLog('user-1');
    const latest = log[log.length - 1];
    expect(latest.type).toBe('context_share');
    expect(latest.userId).toBe('user-1');

    const details = latest.details as { type: string; sharedFields: string[]; blockedFields: string[] };
    expect(details.sharedFields).toContain('availability');
    expect(details.blockedFields).toContain('recentActivity');
  });

  it('logs sync events', () => {
    logSync('user-1', 'google', { emailCount: 10, eventCount: 5, contextCount: 15 });
    const log = getAuditLog('user-1');
    const latest = log[log.length - 1];
    expect(latest.type).toBe('sync');

    const details = latest.details as { type: string; emailCount: number };
    expect(details.emailCount).toBe(10);
  });

  it('logs token refresh events', () => {
    logTokenRefresh('user-1', 'google', true);
    const log = getAuditLog('user-1');
    const latest = log[log.length - 1];
    expect(latest.type).toBe('token_refresh');

    const details = latest.details as { type: string; success: boolean };
    expect(details.success).toBe(true);
  });

  it('filters by userId', () => {
    const countBefore = getAuditLogCount('user-filter-test');
    logSync('user-filter-test', 'google', { contextCount: 1 });
    logSync('user-other', 'google', { contextCount: 1 });
    expect(getAuditLogCount('user-filter-test')).toBe(countBefore + 1);
  });

  it('getAuditLog without userId returns all', () => {
    const all = getAuditLog();
    expect(all.length).toBeGreaterThan(0);
  });

  it('entries have timestamps and ids', () => {
    logSync('user-ts', 'test', {});
    const log = getAuditLog('user-ts');
    const latest = log[log.length - 1];
    expect(latest.id).toMatch(/^audit-/);
    expect(latest.timestamp).toBeInstanceOf(Date);
  });
});

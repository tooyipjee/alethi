import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('token-store', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_KEY: 'test-key-for-token-store-tests!!' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('stores and retrieves tokens', async () => {
    const { storeTokens, getTokens } = await import('./token-store');

    storeTokens('user-1', {
      googleAccessToken: 'ya29.access-token-here',
      googleRefreshToken: '1//refresh-token-here',
      googleTokenExpiry: Date.now() + 3600000,
    });

    const retrieved = getTokens('user-1');
    expect(retrieved).toBeDefined();
    expect(retrieved!.googleAccessToken).toBe('ya29.access-token-here');
    expect(retrieved!.googleRefreshToken).toBe('1//refresh-token-here');
  });

  it('returns undefined for unknown user', async () => {
    const { getTokens } = await import('./token-store');
    expect(getTokens('nonexistent')).toBeUndefined();
  });

  it('detects expired tokens', async () => {
    const { storeTokens, isTokenExpired } = await import('./token-store');

    storeTokens('user-expired', {
      googleAccessToken: 'token',
      googleTokenExpiry: Date.now() - 1000, // already past
    });

    expect(isTokenExpired('user-expired')).toBe(true);
  });

  it('detects valid tokens', async () => {
    const { storeTokens, isTokenExpired } = await import('./token-store');

    storeTokens('user-valid', {
      googleAccessToken: 'token',
      googleTokenExpiry: Date.now() + 3600000, // 1 hour from now
    });

    expect(isTokenExpired('user-valid')).toBe(false);
  });

  it('considers tokens expiring within 5 minutes as expired', async () => {
    const { storeTokens, isTokenExpired } = await import('./token-store');

    storeTokens('user-soon', {
      googleAccessToken: 'token',
      googleTokenExpiry: Date.now() + 2 * 60 * 1000, // 2 minutes from now
    });

    expect(isTokenExpired('user-soon')).toBe(true); // Within 5-min buffer
  });

  it('updates access token', async () => {
    const { storeTokens, updateAccessToken, getTokens } = await import('./token-store');

    storeTokens('user-update', {
      googleAccessToken: 'old-token',
      googleRefreshToken: 'refresh',
      googleTokenExpiry: Date.now() - 1000,
    });

    const newExpiry = Date.now() + 3600000;
    updateAccessToken('user-update', 'new-token', newExpiry);

    const tokens = getTokens('user-update');
    expect(tokens!.googleAccessToken).toBe('new-token');
    expect(tokens!.googleRefreshToken).toBe('refresh');
  });

  it('hasGoogleToken checks presence', async () => {
    const { storeTokens, hasGoogleToken } = await import('./token-store');

    expect(hasGoogleToken('nobody')).toBe(false);

    storeTokens('has-token', { googleAccessToken: 'tok' });
    expect(hasGoogleToken('has-token')).toBe(true);
  });
});

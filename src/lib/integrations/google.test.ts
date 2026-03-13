import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('refreshGoogleToken', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sends correct refresh request', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'ya29.new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    const { refreshGoogleToken } = await import('./google');
    const result = await refreshGoogleToken('1//old-refresh-token');

    expect(result.accessToken).toBe('ya29.new-access-token');
    expect(result.expiresAt).toBeGreaterThan(Date.now());

    expect(global.fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    );
  });

  it('throws on refresh failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":"invalid_grant"}',
    });

    const { refreshGoogleToken } = await import('./google');
    await expect(refreshGoogleToken('bad-refresh')).rejects.toThrow('Token refresh failed');
  });

  it('throws when Google credentials are missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    vi.resetModules();
    const { refreshGoogleToken } = await import('./google');
    await expect(refreshGoogleToken('refresh-token')).rejects.toThrow('Google OAuth credentials');
  });
});

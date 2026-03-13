import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('crypto module', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_KEY: 'test-encryption-key-for-unit-tests!' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('encrypts and decrypts a string correctly', async () => {
    const { encrypt, decrypt } = await import('./crypto');
    const plaintext = 'This is a secret Google OAuth token';
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same input (random IV)', async () => {
    const { encrypt } = await import('./crypto');
    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with wrong key', async () => {
    const { encrypt } = await import('./crypto');
    const encrypted = encrypt('secret');

    // Change the key
    process.env.ENCRYPTION_KEY = 'different-key-for-wrong-decrypt!!';
    vi.resetModules();
    const { decrypt } = await import('./crypto');

    expect(() => decrypt(encrypted)).toThrow();
  });

  it('handles empty string', async () => {
    const { encrypt, decrypt } = await import('./crypto');
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('handles unicode content', async () => {
    const { encrypt, decrypt } = await import('./crypto');
    const plaintext = 'Email from: 田中太郎 Subject: 会議の件 🔒';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('isEncryptionAvailable returns true when key is set', async () => {
    const { isEncryptionAvailable } = await import('./crypto');
    expect(isEncryptionAvailable()).toBe(true);
  });

  it('isEncryptionAvailable returns false when key is missing', async () => {
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
    const { isEncryptionAvailable } = await import('./crypto');
    expect(isEncryptionAvailable()).toBe(false);
  });

  it('throws when encrypting without key', async () => {
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
    const { encrypt } = await import('./crypto');
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
  });
});

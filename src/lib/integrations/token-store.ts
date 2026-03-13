import { encrypt, decrypt, isEncryptionAvailable } from '@/lib/security/crypto';

interface StoredTokens {
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: number;
}

// Tokens are stored encrypted in memory
interface EncryptedTokens {
  googleAccessToken?: string; // encrypted
  googleRefreshToken?: string; // encrypted
  googleTokenExpiry?: number;
  isEncrypted: boolean;
}

const tokens = new Map<string, EncryptedTokens>();

function encryptValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!isEncryptionAvailable()) return value;
  return encrypt(value);
}

function decryptValue(value: string | undefined, isEncrypted: boolean): string | undefined {
  if (!value) return undefined;
  if (!isEncrypted) return value;
  try {
    return decrypt(value);
  } catch {
    return value; // Fallback if decryption fails (e.g. key changed)
  }
}

export function storeTokens(userId: string, t: StoredTokens) {
  const existing = tokens.get(userId);
  const canEncrypt = isEncryptionAvailable();

  const updated: EncryptedTokens = {
    googleAccessToken: encryptValue(t.googleAccessToken) ?? existing?.googleAccessToken,
    googleRefreshToken: encryptValue(t.googleRefreshToken) ?? existing?.googleRefreshToken,
    googleTokenExpiry: t.googleTokenExpiry ?? existing?.googleTokenExpiry,
    isEncrypted: canEncrypt,
  };

  tokens.set(userId, updated);
}

export function getTokens(userId: string): StoredTokens | undefined {
  const stored = tokens.get(userId);
  if (!stored) return undefined;

  return {
    googleAccessToken: decryptValue(stored.googleAccessToken, stored.isEncrypted),
    googleRefreshToken: decryptValue(stored.googleRefreshToken, stored.isEncrypted),
    googleTokenExpiry: stored.googleTokenExpiry,
  };
}

export function hasGoogleToken(userId: string): boolean {
  const stored = tokens.get(userId);
  return !!stored?.googleAccessToken;
}

export function isTokenExpired(userId: string): boolean {
  const stored = tokens.get(userId);
  if (!stored?.googleTokenExpiry) return true;
  // Expired if within 5 minutes of expiry
  return Date.now() > stored.googleTokenExpiry - 5 * 60 * 1000;
}

export function updateAccessToken(userId: string, accessToken: string, expiresAt: number) {
  const stored = tokens.get(userId);
  if (!stored) return;

  stored.googleAccessToken = encryptValue(accessToken);
  stored.googleTokenExpiry = expiresAt;
  stored.isEncrypted = isEncryptionAvailable();
}

// In-memory token store for OAuth tokens
// In production this would be encrypted in a database

interface StoredTokens {
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: number;
}

const tokens = new Map<string, StoredTokens>();

export function storeTokens(userId: string, t: StoredTokens) {
  const existing = tokens.get(userId) || {};
  tokens.set(userId, { ...existing, ...t });
}

export function getTokens(userId: string): StoredTokens | undefined {
  return tokens.get(userId);
}

export function hasGoogleToken(userId: string): boolean {
  const t = tokens.get(userId);
  return !!t?.googleAccessToken;
}

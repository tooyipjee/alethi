import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { db, isDatabaseAvailable } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { registerUser } from '@/lib/users/user-service';

// Dynamic import to avoid loading crypto in Edge Runtime (middleware)
async function storeTokensAsync(userId: string, tokens: { 
  googleAccessToken?: string; 
  googleRefreshToken?: string; 
  googleTokenExpiry?: number;
}) {
  const { storeTokens } = await import('@/lib/integrations/token-store');
  storeTokens(userId, tokens);
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const alexUser = {
  id: 'test-user-1',
  email: 'alex@pan.local',
  name: 'Alex Chen',
  image: undefined,
  daemonName: 'Nova',
  daemonPersonality: 'supportive',
  privacyLevel: 'balanced',
  preferredProvider: 'ollama',
};

const sarahUser = {
  id: 'test-user-2',
  email: 'sarah@pan.local',
  name: 'Sarah Kim',
  image: undefined,
  daemonName: 'Luna',
  daemonPersonality: 'analytical',
  privacyLevel: 'balanced',
  preferredProvider: 'ollama',
};

const TEST_USERS: Record<string, typeof alexUser> = {
  // Primary emails
  'alex@pan.local': alexUser,
  'sarah@pan.local': sarahUser,
  // Legacy aliases for backwards compatibility
  'test@pan.local': alexUser,
  'demo@pan.local': sarahUser,
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: isDatabaseAvailable() ? DrizzleAdapter(db) : undefined,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    newUser: '/onboarding',
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Check for test users (any password works)
        const testUser = TEST_USERS[email];
        if (testUser && password) {
          return {
            id: testUser.id,
            email: testUser.email,
            name: testUser.name,
            image: testUser.image,
          };
        }

        if (!isDatabaseAvailable()) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      // Persist Google tokens from OAuth sign-in
      if (account?.provider === 'google') {
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        token.googleTokenExpiry = account.expires_at ? account.expires_at * 1000 : undefined;
        
        // Store in memory so server-side APIs can access them
        if (token.id) {
          // Use async import to avoid loading crypto in Edge Runtime
          void storeTokensAsync(token.id as string, {
            googleAccessToken: account.access_token ?? undefined,
            googleRefreshToken: account.refresh_token ?? undefined,
            googleTokenExpiry: account.expires_at ? account.expires_at * 1000 : undefined,
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
        
        // Pass Google token availability to client
        session.user.googleConnected = !!token.googleAccessToken;

        // Check if this is a test user
        const testUser = Object.values(TEST_USERS).find(u => u.id === token.id);
        if (testUser) {
          session.user.daemonName = testUser.daemonName;
          session.user.daemonPersonality = testUser.daemonPersonality;
          session.user.privacyLevel = testUser.privacyLevel;
          session.user.preferredProvider = testUser.preferredProvider;
          
          // Register test user for Pan-to-Pan negotiations
          registerUser({
            id: testUser.id,
            name: testUser.name,
            email: testUser.email,
            daemonName: testUser.daemonName,
            daemonPersonality: testUser.daemonPersonality as 'supportive' | 'analytical' | 'direct' | 'creative',
            privacyLevel: testUser.privacyLevel as 'minimal' | 'balanced' | 'open',
          });
          return session;
        }

        if (isDatabaseAvailable()) {
          const dbUser = await db.query.users.findFirst({
            where: eq(users.id, token.id as string),
          });
          
          if (dbUser) {
            session.user.daemonName = dbUser.daemonName;
            session.user.daemonPersonality = dbUser.daemonPersonality;
            session.user.privacyLevel = dbUser.privacyLevel;
            session.user.preferredProvider = dbUser.preferredProvider;
            
            // Register user for Pan-to-Pan negotiations
            registerUser({
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              daemonName: dbUser.daemonName,
              daemonPersonality: dbUser.daemonPersonality,
              privacyLevel: dbUser.privacyLevel,
              image: dbUser.image,
            });
          }
        } else if (session.user.email && session.user.name) {
          // Register OAuth user without DB (Google OAuth user)
          registerUser({
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            daemonName: session.user.daemonName || 'Pan',
            daemonPersonality: (session.user.daemonPersonality as 'supportive') || 'supportive',
            privacyLevel: (session.user.privacyLevel as 'balanced') || 'balanced',
            image: session.user.image,
          });
        }
      }
      return session;
    },
  },
});

// Helper to get Google access token from JWT (server-side only)
export async function getGoogleToken(): Promise<string | null> {
  const session = await auth();
  if (!session) return null;
  
  // Access the raw JWT to get the token
  // This is a workaround — in production you'd use a proper token refresh flow
  return null; // We'll get it from the token store instead
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      daemonName?: string;
      daemonPersonality?: string;
      privacyLevel?: string;
      preferredProvider?: string;
      googleConnected?: boolean;
    };
  }
}

declare module 'next-auth' {
  interface JWT {
    googleAccessToken?: string;
    googleRefreshToken?: string;
    googleTokenExpiry?: number;
  }
}

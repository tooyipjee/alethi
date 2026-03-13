import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { db, isDatabaseAvailable } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Test user for local development without database
const TEST_USER = {
  id: 'test-user-1',
  email: 'test@pan.local',
  name: 'Test User',
  image: undefined,
  daemonName: 'Pan',
  daemonPersonality: 'supportive',
  privacyLevel: 'balanced',
  preferredProvider: 'ollama',
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

        // Test mode: allow test@pan.local with any password
        if (email === 'test@pan.local' && password) {
          return {
            id: TEST_USER.id,
            email: TEST_USER.email,
            name: TEST_USER.name,
            image: TEST_USER.image,
          };
        }

        // If no database, only allow test user
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
        
        // Test user
        if (token.id === TEST_USER.id) {
          session.user.daemonName = TEST_USER.daemonName;
          session.user.daemonPersonality = TEST_USER.daemonPersonality;
          session.user.privacyLevel = TEST_USER.privacyLevel;
          session.user.preferredProvider = TEST_USER.preferredProvider;
          return session;
        }

        // Database user
        if (isDatabaseAvailable()) {
          const dbUser = await db.query.users.findFirst({
            where: eq(users.id, token.id as string),
          });
          
          if (dbUser) {
            session.user.daemonName = dbUser.daemonName;
            session.user.daemonPersonality = dbUser.daemonPersonality;
            session.user.privacyLevel = dbUser.privacyLevel;
            session.user.preferredProvider = dbUser.preferredProvider;
          }
        }
      }
      return session;
    },
  },
});

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
    };
  }
}

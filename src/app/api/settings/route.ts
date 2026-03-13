import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, isDatabaseAvailable } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const settingsSchema = z.object({
  daemonName: z.string().min(1).optional(),
  personality: z.enum(['analytical', 'supportive', 'direct', 'creative']).optional(),
  privacyLevel: z.enum(['minimal', 'balanced', 'open']).optional(),
  provider: z.enum(['openai', 'anthropic', 'ollama']).optional(),
});

// In-memory settings store for test users (no DB)
const testUserSettings = new Map<string, {
  daemonName: string;
  daemonPersonality: string;
  privacyLevel: string;
  preferredProvider: string;
}>();

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For test user or when DB is unavailable, return session data
    if (!isDatabaseAvailable() || session.user.email === 'test@pan.local') {
      const stored = testUserSettings.get(session.user.id);
      return NextResponse.json({
        id: session.user.id,
        daemonName: stored?.daemonName || session.user.daemonName || 'Pan',
        daemonPersonality: stored?.daemonPersonality || session.user.daemonPersonality || 'supportive',
        privacyLevel: stored?.privacyLevel || session.user.privacyLevel || 'balanced',
        preferredProvider: stored?.preferredProvider || 'ollama',
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      daemonName: user.daemonName,
      daemonPersonality: user.daemonPersonality,
      privacyLevel: user.privacyLevel,
      preferredProvider: user.preferredProvider,
    });
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // For test user or when DB is unavailable, store in memory
    if (!isDatabaseAvailable() || session.user.email === 'test@pan.local') {
      const existing = testUserSettings.get(session.user.id) || {
        daemonName: session.user.daemonName || 'Pan',
        daemonPersonality: session.user.daemonPersonality || 'supportive',
        privacyLevel: session.user.privacyLevel || 'balanced',
        preferredProvider: 'ollama',
      };

      const updated = {
        daemonName: parsed.data.daemonName || existing.daemonName,
        daemonPersonality: parsed.data.personality || existing.daemonPersonality,
        privacyLevel: parsed.data.privacyLevel || existing.privacyLevel,
        preferredProvider: parsed.data.provider || existing.preferredProvider,
      };

      testUserSettings.set(session.user.id, updated);

      return NextResponse.json({
        id: session.user.id,
        ...updated,
      });
    }

    const updates: Partial<typeof users.$inferInsert> = {};
    
    if (parsed.data.daemonName) updates.daemonName = parsed.data.daemonName;
    if (parsed.data.personality) updates.daemonPersonality = parsed.data.personality;
    if (parsed.data.privacyLevel) updates.privacyLevel = parsed.data.privacyLevel;
    if (parsed.data.provider) updates.preferredProvider = parsed.data.provider;
    updates.updatedAt = new Date();

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, session.user.id))
      .returning();

    return NextResponse.json({
      id: updatedUser.id,
      daemonName: updatedUser.daemonName,
      daemonPersonality: updatedUser.daemonPersonality,
      privacyLevel: updatedUser.privacyLevel,
      preferredProvider: updatedUser.preferredProvider,
    });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

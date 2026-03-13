import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const settingsSchema = z.object({
  daemonName: z.string().min(1).optional(),
  personality: z.enum(['analytical', 'supportive', 'direct', 'creative']).optional(),
  privacyLevel: z.enum(['minimal', 'balanced', 'open']).optional(),
  provider: z.enum(['openai', 'anthropic']).optional(),
});

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

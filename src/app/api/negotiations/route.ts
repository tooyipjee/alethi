import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initiateNegotiation, getNegotiationHistory } from '@/lib/ai/orchestrator';
import { db } from '@/lib/db';
import { negotiations, negotiationMessages, users } from '@/lib/db/schema';
import { eq, or, desc } from 'drizzle-orm';
import { z } from 'zod';

const negotiationRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  topic: z.string().min(1),
  initialMessage: z.string().min(1),
});

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userNegotiations = await db.query.negotiations.findMany({
      where: or(
        eq(negotiations.initiatorUserId, session.user.id),
        eq(negotiations.targetUserId, session.user.id)
      ),
      orderBy: [desc(negotiations.updatedAt)],
      limit: 20,
    });

    const negotiationsWithDetails = await Promise.all(
      userNegotiations.map(async (neg) => {
        const messages = await db.query.negotiationMessages.findMany({
          where: eq(negotiationMessages.negotiationId, neg.id),
        });

        const [initiator, target] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, neg.initiatorUserId) }),
          db.query.users.findFirst({ where: eq(users.id, neg.targetUserId) }),
        ]);

        return {
          id: neg.id,
          topic: neg.topic,
          status: neg.status,
          outcome: neg.outcome,
          createdAt: neg.createdAt,
          updatedAt: neg.updatedAt,
          initiator: initiator ? {
            id: initiator.id,
            name: initiator.name,
            daemonName: initiator.daemonName,
          } : null,
          target: target ? {
            id: target.id,
            name: target.name,
            daemonName: target.daemonName,
          } : null,
          messages: messages.map(m => ({
            id: m.id,
            fromUserId: m.fromUserId,
            toUserId: m.toUserId,
            intent: m.intent,
            content: m.content,
            createdAt: m.createdAt,
          })),
          isInitiator: neg.initiatorUserId === session.user.id,
        };
      })
    );

    return NextResponse.json({ negotiations: negotiationsWithDetails });
  } catch (error) {
    console.error('Negotiations fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = negotiationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { targetUserId, topic, initialMessage } = parsed.data;

    if (targetUserId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot negotiate with yourself' },
        { status: 400 }
      );
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    const result = await initiateNegotiation({
      initiatorUserId: session.user.id,
      targetUserId,
      topic,
      initialMessage,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Negotiation initiation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

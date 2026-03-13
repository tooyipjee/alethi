import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserNegotiations } from '@/lib/negotiations/store';
import { runNegotiation } from '@/lib/negotiations/negotiate';
import { z } from 'zod';

const negotiationRequestSchema = z.object({
  targetName: z.string().min(1),
  topic: z.string().min(1),
  message: z.string().min(1),
});

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const negotiations = getUserNegotiations(session.user.id);

    const mapped = negotiations.map(n => ({
      ...n,
      isInitiator: n.initiator.id === session.user.id,
    }));

    return NextResponse.json({ negotiations: mapped });
  } catch (error) {
    console.error('Negotiations fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const { targetName, topic, message } = parsed.data;

    const result = await runNegotiation({
      userId: session.user.id,
      userName: session.user.name || 'User',
      userPanName: session.user.daemonName || 'Pan',
      targetPersonName: targetName,
      topic,
      userMessage: message,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Negotiation error:', error);
    return NextResponse.json(
      { error: 'Negotiation failed', details: String(error) },
      { status: 500 }
    );
  }
}

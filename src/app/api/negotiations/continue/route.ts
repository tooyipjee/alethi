import { auth } from '@/lib/auth';
import { continueNegotiation } from '@/lib/negotiations/negotiate';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { negotiationId, message } = await request.json();

    if (!negotiationId || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing negotiationId or message' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await continueNegotiation({
      negotiationId,
      userId: session.user.id,
      userName: session.user.name || 'User',
      userPanName: session.user.daemonName || 'Pan',
      message,
    });

    return new Response(
      JSON.stringify({ success: true, negotiation: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Continue negotiation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to continue negotiation', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTokens } from '@/lib/integrations/token-store';
import { syncGoogleContext } from '@/lib/integrations/google';
import { setUserContexts } from '@/lib/integrations/context-store';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = getTokens(session.user.id);
    if (!tokens?.googleAccessToken) {
      return NextResponse.json(
        { error: 'Google not connected. Sign in with Google to connect.' },
        { status: 400 }
      );
    }

    const result = await syncGoogleContext(session.user.id, tokens.googleAccessToken);

    // Store Gmail contexts
    const gmailContexts = result.contexts.filter(c => c.source === 'gmail');
    if (gmailContexts.length > 0) {
      setUserContexts(session.user.id, 'gmail', gmailContexts);
    }

    // Store Calendar contexts
    const calendarContexts = result.contexts.filter(c => c.source === 'calendar');
    if (calendarContexts.length > 0) {
      setUserContexts(session.user.id, 'calendar', calendarContexts);
    }

    return NextResponse.json({
      success: true,
      emailCount: result.emailCount,
      eventCount: result.eventCount,
      contextCount: result.contexts.length,
    });
  } catch (error) {
    console.error('Google sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET returns current sync status
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = getTokens(session.user.id);
    const { getConnectedSources, getLastSynced, hasRealContext } = await import('@/lib/integrations/context-store');

    return NextResponse.json({
      googleConnected: !!tokens?.googleAccessToken,
      sources: getConnectedSources(session.user.id),
      lastSynced: getLastSynced(session.user.id)?.toISOString() || null,
      hasRealContext: hasRealContext(session.user.id),
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 });
  }
}

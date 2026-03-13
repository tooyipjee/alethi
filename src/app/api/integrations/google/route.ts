import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTokens, isTokenExpired, updateAccessToken } from '@/lib/integrations/token-store';
import { syncGoogleContext, refreshGoogleToken } from '@/lib/integrations/google';
import { setUserContexts, getConnectedSources, getLastSynced, hasRealContext } from '@/lib/integrations/context-store';
import { logSync } from '@/lib/security/audit';

async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokens = getTokens(userId);
  if (!tokens?.googleAccessToken) return null;

  if (!isTokenExpired(userId)) {
    return tokens.googleAccessToken;
  }

  // Token expired — attempt refresh
  if (!tokens.googleRefreshToken) {
    console.warn('Google token expired and no refresh token available');
    return null;
  }

  try {
    const refreshed = await refreshGoogleToken(tokens.googleRefreshToken);
    updateAccessToken(userId, refreshed.accessToken, refreshed.expiresAt);
    return refreshed.accessToken;
  } catch (err) {
    console.error('Token refresh failed:', err);
    return null;
  }
}

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const accessToken = await getValidAccessToken(userId);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google not connected or token expired. Please re-authenticate with Google.' },
        { status: 400 }
      );
    }

    const result = await syncGoogleContext(userId, accessToken);

    const gmailContexts = result.contexts.filter(c => c.source === 'gmail');
    if (gmailContexts.length > 0) {
      await setUserContexts(userId, 'gmail', gmailContexts);
    }

    const calendarContexts = result.contexts.filter(c => c.source === 'calendar');
    if (calendarContexts.length > 0) {
      await setUserContexts(userId, 'calendar', calendarContexts);
    }

    logSync(userId, 'google', {
      emailCount: result.emailCount,
      eventCount: result.eventCount,
      contextCount: result.contexts.length,
    });

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

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = getTokens(session.user.id);

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

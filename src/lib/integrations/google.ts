import type { WorkContext } from '@/types/daemon';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  labels: string[];
  isUnread: boolean;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees: string[];
  location?: string;
  status: string;
}

// Fetch recent emails from Gmail API
async function fetchGmail(accessToken: string): Promise<GmailMessage[]> {
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=newer_than:3d',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    console.error('Gmail list failed:', listRes.status, await listRes.text());
    return [];
  }

  const listData = await listRes.json();
  const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id);

  if (messageIds.length === 0) return [];

  // Fetch each message (batch would be better but this works)
  const messages: GmailMessage[] = [];
  for (const id of messageIds.slice(0, 10)) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) continue;
      const msg = await msgRes.json();

      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      messages.push({
        id: msg.id,
        threadId: msg.threadId,
        snippet: msg.snippet || '',
        subject: getHeader('Subject'),
        from: getHeader('From'),
        date: getHeader('Date'),
        labels: msg.labelIds || [],
        isUnread: (msg.labelIds || []).includes('UNREAD'),
      });
    } catch {
      continue;
    }
  }

  return messages;
}

// Fetch upcoming calendar events
async function fetchCalendar(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: oneWeekFromNow.toISOString(),
    maxResults: '20',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    console.error('Calendar fetch failed:', res.status, await res.text());
    return [];
  }

  const data = await res.json();

  return (data.items || []).map((event: {
    id: string;
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: Array<{ email: string; displayName?: string }>;
    location?: string;
    status?: string;
  }) => ({
    id: event.id,
    summary: event.summary || '(No title)',
    description: event.description?.slice(0, 200),
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    attendees: (event.attendees || []).map(a => a.displayName || a.email),
    location: event.location,
    status: event.status || 'confirmed',
  }));
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    if (diffDays < 0) return `${dayStr} at ${timeStr} (past)`;
    if (diffHrs < 1) return `In ${Math.round(diffMs / 60000)} minutes`;
    if (diffHrs < 24) return `Today at ${timeStr}`;
    if (diffHrs < 48) return `Tomorrow at ${timeStr}`;
    return `${dayStr} at ${timeStr}`;
  } catch {
    return isoString;
  }
}

// Transform Gmail messages into WorkContext
function gmailToWorkContext(userId: string, messages: GmailMessage[]): WorkContext[] {
  const now = new Date();
  const unread = messages.filter(m => m.isUnread);
  const contexts: WorkContext[] = [];

  // Summary item
  if (messages.length > 0) {
    contexts.push({
      id: `gmail-summary`,
      userId,
      source: 'gmail' as WorkContext['source'],
      title: 'Gmail: Recent Activity',
      summary: `${unread.length} unread emails out of ${messages.length} recent. ${
        unread.length > 5 ? 'Inbox is getting busy.' : 'Inbox looks manageable.'
      }`,
      data: { type: 'summary', unreadCount: unread.length, totalRecent: messages.length },
      createdAt: now,
      updatedAt: now,
    });
  }

  // Individual important emails (unread or recent)
  for (const msg of messages.slice(0, 8)) {
    const fromName = msg.from.replace(/<.*>/, '').trim().replace(/"/g, '');
    contexts.push({
      id: `gmail-${msg.id}`,
      userId,
      source: 'gmail' as WorkContext['source'],
      title: `Email: ${msg.subject || '(no subject)'}`,
      summary: `From ${fromName}. ${msg.isUnread ? '⬤ Unread.' : 'Read.'} "${msg.snippet.slice(0, 120)}${msg.snippet.length > 120 ? '...' : ''}"`,
      data: {
        type: 'email',
        from: fromName,
        subject: msg.subject,
        unread: msg.isUnread,
        threadId: msg.threadId,
      },
      createdAt: new Date(msg.date || now),
      updatedAt: now,
    });
  }

  return contexts;
}

// Transform Calendar events into WorkContext
function calendarToWorkContext(userId: string, events: CalendarEvent[]): WorkContext[] {
  const now = new Date();
  const contexts: WorkContext[] = [];

  // Summary
  const todayEvents = events.filter(e => {
    const start = new Date(e.start);
    return start.toDateString() === now.toDateString();
  });

  if (events.length > 0) {
    contexts.push({
      id: 'cal-summary',
      userId,
      source: 'calendar',
      title: 'Calendar: This Week',
      summary: `${todayEvents.length} event${todayEvents.length !== 1 ? 's' : ''} today, ${events.length} total this week.${
        todayEvents.length === 0 ? ' Clear day for deep work.' : ''
      }`,
      data: { type: 'summary', todayCount: todayEvents.length, weekCount: events.length },
      createdAt: now,
      updatedAt: now,
    });
  }

  // Individual events
  for (const event of events.slice(0, 10)) {
    const attendeeList = event.attendees.length > 0
      ? ` With: ${event.attendees.slice(0, 4).join(', ')}${event.attendees.length > 4 ? ` +${event.attendees.length - 4} more` : ''}.`
      : '';

    contexts.push({
      id: `cal-${event.id}`,
      userId,
      source: 'calendar',
      title: `Meeting: ${event.summary}`,
      summary: `${formatTime(event.start)}.${attendeeList}${event.location ? ` Location: ${event.location}.` : ''}`,
      data: {
        type: 'meeting',
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        location: event.location,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  return contexts;
}

export interface GoogleSyncResult {
  emailCount: number;
  eventCount: number;
  contexts: WorkContext[];
}

export async function syncGoogleContext(userId: string, accessToken: string): Promise<GoogleSyncResult> {
  const [emails, events] = await Promise.all([
    fetchGmail(accessToken),
    fetchCalendar(accessToken),
  ]);

  const emailContexts = gmailToWorkContext(userId, emails);
  const calendarContexts = calendarToWorkContext(userId, events);
  const contexts = [...emailContexts, ...calendarContexts];

  return {
    emailCount: emails.length,
    eventCount: events.length,
    contexts,
  };
}

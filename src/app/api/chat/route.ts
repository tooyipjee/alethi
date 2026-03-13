import { auth } from '@/lib/auth';
import { streamDaemonChat } from '@/lib/ai/daemon';
import { getMockWorkContext, getMockOtherUsers } from '@/lib/mock/work-context';
import { runNegotiation } from '@/lib/negotiations/negotiate';
import type { AIMessage, AIProvider } from '@/lib/ai/providers';

interface ClientMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Detect if the user wants Pan to talk to another Pan
function detectNegotiationRequest(message: string): { target: string; topic: string } | null {
  const patterns = [
    /(?:talk|speak|reach out|message|contact|negotiate|coordinate|check) (?:to|with) (\w+)(?:'s)? (?:pan|daemon)/i,
    /(?:ask|tell|ping|sync with) (\w+)(?:'s)? (?:pan|daemon|team)/i,
    /(?:schedule|set up|arrange|book) (?:a |the )?(?:meeting|call|review|sync|chat) with (\w+)/i,
    /(?:talk|speak|reach out|message) (?:to|with) (\w+) about/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const targetName = match[1];
      const otherUsers = getMockOtherUsers();
      const found = otherUsers.find(u =>
        u.name.toLowerCase().includes(targetName.toLowerCase())
      );
      if (found) {
        return { target: found.name, topic: message };
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages: chatMessages } = await request.json() as {
      messages: ClientMessage[];
    };

    const userId = session.user.id;
    const daemonName = session.user.daemonName || 'Pan';
    const personality = session.user.daemonPersonality || 'supportive';
    const privacyLevel = session.user.privacyLevel || 'balanced';

    const provider: AIProvider = process.env.OPENAI_API_KEY
      ? 'openai'
      : process.env.ANTHROPIC_API_KEY
        ? 'anthropic'
        : 'ollama';

    const lastMessage = chatMessages[chatMessages.length - 1]?.content || '';

    // Check if this is a negotiation request
    const negotiationReq = detectNegotiationRequest(lastMessage);
    if (negotiationReq) {
      try {
        const result = await runNegotiation({
          userId,
          userName: session.user.name || 'User',
          userPanName: daemonName,
          targetPersonName: negotiationReq.target,
          topic: negotiationReq.topic,
          userMessage: lastMessage,
        });

        // Build a summary of what happened
        const otherPan = result.target.daemonName;
        const lines = [
          `**I talked to ${result.target.name}'s Pan (${otherPan}).** Here's what happened:\n`,
          '---\n',
        ];

        for (const msg of result.messages) {
          const label = msg.fromUserId === userId ? daemonName : msg.fromPanName;
          lines.push(`**${label}** _(${msg.intent})_: ${msg.content}\n`);
        }

        lines.push('\n---\n');
        if (result.outcome) {
          lines.push(`**Outcome:** ${result.outcome}\n`);
        }
        lines.push(`\nYou can also see this in **Pan Channels** in the sidebar.`);

        const summary = lines.join('\n');

        // Stream the summary as a plain text response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Send in small chunks to simulate streaming
            const words = summary.split(' ');
            let i = 0;
            const interval = setInterval(() => {
              if (i >= words.length) {
                controller.close();
                clearInterval(interval);
                return;
              }
              const chunk = (i === 0 ? '' : ' ') + words[i];
              controller.enqueue(encoder.encode(chunk));
              i++;
            }, 20);
          },
        });

        return new Response(stream, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      } catch (error) {
        console.error('Negotiation failed:', error);
        // Fall through to normal chat if negotiation fails
      }
    }

    // Normal Pan chat with work context
    const workContext = getMockWorkContext(userId);

    const daemonConfig = {
      name: daemonName,
      personality: personality as 'analytical' | 'supportive' | 'direct' | 'creative',
      privacyLevel: privacyLevel as 'minimal' | 'balanced' | 'open',
      provider,
      userId,
    };

    const aiMessages: AIMessage[] = chatMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const result = await streamDaemonChat({
      config: daemonConfig,
      messages: aiMessages,
      workContext,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Chat failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

import { auth } from '@/lib/auth';
import { streamDaemonChat } from '@/lib/ai/daemon';
import { searchContexts } from '@/lib/integrations/context-store';
import { runNegotiation } from '@/lib/negotiations/negotiate';
import { getAllRegisteredUsers } from '@/lib/users/user-service';
import { getMockOtherUsers } from '@/lib/mock/work-context';
import type { AIMessage, AIProvider } from '@/lib/ai/providers';

interface ClientMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Detect if the user wants their daemon to talk to another user's daemon
function detectNegotiationRequest(message: string, excludeUserId: string): { target: string; topic: string } | null {
  const patterns = [
    // Explicit Pan/daemon references
    /(?:talk|speak|reach out|message|contact|negotiate|coordinate|check) (?:to|with) (\w+)(?:'s)? (?:pan|daemon|luna|stella|atlas|mercury|nova)/i,
    /(?:ask|tell|ping|sync with) (\w+)(?:'s)? (?:pan|daemon|team|luna|stella|nova)/i,
    // Meeting/scheduling
    /(?:schedule|set up|arrange|book) (?:a |the )?(?:meeting|call|review|sync|chat) with (\w+)/i,
    // Natural "talk to X about" phrases
    /(?:talk|speak|reach out|message) (?:to|with) (\w+) about/i,
    // Natural "ask X" phrases - catches "ask sarah what she's been up to"
    /ask (\w+) (?:what|about|if|whether|how|when|where|why)/i,
    // Check/find out from someone
    /(?:check|find out) (?:with|from) (\w+)/i,
    // Follow up patterns
    /(?:get back to|follow up with|catch up with|connect with) (\w+)/i,
    // Simple "message X" or "contact X"
    /(?:message|contact|reach|ping) (\w+)$/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const targetName = match[1].toLowerCase();
      
      // First check registered users (real users including demo users)
      const registeredUsers = getAllRegisteredUsers();
      const realUser = registeredUsers.find(u =>
        u.id !== excludeUserId && 
        (u.name.toLowerCase().includes(targetName) || 
         u.daemonName.toLowerCase().includes(targetName))
      );
      if (realUser) {
        return { target: realUser.name, topic: message };
      }
      
      // Fall back to mock users for testing
      const mockUsers = getMockOtherUsers();
      const mockUser = mockUsers.find(u =>
        u.name.toLowerCase().includes(targetName) ||
        u.daemonName.toLowerCase().includes(targetName)
      );
      if (mockUser) {
        return { target: mockUser.name, topic: message };
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
    const negotiationReq = detectNegotiationRequest(lastMessage, userId);
    console.log(`[CHAT] Message from ${session.user.name} (${userId}):`, lastMessage.slice(0, 100));
    console.log(`[CHAT] Negotiation detected:`, negotiationReq);
    
    if (negotiationReq) {
      console.log(`[CHAT] Starting negotiation with target: "${negotiationReq.target}"`);
      try {
        const result = await runNegotiation({
          userId,
          userName: session.user.name || 'User',
          userPanName: daemonName,
          targetPersonName: negotiationReq.target,
          topic: negotiationReq.topic,
          userMessage: lastMessage,
        });

        // Build a conversational summary of what happened
        const otherPan = result.target.daemonName;
        const otherName = result.target.name;
        
        // Get the last substantive message from the other Pan (their response)
        const otherPanMessages = result.messages.filter(m => m.fromUserId !== userId);
        const lastOtherMessage = otherPanMessages[otherPanMessages.length - 1];
        
        // Build a natural, conversational summary
        let summary: string;
        
        if (result.status === 'completed' && result.outcome) {
          // Successful coordination - focus on the outcome
          if (lastOtherMessage) {
            summary = `I talked to ${otherName}'s ${otherPan}. ${lastOtherMessage.content}\n\n**Result:** ${result.outcome}`;
          } else {
            summary = `I coordinated with ${otherName}'s ${otherPan}. ${result.outcome}`;
          }
        } else if (result.status === 'failed') {
          summary = `I tried to reach ${otherName}'s ${otherPan}, but we couldn't come to an agreement. ${result.outcome || 'You might want to reach out directly.'}`;
        } else {
          // In progress or other - just report what happened
          if (lastOtherMessage) {
            summary = `I talked to ${otherName}'s ${otherPan}. Here's what they said:\n\n"${lastOtherMessage.content}"`;
          } else {
            summary = `I reached out to ${otherName}'s ${otherPan}. The conversation is ongoing.`;
          }
        }
        
        summary += `\n\n◎ [View full conversation in Pan Syncs](/spectator)`;

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

    // Retrieve only the most relevant context via vector similarity
    const workContext = await searchContexts(userId, lastMessage);

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

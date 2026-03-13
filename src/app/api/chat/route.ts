import { auth } from '@/lib/auth';
import { streamDaemonChat } from '@/lib/ai/daemon';
import { getMockWorkContext } from '@/lib/mock/work-context';
import type { AIMessage, AIProvider } from '@/lib/ai/providers';

interface ClientMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
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

    // Use session data or defaults for testing
    const userId = session.user.id;
    const daemonName = session.user.daemonName || 'Pan';
    const personality = session.user.daemonPersonality || 'supportive';
    const privacyLevel = session.user.privacyLevel || 'balanced';
    
    // Use Ollama for local testing, fallback to configured provider
    const provider: AIProvider = process.env.OPENAI_API_KEY 
      ? 'openai' 
      : process.env.ANTHROPIC_API_KEY 
        ? 'anthropic' 
        : 'ollama';

    // Get mock work context for rich responses
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

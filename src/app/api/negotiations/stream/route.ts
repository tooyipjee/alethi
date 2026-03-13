import { auth } from '@/lib/auth';
import { getUserNegotiations, addUpdateListener } from '@/lib/negotiations/store';

// Track connected clients per user
const clients = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();

// Set up store listener once
let listenerRegistered = false;

function setupListener() {
  if (listenerRegistered) return;
  listenerRegistered = true;

  addUpdateListener((userIds) => {
    const encoder = new TextEncoder();
    for (const userId of userIds) {
      const controllers = clients.get(userId);
      if (controllers) {
        const negotiations = getUserNegotiations(userId);
        const data = JSON.stringify({
          type: 'update',
          negotiations: negotiations.map(n => ({
            ...n,
            isInitiator: n.initiator.id === userId,
          })),
        });
        
        const toRemove: ReadableStreamDefaultController<Uint8Array>[] = [];
        for (const controller of controllers) {
          try {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch {
            toRemove.push(controller);
          }
        }
        for (const c of toRemove) {
          controllers.delete(c);
        }
      }
    }
  });
}

export async function GET() {
  setupListener();

  const session = await auth();
  
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;

      // Register this client
      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId)!.add(controller);

      // Send initial data
      const negotiations = getUserNegotiations(userId);
      const initialData = JSON.stringify({
        type: 'init',
        negotiations: negotiations.map(n => ({
          ...n,
          isInitiator: n.initiator.id === userId,
        })),
      });
      controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));

      // Send keepalive every 30s
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          if (keepaliveInterval) clearInterval(keepaliveInterval);
        }
      }, 30000);
    },
    cancel() {
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      if (controllerRef) {
        const controllers = clients.get(userId);
        if (controllers) {
          controllers.delete(controllerRef);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

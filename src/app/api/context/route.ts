import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserContexts, getConnectedSources } from '@/lib/integrations/context-store';
import { buildWorkGraph } from '@/lib/mcp/work-graph';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contexts = getUserContexts(session.user.id);
    const workGraph = buildWorkGraph(contexts);
    const sources = getConnectedSources(session.user.id);

    return NextResponse.json({
      contexts,
      workGraph,
      sources,
    });
  } catch (error) {
    console.error('Context fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

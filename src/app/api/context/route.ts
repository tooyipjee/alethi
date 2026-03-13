import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchGitHubContext, transformGitHubToWorkContext } from '@/lib/mcp/client';
import { getUserWorkContext, buildWorkGraph, refreshWorkContext } from '@/lib/mcp/work-graph';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contexts = await getUserWorkContext(session.user.id);
    const workGraph = buildWorkGraph(contexts);

    return NextResponse.json({
      contexts,
      workGraph,
    });
  } catch (error) {
    console.error('Context fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { source, token } = await request.json();

    if (source === 'github' && token) {
      const githubContext = await fetchGitHubContext(token);
      const workContexts = transformGitHubToWorkContext(session.user.id, githubContext);
      await refreshWorkContext(session.user.id, workContexts);

      return NextResponse.json({
        success: true,
        itemsImported: workContexts.length,
      });
    }

    return NextResponse.json(
      { error: 'Unsupported source or missing token' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Context sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

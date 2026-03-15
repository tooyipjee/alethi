import type { WorkContext, TruthPacket, PrivacyLevel } from '@/types/daemon';
import { db } from '@/lib/db';
import { workContext as workContextTable } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface WorkGraphNode {
  id: string;
  type: 'project' | 'task' | 'document' | 'event';
  title: string;
  summary: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'pending' | 'completed';
  lastUpdated: Date;
  connections: string[];
}

export interface WorkGraph {
  nodes: WorkGraphNode[];
  summary: string;
  topPriorities: string[];
  recentActivity: string[];
}

export async function getUserWorkContext(userId: string): Promise<WorkContext[]> {
  const contexts = await db.query.workContext.findMany({
    where: eq(workContextTable.userId, userId),
    orderBy: [desc(workContextTable.updatedAt)],
    limit: 50,
  });

  return contexts.map(ctx => ({
    id: ctx.id,
    userId: ctx.userId,
    source: ctx.source,
    title: ctx.title,
    summary: ctx.summary,
    data: ctx.data as Record<string, unknown>,
    createdAt: ctx.createdAt,
    updatedAt: ctx.updatedAt,
  }));
}

export function buildWorkGraph(contexts: WorkContext[]): WorkGraph {
  const nodes: WorkGraphNode[] = [];
  const projectMap = new Map<string, WorkGraphNode>();

  for (const ctx of contexts) {
    const data = ctx.data as Record<string, unknown>;
    const type = determineNodeType(data);
    const priority = determinePriority(ctx, data);
    const status = determineStatus(data);

    const node: WorkGraphNode = {
      id: ctx.id,
      type,
      title: ctx.title,
      summary: ctx.summary,
      source: ctx.source,
      priority,
      status,
      lastUpdated: ctx.updatedAt,
      connections: [],
    };

    nodes.push(node);

    if (type === 'project') {
      projectMap.set(ctx.title.toLowerCase(), node);
    }
  }

  for (const node of nodes) {
    for (const [projectName, projectNode] of projectMap) {
      if (node.id !== projectNode.id && node.title.toLowerCase().includes(projectName)) {
        node.connections.push(projectNode.id);
        projectNode.connections.push(node.id);
      }
    }
  }

  const highPriorityNodes = nodes
    .filter(n => n.priority === 'high' && n.status === 'active')
    .slice(0, 3);

  const recentNodes = nodes
    .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
    .slice(0, 5);

  const summary = generateWorkSummary(nodes);

  return {
    nodes,
    summary,
    topPriorities: highPriorityNodes.map(n => n.title),
    recentActivity: recentNodes.map(n => `${n.title} (${n.source})`),
  };
}

function determineNodeType(data: Record<string, unknown>): WorkGraphNode['type'] {
  const type = data.type as string | undefined;
  
  if (type === 'repository' || type === 'project') return 'project';
  if (type === 'pull_request' || type === 'issue' || type === 'task') return 'task';
  if (type === 'document' || type === 'page') return 'document';
  if (type === 'event' || type === 'meeting') return 'event';
  
  return 'task';
}

function determinePriority(ctx: WorkContext, data: Record<string, unknown>): WorkGraphNode['priority'] {
  const labels = (data.labels as string[]) || [];
  const title = ctx.title.toLowerCase();
  
  if (labels.some(l => ['urgent', 'critical', 'p0', 'p1', 'high'].includes(l.toLowerCase()))) {
    return 'high';
  }
  
  if (title.includes('urgent') || title.includes('critical') || title.includes('blocker')) {
    return 'high';
  }
  
  if (labels.some(l => ['p2', 'medium'].includes(l.toLowerCase()))) {
    return 'medium';
  }
  
  return 'low';
}

function determineStatus(data: Record<string, unknown>): WorkGraphNode['status'] {
  const state = data.state as string | undefined;
  
  if (state === 'closed' || state === 'merged' || state === 'done') return 'completed';
  if (state === 'open' || state === 'in_progress') return 'active';
  
  return 'pending';
}

function generateWorkSummary(nodes: WorkGraphNode[]): string {
  const activeCount = nodes.filter(n => n.status === 'active').length;
  const highPriorityCount = nodes.filter(n => n.priority === 'high' && n.status === 'active').length;
  const projectCount = nodes.filter(n => n.type === 'project').length;

  const parts: string[] = [];
  
  if (projectCount > 0) {
    parts.push(`${projectCount} active project${projectCount > 1 ? 's' : ''}`);
  }
  
  if (activeCount > 0) {
    parts.push(`${activeCount} open item${activeCount > 1 ? 's' : ''}`);
  }
  
  if (highPriorityCount > 0) {
    parts.push(`${highPriorityCount} high priority`);
  }

  return parts.length > 0 
    ? `Currently tracking: ${parts.join(', ')}.`
    : 'No active work items tracked.';
}

export function synthesizeTruthPacket(
  workGraph: WorkGraph,
  privacyLevel: PrivacyLevel
): TruthPacket {
  const basePacket: TruthPacket = {
    availability: ['Available during business hours'],
    workloadSummary: '',
    relevantExpertise: [],
  };

  const activeNodes = workGraph.nodes.filter(n => n.status === 'active');
  const highPriorityCount = activeNodes.filter(n => n.priority === 'high').length;

  if (activeNodes.length === 0) {
    basePacket.workloadSummary = 'Currently available for new work';
  } else if (highPriorityCount >= 3) {
    basePacket.workloadSummary = 'Heavy workload with multiple high-priority items';
  } else if (activeNodes.length > 5) {
    basePacket.workloadSummary = 'Moderate workload across multiple projects';
  } else {
    basePacket.workloadSummary = 'Light to moderate workload';
  }

  if (privacyLevel === 'minimal') {
    const projects = workGraph.nodes
      .filter(n => n.type === 'project')
      .slice(0, 2)
      .map(n => n.title.split('/').pop() || n.title);
    basePacket.relevantExpertise = projects;
    // Include brief work summaries even in minimal mode
    basePacket.workItems = workGraph.nodes
      .filter(n => n.type === 'task' || n.type === 'project')
      .slice(0, 3)
      .map(n => n.title);
  } else if (privacyLevel === 'balanced') {
    basePacket.relevantExpertise = workGraph.nodes
      .filter(n => n.type === 'project')
      .slice(0, 3)
      .map(n => n.title);
    basePacket.currentFocus = workGraph.topPriorities[0];
    // Include actual work context summaries for richer negotiation
    basePacket.workItems = workGraph.nodes
      .slice(0, 5)
      .map(n => `${n.title}: ${n.summary || ''}`);
  } else {
    basePacket.relevantExpertise = workGraph.nodes
      .filter(n => n.type === 'project')
      .slice(0, 5)
      .map(n => n.title);
    basePacket.currentFocus = workGraph.topPriorities[0];
    basePacket.lastActiveProject = workGraph.recentActivity[0];
    // Include comprehensive work context for open privacy
    basePacket.workItems = workGraph.nodes
      .slice(0, 8)
      .map(n => `${n.title}: ${n.summary || ''}`);
  }

  return basePacket;
}

export async function refreshWorkContext(
  userId: string,
  contexts: Omit<WorkContext, 'id' | 'embedding'>[]
): Promise<void> {
  for (const ctx of contexts) {
    await db.insert(workContextTable).values({
      userId: ctx.userId,
      source: ctx.source,
      title: ctx.title,
      summary: ctx.summary,
      data: ctx.data,
    }).onConflictDoUpdate({
      target: [workContextTable.userId, workContextTable.title],
      set: {
        summary: ctx.summary,
        data: ctx.data,
        updatedAt: new Date(),
      },
    });
  }
}

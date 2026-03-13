import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ContextSource, WorkContext } from '@/types/daemon';

export interface MCPConnection {
  client: Client;
  transport: StdioClientTransport;
  source: ContextSource;
}

export class MCPManager {
  private connections: Map<ContextSource, MCPConnection> = new Map();

  async connectGitHub(token: string): Promise<void> {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: token,
      },
    });

    const client = new Client(
      { name: 'pan', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.connections.set('github', { client, transport, source: 'github' });
  }

  async disconnect(source: ContextSource): Promise<void> {
    const connection = this.connections.get(source);
    if (connection) {
      await connection.client.close();
      this.connections.delete(source);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const source of this.connections.keys()) {
      await this.disconnect(source);
    }
  }

  getClient(source: ContextSource): Client | undefined {
    return this.connections.get(source)?.client;
  }

  isConnected(source: ContextSource): boolean {
    return this.connections.has(source);
  }

  getConnectedSources(): ContextSource[] {
    return Array.from(this.connections.keys());
  }
}

export interface GitHubContext {
  repos: Array<{
    name: string;
    fullName: string;
    description: string | null;
    url: string;
    updatedAt: string;
  }>;
  pullRequests: Array<{
    title: string;
    number: number;
    state: string;
    repo: string;
    url: string;
    createdAt: string;
  }>;
  issues: Array<{
    title: string;
    number: number;
    state: string;
    repo: string;
    url: string;
    labels: string[];
  }>;
}

export async function fetchGitHubContext(token: string): Promise<GitHubContext> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const [reposRes, eventsRes] = await Promise.all([
    fetch('https://api.github.com/user/repos?sort=updated&per_page=10', { headers }),
    fetch('https://api.github.com/users/me/events?per_page=30', { headers }).catch(() => null),
  ]);

  const repos = reposRes.ok ? await reposRes.json() : [];
  
  const pullRequests: GitHubContext['pullRequests'] = [];
  const issues: GitHubContext['issues'] = [];

  for (const repo of repos.slice(0, 5)) {
    try {
      const [prsRes, issuesRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo.full_name}/pulls?state=open&per_page=5`, { headers }),
        fetch(`https://api.github.com/repos/${repo.full_name}/issues?state=open&per_page=5`, { headers }),
      ]);

      if (prsRes.ok) {
        const prs = await prsRes.json();
        pullRequests.push(...prs.map((pr: { title: string; number: number; state: string; html_url: string; created_at: string }) => ({
          title: pr.title,
          number: pr.number,
          state: pr.state,
          repo: repo.full_name,
          url: pr.html_url,
          createdAt: pr.created_at,
        })));
      }

      if (issuesRes.ok) {
        const issuesData = await issuesRes.json();
        issues.push(...issuesData
          .filter((i: { pull_request?: unknown }) => !i.pull_request)
          .map((issue: { title: string; number: number; state: string; html_url: string; labels: Array<{ name: string }> }) => ({
            title: issue.title,
            number: issue.number,
            state: issue.state,
            repo: repo.full_name,
            url: issue.html_url,
            labels: issue.labels.map((l: { name: string }) => l.name),
          })));
      }
    } catch {
      continue;
    }
  }

  return {
    repos: repos.map((r: { name: string; full_name: string; description: string | null; html_url: string; updated_at: string }) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      url: r.html_url,
      updatedAt: r.updated_at,
    })),
    pullRequests,
    issues,
  };
}

export function transformGitHubToWorkContext(
  userId: string,
  github: GitHubContext
): Omit<WorkContext, 'id' | 'embedding'>[] {
  const contexts: Omit<WorkContext, 'id' | 'embedding'>[] = [];

  for (const repo of github.repos.slice(0, 5)) {
    contexts.push({
      userId,
      source: 'github',
      title: repo.name,
      summary: repo.description || `Active repository: ${repo.fullName}`,
      data: { type: 'repository', ...repo },
      createdAt: new Date(),
      updatedAt: new Date(repo.updatedAt),
    });
  }

  for (const pr of github.pullRequests.slice(0, 10)) {
    contexts.push({
      userId,
      source: 'github',
      title: `PR: ${pr.title}`,
      summary: `Open pull request #${pr.number} in ${pr.repo}`,
      data: { type: 'pull_request', ...pr },
      createdAt: new Date(pr.createdAt),
      updatedAt: new Date(pr.createdAt),
    });
  }

  for (const issue of github.issues.slice(0, 10)) {
    contexts.push({
      userId,
      source: 'github',
      title: `Issue: ${issue.title}`,
      summary: `Open issue #${issue.number} in ${issue.repo}${issue.labels.length > 0 ? ` [${issue.labels.join(', ')}]` : ''}`,
      data: { type: 'issue', ...issue },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return contexts;
}

export const mcpManager = new MCPManager();

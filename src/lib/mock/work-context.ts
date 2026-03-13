import type { WorkContext } from '@/types/daemon';

export function getMockWorkContext(userId: string): WorkContext[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  return [
    // GitHub PRs
    {
      id: 'gh-pr-1',
      userId,
      source: 'github',
      title: 'PR: Add user authentication flow',
      summary: 'Open pull request #142 in pan-app/frontend - adds OAuth2 login with Google and GitHub providers. 3 approvals, waiting for CI.',
      data: {
        type: 'pull_request',
        number: 142,
        repo: 'pan-app/frontend',
        status: 'open',
        approvals: 3,
        ci_status: 'pending',
      },
      createdAt: yesterday,
      updatedAt: now,
    },
    {
      id: 'gh-pr-2',
      userId,
      source: 'github',
      title: 'PR: Refactor API middleware',
      summary: 'Open pull request #89 in pan-app/backend - breaking change to request validation. Needs review from Sarah.',
      data: {
        type: 'pull_request',
        number: 89,
        repo: 'pan-app/backend',
        status: 'needs_review',
        reviewer_requested: 'sarah',
      },
      createdAt: twoDaysAgo,
      updatedAt: yesterday,
    },

    // Linear Issues
    {
      id: 'lin-1',
      userId,
      source: 'linear',
      title: 'Issue: Performance regression in search',
      summary: 'High priority bug - search response time increased 3x after last deploy. Assigned to you, due Friday.',
      data: {
        type: 'issue',
        id: 'PAN-234',
        priority: 'high',
        status: 'in_progress',
        due: 'Friday',
      },
      createdAt: twoDaysAgo,
      updatedAt: now,
    },
    {
      id: 'lin-2',
      userId,
      source: 'linear',
      title: 'Issue: Design system color tokens',
      summary: 'Medium priority feature - create semantic color tokens for dark/light mode. Blocked waiting on design specs from Alex.',
      data: {
        type: 'issue',
        id: 'PAN-201',
        priority: 'medium',
        status: 'blocked',
        blocked_by: 'Alex (design)',
      },
      createdAt: twoDaysAgo,
      updatedAt: yesterday,
    },
    {
      id: 'lin-3',
      userId,
      source: 'linear',
      title: 'Sprint: Q1 Launch Prep',
      summary: 'Current sprint ends in 4 days. 8/12 issues completed, 2 in progress, 2 blocked.',
      data: {
        type: 'sprint',
        name: 'Q1 Launch Prep',
        progress: '8/12',
        days_remaining: 4,
      },
      createdAt: twoDaysAgo,
      updatedAt: now,
    },

    // Confluence/Notion docs
    {
      id: 'conf-1',
      userId,
      source: 'notion',
      title: 'Doc: API v2 Migration Guide',
      summary: 'You last edited this doc 2 hours ago. Contains breaking changes for the March release. 4 comments pending review.',
      data: {
        type: 'document',
        comments: 4,
        last_edit: '2 hours ago',
      },
      createdAt: twoDaysAgo,
      updatedAt: now,
    },
    {
      id: 'conf-2',
      userId,
      source: 'notion',
      title: 'Doc: Team OKRs Q1',
      summary: 'Quarterly objectives document. Key result "Reduce p95 latency to <200ms" is at 60% progress.',
      data: {
        type: 'document',
        okr_progress: '60%',
      },
      createdAt: twoDaysAgo,
      updatedAt: yesterday,
    },

    // Calendar context
    {
      id: 'cal-1',
      userId,
      source: 'calendar',
      title: 'Meeting: Design Review',
      summary: 'Tomorrow at 2pm with Sarah, Alex, and Mike. Topic: New dashboard wireframes. You have a prep doc to review.',
      data: {
        type: 'meeting',
        time: 'Tomorrow 2pm',
        attendees: ['Sarah', 'Alex', 'Mike'],
        prep_required: true,
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cal-2',
      userId,
      source: 'calendar',
      title: 'Meeting: 1:1 with Manager',
      summary: 'Thursday 10am with Jordan. Agenda items: Q1 performance, project ownership, growth areas.',
      data: {
        type: 'meeting',
        time: 'Thursday 10am',
        attendees: ['Jordan'],
        agenda: ['Q1 performance', 'project ownership', 'growth areas'],
      },
      createdAt: now,
      updatedAt: now,
    },

    // Slack/comms context
    {
      id: 'slack-1',
      userId,
      source: 'slack',
      title: 'DM from Sarah',
      summary: 'Sarah mentioned you in #engineering about the API changes. She has questions about backward compatibility.',
      data: {
        type: 'mention',
        from: 'Sarah',
        channel: '#engineering',
        urgency: 'medium',
      },
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getMockOtherUsers() {
  return [
    {
      id: 'user-sarah',
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      daemonName: 'Stella',
      role: 'Senior Engineer',
      workContext: [
        {
          title: 'Working on: Frontend performance',
          summary: 'Leading the performance optimization initiative',
        },
        {
          title: 'Available: Afternoons best',
          summary: 'Deep work mornings, meetings afternoons',
        },
      ],
    },
    {
      id: 'user-alex',
      name: 'Alex Rivera',
      email: 'alex@example.com',
      daemonName: 'Atlas',
      role: 'Design Lead',
      workContext: [
        {
          title: 'Working on: Design system v2',
          summary: 'Finalizing color tokens and component specs',
        },
        {
          title: 'Status: Partially blocked',
          summary: 'Waiting on brand guidelines approval',
        },
      ],
    },
    {
      id: 'user-mike',
      name: 'Mike Johnson',
      email: 'mike@example.com',
      daemonName: 'Mercury',
      role: 'Backend Engineer',
      workContext: [
        {
          title: 'Working on: API v2 migration',
          summary: 'Database schema changes and endpoint updates',
        },
        {
          title: 'Available: Flexible',
          summary: 'Can accommodate most meeting times',
        },
      ],
    },
  ];
}

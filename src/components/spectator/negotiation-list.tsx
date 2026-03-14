'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Participant {
  id: string;
  name: string;
  daemonName: string;
}

interface NegotiationSummary {
  id: string;
  topic: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  initiator: Participant;
  target: Participant;
  isInitiator: boolean;
  messageCount: number;
}

interface NegotiationListProps {
  negotiations: NegotiationSummary[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

const statusColors: Record<string, string> = {
  pending: 'border-slate-500/30 text-slate-400',
  in_progress: 'border-amber-500/30 text-amber-400',
  completed: 'border-emerald-500/30 text-emerald-400',
  failed: 'border-red-500/30 text-red-400',
  cancelled: 'border-slate-500/30 text-slate-400',
};

export function NegotiationList({ negotiations, selectedId, onSelect }: NegotiationListProps) {
  if (negotiations.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-8 text-center">
          <p className="text-slate-400">No syncs yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Start a sync to see your Pans in action
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {negotiations.map((neg) => {
        const otherParty = neg.isInitiator ? neg.target : neg.initiator;
        
        return (
          <Card
            key={neg.id}
            className={cn(
              'bg-slate-900/50 border-slate-800 cursor-pointer transition-colors',
              selectedId === neg.id
                ? 'border-amber-500/50 bg-amber-500/5'
                : 'hover:border-slate-700 hover:bg-slate-800/50'
            )}
            onClick={() => onSelect(neg.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-slate-100 truncate">
                      {neg.topic}
                    </h3>
                    {neg.status === 'in_progress' && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    with {otherParty.daemonName} ({otherParty.name})
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className={cn('text-xs', statusColors[neg.status])}
                    >
                      {neg.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {neg.messageCount} message{neg.messageCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-500">
                    {formatRelativeTime(neg.updatedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

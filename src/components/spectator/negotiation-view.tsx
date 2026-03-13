'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NegotiationMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  intent: string;
  content: string;
  createdAt: string;
}

interface Participant {
  id: string;
  name: string;
  daemonName: string;
}

interface NegotiationData {
  id: string;
  topic: string;
  status: string;
  outcome?: string;
  createdAt: string;
  initiator: Participant;
  target: Participant;
  messages: NegotiationMessage[];
  isInitiator: boolean;
}

interface NegotiationViewProps {
  negotiation: NegotiationData;
  currentUserId: string;
  onIntervene?: (action: string) => void;
}

const intentColors: Record<string, string> = {
  request: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  propose: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  accept: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  counter: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  decline: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const intentLabels: Record<string, string> = {
  request: 'Requesting',
  propose: 'Proposing',
  accept: 'Accepted',
  counter: 'Counter-offer',
  decline: 'Declined',
};

export function NegotiationView({ negotiation, currentUserId, onIntervene }: NegotiationViewProps) {
  const [isLive, setIsLive] = useState(negotiation.status === 'in_progress');
  
  const myDaemon = negotiation.isInitiator ? negotiation.initiator : negotiation.target;
  const otherDaemon = negotiation.isInitiator ? negotiation.target : negotiation.initiator;

  return (
    <Card className="bg-slate-900/50 border-slate-800 h-full">
      <CardHeader className="border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              {negotiation.topic}
              {isLive && (
                <span className="flex items-center gap-1.5 text-xs font-normal text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1">
              {myDaemon.daemonName} ↔ {otherDaemon.daemonName}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              negotiation.status === 'completed' && 'border-emerald-500/30 text-emerald-400',
              negotiation.status === 'failed' && 'border-red-500/30 text-red-400',
              negotiation.status === 'in_progress' && 'border-amber-500/30 text-amber-400'
            )}
          >
            {negotiation.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 divide-x divide-slate-800">
          <div className="p-4 bg-slate-900/30">
            <div className="flex items-center gap-2 mb-4">
              <Avatar className="h-8 w-8 border border-amber-500/30">
                <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900 text-sm font-semibold">
                  {myDaemon.daemonName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-slate-100">{myDaemon.daemonName}</p>
                <p className="text-xs text-slate-400">Your Dæmon</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-800/30">
            <div className="flex items-center gap-2 mb-4">
              <Avatar className="h-8 w-8 border border-slate-600">
                <AvatarFallback className="bg-slate-700 text-slate-300 text-sm font-semibold">
                  {otherDaemon.daemonName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-slate-100">{otherDaemon.daemonName}</p>
                <p className="text-xs text-slate-400">{otherDaemon.name}&apos;s Dæmon</p>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[400px] p-4">
          <div className="space-y-4">
            {negotiation.messages.map((message, index) => {
              const isFromMyDaemon = message.fromUserId === currentUserId;
              const speaker = isFromMyDaemon ? myDaemon : otherDaemon;

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    isFromMyDaemon ? 'flex-row' : 'flex-row-reverse'
                  )}
                >
                  <div
                    className={cn(
                      'flex-1 max-w-[80%] rounded-xl p-4',
                      isFromMyDaemon
                        ? 'bg-amber-500/10 border border-amber-500/20'
                        : 'bg-slate-800/50 border border-slate-700'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-slate-200">
                        {speaker.daemonName}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', intentColors[message.intent])}
                      >
                        {intentLabels[message.intent] || message.intent}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {negotiation.outcome && (
          <div className="p-4 border-t border-slate-800 bg-slate-800/30">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-slate-100">Outcome:</span> {negotiation.outcome}
            </p>
          </div>
        )}

        {negotiation.status === 'in_progress' && onIntervene && (
          <div className="p-4 border-t border-slate-800 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onIntervene('approve')}
              className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              Approve & Continue
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onIntervene('intervene')}
              className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              Intervene
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onIntervene('cancel')}
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

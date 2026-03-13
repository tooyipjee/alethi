'use client';

import { useState, useEffect, useCallback } from 'react';

interface NegotiationMessage {
  id: string;
  fromUserId: string;
  fromPanName: string;
  toPanName: string;
  intent: string;
  content: string;
  createdAt: string;
}

interface Negotiation {
  id: string;
  topic: string;
  status: string;
  outcome?: string;
  initiator: { id: string; name: string; daemonName: string };
  target: { id: string; name: string; daemonName: string };
  messages: NegotiationMessage[];
  isInitiator: boolean;
  createdAt: string;
}

export default function SpectatorPage() {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNegotiations = useCallback(async () => {
    try {
      const res = await fetch('/api/negotiations');
      if (res.ok) {
        const data = await res.json();
        setNegotiations(data.negotiations || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNegotiations();
    const interval = setInterval(fetchNegotiations, 5000);
    return () => clearInterval(interval);
  }, [fetchNegotiations]);

  const selected = negotiations.find(n => n.id === selectedId);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="h-14 px-6 flex items-center border-b border-neutral-900 bg-black shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
            <span className="text-[14px]">◎</span>
          </div>
          <div>
            <p className="text-[14px] font-medium">Pan Channels</p>
            <p className="text-[11px] text-neutral-500">
              {negotiations.length} negotiation{negotiations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* List */}
        <div className="w-72 border-r border-neutral-900 overflow-y-auto shrink-0">
          <div className="p-4">
            {isLoading ? (
              <p className="text-[13px] text-neutral-500 px-3 py-8 text-center">Loading...</p>
            ) : negotiations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-[15px] font-medium mb-2">No negotiations yet</p>
                <p className="text-[13px] text-neutral-500 leading-relaxed">
                  Go to your Pan and say something like
                  &quot;Talk to Sarah&apos;s Pan about the design review&quot;
                  to start a Pan-to-Pan negotiation.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {negotiations.map((n) => {
                  const statusColor = n.status === 'completed'
                    ? 'bg-emerald-500' : n.status === 'failed'
                    ? 'bg-red-500' : 'bg-amber-500';
                  return (
                    <button
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                        selectedId === n.id
                          ? 'bg-neutral-900'
                          : 'hover:bg-neutral-950'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                        <p className="text-[13px] font-medium truncate flex-1">
                          {n.initiator.daemonName} ↔ {n.target.daemonName}
                        </p>
                      </div>
                      <p className="text-[12px] text-neutral-500 truncate pl-3.5">
                        {n.topic.length > 50 ? n.topic.slice(0, 50) + '...' : n.topic}
                      </p>
                      <p className="text-[11px] text-neutral-600 mt-1 pl-3.5">
                        {n.messages.length} message{n.messages.length !== 1 ? 's' : ''} · {n.status}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {selected ? (
            <div className="max-w-2xl mx-auto p-6">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${
                    selected.status === 'completed' ? 'bg-emerald-500'
                    : selected.status === 'failed' ? 'bg-red-500'
                    : 'bg-amber-500'
                  }`} />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider">
                    {selected.status}
                  </p>
                </div>
                <h2 className="text-[18px] font-semibold mb-1">
                  {selected.initiator.daemonName} ↔ {selected.target.daemonName}
                </h2>
                <p className="text-[13px] text-neutral-400">
                  {selected.initiator.name}&apos;s Pan negotiating with {selected.target.name}&apos;s Pan
                </p>
              </div>

              <div className="space-y-6">
                {selected.messages.map((m) => {
                  const isYours = m.fromUserId === (selected.isInitiator ? selected.initiator.id : selected.target.id);
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isYours ? 'bg-neutral-800' : 'bg-neutral-900'
                      }`}>
                        <span className="text-[12px]">◉</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-medium">{m.fromPanName}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                            m.intent === 'accept' ? 'bg-emerald-500/10 text-emerald-400' :
                            m.intent === 'decline' ? 'bg-red-500/10 text-red-400' :
                            m.intent === 'propose' ? 'bg-blue-500/10 text-blue-400' :
                            m.intent === 'counter' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-neutral-800 text-neutral-400'
                          }`}>
                            {m.intent}
                          </span>
                        </div>
                        <p className="text-[14px] text-neutral-300 leading-relaxed break-words">{m.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selected.outcome && (
                <div className="mt-8 p-4 bg-neutral-950 rounded-lg border border-neutral-900">
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Outcome</p>
                  <p className="text-[14px] text-neutral-300">{selected.outcome}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-[14px] text-neutral-500 mb-2">
                  {negotiations.length > 0
                    ? 'Select a negotiation to view'
                    : 'No Pan-to-Pan conversations yet'}
                </p>
                {negotiations.length === 0 && (
                  <p className="text-[12px] text-neutral-600">
                    Ask your Pan to talk to someone
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';

interface Negotiation {
  id: string;
  topic: string;
  status: string;
  outcome?: string;
  initiator: { id: string; name: string; daemonName: string };
  target: { id: string; name: string; daemonName: string };
  messages: Array<{
    id: string;
    fromUserId: string;
    intent: string;
    content: string;
  }>;
  isInitiator: boolean;
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
  }, [fetchNegotiations]);

  const selected = negotiations.find(n => n.id === selectedId);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-14 px-6 flex items-center border-b border-neutral-900 bg-black">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
            <span className="text-[14px]">◎</span>
          </div>
          <div>
            <p className="text-[14px] font-medium">Pan Channels</p>
            <p className="text-[11px] text-neutral-500">Pan-to-Pan negotiations</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="w-72 border-r border-neutral-900 overflow-y-auto">
          <div className="p-4">
            {isLoading ? (
              <p className="text-[13px] text-neutral-500 px-3">Loading...</p>
            ) : negotiations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-[13px] text-neutral-500 mb-2">No negotiations</p>
                <p className="text-[12px] text-neutral-600">
                  When your Pan talks to other Pans, you&apos;ll see it here
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {negotiations.map((n) => {
                  const other = n.isInitiator ? n.target : n.initiator;
                  return (
                    <button
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                        selectedId === n.id
                          ? 'bg-neutral-900'
                          : 'hover:bg-neutral-950'
                      }`}
                    >
                      <p className="text-[13px] font-medium truncate mb-0.5">{n.topic}</p>
                      <p className="text-[11px] text-neutral-500">
                        with {other.daemonName || other.name}&apos;s Pan
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div className="max-w-2xl mx-auto p-6">
              <div className="mb-6">
                <p className="text-[11px] text-neutral-600 uppercase tracking-wider mb-2">
                  Negotiation
                </p>
                <h2 className="text-[20px] font-semibold mb-1">{selected.topic}</h2>
                <p className="text-[13px] text-neutral-500">
                  Your Pan ↔ {selected.isInitiator ? selected.target.daemonName : selected.initiator.daemonName}&apos;s Pan
                </p>
              </div>

              <div className="space-y-6">
                {selected.messages.map((m) => {
                  const isYours = m.fromUserId === (selected.isInitiator ? selected.initiator.id : selected.target.id);
                  const panName = isYours 
                    ? (selected.isInitiator ? selected.initiator.daemonName : selected.target.daemonName)
                    : (selected.isInitiator ? selected.target.daemonName : selected.initiator.daemonName);
                  
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isYours ? 'bg-neutral-800' : 'bg-neutral-900'
                      }`}>
                        <span className="text-[12px]">◉</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-medium">{panName}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide ${
                            m.intent === 'accept' ? 'bg-emerald-500/10 text-emerald-400' :
                            m.intent === 'decline' ? 'bg-red-500/10 text-red-400' :
                            m.intent === 'propose' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-neutral-800 text-neutral-400'
                          }`}>
                            {m.intent}
                          </span>
                        </div>
                        <p className="text-[14px] text-neutral-300 leading-relaxed">{m.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selected.outcome && (
                <div className="mt-8 p-4 bg-neutral-950 rounded-lg border border-neutral-900">
                  <p className="text-[11px] text-neutral-600 uppercase tracking-wider mb-1">Outcome</p>
                  <p className="text-[14px]">{selected.outcome}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-[14px] text-neutral-600">Select a negotiation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

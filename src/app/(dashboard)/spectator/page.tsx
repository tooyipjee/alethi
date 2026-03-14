'use client';

import { useState, useEffect, useCallback } from 'react';
import { StartNegotiation } from '@/components/spectator/start-negotiation';
import { useNegotiationsStream } from '@/hooks/use-negotiations-stream';

interface PanUser {
  id: string;
  name: string;
  daemonName: string;
  image?: string;
}

export default function SpectatorPage() {
  const { negotiations: streamNegotiations, isConnected, reconnect } = useNegotiationsStream();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [users, setUsers] = useState<PanUser[]>([]);
  const [fallbackNegotiations, setFallbackNegotiations] = useState<typeof streamNegotiations>([]);

  // Use stream negotiations if available, otherwise use fallback
  const negotiations = streamNegotiations.length > 0 ? streamNegotiations : fallbackNegotiations;

  const fetchNegotiations = useCallback(async () => {
    try {
      const res = await fetch('/api/negotiations');
      if (res.ok) {
        const data = await res.json();
        if (data.negotiations) {
          setFallbackNegotiations(data.negotiations);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchNegotiations();
    // Poll every 5 seconds as backup
    const interval = setInterval(fetchNegotiations, 5000);
    return () => clearInterval(interval);
  }, [fetchUsers, fetchNegotiations]);

  const selected = negotiations.find(n => n.id === selectedId);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="h-14 px-6 md:px-6 pl-16 md:pl-6 flex items-center justify-between border-b border-neutral-900 bg-black shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
            <span className="text-[14px]">◎</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-medium truncate">Pan Channels</p>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            </div>
            <p className="text-[11px] text-neutral-500 truncate">
              {negotiations.length} negotiation{negotiations.length !== 1 ? 's' : ''} · {isConnected ? 'live' : 'reconnecting...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isConnected && (
            <button
              onClick={reconnect}
              className="hidden sm:block px-3 py-1.5 text-[12px] text-neutral-400 hover:text-white transition-colors"
            >
              Reconnect
            </button>
          )}
          <StartNegotiation onSuccess={fetchUsers} />
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* List */}
        <div className="w-72 border-r border-neutral-900 overflow-y-auto shrink-0">
          <div className="p-4">
            {negotiations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <p className="text-[14px] font-medium mb-2">No negotiations yet</p>
                <p className="text-[12px] text-neutral-500 leading-relaxed">
                  Click "New Negotiation" above or ask your Pan to talk to someone.
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
                  const isInitiatorMsg = m.fromPanName === selected.initiator.daemonName;
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isInitiatorMsg ? 'bg-neutral-800' : 'bg-neutral-900'
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
            <div className="p-6">
              <div className="max-w-md mx-auto">
                <h3 className="text-[15px] font-medium mb-1">Other Pans</h3>
                <p className="text-[12px] text-neutral-500 mb-4">
                  These users are available for Pan-to-Pan negotiations
                </p>
                
                {users.length === 0 ? (
                  <div className="text-center py-12 px-4 border border-neutral-900 rounded-lg">
                    <p className="text-[14px] text-neutral-400 mb-2">No other users yet</p>
                    <p className="text-[12px] text-neutral-600">
                      Invite someone to sign up and connect with their Pan
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border border-neutral-900 rounded-lg hover:bg-neutral-950 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
                            <span className="text-[14px]">◉</span>
                          </div>
                          <div>
                            <p className="text-[13px] font-medium">{user.name}</p>
                            <p className="text-[11px] text-neutral-500">{user.daemonName}</p>
                          </div>
                        </div>
                        <StartNegotiation 
                          onSuccess={fetchUsers} 
                          initialTarget={user}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

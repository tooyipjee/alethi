'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StartNegotiation } from '@/components/spectator/start-negotiation';
import { useNegotiationsStream } from '@/hooks/use-negotiations-stream';

interface PanUser {
  id: string;
  name: string;
  daemonName: string;
  image?: string;
}

interface TruthPacket {
  availability: string[];
  workloadSummary: string;
  relevantExpertise: string[];
  currentFocus?: string;
  lastActiveProject?: string;
}

interface SharedContext {
  initiator: {
    userId: string;
    truthPacket: TruthPacket;
    privacyLevel: string;
  };
  target: {
    userId: string;
    truthPacket: TruthPacket;
    privacyLevel: string;
  };
}

function formatTime(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TypingIndicator({ names }: { names: string[] }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-[12px] text-neutral-500">
        {names.join(' and ')} {names.length === 1 ? 'is' : 'are'} syncing...
      </span>
    </div>
  );
}

function ChatMessage({ 
  message, 
  showAvatar,
  isFirstInGroup,
  negotiation
}: { 
  message: {
    id: string;
    fromPanName: string;
    toPanName: string;
    intent: string;
    content: string;
    createdAt: string;
  };
  showAvatar: boolean;
  isFirstInGroup: boolean;
  negotiation: {
    initiator: { daemonName: string; name: string };
    target: { daemonName: string; name: string };
  };
}) {
  const isInitiator = message.fromPanName === negotiation.initiator.daemonName;
  const ownerName = isInitiator ? negotiation.initiator.name : negotiation.target.name;
  const daemonName = isInitiator ? negotiation.initiator.daemonName : negotiation.target.daemonName;
  const avatarColor = isInitiator ? 'bg-blue-600' : 'bg-purple-600';
  const initial = ownerName.charAt(0).toUpperCase();

  return (
    <div className={`flex gap-3 px-4 hover:bg-neutral-900/30 ${isFirstInGroup ? 'pt-3' : 'pt-0.5'}`}>
      {showAvatar ? (
        <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center shrink-0`}>
          <span className="text-[14px] font-semibold text-white">{initial}</span>
        </div>
      ) : (
        <div className="w-10 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        {isFirstInGroup && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[14px] font-semibold text-white">{ownerName}</span>
            <span className="text-[11px] text-neutral-500">{daemonName}</span>
            <span className="text-[11px] text-neutral-600">{formatTime(message.createdAt)}</span>
          </div>
        )}
        <div className="text-[14px] text-neutral-200 leading-relaxed">
          {message.content}
        </div>
      </div>
    </div>
  );
}

function SharedContextDisplay({ 
  sharedContext, 
  initiatorName, 
  targetName 
}: { 
  sharedContext: SharedContext; 
  initiatorName: string;
  targetName: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mx-4 mt-4 p-3 bg-neutral-900/50 rounded-lg border border-neutral-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-[12px] text-neutral-400">
          Context shared between Pans
        </span>
        <span className="text-[11px] text-neutral-600">
          {expanded ? '▼' : '▶'}
        </span>
      </button>
      
      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="p-2 bg-neutral-950 rounded">
            <p className="text-[11px] text-neutral-500 mb-1.5">
              {initiatorName} ({sharedContext.initiator.privacyLevel})
            </p>
            <ul className="space-y-0.5 text-[11px] text-neutral-500">
              {sharedContext.initiator.truthPacket.availability.length > 0 && (
                <li>• {sharedContext.initiator.truthPacket.availability.length} time slots</li>
              )}
              {sharedContext.initiator.truthPacket.workloadSummary && (
                <li>• Workload</li>
              )}
              {sharedContext.initiator.truthPacket.relevantExpertise.length > 0 && (
                <li>• {sharedContext.initiator.truthPacket.relevantExpertise.length} expertise</li>
              )}
            </ul>
          </div>
          <div className="p-2 bg-neutral-950 rounded">
            <p className="text-[11px] text-neutral-500 mb-1.5">
              {targetName} ({sharedContext.target.privacyLevel})
            </p>
            <ul className="space-y-0.5 text-[11px] text-neutral-500">
              {sharedContext.target.truthPacket.availability.length > 0 && (
                <li>• {sharedContext.target.truthPacket.availability.length} time slots</li>
              )}
              {sharedContext.target.truthPacket.workloadSummary && (
                <li>• Workload</li>
              )}
              {sharedContext.target.truthPacket.relevantExpertise.length > 0 && (
                <li>• {sharedContext.target.truthPacket.relevantExpertise.length} expertise</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SpectatorPage() {
  const { negotiations: streamNegotiations, isConnected, reconnect } = useNegotiationsStream();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [users, setUsers] = useState<PanUser[]>([]);
  const [fallbackNegotiations, setFallbackNegotiations] = useState<typeof streamNegotiations>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isSending, setIsSending] = useState(false);

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

  const handleFollowUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || !selectedId || isSending) return;

    const selected = negotiations.find(n => n.id === selectedId);
    if (!selected) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/negotiations/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negotiationId: selectedId,
          message: followUpInput.trim(),
        }),
      });
      
      if (res.ok) {
        setFollowUpInput('');
        // The SSE stream will pick up the new messages
      }
    } catch (err) {
      console.error('Failed to send follow-up:', err);
    } finally {
      setIsSending(false);
    }
  }, [followUpInput, selectedId, isSending, negotiations]);

  useEffect(() => {
    fetchUsers();
    fetchNegotiations();
    const interval = setInterval(fetchNegotiations, 5000);
    return () => clearInterval(interval);
  }, [fetchUsers, fetchNegotiations]);

  const selected = negotiations.find(n => n.id === selectedId);
  const selectedMessagesLength = selected?.messages.length ?? 0;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (selected && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedMessagesLength, selected]);

  // Auto-select first negotiation if none selected
  useEffect(() => {
    if (!selectedId && negotiations.length > 0) {
      setSelectedId(negotiations[0].id);
    }
  }, [selectedId, negotiations]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
      {/* Header */}
      <div className="h-12 px-4 md:px-4 pl-14 md:pl-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-900 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">@</span>
          <span className="text-[14px] font-semibold">Conversations</span>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
        </div>
        <div className="flex items-center gap-2">
          {!isConnected && (
            <button
              onClick={reconnect}
              className="text-[12px] text-neutral-400 hover:text-white"
            >
              Reconnect
            </button>
          )}
          <StartNegotiation onSuccess={fetchUsers} />
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Channel list */}
        <div className="w-60 border-r border-neutral-800 bg-neutral-900 overflow-y-auto shrink-0">
          <div className="p-2">
            <p className="px-2 py-1.5 text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
              Recent
            </p>
            {negotiations.length === 0 ? (
              <p className="px-2 py-4 text-[12px] text-neutral-600 text-center">
                No conversations yet
              </p>
            ) : (
              <div className="space-y-0.5">
                {negotiations.map((n) => {
                  const isActive = n.status === 'in_progress';
                  return (
                    <button
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
                        selectedId === n.id
                          ? 'bg-neutral-700/50 text-white'
                          : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center shrink-0">
                        <span className="text-[10px]">{n.target.name.charAt(0)}</span>
                      </div>
                      <span className="text-[13px] truncate flex-1">
                        {n.target.name}
                      </span>
                      {isActive && (
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                      {n.status === 'completed' && (
                        <span className="text-[10px] text-emerald-500">✓</span>
                      )}
                      {n.status === 'failed' && (
                        <span className="text-[10px] text-red-500">✕</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4">
              <p className="px-2 py-1.5 text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                Online Users
              </p>
              {users.length === 0 ? (
                <p className="px-2 py-2 text-[12px] text-neutral-600">No users online</p>
              ) : (
                <div className="space-y-0.5">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-800/50"
                    >
                      <div className="relative">
                        <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center">
                          <span className="text-[10px]">{user.name.charAt(0)}</span>
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-900" />
                      </div>
                      <p className="text-[12px] text-neutral-300 truncate">{user.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          {selected ? (
            <>
              {/* Channel header */}
              <div className="h-12 px-4 flex items-center gap-3 border-b border-neutral-800 shrink-0">
                <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                  <span className="text-[12px] font-medium">{selected.target.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">
                    {selected.target.name}
                  </p>
                  <p className="text-[11px] text-neutral-500 truncate">
                    {selected.topic}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    selected.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    selected.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {selected.status === 'in_progress' ? 'LIVE' : selected.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                {/* Topic banner */}
                <div className="px-4 py-6 border-b border-neutral-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-[18px] font-bold text-white">{selected.target.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h2 className="text-[20px] font-bold">
                        {selected.target.name}
                      </h2>
                      <p className="text-[13px] text-neutral-400">
                        {selected.topic}
                      </p>
                    </div>
                  </div>
                  <p className="text-[12px] text-neutral-500 mt-1">
                    Started {formatDate(selected.createdAt)} at {formatTime(selected.createdAt)}
                  </p>
                </div>

                {/* Message list */}
                <div className="pb-4">
                  {selected.messages.map((msg, idx) => {
                    const prevMsg = selected.messages[idx - 1];
                    const isFirstInGroup = !prevMsg || prevMsg.fromPanName !== msg.fromPanName;
                    
                    return (
                      <ChatMessage
                        key={msg.id}
                        message={msg}
                        showAvatar={isFirstInGroup}
                        isFirstInGroup={isFirstInGroup}
                        negotiation={selected}
                      />
                    );
                  })}

                  {/* Typing indicator when in progress */}
                  {selected.status === 'in_progress' && (
                    <TypingIndicator names={[selected.initiator.name, selected.target.name]} />
                  )}

                  {/* Outcome */}
                  {selected.outcome && (
                    <div className="mx-4 mt-4 p-3 rounded-lg border border-neutral-800 bg-neutral-900/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[12px] ${
                          selected.status === 'completed' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {selected.status === 'completed' ? '✓ Agreement Reached' : '✕ Declined'}
                        </span>
                      </div>
                      <p className="text-[13px] text-neutral-300">{selected.outcome}</p>
                    </div>
                  )}

                  {/* Shared context */}
                  {selected.sharedContext && (
                    <SharedContextDisplay
                      sharedContext={selected.sharedContext}
                      initiatorName={selected.initiator.name}
                      targetName={selected.target.name}
                    />
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Follow-up input */}
              <div className="p-4 border-t border-neutral-800 shrink-0">
                <form onSubmit={handleFollowUp} className="flex gap-2">
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    placeholder={`Continue the conversation with ${selected.target.name}...`}
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-[14px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
                    disabled={isSending}
                  />
                  <button
                    type="submit"
                    disabled={!followUpInput.trim() || isSending}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg text-[14px] font-medium transition-colors"
                  >
                    {isSending ? '...' : 'Send'}
                  </button>
                </form>
                <p className="text-[11px] text-neutral-600 mt-2">
                  Continue the conversation
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[28px] text-neutral-600">@</span>
                </div>
                <p className="text-[15px] text-neutral-400 mb-1">Select a conversation</p>
                <p className="text-[13px] text-neutral-600">
                  or start a new one from the sidebar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

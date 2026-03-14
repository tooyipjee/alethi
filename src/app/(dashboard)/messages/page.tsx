'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useNegotiationsStream } from '@/hooks/use-negotiations-stream';
import { StartNegotiation } from '@/components/spectator/start-negotiation';

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

interface ConversationThread {
  otherUser: PanUser;
  negotiations: Array<{
    id: string;
    topic: string;
    status: string;
    outcome?: string;
    isInitiator: boolean;
    myDaemonName: string;
    theirDaemonName: string;
    messages: Array<{
      id: string;
      fromPanName: string;
      toPanName: string;
      intent: string;
      content: string;
      isFromMe: boolean;
      createdAt: string;
    }>;
    sharedContext?: SharedContext;
    createdAt: string;
  }>;
  lastActivity: Date;
}

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-[11px] text-neutral-500">{name} is typing...</span>
    </div>
  );
}

function ChatMessage({ 
  message, 
  showAvatar,
  isFirstInGroup,
  fromPanName,
  isFromMe
}: { 
  message: {
    content: string;
    intent: string;
    createdAt: string;
  };
  showAvatar: boolean;
  isFirstInGroup: boolean;
  fromPanName: string;
  isFromMe: boolean;
}) {
  const avatarColor = isFromMe ? 'bg-blue-600' : 'bg-purple-600';
  const initial = fromPanName.charAt(0).toUpperCase();

  const intentColors: Record<string, string> = {
    accept: 'text-emerald-400',
    decline: 'text-red-400',
    propose: 'text-blue-400',
    counter: 'text-amber-400',
    request: 'text-neutral-400',
  };

  return (
    <div className={`flex gap-3 px-4 hover:bg-neutral-900/30 ${isFirstInGroup ? 'pt-3' : 'pt-0.5'}`}>
      {showAvatar ? (
        <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center shrink-0`}>
          <span className="text-[13px] font-semibold text-white">{initial}</span>
        </div>
      ) : (
        <div className="w-9 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        {isFirstInGroup && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[13px] font-semibold text-white">{fromPanName}</span>
            <span className="text-[10px] text-neutral-600">{formatTime(message.createdAt)}</span>
          </div>
        )}
        <div className="text-[13px] text-neutral-200 leading-relaxed">
          <span className={`text-[10px] ${intentColors[message.intent] || 'text-neutral-400'} mr-1`}>
            [{message.intent}]
          </span>
          {message.content}
        </div>
      </div>
    </div>
  );
}

function SharedContextDisplay({ 
  sharedContext, 
  isInitiator, 
  theirName 
}: { 
  sharedContext: SharedContext; 
  isInitiator: boolean;
  theirName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const myContext = isInitiator ? sharedContext.initiator : sharedContext.target;
  const theirContext = isInitiator ? sharedContext.target : sharedContext.initiator;

  return (
    <div className="mx-4 mt-2 p-2 bg-neutral-900/50 rounded border border-neutral-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-[11px] text-neutral-500">Context shared</span>
        <span className="text-[10px] text-neutral-600">{expanded ? '▼' : '▶'}</span>
      </button>
      
      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          <div className="p-1.5 bg-neutral-950 rounded">
            <p className="text-neutral-500 mb-1">You ({myContext.privacyLevel})</p>
            <ul className="text-neutral-600 space-y-0.5">
              {myContext.truthPacket.availability.length > 0 && <li>• Availability</li>}
              {myContext.truthPacket.workloadSummary && <li>• Workload</li>}
              {myContext.truthPacket.relevantExpertise.length > 0 && <li>• Expertise</li>}
            </ul>
          </div>
          <div className="p-1.5 bg-neutral-950 rounded">
            <p className="text-neutral-500 mb-1">{theirName} ({theirContext.privacyLevel})</p>
            <ul className="text-neutral-600 space-y-0.5">
              {theirContext.truthPacket.availability.length > 0 && <li>• Availability</li>}
              {theirContext.truthPacket.workloadSummary && <li>• Workload</li>}
              {theirContext.truthPacket.relevantExpertise.length > 0 && <li>• Expertise</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const { data: session } = useSession();
  const { negotiations: streamNegotiations, isConnected } = useNegotiationsStream();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<PanUser[]>([]);
  const [fallbackNegotiations, setFallbackNegotiations] = useState<typeof streamNegotiations>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Initial fetch and polling - setState is called asynchronously after fetch completes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNegotiations();
    const interval = setInterval(() => void fetchNegotiations(), 5000);
    return () => clearInterval(interval);
  }, [fetchNegotiations]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch { /* ignore */ }
  }, []);

  // Initial user fetch - setState is called asynchronously after fetch completes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUsers();
  }, [fetchUsers]);

  // Group negotiations by the other user
  const threads: ConversationThread[] = [];
  const threadMap = new Map<string, ConversationThread>();

  for (const n of negotiations) {
    const isInitiator = n.initiator.id === session?.user?.id;
    const otherUser = isInitiator ? n.target : n.initiator;
    
    let thread = threadMap.get(otherUser.id);
    if (!thread) {
      thread = {
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          daemonName: otherUser.daemonName,
        },
        negotiations: [],
        lastActivity: new Date(n.updatedAt || n.createdAt),
      };
      threadMap.set(otherUser.id, thread);
      threads.push(thread);
    }

    thread.negotiations.push({
      id: n.id,
      topic: n.topic,
      status: n.status,
      outcome: n.outcome,
      isInitiator,
      myDaemonName: isInitiator ? n.initiator.daemonName : n.target.daemonName,
      theirDaemonName: isInitiator ? n.target.daemonName : n.initiator.daemonName,
      messages: (n.messages || []).map(m => ({
        id: m.id,
        fromPanName: m.fromPanName,
        toPanName: m.toPanName,
        intent: m.intent,
        content: m.content,
        isFromMe: m.fromUserId === session?.user?.id,
        createdAt: m.createdAt,
      })),
      sharedContext: n.sharedContext,
      createdAt: n.createdAt,
    });

    const negDate = new Date(n.updatedAt || n.createdAt);
    if (negDate > thread.lastActivity) {
      thread.lastActivity = negDate;
    }
  }

  threads.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  const selectedThread = selectedUserId ? threadMap.get(selectedUserId) : null;
  const usersWithoutThreads = users.filter(u => !threadMap.has(u.id));
  const selectedThreadMessagesCount = selectedThread?.negotiations.flatMap(n => n.messages).length ?? 0;

  // Auto-scroll to bottom
  useEffect(() => {
    if (selectedThread && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedThreadMessagesCount, selectedThread]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
      {/* Header */}
      <div className="h-12 px-4 md:px-4 pl-14 md:pl-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-900 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">@</span>
          <span className="text-[14px] font-semibold">Direct Messages</span>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
        </div>
        <StartNegotiation onSuccess={fetchUsers} />
      </div>

      <div className="flex-1 flex min-h-0">
        {/* DM list */}
        <div className="w-60 border-r border-neutral-800 bg-neutral-900 overflow-y-auto shrink-0">
          <div className="p-2">
            <p className="px-2 py-1.5 text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
              Direct Messages
            </p>
            {threads.length === 0 ? (
              <p className="px-2 py-4 text-[12px] text-neutral-600 text-center">
                No conversations yet
              </p>
            ) : (
              <div className="space-y-0.5">
                {threads.map((thread) => {
                  const hasActive = thread.negotiations.some(n => n.status === 'in_progress');
                  const lastNeg = thread.negotiations[thread.negotiations.length - 1];
                  return (
                    <button
                      key={thread.otherUser.id}
                      onClick={() => setSelectedUserId(thread.otherUser.id)}
                      className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
                        selectedUserId === thread.otherUser.id
                          ? 'bg-neutral-700/50 text-white'
                          : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                      }`}
                    >
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                          <span className="text-[12px] font-medium">{thread.otherUser.name.charAt(0)}</span>
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-900" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate">{thread.otherUser.name}</p>
                        <p className="text-[10px] text-neutral-600 truncate">
                          {thread.otherUser.daemonName} · {thread.negotiations.length} thread{thread.negotiations.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {hasActive && (
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
                      )}
                      {!hasActive && lastNeg?.status === 'completed' && (
                        <span className="text-[9px] text-emerald-500 shrink-0">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {usersWithoutThreads.length > 0 && (
              <div className="mt-4">
                <p className="px-2 py-1.5 text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                  Start Conversation
                </p>
                <div className="space-y-0.5">
                  {usersWithoutThreads.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
                        selectedUserId === user.id
                          ? 'bg-neutral-700/50 text-white'
                          : 'text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center">
                        <span className="text-[10px]">{user.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] truncate">{user.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedThread ? (
            <>
              {/* DM header */}
              <div className="h-12 px-4 flex items-center gap-3 border-b border-neutral-800 shrink-0">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                    <span className="text-[12px] font-medium">{selectedThread.otherUser.name.charAt(0)}</span>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-950" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{selectedThread.otherUser.name}</p>
                  <p className="text-[11px] text-neutral-500">{selectedThread.otherUser.daemonName}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                {/* Profile banner */}
                <div className="px-4 py-6 border-b border-neutral-800">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-3">
                    <span className="text-[24px] font-bold text-white">{selectedThread.otherUser.name.charAt(0)}</span>
                  </div>
                  <h2 className="text-[20px] font-bold">{selectedThread.otherUser.name}</h2>
                  <p className="text-[13px] text-neutral-400">
                    This is the beginning of your conversation with {selectedThread.otherUser.name}.
                    Their Pan ({selectedThread.otherUser.daemonName}) will negotiate on their behalf.
                  </p>
                </div>

                {/* Negotiations as chat threads */}
                <div className="pb-4">
                  {selectedThread.negotiations.map((neg) => {
                    const hasActiveTyping = neg.status === 'in_progress';
                    
                    return (
                      <div key={neg.id} className="mb-4">
                        {/* Thread divider */}
                        <div className="flex items-center gap-3 px-4 py-2">
                          <div className="h-px flex-1 bg-neutral-800" />
                          <span className="text-[11px] text-neutral-500 px-2 py-0.5 bg-neutral-900 rounded">
                            {neg.topic} · {formatDate(neg.createdAt)}
                          </span>
                          <div className="h-px flex-1 bg-neutral-800" />
                        </div>

                        {/* Messages */}
                        {neg.messages.map((msg, idx) => {
                          const prevMsg = neg.messages[idx - 1];
                          const isFirstInGroup = !prevMsg || prevMsg.fromPanName !== msg.fromPanName;
                          
                          return (
                            <ChatMessage
                              key={msg.id}
                              message={msg}
                              showAvatar={isFirstInGroup}
                              isFirstInGroup={isFirstInGroup}
                              fromPanName={msg.fromPanName}
                              isFromMe={msg.isFromMe}
                            />
                          );
                        })}

                        {/* Typing indicator */}
                        {hasActiveTyping && (
                          <TypingIndicator name={neg.theirDaemonName} />
                        )}

                        {/* Outcome */}
                        {neg.outcome && (
                          <div className="mx-4 mt-2 p-2 rounded border border-neutral-800 bg-neutral-900/50">
                            <span className={`text-[11px] ${
                              neg.status === 'completed' ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {neg.status === 'completed' ? '✓ ' : '✕ '}
                              {neg.outcome}
                            </span>
                          </div>
                        )}

                        {/* Shared context */}
                        {neg.sharedContext && (
                          <SharedContextDisplay
                            sharedContext={neg.sharedContext}
                            isInitiator={neg.isInitiator}
                            theirName={selectedThread.otherUser.name}
                          />
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </>
          ) : selectedUserId ? (
            // User selected but no conversation yet
            (() => {
              const selectedUser = users.find(u => u.id === selectedUserId);
              if (!selectedUser) return null;
              return (
                <>
                  <div className="h-12 px-4 flex items-center gap-3 border-b border-neutral-800 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                      <span className="text-[12px] font-medium">{selectedUser.name.charAt(0)}</span>
                    </div>
                    <p className="text-[14px] font-semibold">{selectedUser.name}</p>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center px-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                        <span className="text-[32px] font-bold text-white">{selectedUser.name.charAt(0)}</span>
                      </div>
                      <h2 className="text-[18px] font-bold mb-1">{selectedUser.name}</h2>
                      <p className="text-[13px] text-neutral-400 mb-4">
                        Start a sync to have your Pans coordinate
                      </p>
                      <StartNegotiation 
                        onSuccess={fetchUsers} 
                        initialTarget={selectedUser}
                      />
                    </div>
                  </div>
                </>
              );
            })()
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useNegotiationsStream } from '@/hooks/use-negotiations-stream';
import { StartNegotiation } from '@/components/spectator/start-negotiation';

interface PanUser {
  id: string;
  name: string;
  daemonName: string;
  image?: string;
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
    }>;
    createdAt: string;
  }>;
  lastActivity: Date;
}

export default function MessagesPage() {
  const { data: session } = useSession();
  const { negotiations } = useNegotiationsStream();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<PanUser[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Group negotiations by the other user (like DM threads)
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
      })),
      createdAt: n.createdAt,
    });

    const negDate = new Date(n.updatedAt || n.createdAt);
    if (negDate > thread.lastActivity) {
      thread.lastActivity = negDate;
    }
  }

  // Sort threads by last activity
  threads.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  const selectedThread = selectedUserId ? threadMap.get(selectedUserId) : null;

  // Find users we haven't talked to yet
  const usersWithoutThreads = users.filter(u => !threadMap.has(u.id));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="h-14 px-6 md:px-6 pl-16 md:pl-6 flex items-center justify-between border-b border-neutral-900 bg-black shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
            <span className="text-[14px]">💬</span>
          </div>
          <div>
            <p className="text-[14px] font-medium">Messages</p>
            <p className="text-[11px] text-neutral-500">Conversations with other users</p>
          </div>
        </div>
        <StartNegotiation onSuccess={fetchUsers} />
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Thread list */}
        <div className="w-72 border-r border-neutral-900 overflow-y-auto shrink-0">
          <div className="p-3">
            {threads.length === 0 && usersWithoutThreads.length === 0 ? (
              <div className="text-center py-8 px-4">
                <p className="text-[14px] font-medium mb-2">No conversations yet</p>
                <p className="text-[12px] text-neutral-500">
                  Start a negotiation to begin a conversation.
                </p>
              </div>
            ) : (
              <>
                {threads.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider px-2 mb-2">
                      Active Conversations
                    </p>
                    <div className="space-y-1">
                      {threads.map(thread => {
                        const lastNeg = thread.negotiations[thread.negotiations.length - 1];
                        const statusColor = lastNeg?.status === 'completed' 
                          ? 'bg-emerald-500' 
                          : lastNeg?.status === 'failed' 
                            ? 'bg-red-500' 
                            : 'bg-amber-500';
                        return (
                          <button
                            key={thread.otherUser.id}
                            onClick={() => setSelectedUserId(thread.otherUser.id)}
                            className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                              selectedUserId === thread.otherUser.id
                                ? 'bg-neutral-900'
                                : 'hover:bg-neutral-950'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-[14px] font-medium shrink-0">
                                {thread.otherUser.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-medium truncate">{thread.otherUser.name}</p>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                                </div>
                                <p className="text-[11px] text-neutral-500 truncate">
                                  {thread.otherUser.daemonName} · {thread.negotiations.length} negotiation{thread.negotiations.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {usersWithoutThreads.length > 0 && (
                  <div>
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider px-2 mb-2">
                      Other Users
                    </p>
                    <div className="space-y-1">
                      {usersWithoutThreads.map(user => (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUserId(user.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            selectedUserId === user.id
                              ? 'bg-neutral-900'
                              : 'hover:bg-neutral-950'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-[12px] font-medium shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-neutral-400 truncate">{user.name}</p>
                            <p className="text-[10px] text-neutral-600 truncate">{user.daemonName}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Conversation view */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {selectedThread ? (
            <>
              {/* Thread header */}
              <div className="h-14 px-6 flex items-center border-b border-neutral-900 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-[14px] font-medium">
                    {selectedThread.otherUser.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium">{selectedThread.otherUser.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      {selectedThread.otherUser.daemonName} represents them
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                  {selectedThread.negotiations.map(neg => (
                    <div key={neg.id} className="space-y-4">
                      {/* Negotiation header */}
                      <div className="flex items-center gap-2 py-2">
                        <div className="h-px flex-1 bg-neutral-900" />
                        <span className="text-[11px] text-neutral-500 px-2">
                          {neg.topic} · {new Date(neg.createdAt).toLocaleDateString()}
                        </span>
                        <div className="h-px flex-1 bg-neutral-900" />
                      </div>

                      {/* Messages */}
                      {neg.messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] ${msg.isFromMe ? 'items-end' : 'items-start'}`}>
                            <p className="text-[11px] text-neutral-500 mb-1 px-1">
                              {msg.fromPanName} → {msg.toPanName}
                              <span className="ml-2 px-1.5 py-0.5 bg-neutral-900 rounded text-[10px]">
                                {msg.intent}
                              </span>
                            </p>
                            <div className={`px-4 py-3 rounded-2xl ${
                              msg.isFromMe 
                                ? 'bg-blue-600 text-white rounded-br-md' 
                                : 'bg-neutral-900 text-neutral-200 rounded-bl-md'
                            }`}>
                              <p className="text-[13px] leading-relaxed">{msg.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Outcome */}
                      {neg.outcome && (
                        <div className="flex justify-center">
                          <div className={`px-4 py-2 rounded-lg text-[12px] ${
                            neg.status === 'completed' 
                              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' 
                              : 'bg-red-900/30 text-red-400 border border-red-900/50'
                          }`}>
                            {neg.status === 'completed' ? '✓' : '✕'} {neg.outcome}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
                  <div className="h-14 px-6 flex items-center border-b border-neutral-900 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-[14px] font-medium">
                        {selectedUser.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[14px] font-medium">{selectedUser.name}</p>
                        <p className="text-[11px] text-neutral-500">
                          {selectedUser.daemonName} represents them
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">{selectedUser.name.charAt(0)}</span>
                      </div>
                      <p className="text-[14px] text-neutral-400 mb-2">
                        No conversations with {selectedUser.name} yet
                      </p>
                      <p className="text-[12px] text-neutral-600 mb-4">
                        Start a negotiation to have your daemons coordinate
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
                <p className="text-[14px] text-neutral-400 mb-2">Select a conversation</p>
                <p className="text-[12px] text-neutral-600">
                  or start a new negotiation with another user
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

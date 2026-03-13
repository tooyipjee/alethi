'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

interface PanChatProps {
  panName: string;
  userName: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isNegotiation?: boolean;
  error?: boolean;
}

export function PanChat({ panName, userName }: PanChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent, overrideMessage?: string) => {
    e?.preventDefault();
    const messageText = overrideMessage || input.trim();
    if (!messageText || isLoading) return;

    setRetryMessage(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
    };

    const allMessages = [...messages, userMessage];
    setMessages(allMessages);
    setInput('');
    setIsLoading(true);

    const assistantId = crypto.randomUUID();

    // Check if this looks like a negotiation request
    const isNegotiationRequest = /(?:talk|speak|message|contact|negotiate|coordinate|check|ask|tell|ping|sync|schedule|set up|arrange|book).+(?:pan|daemon|meeting|call|review|sync|chat)/i.test(messageText);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      setMessages(prev => [...prev, { 
        id: assistantId, 
        role: 'assistant', 
        content: '',
        isNegotiation: isNegotiationRequest,
      }]);

      const decoder = new TextDecoder();
      let fullContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullContent += chunk;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      }

      // Show toast if this was a negotiation
      if (isNegotiationRequest && fullContent.includes('negotiat')) {
        toast.success('Negotiation started! Check Pan Channels to follow along.', {
          action: {
            label: 'View',
            onClick: () => window.location.href = '/spectator',
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      setRetryMessage(messageText);
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: `I couldn't process that request. ${errorMessage}`,
        error: true,
      }]);
      toast.error('Failed to get response from Pan');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleRetry = () => {
    if (retryMessage) {
      // Remove the last error message
      setMessages(prev => prev.slice(0, -1));
      handleSubmit(undefined, retryMessage);
    }
  };

  const suggestions = [
    "What's happening today?",
    "Talk to Sarah's Pan about the design review",
    "What did I miss this morning?",
    "Summarize my recent emails",
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="h-14 px-6 md:px-6 pl-16 md:pl-6 flex items-center border-b border-neutral-900 bg-black shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
            <span className="text-[14px]">◉</span>
          </div>
          <div>
            <p className="text-[14px] font-medium">{panName}</p>
            <p className="text-[11px] text-neutral-500">Your personal Pan</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="py-16">
              <p className="text-[11px] text-neutral-600 uppercase tracking-wider mb-4">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h2 className="text-[32px] font-semibold tracking-tight mb-3">
                Hey {userName.split(' ')[0]}
              </h2>
              <p className="text-[15px] text-neutral-400 mb-10">
                I&apos;m {panName}, your Pan. I can talk to other Pans,
                check your tools, and handle coordination so you don&apos;t have to.
              </p>
              <div className="space-y-2">
                <p className="text-[12px] text-neutral-500 mb-3">Try saying</p>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      inputRef.current?.focus();
                    }}
                    className="block w-full text-left px-4 py-3 text-[14px] text-neutral-400 bg-neutral-950 border border-neutral-900 rounded-lg hover:border-neutral-800 hover:text-white transition-colors"
                  >
                    &quot;{s}&quot;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <div key={m.id} className="group">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      m.role === 'user' ? 'bg-neutral-800' : m.error ? 'bg-red-900/50' : 'bg-neutral-900'
                    }`}>
                      <span className="text-[12px]">
                        {m.role === 'user' ? userName.charAt(0) : m.error ? '!' : '◉'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium mb-1">
                        {m.role === 'user' ? 'You' : panName}
                      </p>
                      <div className={`text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                        m.error ? 'text-red-400' : 'text-neutral-300'
                      }`}>
                        {m.content}
                      </div>
                      {m.error && retryMessage && (
                        <button
                          onClick={handleRetry}
                          className="mt-2 text-[12px] text-neutral-500 hover:text-white transition-colors"
                        >
                          ↻ Try again
                        </button>
                      )}
                      {m.isNegotiation && m.content && !m.error && (
                        <Link
                          href="/spectator"
                          className="inline-flex items-center gap-1 mt-3 text-[12px] text-emerald-500 hover:text-emerald-400 transition-colors"
                        >
                          <span>◎</span> View in Pan Channels →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
                    <span className="text-[12px]">◉</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium mb-1">{panName}</p>
                    <div className="flex gap-1 py-1">
                      <span className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input - always visible at bottom */}
      <div className="border-t border-neutral-900 bg-black p-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={`Message ${panName}...`}
                rows={1}
                className="w-full px-4 py-3 pr-24 bg-neutral-950 border border-neutral-800 rounded-xl text-[14px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors resize-none"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-white text-black text-[13px] font-semibold rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-30"
              >
                {isLoading ? '...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

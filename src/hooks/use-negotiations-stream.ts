'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface NegotiationMessage {
  id: string;
  fromUserId: string;
  fromPanName: string;
  toPanName: string;
  intent: string;
  content: string;
  createdAt: string;
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

interface Negotiation {
  id: string;
  topic: string;
  status: string;
  outcome?: string;
  initiator: { id: string; name: string; daemonName: string };
  target: { id: string; name: string; daemonName: string };
  messages: NegotiationMessage[];
  sharedContext?: SharedContext;
  isInitiator: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UseNegotiationsStreamResult {
  negotiations: Negotiation[];
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useNegotiationsStream(): UseNegotiationsStreamResult {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setError(null);

    try {
      const es = new EventSource('/api/negotiations/stream');
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE Client] Received:', data.type, 'negotiations:', data.negotiations?.length || 0);
          if (data.type === 'init' || data.type === 'update') {
            setNegotiations(data.negotiations || []);
          }
        } catch {
          console.error('Failed to parse SSE data');
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();

        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (err) {
      setError('Failed to connect');
      setIsConnected(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { negotiations, isConnected, error, reconnect };
}

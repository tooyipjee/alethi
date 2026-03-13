export type DaemonPersonality = 'analytical' | 'supportive' | 'direct' | 'creative';

export type NegotiationIntent = 'request' | 'propose' | 'accept' | 'counter' | 'decline';

export type NegotiationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type PrivacyLevel = 'minimal' | 'balanced' | 'open';

export type ContextSource = 'github' | 'notion' | 'linear' | 'slack' | 'calendar' | 'gmail' | 'manual';

export type ConversationType = 'personal' | 'negotiation';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface TruthPacket {
  availability: string[];
  workloadSummary: string;
  relevantExpertise: string[];
  currentFocus?: string;
  lastActiveProject?: string;
}

export interface DaemonMessage {
  id: string;
  fromDaemonId: string;
  toDaemonId: string;
  intent: NegotiationIntent;
  topic: string;
  content: string;
  synthesizedContext: TruthPacket;
  timestamp: Date;
}

export interface Negotiation {
  id: string;
  initiatorDaemonId: string;
  targetDaemonId: string;
  topic: string;
  status: NegotiationStatus;
  messages: DaemonMessage[];
  outcome?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DaemonConfig {
  id: string;
  userId: string;
  name: string;
  personality: DaemonPersonality;
  privacyLevel: PrivacyLevel;
  preferredProvider: 'openai' | 'anthropic';
}

export interface WorkContext {
  id: string;
  userId: string;
  source: ContextSource;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  type: ConversationType;
  title?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  daemonName: string;
  daemonPersonality: DaemonPersonality;
  privacyLevel: PrivacyLevel;
  preferredProvider: 'openai' | 'anthropic';
  createdAt: Date;
  updatedAt: Date;
}

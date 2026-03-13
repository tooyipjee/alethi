import { pgTable, text, timestamp, jsonb, uuid, pgEnum, vector } from 'drizzle-orm/pg-core';

export const daemonPersonalityEnum = pgEnum('daemon_personality', ['analytical', 'supportive', 'direct', 'creative']);
export const privacyLevelEnum = pgEnum('privacy_level', ['minimal', 'balanced', 'open']);
export const aiProviderEnum = pgEnum('ai_provider', ['openai', 'anthropic']);
export const conversationTypeEnum = pgEnum('conversation_type', ['personal', 'negotiation']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const negotiationStatusEnum = pgEnum('negotiation_status', ['pending', 'in_progress', 'completed', 'failed', 'cancelled']);
export const negotiationIntentEnum = pgEnum('negotiation_intent', ['request', 'propose', 'accept', 'counter', 'decline']);
export const contextSourceEnum = pgEnum('context_source', ['github', 'notion', 'linear', 'manual']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  image: text('image'),
  emailVerified: timestamp('email_verified'),
  hashedPassword: text('hashed_password'),
  daemonName: text('daemon_name').notNull().default('Dæmon'),
  daemonPersonality: daemonPersonalityEnum('daemon_personality').notNull().default('supportive'),
  privacyLevel: privacyLevelEnum('privacy_level').notNull().default('balanced'),
  preferredProvider: aiProviderEnum('preferred_provider').notNull().default('anthropic'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: text('session_token').notNull().unique(),
  expires: timestamp('expires').notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: timestamp('expires').notNull(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: conversationTypeEnum('type').notNull().default('personal'),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const negotiations = pgTable('negotiations', {
  id: uuid('id').defaultRandom().primaryKey(),
  initiatorUserId: uuid('initiator_user_id').notNull().references(() => users.id),
  targetUserId: uuid('target_user_id').notNull().references(() => users.id),
  topic: text('topic').notNull(),
  status: negotiationStatusEnum('status').notNull().default('pending'),
  outcome: text('outcome'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const negotiationMessages = pgTable('negotiation_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  negotiationId: uuid('negotiation_id').notNull().references(() => negotiations.id, { onDelete: 'cascade' }),
  fromUserId: uuid('from_user_id').notNull().references(() => users.id),
  toUserId: uuid('to_user_id').notNull().references(() => users.id),
  intent: negotiationIntentEnum('intent').notNull(),
  content: text('content').notNull(),
  synthesizedContext: jsonb('synthesized_context').$type<{
    availability: string[];
    workloadSummary: string;
    relevantExpertise: string[];
    currentFocus?: string;
    lastActiveProject?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workContext = pgTable('work_context', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: contextSourceEnum('source').notNull(),
  externalId: text('external_id'),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  data: jsonb('data').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const privacyAuditLog = pgTable('privacy_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  negotiationId: uuid('negotiation_id').references(() => negotiations.id),
  action: text('action').notNull(),
  dataShared: jsonb('data_shared'),
  dataBlocked: jsonb('data_blocked'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type ConversationSelect = typeof conversations.$inferSelect;
export type MessageSelect = typeof messages.$inferSelect;
export type NegotiationSelect = typeof negotiations.$inferSelect;
export type NegotiationMessageSelect = typeof negotiationMessages.$inferSelect;
export type WorkContextSelect = typeof workContext.$inferSelect;

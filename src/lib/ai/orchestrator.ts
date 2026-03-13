import { generateChat, type AIProvider, type AIMessage } from './providers';
import { buildDaemonSystemPrompt, type DaemonConfig } from './daemon';
import { getUserWorkContext, buildWorkGraph, synthesizeTruthPacket } from '@/lib/mcp/work-graph';
import { filterForPrivacy } from '@/lib/privacy/truth-filter';
import { db } from '@/lib/db';
import { negotiations, negotiationMessages, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { NegotiationIntent, NegotiationStatus, TruthPacket, PrivacyLevel } from '@/types/daemon';
import { v4 as uuid } from 'uuid';

export interface NegotiationRequest {
  initiatorUserId: string;
  targetUserId: string;
  topic: string;
  initialMessage: string;
}

export interface NegotiationTurn {
  negotiationId: string;
  fromUserId: string;
  toUserId: string;
  intent: NegotiationIntent;
  content: string;
  synthesizedContext: TruthPacket;
}

export interface NegotiationResult {
  negotiationId: string;
  status: NegotiationStatus;
  turns: NegotiationTurn[];
  outcome?: string;
}

const NEGOTIATION_SYSTEM_PROMPT = `You are participating in a Dæmon-to-Dæmon negotiation on behalf of your human.
Your goal is to represent your human's interests while being collaborative and finding mutually beneficial outcomes.

## Negotiation Protocol
- Always be respectful of the other Dæmon and their human
- Focus on finding solutions that work for both parties
- Be transparent about constraints (availability, workload) without oversharing
- Use the provided TruthPacket context—never invent or assume information

## Response Format
You must respond with a JSON object:
{
  "intent": "request" | "propose" | "accept" | "counter" | "decline",
  "message": "Your message to the other Dæmon",
  "reasoning": "Brief internal reasoning (not shown to other party)"
}

## Intent Meanings
- request: Asking for something (scheduling, information, resources)
- propose: Making a specific offer or suggestion
- accept: Agreeing to a proposal
- counter: Proposing a modified alternative
- decline: Politely declining (with reason)

Be concise and action-oriented. Aim to reach resolution within 3-5 exchanges.`;

export async function initiateNegotiation(request: NegotiationRequest): Promise<NegotiationResult> {
  const [initiator, target] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, request.initiatorUserId) }),
    db.query.users.findFirst({ where: eq(users.id, request.targetUserId) }),
  ]);

  if (!initiator || !target) {
    throw new Error('Users not found');
  }

  const [negotiation] = await db.insert(negotiations).values({
    initiatorUserId: request.initiatorUserId,
    targetUserId: request.targetUserId,
    topic: request.topic,
    status: 'in_progress',
  }).returning();

  const [initiatorContext, targetContext] = await Promise.all([
    getUserWorkContext(initiator.id),
    getUserWorkContext(target.id),
  ]);

  const initiatorGraph = buildWorkGraph(initiatorContext);
  const targetGraph = buildWorkGraph(targetContext);

  const initiatorTruth = filterForPrivacy(
    synthesizeTruthPacket(initiatorGraph, initiator.privacyLevel as PrivacyLevel),
    initiator.privacyLevel as PrivacyLevel
  );
  const targetTruth = filterForPrivacy(
    synthesizeTruthPacket(targetGraph, target.privacyLevel as PrivacyLevel),
    target.privacyLevel as PrivacyLevel
  );

  const turns: NegotiationTurn[] = [];
  let currentStatus: NegotiationStatus = 'in_progress';
  let outcome: string | undefined;

  const firstTurn = await generateNegotiationTurn({
    negotiationId: negotiation.id,
    fromUser: initiator,
    toUser: target,
    fromTruth: initiatorTruth,
    toTruth: targetTruth,
    topic: request.topic,
    previousTurns: [],
    initialMessage: request.initialMessage,
  });

  turns.push(firstTurn);
  await saveNegotiationMessage(firstTurn);

  let maxTurns = 6;
  let currentTurn = 1;

  while (currentStatus === 'in_progress' && currentTurn < maxTurns) {
    const isInitiatorTurn = currentTurn % 2 === 0;
    const fromUser = isInitiatorTurn ? initiator : target;
    const toUser = isInitiatorTurn ? target : initiator;
    const fromTruth = isInitiatorTurn ? initiatorTruth : targetTruth;
    const toTruth = isInitiatorTurn ? targetTruth : initiatorTruth;

    const turn = await generateNegotiationTurn({
      negotiationId: negotiation.id,
      fromUser,
      toUser,
      fromTruth,
      toTruth,
      topic: request.topic,
      previousTurns: turns,
    });

    turns.push(turn);
    await saveNegotiationMessage(turn);

    if (turn.intent === 'accept') {
      currentStatus = 'completed';
      outcome = `Agreement reached: ${turn.content}`;
    } else if (turn.intent === 'decline') {
      currentStatus = 'failed';
      outcome = `Negotiation declined: ${turn.content}`;
    }

    currentTurn++;
  }

  if (currentStatus === 'in_progress') {
    currentStatus = 'completed';
    outcome = 'Negotiation concluded after maximum turns';
  }

  await db.update(negotiations)
    .set({ status: currentStatus, outcome, updatedAt: new Date() })
    .where(eq(negotiations.id, negotiation.id));

  return {
    negotiationId: negotiation.id,
    status: currentStatus,
    turns,
    outcome,
  };
}

interface GenerateTurnParams {
  negotiationId: string;
  fromUser: typeof users.$inferSelect;
  toUser: typeof users.$inferSelect;
  fromTruth: TruthPacket;
  toTruth: TruthPacket;
  topic: string;
  previousTurns: NegotiationTurn[];
  initialMessage?: string;
}

async function generateNegotiationTurn(params: GenerateTurnParams): Promise<NegotiationTurn> {
  const { negotiationId, fromUser, toUser, fromTruth, toTruth, topic, previousTurns, initialMessage } = params;

  const daemonConfig: DaemonConfig = {
    name: fromUser.daemonName,
    personality: fromUser.daemonPersonality,
    privacyLevel: fromUser.privacyLevel as PrivacyLevel,
    provider: fromUser.preferredProvider as AIProvider,
    userId: fromUser.id,
  };

  const contextPrompt = `
## Current Negotiation
Topic: ${topic}
Negotiating with: ${toUser.name}'s Dæmon (${toUser.daemonName})

## Your Human's Context (TruthPacket)
${JSON.stringify(fromTruth, null, 2)}

## Other Party's Shared Context
${JSON.stringify(toTruth, null, 2)}

${previousTurns.length > 0 ? `
## Conversation History
${previousTurns.map(t => `${t.fromUserId === fromUser.id ? 'You' : toUser.daemonName}: [${t.intent}] ${t.content}`).join('\n')}
` : ''}`;

  const messages: AIMessage[] = [
    {
      role: 'user',
      content: initialMessage 
        ? `Start this negotiation. Your human wants: ${initialMessage}\n\n${contextPrompt}`
        : `Continue this negotiation. Respond to the last message.\n\n${contextPrompt}`,
    },
  ];

  const systemPrompt = buildDaemonSystemPrompt(daemonConfig) + '\n\n' + NEGOTIATION_SYSTEM_PROMPT;

  const result = await generateChat({
    provider: daemonConfig.provider,
    messages,
    systemPrompt,
    fast: true,
  });

  let intent: NegotiationIntent = 'propose';
  let content = result.text;

  try {
    const parsed = JSON.parse(result.text);
    intent = parsed.intent || 'propose';
    content = parsed.message || result.text;
  } catch {
    if (result.text.toLowerCase().includes('accept')) intent = 'accept';
    else if (result.text.toLowerCase().includes('decline')) intent = 'decline';
    else if (result.text.toLowerCase().includes('counter')) intent = 'counter';
  }

  return {
    negotiationId,
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    intent,
    content,
    synthesizedContext: fromTruth,
  };
}

async function saveNegotiationMessage(turn: NegotiationTurn): Promise<void> {
  await db.insert(negotiationMessages).values({
    negotiationId: turn.negotiationId,
    fromUserId: turn.fromUserId,
    toUserId: turn.toUserId,
    intent: turn.intent,
    content: turn.content,
    synthesizedContext: turn.synthesizedContext,
  });
}

export async function getNegotiationHistory(userId: string): Promise<NegotiationResult[]> {
  const userNegotiations = await db.query.negotiations.findMany({
    where: eq(negotiations.initiatorUserId, userId),
  });

  const results: NegotiationResult[] = [];

  for (const neg of userNegotiations) {
    const messages = await db.query.negotiationMessages.findMany({
      where: eq(negotiationMessages.negotiationId, neg.id),
    });

    results.push({
      negotiationId: neg.id,
      status: neg.status,
      turns: messages.map(m => ({
        negotiationId: m.negotiationId,
        fromUserId: m.fromUserId,
        toUserId: m.toUserId,
        intent: m.intent,
        content: m.content,
        synthesizedContext: m.synthesizedContext || {
          availability: [],
          workloadSummary: '',
          relevantExpertise: [],
        },
      })),
      outcome: neg.outcome || undefined,
    });
  }

  return results;
}

export function createMockNegotiationId(): string {
  return uuid();
}

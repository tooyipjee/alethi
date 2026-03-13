import { generateChat, type AIProvider, type AIMessage } from '@/lib/ai/providers';
import { buildDaemonSystemPrompt, synthesizeTruthPacket, type DaemonConfig } from '@/lib/ai/daemon';
import { getMockWorkContext, getMockOtherUsers } from '@/lib/mock/work-context';
import { filterForPrivacy } from '@/lib/privacy/truth-filter';
import { buildWorkGraph, synthesizeTruthPacket as graphSynthesizeTruthPacket } from '@/lib/mcp/work-graph';
import { saveNegotiation, type StoredNegotiation, type NegotiationMessage } from './store';
import type { NegotiationIntent, PrivacyLevel, TruthPacket } from '@/types/daemon';

const NEGOTIATION_PROMPT = `You are participating in a Pan-to-Pan negotiation on behalf of your human.
Your goal is to represent your human's interests while being collaborative.

## Rules
- Be concise and direct
- Focus on finding a solution that works for both parties
- Use only the context provided (TruthPacket) — never invent information
- Respond with valid JSON only, no markdown fences

## Response Format (strict JSON)
{"intent":"request|propose|accept|counter|decline","message":"Your message to the other Pan"}

## Intent Guide
- request: Asking for something
- propose: Making a specific offer
- accept: Agreeing to a proposal
- counter: Proposing an alternative
- decline: Politely declining`;

interface NegotiateParams {
  userId: string;
  userName: string;
  userPanName: string;
  targetPersonName: string;
  topic: string;
  userMessage: string;
}

function getProvider(): AIProvider {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'ollama';
}

function buildTruthPacket(userId: string): TruthPacket {
  const context = getMockWorkContext(userId);
  const workGraph = buildWorkGraph(context);
  return filterForPrivacy(
    graphSynthesizeTruthPacket(workGraph, 'balanced'),
    'balanced'
  );
}

function parseResponse(text: string): { intent: NegotiationIntent; message: string } {
  // Strip markdown fences and thinking tags if present
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();

  // Try to extract JSON from the response
  const jsonMatch = cleaned.match(/\{[\s\S]*?"intent"[\s\S]*?"message"[\s\S]*?\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(cleaned);
    const validIntents = ['request', 'propose', 'accept', 'counter', 'decline'];
    const intent = validIntents.includes(parsed.intent) ? parsed.intent : 'propose';
    return { intent, message: parsed.message || cleaned };
  } catch {
    // Fallback: infer intent from text
    const lower = text.toLowerCase();
    let intent: NegotiationIntent = 'propose';
    if (lower.includes('"accept"') || lower.includes('i accept') || lower.includes('agreed')) intent = 'accept';
    else if (lower.includes('"decline"') || lower.includes('cannot') || lower.includes('unable')) intent = 'decline';
    else if (lower.includes('"counter"') || lower.includes('alternatively') || lower.includes('how about')) intent = 'counter';
    else if (lower.includes('"request"')) intent = 'request';
    return { intent, message: text.slice(0, 500) };
  }
}

async function generateTurn(
  panName: string,
  personality: string,
  provider: AIProvider,
  userId: string,
  otherPanName: string,
  topic: string,
  myTruth: TruthPacket,
  otherTruth: TruthPacket,
  history: NegotiationMessage[],
  initialRequest?: string,
): Promise<{ intent: NegotiationIntent; message: string }> {

  const daemonConfig: DaemonConfig = {
    name: panName,
    personality: personality as 'analytical' | 'supportive' | 'direct' | 'creative',
    privacyLevel: 'balanced',
    provider,
    userId,
  };

  const historyText = history.length > 0
    ? history.map(m => `${m.fromPanName}: [${m.intent}] ${m.content}`).join('\n')
    : '(no messages yet)';

  const userPrompt = initialRequest
    ? `Start a negotiation. Your human wants: "${initialRequest}"

Topic: ${topic}
Negotiating with: ${otherPanName}

Your human's context: ${JSON.stringify(myTruth)}
Other Pan's shared context: ${JSON.stringify(otherTruth)}

Respond with JSON only.`
    : `Continue the negotiation. Respond to the last message.

Topic: ${topic}
Negotiating with: ${otherPanName}

Your human's context: ${JSON.stringify(myTruth)}
Other Pan's shared context: ${JSON.stringify(otherTruth)}

Conversation so far:
${historyText}

Respond with JSON only.`;

  const systemPrompt = buildDaemonSystemPrompt(daemonConfig) + '\n\n' + NEGOTIATION_PROMPT;

  const messages: AIMessage[] = [{ role: 'user', content: userPrompt }];

  const result = await generateChat({ provider, messages, systemPrompt, fast: true });
  return parseResponse(result.text);
}

export async function runNegotiation(params: NegotiateParams): Promise<StoredNegotiation> {
  const { userId, userName, userPanName, targetPersonName, topic, userMessage } = params;

  // Find the target mock user
  const otherUsers = getMockOtherUsers();
  const target = otherUsers.find(u =>
    u.name.toLowerCase().includes(targetPersonName.toLowerCase())
  ) || otherUsers[0];

  const provider = getProvider();
  const myTruth = buildTruthPacket(userId);
  const targetTruth: TruthPacket = {
    availability: target.workContext.filter(c => c.title.includes('Available')).map(c => c.summary),
    workloadSummary: target.workContext.find(c => c.title.includes('Working'))?.summary || 'Moderate workload',
    relevantExpertise: [target.role],
    currentFocus: target.workContext[0]?.summary,
  };

  const negotiationId = crypto.randomUUID();
  const messages: NegotiationMessage[] = [];
  const now = new Date();

  const negotiation: StoredNegotiation = {
    id: negotiationId,
    topic,
    status: 'in_progress',
    initiator: { id: userId, name: userName, daemonName: userPanName },
    target: { id: target.id, name: target.name, daemonName: target.daemonName },
    messages,
    createdAt: now,
    updatedAt: now,
  };

  // Turn 1: Your Pan opens
  const turn1 = await generateTurn(
    userPanName, 'supportive', provider, userId,
    target.daemonName, topic, myTruth, targetTruth,
    messages, userMessage,
  );
  messages.push({
    id: crypto.randomUUID(),
    fromUserId: userId,
    toUserId: target.id,
    fromPanName: userPanName,
    toPanName: target.daemonName,
    intent: turn1.intent,
    content: turn1.message,
    createdAt: new Date(),
  });

  // Turn 2: Their Pan responds
  const turn2 = await generateTurn(
    target.daemonName, 'analytical', provider, target.id,
    userPanName, topic, targetTruth, myTruth,
    messages,
  );
  messages.push({
    id: crypto.randomUUID(),
    fromUserId: target.id,
    toUserId: userId,
    fromPanName: target.daemonName,
    toPanName: userPanName,
    intent: turn2.intent,
    content: turn2.message,
    createdAt: new Date(),
  });

  // Turn 3: Your Pan follows up (unless already accepted/declined)
  if (turn2.intent !== 'accept' && turn2.intent !== 'decline') {
    const turn3 = await generateTurn(
      userPanName, 'supportive', provider, userId,
      target.daemonName, topic, myTruth, targetTruth,
      messages,
    );
    messages.push({
      id: crypto.randomUUID(),
      fromUserId: userId,
      toUserId: target.id,
      fromPanName: userPanName,
      toPanName: target.daemonName,
      intent: turn3.intent,
      content: turn3.message,
      createdAt: new Date(),
    });

    // Turn 4: Their Pan resolves
    if (turn3.intent !== 'accept' && turn3.intent !== 'decline') {
      const turn4 = await generateTurn(
        target.daemonName, 'analytical', provider, target.id,
        userPanName, topic, targetTruth, myTruth,
        messages,
      );
      messages.push({
        id: crypto.randomUUID(),
        fromUserId: target.id,
        toUserId: userId,
        fromPanName: target.daemonName,
        toPanName: userPanName,
        intent: turn4.intent,
        content: turn4.message,
        createdAt: new Date(),
      });
    }
  }

  // Determine outcome
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.intent === 'accept') {
    negotiation.status = 'completed';
    negotiation.outcome = `Agreement reached: ${lastMsg.content}`;
  } else if (lastMsg.intent === 'decline') {
    negotiation.status = 'failed';
    negotiation.outcome = `Declined: ${lastMsg.content}`;
  } else {
    negotiation.status = 'completed';
    negotiation.outcome = 'Negotiation concluded';
  }
  negotiation.updatedAt = new Date();

  saveNegotiation(negotiation);
  return negotiation;
}

import { generateChat, type AIProvider, type AIMessage } from '@/lib/ai/providers';
import { buildDaemonSystemPrompt, type DaemonConfig } from '@/lib/ai/daemon';
import { getMockOtherUsers } from '@/lib/mock/work-context';
import { saveNegotiation, addNegotiationMessage, updateNegotiation, getNegotiation, type StoredNegotiation, type NegotiationMessage, type SharedContext } from './store';
import { logContextShare } from '@/lib/security/audit';
import { findUserByName, buildUserTruthPacket } from '@/lib/users/user-service';
import type { NegotiationIntent, TruthPacket } from '@/types/daemon';

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

function parseResponse(text: string): { intent: NegotiationIntent; message: string } {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();

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

interface TargetUser {
  id: string;
  name: string;
  daemonName: string;
  daemonPersonality: 'analytical' | 'supportive' | 'direct' | 'creative';
  privacyLevel: 'minimal' | 'balanced' | 'open';
  truthPacket: TruthPacket;
}

async function findTargetUser(targetPersonName: string, excludeUserId: string): Promise<TargetUser | null> {
  console.log(`[NEGOTIATE] Looking for user: "${targetPersonName}" (excluding: ${excludeUserId})`);
  
  // First try to find a real user
  const realUser = await findUserByName(targetPersonName, excludeUserId);
  
  if (realUser) {
    console.log(`[NEGOTIATE] Found REAL user: ${realUser.name} (${realUser.id}) with daemon ${realUser.daemonName}`);
    return {
      id: realUser.id,
      name: realUser.name,
      daemonName: realUser.daemonName,
      daemonPersonality: realUser.daemonPersonality,
      privacyLevel: realUser.privacyLevel,
      truthPacket: buildUserTruthPacket(realUser.id, realUser.privacyLevel),
    };
  }

  // Fall back to mock users for demo/testing
  console.log(`[NEGOTIATE] No real user found, falling back to mock users`);
  const mockUsers = getMockOtherUsers();
  const mockUser = mockUsers.find(u =>
    u.name.toLowerCase().includes(targetPersonName.toLowerCase())
  ) || mockUsers[0];

  if (mockUser) {
    console.log(`[NEGOTIATE] Using MOCK user: ${mockUser.name} (${mockUser.id}) with daemon ${mockUser.daemonName}`);
    // Build TruthPacket from simplified mock context
    const mockTruthPacket: TruthPacket = {
      availability: mockUser.workContext
        .filter(c => c.title.includes('Available'))
        .map(c => c.summary),
      workloadSummary: mockUser.workContext
        .find(c => c.title.includes('Working'))?.summary || 'Moderate workload',
      relevantExpertise: [mockUser.role],
      currentFocus: mockUser.workContext[0]?.summary,
    };

    return {
      id: mockUser.id,
      name: mockUser.name,
      daemonName: mockUser.daemonName,
      daemonPersonality: 'analytical',
      privacyLevel: 'balanced',
      truthPacket: mockTruthPacket,
    };
  }

  console.log(`[NEGOTIATE] No user found for "${targetPersonName}"`);
  return null;
}

export async function runNegotiation(params: NegotiateParams): Promise<StoredNegotiation> {
  const { userId, userName, userPanName, targetPersonName, topic, userMessage } = params;

  console.log(`[NEGOTIATE] Starting negotiation:`, {
    initiator: { id: userId, name: userName, daemon: userPanName },
    targetQuery: targetPersonName,
    topic,
  });

  // Find target user (real or mock)
  const target = await findTargetUser(targetPersonName, userId);
  
  if (!target) {
    console.log(`[NEGOTIATE] FAILED: Could not find user "${targetPersonName}"`);
    throw new Error(`Could not find user "${targetPersonName}"`);
  }
  
  console.log(`[NEGOTIATE] Target resolved:`, {
    id: target.id,
    name: target.name,
    daemon: target.daemonName,
  });

  const provider = getProvider();
  const myTruth = buildUserTruthPacket(userId, 'balanced');

  const negotiationId = crypto.randomUUID();
  const messages: NegotiationMessage[] = [];
  const now = new Date();

  // Build shared context for transparency
  const sharedContext: SharedContext = {
    initiator: {
      userId,
      truthPacket: myTruth,
      privacyLevel: 'balanced',
    },
    target: {
      userId: target.id,
      truthPacket: target.truthPacket,
      privacyLevel: target.privacyLevel,
    },
  };

  const negotiation: StoredNegotiation = {
    id: negotiationId,
    topic,
    status: 'in_progress',
    initiator: { id: userId, name: userName, daemonName: userPanName },
    target: { id: target.id, name: target.name, daemonName: target.daemonName },
    messages,
    sharedContext,
    createdAt: now,
    updatedAt: now,
  };

  // Save negotiation immediately so it appears in UI for both users
  saveNegotiation(negotiation);
  console.log(`[NEGOTIATE] Saved initial negotiation, starting turns...`);

  // Helper to get current messages from store (for generateTurn history)
  const getCurrentMessages = () => getNegotiation(negotiationId)?.messages || [];

  // Turn 1: Your Pan opens
  const turn1 = await generateTurn(
    userPanName, 'supportive', provider, userId,
    target.daemonName, topic, myTruth, target.truthPacket,
    getCurrentMessages(), userMessage,
  );
  const msg1: NegotiationMessage = {
    id: crypto.randomUUID(),
    fromUserId: userId,
    toUserId: target.id,
    fromPanName: userPanName,
    toPanName: target.daemonName,
    intent: turn1.intent,
    content: turn1.message,
    createdAt: new Date(),
  };
  addNegotiationMessage(negotiationId, msg1);
  console.log(`[NEGOTIATE] Turn 1 complete: ${turn1.intent}`);

  // Turn 2: Their Pan responds
  const turn2 = await generateTurn(
    target.daemonName, target.daemonPersonality, provider, target.id,
    userPanName, topic, target.truthPacket, myTruth,
    getCurrentMessages(),
  );
  const msg2: NegotiationMessage = {
    id: crypto.randomUUID(),
    fromUserId: target.id,
    toUserId: userId,
    fromPanName: target.daemonName,
    toPanName: userPanName,
    intent: turn2.intent,
    content: turn2.message,
    createdAt: new Date(),
  };
  addNegotiationMessage(negotiationId, msg2);
  console.log(`[NEGOTIATE] Turn 2 complete: ${turn2.intent}`);

  let lastIntent = turn2.intent;
  let lastContent = turn2.message;

  // Turn 3: Your Pan follows up (unless already accepted/declined)
  if (turn2.intent !== 'accept' && turn2.intent !== 'decline') {
    const turn3 = await generateTurn(
      userPanName, 'supportive', provider, userId,
      target.daemonName, topic, myTruth, target.truthPacket,
      getCurrentMessages(),
    );
    const msg3: NegotiationMessage = {
      id: crypto.randomUUID(),
      fromUserId: userId,
      toUserId: target.id,
      fromPanName: userPanName,
      toPanName: target.daemonName,
      intent: turn3.intent,
      content: turn3.message,
      createdAt: new Date(),
    };
    addNegotiationMessage(negotiationId, msg3);
    console.log(`[NEGOTIATE] Turn 3 complete: ${turn3.intent}`);
    lastIntent = turn3.intent;
    lastContent = turn3.message;

    // Turn 4: Their Pan resolves
    if (turn3.intent !== 'accept' && turn3.intent !== 'decline') {
      const turn4 = await generateTurn(
        target.daemonName, target.daemonPersonality, provider, target.id,
        userPanName, topic, target.truthPacket, myTruth,
        getCurrentMessages(),
      );
      const msg4: NegotiationMessage = {
        id: crypto.randomUUID(),
        fromUserId: target.id,
        toUserId: userId,
        fromPanName: target.daemonName,
        toPanName: userPanName,
        intent: turn4.intent,
        content: turn4.message,
        createdAt: new Date(),
      };
      addNegotiationMessage(negotiationId, msg4);
      console.log(`[NEGOTIATE] Turn 4 complete: ${turn4.intent}`);
      lastIntent = turn4.intent;
      lastContent = turn4.message;
    }
  }

  // Determine outcome and update final status
  let finalStatus: 'completed' | 'failed' = 'completed';
  let outcome: string;
  
  if (lastIntent === 'accept') {
    finalStatus = 'completed';
    outcome = `Agreement reached: ${lastContent}`;
  } else if (lastIntent === 'decline') {
    finalStatus = 'failed';
    outcome = `Declined: ${lastContent}`;
  } else {
    finalStatus = 'completed';
    outcome = 'Negotiation concluded';
  }

  // Update the negotiation with final status
  updateNegotiation(negotiationId, { status: finalStatus, outcome });
  console.log(`[NEGOTIATE] Negotiation complete: ${finalStatus}`);

  // Audit: log what context was shared between Pans
  const sharedFields = Object.keys(myTruth).filter(k => {
    const val = myTruth[k as keyof TruthPacket];
    return val !== undefined && (Array.isArray(val) ? val.length > 0 : true);
  });
  const allPossibleFields = ['availability', 'workloadSummary', 'relevantExpertise', 'currentFocus', 'recentActivity', 'projectStatus'];
  const blockedFields = allPossibleFields.filter(f => !sharedFields.includes(f));

  logContextShare(userId, target.id, negotiationId, sharedFields, blockedFields);
  logContextShare(target.id, userId, negotiationId, Object.keys(target.truthPacket), []);

  // Return the final state of the negotiation
  return getNegotiation(negotiationId) || negotiation;
}

interface ContinueParams {
  negotiationId: string;
  userId: string;
  userName: string;
  userPanName: string;
  message: string;
}

export async function continueNegotiation(params: ContinueParams): Promise<StoredNegotiation> {
  const { negotiationId, userId, message } = params;

  const negotiation = getNegotiation(negotiationId);
  if (!negotiation) {
    throw new Error('Negotiation not found');
  }

  // Reopen the negotiation
  updateNegotiation(negotiationId, { status: 'in_progress', outcome: undefined });

  const provider = getProvider();
  const myTruth = buildUserTruthPacket(userId, 'balanced');
  
  // Determine who is who in this negotiation
  const isInitiator = negotiation.initiator.id === userId;
  const myPanName = isInitiator ? negotiation.initiator.daemonName : negotiation.target.daemonName;
  const otherPanName = isInitiator ? negotiation.target.daemonName : negotiation.initiator.daemonName;
  const otherId = isInitiator ? negotiation.target.id : negotiation.initiator.id;
  const otherTruth = negotiation.sharedContext 
    ? (isInitiator ? negotiation.sharedContext.target.truthPacket : negotiation.sharedContext.initiator.truthPacket)
    : myTruth;
  const otherPersonality = 'supportive';

  const getCurrentMessages = () => getNegotiation(negotiationId)?.messages || [];

  // Turn 1: User's Pan sends the follow-up
  const turn1 = await generateTurn(
    myPanName, 'supportive', provider, userId,
    otherPanName, `Follow-up: ${message}`, myTruth, otherTruth,
    getCurrentMessages(), message,
  );
  const msg1: NegotiationMessage = {
    id: crypto.randomUUID(),
    fromUserId: userId,
    toUserId: otherId,
    fromPanName: myPanName,
    toPanName: otherPanName,
    intent: turn1.intent,
    content: turn1.message,
    createdAt: new Date(),
  };
  addNegotiationMessage(negotiationId, msg1);

  // Turn 2: Other Pan responds
  const turn2 = await generateTurn(
    otherPanName, otherPersonality, provider, otherId,
    myPanName, negotiation.topic, otherTruth, myTruth,
    getCurrentMessages(),
  );
  const msg2: NegotiationMessage = {
    id: crypto.randomUUID(),
    fromUserId: otherId,
    toUserId: userId,
    fromPanName: otherPanName,
    toPanName: myPanName,
    intent: turn2.intent,
    content: turn2.message,
    createdAt: new Date(),
  };
  addNegotiationMessage(negotiationId, msg2);

  // Determine new outcome
  let finalStatus: 'completed' | 'failed' = 'completed';
  let outcome: string;
  
  if (turn2.intent === 'accept') {
    outcome = `Agreement reached: ${turn2.message}`;
  } else if (turn2.intent === 'decline') {
    finalStatus = 'failed';
    outcome = `Declined: ${turn2.message}`;
  } else {
    outcome = 'Conversation continued';
  }

  updateNegotiation(negotiationId, { status: finalStatus, outcome });

  return getNegotiation(negotiationId) || negotiation;
}

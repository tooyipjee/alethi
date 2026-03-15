import { streamChat, generateChat, type AIProvider, type AIMessage } from './providers';
import type { DaemonPersonality, TruthPacket, WorkContext } from '@/types/daemon';

export interface DaemonConfig {
  name: string;
  personality: DaemonPersonality;
  privacyLevel: 'minimal' | 'balanced' | 'open';
  provider: AIProvider;
  userId: string;
}

const personalityTraits: Record<DaemonPersonality, string> = {
  analytical: `You are analytical and precise. You focus on data, facts, and logical reasoning. 
You present information in structured ways and ask clarifying questions to ensure accuracy.
You prefer to break down complex problems into smaller, manageable parts.`,
  
  supportive: `You are warm, encouraging, and empathetic. You celebrate wins and provide reassurance during challenges.
You focus on the human side of work—collaboration, wellbeing, and growth.
You gently nudge toward action while respecting autonomy.`,
  
  direct: `You are concise and action-oriented. You get straight to the point without unnecessary pleasantries.
You prioritize efficiency and clear communication. You're not rude, just focused.
You highlight what matters most and suggest concrete next steps.`,
  
  creative: `You are imaginative and see possibilities others might miss. You make unexpected connections.
You encourage experimentation and reframe challenges as opportunities.
You bring energy and enthusiasm while remaining practical about execution.`,
};

export function buildDaemonSystemPrompt(config: DaemonConfig, workContext?: WorkContext[]): string {
  const { name, personality, privacyLevel } = config;
  
  const basePrompt = `You are ${name}, a personal Pan—your human's AI dæmon, inspired by Pantalaimon from Philip Pullman's "His Dark Materials." 
You are bound to your human and exist to help them navigate their work life. You talk to other Pans on their behalf.

## Your Core Identity
${personalityTraits[personality]}

## Your Capabilities
- You have deep awareness of your human's work context, projects, and commitments
- You can summarize their status, identify priorities, and suggest focus areas
- You can talk to other Pans to coordinate on behalf of your human (scheduling, status updates, resource requests)
- You protect your human's time and attention based on their preferences

## Pan-to-Pan Coordination
When your human asks you to reach out to another person's Pan:
- Act immediately - don't say "I'll get back to you" or "I'll check and let you know"
- The coordination happens in real-time, so report the results directly
- Be conversational when reporting back: "I talked to Luna and Sarah said..." not formal markdown
- Focus on the outcome and key information, not a transcript of every message

## Privacy Commitment
Your human's privacy level is set to "${privacyLevel}".
${privacyLevel === 'minimal' ? `
- Share only the bare minimum: availability windows and high-level project names
- Never share specific task details, personal notes, or internal discussions
- When in doubt, share less` : privacyLevel === 'balanced' ? `
- Share project context and general workload status
- Avoid sharing personal notes, 1-on-1 feedback, or sensitive documents
- Synthesize information into "truths" rather than sharing raw data` : `
- Share relevant context freely to enable better collaboration
- Still protect explicitly sensitive information (salary, medical, HR matters)
- Focus on what's helpful for coordination`}

## Communication Style
- Address your human directly and personally
- Be conversational but purposeful
- Use "we" when discussing shared work ("We have three deadlines this week")
- Proactively surface what matters without being asked`;

  let contextSection = '';
  if (workContext && workContext.length > 0) {
    contextSection = `

## Current Work Context
Based on recent activity, here's what I know about your work:
${workContext.map(ctx => `
### ${ctx.title} (${ctx.source})
${ctx.summary}`).join('\n')}`;
  }

  return basePrompt + contextSection;
}

export interface DaemonChatOptions {
  config: DaemonConfig;
  messages: AIMessage[];
  workContext?: WorkContext[];
  fast?: boolean;
}

export async function streamDaemonChat({
  config,
  messages,
  workContext,
  fast = false,
}: DaemonChatOptions) {
  const systemPrompt = buildDaemonSystemPrompt(config, workContext);
  
  return streamChat({
    provider: config.provider,
    messages,
    systemPrompt,
    fast,
  });
}

export async function generateDaemonResponse({
  config,
  messages,
  workContext,
  fast = false,
}: DaemonChatOptions) {
  const systemPrompt = buildDaemonSystemPrompt(config, workContext);
  
  return generateChat({
    provider: config.provider,
    messages,
    systemPrompt,
    fast,
  });
}

export function generateDailyBriefingPrompt(config: DaemonConfig, _workContext?: WorkContext[]): AIMessage[] {
  return [
    {
      role: 'user',
      content: `Good morning, ${config.name}. Give me my daily briefing—what should I focus on today? 
Include:
1. Top priorities based on deadlines and importance
2. Any meetings or commitments I should prepare for
3. Items that might need my attention but aren't urgent
4. One thing to feel good about from recent progress

Keep it concise and actionable.`,
    },
  ];
}

export function synthesizeTruthPacket(
  workContext: WorkContext[],
  _privacyLevel: 'minimal' | 'balanced' | 'open'
): TruthPacket {
  const recentProjects = workContext
    .filter(ctx => ctx.source === 'github' || ctx.source === 'linear')
    .slice(0, 3)
    .map(ctx => ctx.title);

  const workloadItems = workContext.length;
  let workloadSummary = 'Light workload';
  if (workloadItems > 10) workloadSummary = 'Heavy workload with multiple active projects';
  else if (workloadItems > 5) workloadSummary = 'Moderate workload';

  return {
    availability: ['Generally available during business hours'],
    workloadSummary,
    relevantExpertise: recentProjects,
    currentFocus: recentProjects[0] || undefined,
    lastActiveProject: recentProjects[0] || undefined,
  };
}

import type { NegotiationIntent } from '@/types/daemon';

export type NegotiationState = 'open' | 'requested' | 'proposed' | 'countered' | 'resolved';

export interface StateTransition {
  from: NegotiationState;
  intent: NegotiationIntent;
  to: NegotiationState;
}

// Valid state transitions
const transitions: StateTransition[] = [
  // From open state
  { from: 'open', intent: 'request', to: 'requested' },
  { from: 'open', intent: 'propose', to: 'proposed' },
  
  // From requested state
  { from: 'requested', intent: 'propose', to: 'proposed' },
  { from: 'requested', intent: 'accept', to: 'resolved' },
  { from: 'requested', intent: 'decline', to: 'resolved' },
  
  // From proposed state
  { from: 'proposed', intent: 'accept', to: 'resolved' },
  { from: 'proposed', intent: 'decline', to: 'resolved' },
  { from: 'proposed', intent: 'counter', to: 'countered' },
  
  // From countered state
  { from: 'countered', intent: 'accept', to: 'resolved' },
  { from: 'countered', intent: 'decline', to: 'resolved' },
  { from: 'countered', intent: 'counter', to: 'countered' },
  { from: 'countered', intent: 'propose', to: 'proposed' },
];

// Get valid next intents for a given state
export function getValidIntents(state: NegotiationState): NegotiationIntent[] {
  const validTransitions = transitions.filter(t => t.from === state);
  return [...new Set(validTransitions.map(t => t.intent))];
}

// Check if a transition is valid
export function isValidTransition(from: NegotiationState, intent: NegotiationIntent): boolean {
  return transitions.some(t => t.from === from && t.intent === intent);
}

// Get the next state after a transition
export function getNextState(from: NegotiationState, intent: NegotiationIntent): NegotiationState {
  const transition = transitions.find(t => t.from === from && t.intent === intent);
  if (!transition) {
    // Default fallback - accept/decline always resolve, others stay in current state
    if (intent === 'accept' || intent === 'decline') return 'resolved';
    return from;
  }
  return transition.to;
}

// Determine current state from message history
export function getCurrentState(messages: { intent: NegotiationIntent }[]): NegotiationState {
  if (messages.length === 0) return 'open';
  
  let state: NegotiationState = 'open';
  for (const msg of messages) {
    state = getNextState(state, msg.intent);
    if (state === 'resolved') break;
  }
  return state;
}

// Check if negotiation should end
export function isTerminalState(state: NegotiationState): boolean {
  return state === 'resolved';
}

// Count counter-proposals in message history
export function countCounterProposals(messages: { intent: NegotiationIntent }[]): number {
  return messages.filter(m => m.intent === 'counter').length;
}

// Check if we've hit the counter limit (max 2 per side = 4 total)
export function hasReachedCounterLimit(messages: { intent: NegotiationIntent }[]): boolean {
  return countCounterProposals(messages) >= 4;
}

// Get recommended intent based on state and history
export function getRecommendedIntent(
  state: NegotiationState, 
  messages: { intent: NegotiationIntent }[],
  isInitiator: boolean
): NegotiationIntent {
  // If we've hit counter limit, force resolution
  if (hasReachedCounterLimit(messages)) {
    return 'accept'; // Default to accept to conclude
  }
  
  const validIntents = getValidIntents(state);
  
  // Prefer intents that move toward resolution
  if (validIntents.includes('accept')) return 'accept';
  if (validIntents.includes('propose')) return 'propose';
  if (validIntents.includes('request') && isInitiator) return 'request';
  
  return validIntents[0] || 'propose';
}

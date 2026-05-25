/**
 * WHAT: Detects whether a card thread's latest note is an agent answer.
 * WHY: Cards need a compact visual signal when the operator has a fresh agent response.
 */
import { state } from '../../state.js';

export function cardHasAgentLastAnswer(cardId: string): boolean {
  const ledger = state.activeLedger as { notes?: Record<string, Array<Record<string, unknown>>> } | null;
  const notes = ledger?.notes?.[`thread-${cardId}`] ?? [];
  const last = notes.at(-1);
  const role = String(last?.role ?? last?.source ?? '').toLowerCase();
  return role === 'agent' || role === 'assistant';
}

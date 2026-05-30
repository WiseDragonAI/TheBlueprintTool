/**
 * WHAT: Resolves the visible workflow status for a ledger card.
 * WHY: Card chrome needs one status indicator while processing remains derived from thread ownership.
 */
import { state } from '../../state.js';

export type CardPersistedWorkStatus = 'todo' | 'done';
export type CardVisibleWorkStatus = CardPersistedWorkStatus | 'processing';

function latestThreadRole(cardId: string): string {
  const ledger = state.activeLedger as { notes?: Record<string, Array<Record<string, unknown>>> } | null;
  const notes = ledger?.notes?.[`thread-${cardId}`] ?? [];
  const last = notes.at(-1);
  return String(last?.role ?? last?.source ?? '').toLowerCase();
}

export function cardPersistedWorkStatus(card: Record<string, unknown>): CardPersistedWorkStatus {
  return card.status === 'done' ? 'done' : 'todo';
}

export function resolveCardWorkStatus(card: Record<string, unknown>): CardVisibleWorkStatus {
  const persistedStatus = cardPersistedWorkStatus(card);
  if (persistedStatus === 'done') return 'done';

  const role = latestThreadRole(String(card.id ?? ''));
  if (role === 'operator') return 'processing';

  return 'todo';
}

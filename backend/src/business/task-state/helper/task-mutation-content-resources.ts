/**
 * WHAT: Derives the Markdown resources written by one scoped task mutation.
 * WHY: The causal mutation must persist exact content heads without scanning unrelated cards.
 */
import type { LedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';

type AnyRecord = Record<string, unknown>;

export function taskMutationContentResources(mutation: LedgerMutation, before: AnyRecord, after: AnyRecord): string[] {
  const beforeCards = Array.isArray(before.cards) ? before.cards as AnyRecord[] : [];
  const afterCards = Array.isArray(after.cards) ? after.cards as AnyRecord[] : [];
  const cardIds = new Set<string>();
  // WHAT: Capture the existing card file changed by a body edit or image removal.
  // WHY: Both mutations rewrite Markdown without creating a new card identity.
  if ((mutation.action === 'patch-card' && typeof mutation.cardPatch?.description === 'string') || mutation.action === 'delete-card-image') {
    cardIds.add(String(mutation.cardPatch?.id ?? mutation.cardId ?? ''));
  }
  // WHAT: Capture the one card created by the single-card commands.
  // WHY: Their Markdown is externalized before Epoch 4 persistence.
  if (mutation.action === 'create-card' || mutation.action === 'create-task-intake') {
    cardIds.add(String(mutation.card?.id ?? ''));
  }
  // WHAT: Capture every card externalized by one master-task command.
  // WHY: The master and subtasks must become reachable in the same causal update.
  if (mutation.action === 'create-master-task') {
    cardIds.add(String(mutation.card?.id ?? ''));
    for (const card of mutation.cards ?? []) cardIds.add(String(card.id ?? ''));
  }
  // WHAT: Capture only cards newly introduced by a paste.
  // WHY: Existing selected cards are not rewritten by this command.
  if (mutation.action === 'paste-selection') {
    const priorCardIds = new Set(beforeCards.map((card) => String(card.id ?? '')));
    for (const card of afterCards) {
      const cardId = String(card.id ?? '');
      if (!priorCardIds.has(cardId)) cardIds.add(cardId);
    }
  }
  const resources = [...cardIds].filter(Boolean).flatMap((cardId) => {
    const card = afterCards.find((candidate) => String(candidate.id ?? '') === cardId);
    const comment = card?.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
      ? card.comment as AnyRecord
      : {};
    return typeof comment.contentFile === 'string' && comment.contentFile ? [comment.contentFile] : [];
  });
  // WHAT: Include the empty thread sidecars created with new task cards.
  // WHY: A later reader must never interpret a missing local thread file as empty content.
  if (mutation.action === 'create-card' || mutation.action === 'create-task-intake' || mutation.action === 'create-master-task') {
    const threadFiles = after.threadFiles && typeof after.threadFiles === 'object' && !Array.isArray(after.threadFiles)
      ? after.threadFiles as AnyRecord
      : {};
    for (const cardId of cardIds) {
      const resource = threadFiles[`thread-${cardId}`];
      if (typeof resource === 'string' && resource) resources.push(resource);
    }
  }
  return [...new Set(resources)];
}

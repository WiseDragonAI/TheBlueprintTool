/**
 * WHAT: Resolves whether a thread belongs to a card in the active ledger.
 * WHY: Thread-panel Codex runs can attach their widget only to card targets.
 */
export function threadCodexCardId(ledger: Record<string, any> | null | undefined, threadId: string): string {
  const cardId = String(threadId ?? '').replace(/^thread-/, '').trim();
  if (!cardId || !Array.isArray(ledger?.cards)) return '';
  return ledger.cards.some((card: Record<string, unknown>) => String(card.id ?? '') === cardId) ? cardId : '';
}

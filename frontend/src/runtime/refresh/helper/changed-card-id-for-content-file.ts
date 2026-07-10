/**
 * WHAT: Resolves a normalized card content file reference to its active-ledger card ID.
 * WHY: Content-driven resizing must target only the card that owns the changed Markdown file.
 */
import { state } from '../../state.js';
import { normalizeContentFileReference } from '../../thread/effect/load-active-thread-slice.js';

export function changedCardIdForContentFile(contentFile: string): string {
  const target = normalizeContentFileReference(contentFile);
  // WHAT: Reject empty file references before scanning active cards.
  // WHY: An unscoped event must never match a card with missing metadata.
  if (!target) return '';
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  for (const card of cards) {
    const comment = card.comment && typeof card.comment === 'object' ? card.comment as Record<string, unknown> : {};
    // WHAT: Return only the exact normalized content-file owner.
    // WHY: Card identity must not be inferred from filenames or event order.
    if (normalizeContentFileReference(comment.contentFile) === target) return String(card.id ?? '');
  }
  return '';
}

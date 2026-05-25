/**
 * WHAT: Resolves the visible title for the active thread target.
 * WHY: The notes panel should identify the card or zone by name, not only by thread id.
 */
import { state } from '../../state.js';

export function resolveThreadTargetTitle(threadId: string): string {
  const escapedThreadId = globalThis.CSS?.escape ? CSS.escape(threadId) : threadId.replace(/["\\]/g, '\\$&');
  const target = threadId ? document.querySelector(`[data-thread-id="${escapedThreadId}"]`) as HTMLElement | null : null;
  const domTitle = target?.querySelector('.ledger-card-title, .zone-title, strong')?.textContent?.trim();
  if (domTitle) return domTitle;
  const id = threadId.replace(/^thread-/, '');
  const ledger = state.activeLedger as { cards?: Array<Record<string, unknown>>; annotations?: Array<Record<string, unknown>> } | null;
  const card = ledger?.cards?.find((entry) => String(entry.id ?? '') === id);
  if (card) return String(card.title ?? id);
  const annotation = ledger?.annotations?.find((entry) => String(entry.id ?? '') === id);
  if (annotation) return String(annotation.label ?? id);
  return threadId ? id : '';
}

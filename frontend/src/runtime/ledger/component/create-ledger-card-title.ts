/**
 * WHAT: Creates one ledger card title node with the runtime text formatting.
 * WHY: Card detail and low-detail overview both need the same title construction without duplicating DOM logic.
 */
import { appendTitleText } from './append-title-text.js';

export function createLedgerCardTitle(card: Record<string, unknown>, id: string, className = 'ledger-card-title'): HTMLElement {
  const title = document.createElement('strong');
  title.className = className;
  appendTitleText(title, String(card.title ?? id));
  return title;
}

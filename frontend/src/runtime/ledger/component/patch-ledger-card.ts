import { ledgerCardBody } from '../helper/ledger-card-body.js';

export function patchLedgerCard(card: Record<string, unknown>): HTMLElement {
  const element = document.createElement('article');
  const id = String(card.id ?? '');
  element.className = 'card ledger-node';
  element.dataset.cardId = id;
  element.dataset.threadId = `thread-${id}`;
  element.dataset.ledgerNode = 'card';
  element.style.left = `${Number(card.x ?? 0)}px`;
  element.style.top = `${Number(card.y ?? 0)}px`;
  element.style.width = `${Math.max(220, Number(card.w ?? 280))}px`;
  const hash = document.createElement('span');
  hash.className = 'hash';
  hash.textContent = `#${id}`;
  const title = document.createElement('strong');
  title.textContent = String(card.title ?? id);
  const body = document.createElement('p');
  body.textContent = ledgerCardBody(card);
  element.append(hash, title, body);
  return element;
}

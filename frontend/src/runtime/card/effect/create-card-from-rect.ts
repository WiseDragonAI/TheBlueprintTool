import { content } from '../../dom.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function createCardFromRect(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  const cardId = `card-draft-${state.cardCounter++}`;
  const card = {
    id: cardId,
    title: 'New card',
    cardType: 'note',
    domainId: state.activeTab,
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    w: Math.max(260, rect.width),
    comment: { what: 'New description' },
  };

  if (state.activeLedger) {
    const committed = await commitActiveLedgerMutation({ action: 'create-card', card });
    if (committed) {
      state.selection = { cardIds: [cardId], zoneIds: [], groupIds: [] };
      telemetry('render-card-layer', { created: cardId, activeTab: state.activeTab, authority: 'server' });
    }
    return;
  }

  const element = document.createElement('article');
  element.className = 'card selected';
  element.dataset.cardId = cardId;
  element.dataset.threadId = `thread-${cardId}`;
  element.style.left = `${card.x}px`;
  element.style.top = `${card.y}px`;
  element.style.width = `${card.w}px`;
  element.innerHTML = '<span class="hash"></span><strong class="ledger-card-title">New card</strong><div class="ledger-card-body"><p>New description</p></div>';
  content.insertBefore(element, content.querySelector('.marquee'));
  state.selection = { cardIds: [cardId], zoneIds: [], groupIds: [] };
  telemetry('commit-static-surface-edit', { createCard: cardId, geometry: rect });
  telemetry('render-card-layer', { created: cardId });
}

import { content } from '../../dom.js';
import { createCardResizeHandles } from '../component/create-card-resize-handles.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { createLedgerObjectId } from '../../ledger/helper/create-ledger-object-id.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function createCardFromRect(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  const cardId = createLedgerObjectId('card');
  const card = {
    id: cardId,
    title: 'New card',
    cardType: 'note',
    domainId: state.activeTab,
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    w: Math.max(260, rect.width),
    h: Math.max(132, rect.height),
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
  element.style.height = `${card.h}px`;
  element.replaceChildren(
    ...createCardResizeHandles(),
    Object.assign(document.createElement('span'), { className: 'hash' }),
    Object.assign(document.createElement('strong'), { className: 'ledger-card-title', textContent: 'New card' }),
    Object.assign(document.createElement('div'), { className: 'ledger-card-body', innerHTML: '<p>New description</p>' })
  );
  content.insertBefore(element, content.querySelector('.marquee'));
  state.selection = { cardIds: [cardId], zoneIds: [], groupIds: [] };
  telemetry('commit-static-surface-edit', { createCard: cardId, geometry: rect });
  telemetry('render-card-layer', { created: cardId });
}

/**
 * WHAT: Creates a canvas card from a drawn rectangle in active-ledger or standalone DOM mode.
 * WHY: Draw gestures need immediate local feedback while active-ledger persistence reconciles asynchronously.
 */
import { content } from '../../dom.js';
import { createCardResizeHandles } from '../component/create-card-resize-handles.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { createLedgerObjectId } from '../../ledger/helper/create-ledger-object-id.js';
import { createLedgerCardTitleRow } from '../../ledger/component/render-ledger-card-detail-layer.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { insertActiveLedgerCard } from '../../ledger/helper/active-ledger-geometry.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { selectTarget } from '../../selection/controller/select-target.js';

export async function createCardFromRect(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  const cardId = createLedgerObjectId('card');
  const card = {
    id: cardId,
    title: state.canvasMode === 'ledgers' ? 'New Ledger' : 'New card',
    cardType: state.canvasMode === 'ledgers' ? 'ledger' : 'note',
    domainId: state.canvasMode === 'ledgers' ? 'ledgers' : state.activeTab,
    status: 'todo',
    x: rect.x,
    y: rect.y,
    w: Math.max(260, rect.width),
    h: Math.max(132, rect.height),
    comment: { what: 'New description' },
  };

  // WHAT: Insert and render the card immediately when ledger state owns the canvas.
  // WHY: The operator should not wait for a server round trip before seeing the drawn record.
  if (state.activeLedger) {
    insertActiveLedgerCard(card);
    refreshZoneAttributionCache('optimistic-create-card');
    telemetry('render-card-layer', { created: cardId, activeTab: state.activeTab, authority: 'optimistic-client' });
    renderCanvasSurface({ renderThreadPanel: false });
    selectTarget('card', cardId, false);
    await commitActiveLedgerMutation({ action: 'create-card', card });
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
    createLedgerCardTitleRow(card, cardId),
    Object.assign(document.createElement('div'), { className: 'ledger-card-body', innerHTML: '<p>New description</p>' })
  );
  content.insertBefore(element, content.querySelector('.marquee'));
  selectTarget('card', cardId, false);
  telemetry('commit-static-surface-edit', { createCard: cardId, geometry: rect });
  telemetry('render-card-layer', { created: cardId });
}

/**
 * WHAT: Creates a canvas card from a drawn rectangle in active-ledger or standalone DOM mode.
 * WHY: Draw gestures need immediate local feedback while active-ledger persistence reconciles asynchronously.
 */
import { content } from '../../dom.js';
import { createCardResizeHandles } from '../component/create-card-resize-handles.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
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
  if (state.activeLedger && state.canvasMode === 'ledger') {
    const previousSelection = structuredClone(state.selection);
    await runOptimisticActiveLedgerMutation({
      mutation: { action: 'create-card', card },
      apply: (ledger) => {
        ledger.cards = (ledger.cards ?? []).filter((entry: Record<string, unknown>) => String(entry.id ?? '') !== cardId).concat(structuredClone(card));
      },
      render: (outcome) => {
        if (outcome === 'rejected') state.selection = previousSelection;
        refreshZoneAttributionCache(`optimistic-create-card:${outcome}`);
        telemetry('render-card-layer', { created: cardId, activeTab: state.activeTab, authority: 'optimistic-client', outcome });
        renderCanvasSurface({ renderThreadPanel: false });
        if (outcome === 'optimistic') selectTarget('card', cardId, false);
      },
    });
    return;
  }
  if (state.activeLedger) {
    insertActiveLedgerCard(card);
    await commitActiveLedgerMutation({ action: 'create-card', card }, { render: true });
    return;
  }

  // WHAT: Build a standalone DOM card when no active ledger state owns the canvas.
  // WHY: Static canvas mode has no ledger render pass to materialize the drawn card.
  const element = document.createElement('article');
  element.className = 'card';
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
  // WHAT: Select after insertion so the selection renderer can update the new DOM node.
  // WHY: selectTarget is the single owner of thread preparation and selected classes.
  selectTarget('card', cardId, false);
  telemetry('commit-static-surface-edit', { createCard: cardId, geometry: rect });
  telemetry('render-card-layer', { created: cardId });
}

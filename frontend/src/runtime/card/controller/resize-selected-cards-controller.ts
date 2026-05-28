import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { state } from '../../state.js';
import { resizeSelectedCardsToContent } from '../effect/resize-selected-cards-to-content.js';

export async function resizeSelectedCardsController(): Promise<void> {
  const cards = resizeSelectedCardsToContent();
  if (Object.keys(cards).length === 0) return;

  persistState();
  if (state.activeLedger) {
    await commitActiveLedgerMutation({ action: 'patch-geometry', geometry: { cards } }, { render: true });
    return;
  }

  renderCanvasSurface();
}

/**
 * WHAT: Runs the selected-card content-fit lifecycle and persists its resulting geometry.
 * WHY: Measurement, local persistence, and server acknowledgement need one controller boundary.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { state } from '../../state.js';
import { resizeSelectedCardsToContent } from '../effect/resize-selected-cards-to-content.js';
import { geometryRevisionSnapshot } from '../../ledger/helper/active-ledger-geometry.js';

export async function resizeSelectedCardsController(): Promise<void> {
  const geometry = resizeSelectedCardsToContent();
  if (Object.keys(geometry.cards).length === 0 && Object.keys(geometry.zones).length === 0) return;

  persistState();
  // WHAT: Submit active-ledger geometry with the exact local revisions just measured.
  // WHY: Reconciliation may acknowledge this edit without erasing a later local edit.
  if (state.activeLedger) {
    await commitActiveLedgerMutation({ action: 'patch-geometry', geometry },
      { render: true, submittedGeometryRevisions: geometryRevisionSnapshot(geometry) }
    );
    return;
  }

  renderCanvasSurface();
}

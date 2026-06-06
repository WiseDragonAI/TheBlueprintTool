/**
 * WHAT: Updates canvas detail CSS modes from the current viewport scale.
 * WHY: Zoom transitions must collapse to one low-detail mode while coordinating viewport-driven detail mounting.
 */
import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { clearMountedLedgerCardDetails } from '../../card/detail-mount/clear-mounted-ledger-card-details.js';
import { scheduleMountedLedgerCardDetailsSync } from '../../card/detail-mount/schedule-mounted-ledger-card-details-sync.js';
import { mountAllLedgerCardLowDetail } from '../../card/low-detail-mount/mount-all-ledger-card-low-detail.js';
import { unmountAllLedgerCardLowDetail } from '../../card/low-detail-mount/unmount-all-ledger-card-low-detail.js';
import { clearZoneLabelOverlay } from '../../zone/effect/clear-zone-label-overlay.js';
import { clearRelationshipLabels } from '../../relationship/effect/clear-relationship-labels.js';
import { rebuildLowDetailLedgerWorld } from '../../ledger/effect/rebuild-low-detail-ledger-world.js';
import { queryEnablesWorldResetDebug } from '../../debug/zoom-debug/helper/query-enables-world-reset-debug.js';
import { stopDetailRuntime } from '../../card/detail-runtime/stop-detail-runtime.js';
import { clearCanvasControlOverlayHoverTarget } from './clear-canvas-control-overlay-hover-target.js';

export function updateDetailMode(): void {
  const shouldUseLowDetail = state.viewport.scale < 0.35;
  const hasLowDetail = canvas.classList.contains('low-detail');
  if (hasLowDetail !== shouldUseLowDetail) {
    // Branch: The single low-detail threshold owns all zoom presentation edges now.
    if (shouldUseLowDetail) {
      stopDetailRuntime();
      clearCanvasControlOverlayHoverTarget();
      if (queryEnablesWorldResetDebug()) {
        // Branch: The world-reset debug flag rebuilds the world nodes themselves before low-detail mounts to test retained layer state.
        rebuildLowDetailLedgerWorld();
      }
      mountAllLedgerCardLowDetail();
      canvas.classList.add('low-detail');
      clearMountedLedgerCardDetails();
      clearZoneLabelOverlay();
      clearRelationshipLabels();
    } else {
      // Branch: Crossing back into detail tears down every low-detail branch before detail remount begins.
      canvas.classList.remove('low-detail');
      unmountAllLedgerCardLowDetail();
      clearZoneLabelOverlay();
      scheduleMountedLedgerCardDetailsSync(true);
    }
  }
  if (!shouldUseLowDetail) {
    // Branch: Detail mode keeps the mounted card working set aligned after zoom settles.
    scheduleMountedLedgerCardDetailsSync();
  }
}

/**
 * WHAT: Deletes one markdown image from a card through the active ledger mutation path.
 * WHY: Image removal must update the card content file and delete the workspace asset on disk.
 */
import { modal } from '../../dom.js';
import { clearCanvasMediaOverlay } from '../../canvas/effect/render-canvas-media-overlay.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteCardImageController(input: { cardId: string; imageSrc: string }): Promise<void> {
  const cardId = input.cardId;
  const imageSrc = input.imageSrc;
  if (!cardId || !imageSrc) return;
  telemetry('delete-card-image-controller', { cardId, imageSrc });
  clearCanvasMediaOverlay({ reconcilePromotedGeometry: false });
  const committed = await commitActiveLedgerMutation({ action: 'delete-card-image', cardId, imageSrc }, { render: true });
  if (!committed) return;
  modal.close?.();
}

/**
 * WHAT: Deletes one markdown image from a card through the active ledger mutation path.
 * WHY: Image removal must update the card content file and delete the workspace asset on disk.
 */
import { modal } from '../../dom.js';
import { clearCanvasMediaOverlay } from '../../canvas/effect/render-canvas-media-overlay.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { persistLedgerCardMediaCarouselDeleteHandoff } from '../../ledger/helper/persist-ledger-card-media-carousel.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

function parseCarouselSources(value?: string): string[] {
  try {
    const sources = JSON.parse(value ?? '[]');
    return Array.isArray(sources) ? sources.map((source) => String(source)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function deleteCardImageController(input: { cardId: string; imageSrc: string; carouselSources?: string; carouselSlideIndex?: string }): Promise<void> {
  const cardId = input.cardId;
  const imageSrc = input.imageSrc;
  if (!cardId || !imageSrc) return;
  telemetry('delete-card-image-controller', { cardId, imageSrc });
  persistLedgerCardMediaCarouselDeleteHandoff({
    tabId: String(state.activeTab ?? ''),
    cardId,
    imageSrc,
    sources: parseCarouselSources(input.carouselSources),
    slideIndex: Number(input.carouselSlideIndex)
  });
  clearCanvasMediaOverlay({ reconcilePromotedGeometry: false });
  const committed = await commitActiveLedgerMutation({ action: 'delete-card-image', cardId, imageSrc }, { render: true });
  if (!committed) return;
  modal.close?.();
}

/**
 * WHAT: Deletes one markdown image from a card through the active ledger mutation path.
 * WHY: Image removal must update the card content file and delete the workspace asset on disk.
 */
import { modal } from '../../dom.js';
import { clearCanvasMediaOverlay } from '../../canvas/effect/render-canvas-media-overlay.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { persistLedgerCardMediaCarouselDeleteHandoff } from '../../ledger/helper/persist-ledger-card-media-carousel.js';
import { removeMarkdownImage, sameMarkdownImageSource } from '../../ledger/helper/remove-markdown-image.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
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
  modal.close?.();
  await runOptimisticActiveLedgerMutation({
    mutation: { action: 'delete-card-image', cardId, imageSrc },
    apply: (ledger) => {
      const card = (ledger.cards ?? []).find((entry: Record<string, any>) => String(entry.id ?? '') === cardId);
      if (!card) return;
      const comment = card.comment && typeof card.comment === 'object' ? card.comment : (card.comment = {});
      const removal = removeMarkdownImage(String(comment.what ?? ''), imageSrc);
      if (removal.removed) comment.what = removal.markdown;
      if (card.imageSizes && typeof card.imageSizes === 'object') {
        for (const source of Object.keys(card.imageSizes)) if (sameMarkdownImageSource(source, imageSrc)) delete card.imageSizes[source];
      }
    },
    render: () => renderCanvasSurface(),
  });
}

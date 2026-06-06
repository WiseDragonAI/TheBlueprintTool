/**
 * WHAT: Advances a card image carousel from a Ctrl-wheel event.
 * WHY: Carousel wheel handling must stay separate from canvas viewport zoom.
 */
import { scheduleCanvasMediaOverlayRender } from '../../canvas/effect/render-canvas-media-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function advanceCarouselFromWheel(event: WheelEvent): boolean {
  if (!event.ctrlKey) {
    // Branch: Plain wheel events belong to canvas zoom, not carousel navigation.
    return false;
  }
  const target = event.target as HTMLElement | null;
  const carousel = target?.closest('.ledger-card-media-carousel') as HTMLElement | null;
  if (!carousel) {
    // Branch: Ctrl-wheel outside a carousel remains available for canvas panning.
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  const track = carousel.querySelector('.ledger-card-media-track') as HTMLElement | null;
  const slideCount = track?.children.length ?? 0;
  if (!track || slideCount <= 0) {
    // Branch: Empty carousel shells consume the event but cannot advance.
    return true;
  }
  const slideWidth = Math.max(1, track.clientWidth);
  const currentIndex = Math.round(track.scrollLeft / slideWidth);
  const wheelDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  const direction = wheelDelta < 0 ? -1 : 1;
  const nextIndex = (currentIndex + direction + slideCount) % slideCount;
  track.scrollTo({ left: nextIndex * slideWidth, behavior: 'smooth' });
  scheduleCanvasMediaOverlayRender();
  telemetry('card-image-carousel-wheel', { direction, currentIndex, nextIndex, slideCount });
  return true;
}

/**
 * WHAT: Handles canvas wheel zoom and Ctrl-wheel pan.
 * WHY: Wheel events should control canvas navigation unless an interactive child can consume them.
 */
import { state } from '../../state.js';
import { applyViewportTransform } from '../../canvas/effect/apply-viewport-transform.js';
import { scheduleViewportPersistence } from '../../persistence/effect/schedule-viewport-persistence.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { point } from '../helper/point.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { shouldCaptureWheelTarget } from '../helper/should-capture-wheel-target.js';

export const minCanvasZoomScale = 0.03;
export const maxCanvasZoomScale = 2.2;

function advanceCarouselFromWheel(event: WheelEvent): boolean {
  if (!event.ctrlKey) return false;
  const target = event.target as HTMLElement | null;
  const carousel = target?.closest('.ledger-card-media-carousel') as HTMLElement | null;
  if (!carousel) return false;
  event.preventDefault();
  event.stopPropagation();
  const track = carousel.querySelector('.ledger-card-media-track') as HTMLElement | null;
  const slideCount = track?.children.length ?? 0;
  if (!track || slideCount <= 0) return true;
  const slideWidth = Math.max(1, track.clientWidth);
  const currentIndex = Math.round(track.scrollLeft / slideWidth);
  const wheelDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  const direction = wheelDelta < 0 ? -1 : 1;
  const nextIndex = (currentIndex + direction + slideCount) % slideCount;
  track.scrollTo({ left: nextIndex * slideWidth, behavior: 'smooth' });
  telemetry('card-image-carousel-wheel', { direction, currentIndex, nextIndex, slideCount });
  return true;
}

export function handleWheel(event: WheelEvent): void {
  if (advanceCarouselFromWheel(event)) return;
  if (shouldCaptureWheelTarget(event)) return;
  event.preventDefault();
  telemetry('canvas-wheel', { deltaX: event.deltaX, deltaY: event.deltaY, ctrlKey: event.ctrlKey });
  telemetry('derive-gesture-intent', { kind: event.ctrlKey ? 'pan' : 'zoom' });
  if (event.ctrlKey) {
    state.viewport.y -= event.deltaY;
    telemetry('calculate-viewport-transform', { kind: 'pan', viewport: state.viewport });
  } else {
    const pointer = point(event);
    const oldScale = state.viewport.scale;
    const anchoredCanvasPoint = {
      x: (pointer.x - state.viewport.x) / oldScale,
      y: (pointer.y - state.viewport.y) / oldScale
    };
    const nextScale = state.viewport.scale * Math.exp(-event.deltaY * 0.0015);
    state.viewport.scale = Math.min(maxCanvasZoomScale, Math.max(minCanvasZoomScale, nextScale));
    state.viewport.x = pointer.x - anchoredCanvasPoint.x * state.viewport.scale;
    state.viewport.y = pointer.y - anchoredCanvasPoint.y * state.viewport.scale;
    telemetry('calculate-viewport-transform', { kind: 'zoom', pointer, anchoredCanvasPoint, viewport: state.viewport });
  }
  scheduleViewportPersistence();
  applyViewportTransform();
  renderRelationshipOverlay();
}

import { canvas } from '../../dom.js';

type CanvasPointBounds = {
  left: number;
  top: number;
  viewportWidth: number;
  viewportHeight: number;
};

let cachedCanvasBounds: CanvasPointBounds | null = null;

export function invalidateCanvasPointBounds(): void {
  cachedCanvasBounds = null;
}

function canvasPointBounds(): CanvasPointBounds {
  if (
    cachedCanvasBounds &&
    cachedCanvasBounds.viewportWidth === window.innerWidth &&
    cachedCanvasBounds.viewportHeight === window.innerHeight
  ) {
    return cachedCanvasBounds;
  }
  const bounds = canvas.getBoundingClientRect();
  cachedCanvasBounds = {
    left: bounds.left,
    top: bounds.top,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  };
  return cachedCanvasBounds;
}

window.addEventListener('resize', invalidateCanvasPointBounds, { passive: true });
window.visualViewport?.addEventListener('resize', invalidateCanvasPointBounds, { passive: true });
window.addEventListener('scroll', invalidateCanvasPointBounds, { passive: true, capture: true });

export function point(event: MouseEvent): { x: number; y: number } {
  const bounds = canvasPointBounds();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

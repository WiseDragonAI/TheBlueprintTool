export type ViewportRecord = { x: number; y: number; scale: number };
export type CanvasSize = { width: number; height: number };
export type CanvasBounds = { x: number; y: number; width: number; height: number };

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function viewportWorldBounds(viewport: ViewportRecord, canvasSize: CanvasSize): CanvasBounds {
  const scale = Math.max(0.0001, finiteNumber(viewport.scale, 1));
  return {
    x: -finiteNumber(viewport.x, 0) / scale,
    y: -finiteNumber(viewport.y, 0) / scale,
    width: Math.max(0, finiteNumber(canvasSize.width, 0)) / scale,
    height: Math.max(0, finiteNumber(canvasSize.height, 0)) / scale
  };
}

export function ledgerCardBounds(card: Record<string, unknown>): CanvasBounds {
  return {
    x: finiteNumber(card.x, 0),
    y: finiteNumber(card.y, 0),
    width: finiteNumber(card.w ?? card.width, 280),
    height: finiteNumber(card.h ?? card.height, 132)
  };
}

export function canvasBoundsIntersect(a: CanvasBounds, b: CanvasBounds): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export function visibleLedgerCards(cards: Array<Record<string, unknown>>, bounds: CanvasBounds): Array<Record<string, unknown>> {
  return cards.filter((card) => canvasBoundsIntersect(ledgerCardBounds(card), bounds));
}

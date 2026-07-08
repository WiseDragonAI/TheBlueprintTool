type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

const TITLE_BAND_START = 48;
const TITLE_BAND_END = 128;
const TITLE_BAND_MIN_SPAN = 24;

export function relationshipTitlePortBounds(rect: CanvasRect): { min: number; max: number } {
  const safePadding = Math.min(36, rect.height / 4);
  const safeMin = rect.top + safePadding;
  const safeMax = rect.bottom - safePadding;
  const min = Math.min(safeMax, Math.max(safeMin, rect.top + TITLE_BAND_START));
  const max = Math.min(safeMax, Math.max(min + TITLE_BAND_MIN_SPAN, rect.top + TITLE_BAND_END));
  return { min, max: Math.max(min, max) };
}

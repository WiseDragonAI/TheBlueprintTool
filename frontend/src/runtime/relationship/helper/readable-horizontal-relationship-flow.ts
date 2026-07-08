/**
 * WHAT: Detects horizontally staged cards whose relationship should read as left-to-right or right-to-left flow.
 * WHY: Large aligned cards are easier to scan when arrows attach to side title bands instead of generic shortest-path borders.
 */
type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

const MIN_READABLE_HORIZONTAL_GAP = 28;
const TITLE_ALIGNMENT_TOLERANCE = 180;
const TITLE_BAND_START = 48;
const TITLE_BAND_END = 128;
const TITLE_BAND_MIN_SPAN = 24;

export function readableHorizontalRelationshipFlow(sourceRect: CanvasRect, targetRect: CanvasRect): { sourceSide: 'left' | 'right'; targetSide: 'left' | 'right' } | null {
  if (!titleBandsAlign(sourceRect, targetRect)) return null;
  if (targetRect.left - sourceRect.right >= MIN_READABLE_HORIZONTAL_GAP) {
    return { sourceSide: 'right', targetSide: 'left' };
  }
  if (sourceRect.left - targetRect.right >= MIN_READABLE_HORIZONTAL_GAP) {
    return { sourceSide: 'left', targetSide: 'right' };
  }
  return null;
}

export function relationshipTitlePortBounds(rect: CanvasRect): { min: number; max: number } {
  const safePadding = Math.min(36, rect.height / 4);
  const safeMin = rect.top + safePadding;
  const safeMax = rect.bottom - safePadding;
  const min = Math.min(safeMax, Math.max(safeMin, rect.top + TITLE_BAND_START));
  const max = Math.min(safeMax, Math.max(min + TITLE_BAND_MIN_SPAN, rect.top + TITLE_BAND_END));
  return { min, max: Math.max(min, max) };
}

function titleBandsAlign(sourceRect: CanvasRect, targetRect: CanvasRect): boolean {
  const sourceBand = relationshipTitlePortBounds(sourceRect);
  const targetBand = relationshipTitlePortBounds(targetRect);
  const bandsOverlap = sourceBand.min <= targetBand.max && targetBand.min <= sourceBand.max;
  return bandsOverlap || Math.abs(sourceRect.top - targetRect.top) <= TITLE_ALIGNMENT_TOLERANCE;
}

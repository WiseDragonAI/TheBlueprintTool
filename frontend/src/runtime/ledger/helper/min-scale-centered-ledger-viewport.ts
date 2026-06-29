/**
 * WHAT: Computes the canonical zoomed-out entry viewport for a real ledger.
 * WHY: Opening a ledger from `/ledgers` should start from a consistent whole-ledger framing.
 */
export function minScaleCenteredLedgerViewport(input: {
  ledger: { cards?: Array<Record<string, unknown>>; annotations?: Array<Record<string, unknown>> } | null;
  canvasSize: { width: number; height: number };
  scale?: number;
}): { x: number; y: number; scale: number } {
  const scale = Number(input.scale ?? 0.03);
  let left = 0;
  let top = 0;
  let right = 5200;
  let bottom = 2600;
  let hasBounds = false;
  for (const entry of [...(input.ledger?.cards ?? []), ...(input.ledger?.annotations ?? [])]) {
    const x = Number(entry.x ?? 0);
    const y = Number(entry.y ?? 0);
    const width = Number(entry.w ?? entry.width ?? 280);
    const height = Number(entry.h ?? entry.height ?? 180);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) continue;
    if (!hasBounds) {
      left = x;
      top = y;
      right = x + width;
      bottom = y + height;
      hasBounds = true;
    } else {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + width);
      bottom = Math.max(bottom, y + height);
    }
  }
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  return {
    x: input.canvasSize.width / 2 - centerX * scale,
    y: input.canvasSize.height / 2 - centerY * scale,
    scale
  };
}

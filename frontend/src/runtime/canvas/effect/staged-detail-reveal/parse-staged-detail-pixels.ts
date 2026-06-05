/**
 * WHAT: Parses CSS or cached pixel values for staged detail reveal geometry.
 * WHY: Reveal ordering must use existing canvas data instead of layout reads during zoom transitions.
 */
export function parseStagedDetailPixels(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  if (Number.isFinite(parsed)) {
    // Branch: Trust explicit canvas geometry when style or cached values are numeric.
    return parsed;
  }
  // Branch: Fall back to stable ledger geometry when the element has no explicit pixel value.
  return fallback;
}

/**
 * WHAT: Runtime relationship helper that lists supported card border sides.
 * WHY: Port-side scoring must evaluate a canonical side set instead of relying on implicit literals.
 */
export function relationshipPortSideOptions(): string[] {
  return ['left', 'right', 'top', 'bottom'];
}

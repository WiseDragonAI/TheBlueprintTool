/**
 * WHAT: Decides whether a wheel event belongs to an interactive control instead of canvas zoom.
 * WHY: Card descriptions should fall through to zoom unless the active content can actually scroll.
 */
export function shouldCaptureWheelTarget(event: WheelEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target.closest('button,input,textarea,select,[data-action],[contenteditable="true"]')) return true;
  const capture = target.closest('[data-wheel-capture]') as HTMLElement | null;
  if (!capture) return false;
  const scrollTarget = resolveScrollableWheelTarget(capture);
  if (!scrollTarget) return false;
  const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
  return horizontal ? canScroll(scrollTarget, 'x', event.deltaX) : canScroll(scrollTarget, 'y', event.deltaY);
}

function resolveScrollableWheelTarget(capture: HTMLElement): HTMLElement | null {
  if (isScrollable(capture)) return capture;
  const activeFields = capture.matches('.ledger-card-fields-panel.is-active')
    ? capture
    : capture.querySelector('.ledger-card-fields-panel.is-active') as HTMLElement | null;
  if (activeFields && isScrollable(activeFields)) return activeFields;
  return null;
}

function isScrollable(node: HTMLElement): boolean {
  return node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth;
}

function canScroll(node: HTMLElement, axis: 'x' | 'y', delta: number): boolean {
  if (axis === 'x') {
    if (node.scrollWidth <= node.clientWidth) return false;
    if (delta < 0) return node.scrollLeft > 0;
    return node.scrollLeft + node.clientWidth < node.scrollWidth;
  }
  if (node.scrollHeight <= node.clientHeight) return false;
  if (delta < 0) return node.scrollTop > 0;
  return node.scrollTop + node.clientHeight < node.scrollHeight;
}

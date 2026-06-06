/**
 * WHAT: Resolves the canvas viewport size for ledger-space detail mount calculations.
 * WHY: Tests and embedded contexts do not always expose window dimensions, so the scheduler needs a stable fallback.
 */
import { canvas } from '../../dom.js';

export function resolveDetailMountCanvasSize(): { width: number; height: number } {
  const width = window.innerWidth || canvas.clientWidth || 0;
  const height = window.innerHeight || canvas.clientHeight || 0;
  return { width, height };
}

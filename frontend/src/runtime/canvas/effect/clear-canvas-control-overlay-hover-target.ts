/**
 * WHAT: Clears the hover-owned canvas control target.
 * WHY: Returning to low-detail must not keep a stale hovered card active in later scheduled viewport transforms.
 */
import { canvasControlOverlayHoverState } from './canvas-control-overlay-hover-state.js';

export function clearCanvasControlOverlayHoverTarget(): void {
  canvasControlOverlayHoverState.target = null;
}

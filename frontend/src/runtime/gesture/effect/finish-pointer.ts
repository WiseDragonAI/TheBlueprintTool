import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { clearPanningEffects } from './schedule-panning-effects.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';

export function finishPointer(event?: PointerEvent): void {
  state.pointer = null;
  clearPanningEffects();
  renderCanvasControlOverlay();
  if (event?.pointerId !== undefined) {
    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // Synthetic verification events may not own browser pointer capture.
    }
  }
}

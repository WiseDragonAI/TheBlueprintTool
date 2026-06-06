import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { renderCanvasControlOverlay } from '../../canvas/effect/render-canvas-control-overlay.js';
import { clearPanningEffects } from './schedule-panning-effects.js';

export function finishPointer(event?: PointerEvent): void {
  const pointerSession = state.pointer;
  state.pointer = null;
  clearPanningEffects();
  if (pointerSession?.intent === 'pan') renderCanvasControlOverlay();
  if (event?.pointerId !== undefined) {
    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // Synthetic verification events may not own browser pointer capture.
    }
  }
}

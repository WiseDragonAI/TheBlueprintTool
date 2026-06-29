/**
 * WHAT: Renders the fixed Ledgers indicator at real-ledger minimum zoom.
 * WHY: Operators need a visible affordance before the extra wheel-out enters the parent canvas.
 */
import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { minCanvasZoomScale } from '../helper/canvas-zoom-constants.js';

export function renderLedgersIndicator(): void {
  if (!canvas) return;
  let indicator = canvas.querySelector(':scope > .ledgers-min-zoom-indicator') as HTMLButtonElement | null;
  const visible = state.canvasMode === 'ledger' && Number(state.viewport.scale) <= minCanvasZoomScale + 0.00001;
  if (!visible) {
    indicator?.remove();
    return;
  }
  if (!indicator) {
    indicator = document.createElement('button');
    indicator.className = 'ledgers-min-zoom-indicator';
    indicator.type = 'button';
    indicator.dataset.action = 'open-ledgers-canvas';
    indicator.textContent = 'Ledgers';
    canvas.append(indicator);
  }
}

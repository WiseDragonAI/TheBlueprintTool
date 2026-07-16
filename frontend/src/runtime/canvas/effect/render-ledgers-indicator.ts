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
  const visible = (state.canvasMode === 'ledger' || state.canvasMode === 'ledgers')
    && Number(state.viewport.scale) <= minCanvasZoomScale + 0.00001;
  if (!visible) {
    indicator?.remove();
    return;
  }
  if (!indicator) {
    indicator = document.createElement('button');
    indicator.className = 'ledgers-min-zoom-indicator';
    indicator.type = 'button';
    canvas.append(indicator);
  }
  indicator.dataset.action = state.canvasMode === 'ledger' ? 'open-ledgers-canvas' : 'open-projects-canvas';
  indicator.textContent = state.canvasMode === 'ledger' ? 'Ledgers' : 'Projects';
}

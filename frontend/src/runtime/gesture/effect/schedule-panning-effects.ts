import { canvas } from '../../dom.js';
import { state } from '../../state.js';

let enableFrame = 0;
let disableFrame = 0;

export function schedulePanningEffects(): void {
  if (disableFrame) {
    cancelAnimationFrame(disableFrame);
    disableFrame = 0;
  }
  if (enableFrame || canvas.classList.contains('is-panning')) return;
  enableFrame = requestAnimationFrame(() => {
    enableFrame = 0;
    if (state.pointer?.intent === 'pan') canvas.classList.add('is-panning');
  });
}

export function clearPanningEffects(): void {
  if (enableFrame) {
    cancelAnimationFrame(enableFrame);
    enableFrame = 0;
  }
  if (disableFrame) return;
  disableFrame = requestAnimationFrame(() => {
    disableFrame = 0;
    canvas.classList.remove('is-panning');
  });
}

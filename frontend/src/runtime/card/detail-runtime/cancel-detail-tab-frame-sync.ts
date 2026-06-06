/**
 * WHAT: Cancels delayed detail tab-frame measurement callbacks.
 * WHY: Low-detail mode cannot inherit detail-mode RAF or font-ready follow-up layout work.
 */
import { detailRuntimeState } from './state.js';

export function cancelDetailTabFrameSync(): void {
  if (detailRuntimeState.tabFrameRafA) {
    cancelAnimationFrame(detailRuntimeState.tabFrameRafA);
    detailRuntimeState.tabFrameRafA = 0;
  }
  if (detailRuntimeState.tabFrameRafB) {
    cancelAnimationFrame(detailRuntimeState.tabFrameRafB);
    detailRuntimeState.tabFrameRafB = 0;
  }
  detailRuntimeState.tabFrameFontsEpoch += 1;
}

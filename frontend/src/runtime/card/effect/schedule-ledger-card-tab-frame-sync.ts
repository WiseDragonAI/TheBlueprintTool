import { syncLedgerCardTabFrames } from './sync-ledger-card-tab-frames.js';
import { detailRuntimeState } from '../detail-runtime/state.js';

export function scheduleLedgerCardTabFrameSync(root: ParentNode = document): void {
  detailRuntimeState.tabFrameFontsEpoch += 1;
  const fontsEpoch = detailRuntimeState.tabFrameFontsEpoch;
  syncLedgerCardTabFrames(root);
  detailRuntimeState.tabFrameRafA = requestAnimationFrame(() => {
    detailRuntimeState.tabFrameRafA = 0;
    syncLedgerCardTabFrames(root);
    detailRuntimeState.tabFrameRafB = requestAnimationFrame(() => {
      detailRuntimeState.tabFrameRafB = 0;
      syncLedgerCardTabFrames(root);
    });
  });
  void document.fonts?.ready?.then(() => {
    // Branch: A newer detail-runtime epoch or a low-detail teardown invalidates this deferred measurement pass.
    if (fontsEpoch !== detailRuntimeState.tabFrameFontsEpoch) return;
    syncLedgerCardTabFrames(root);
  });
}

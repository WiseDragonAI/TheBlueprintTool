import { syncLedgerCardTabFrames } from './sync-ledger-card-tab-frames.js';

export function scheduleLedgerCardTabFrameSync(root: ParentNode = document): void {
  syncLedgerCardTabFrames(root);
  requestAnimationFrame(() => {
    syncLedgerCardTabFrames(root);
    requestAnimationFrame(() => syncLedgerCardTabFrames(root));
  });
  void document.fonts?.ready?.then(() => syncLedgerCardTabFrames(root));
}

import { syncLedgerCardTabFrames } from './sync-ledger-card-tab-frames.js';
import { detailRuntimeState } from '../detail-runtime/state.js';

export function watchLedgerCardTabFrameSize(root: ParentNode = document): void {
  detailRuntimeState.tabFrameObserver?.disconnect();
  detailRuntimeState.tabFrameObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const frame = entry.target.closest?.('.ledger-card-tab-frame') as HTMLElement | null;
      if (frame) syncLedgerCardTabFrames(frame);
    }
  });
  for (const description of Array.from(root.querySelectorAll('.ledger-card-description-panel')) as HTMLElement[]) {
    detailRuntimeState.tabFrameObserver.observe(description);
  }
}

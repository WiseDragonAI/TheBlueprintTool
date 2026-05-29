import { syncLedgerCardTabFrames } from './sync-ledger-card-tab-frames.js';

let observer: ResizeObserver | null = null;

export function watchLedgerCardTabFrameSize(root: ParentNode = document): void {
  observer?.disconnect();
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const frame = entry.target.closest?.('.ledger-card-tab-frame') as HTMLElement | null;
      if (frame) syncLedgerCardTabFrames(frame);
    }
  });
  for (const description of Array.from(root.querySelectorAll('.ledger-card-description-panel')) as HTMLElement[]) {
    observer.observe(description);
  }
}

/**
 * WHAT: Tears down delayed detail-runtime measurement work.
 * WHY: The low-detail lifecycle needs one explicit boundary that clears detail-only schedulers and observers.
 */
import { cancelDetailTabFrameSync } from './cancel-detail-tab-frame-sync.js';
import { disconnectDetailTabFrameObserver } from './disconnect-detail-tab-frame-observer.js';

export function stopDetailRuntime(): void {
  cancelDetailTabFrameSync();
  disconnectDetailTabFrameObserver();
}

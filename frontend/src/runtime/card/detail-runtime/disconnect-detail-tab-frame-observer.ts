/**
 * WHAT: Disconnects the shared detail tab-frame resize observer.
 * WHY: Detail-only resize measurement must stop immediately when the runtime collapses to low-detail.
 */
import { detailRuntimeState } from './state.js';

export function disconnectDetailTabFrameObserver(): void {
  detailRuntimeState.tabFrameObserver?.disconnect();
  detailRuntimeState.tabFrameObserver = null;
}

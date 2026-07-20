/**
 * WHAT: Returns the canonical per-thread active-surface map.
 * WHY: Selection, entry, and rendering must repair legacy sessions through the same boundary.
 */
import { state, type ThreadPanelTab } from '../../state.js';

export function threadPanelTabState(): Record<string, ThreadPanelTab> {
  // WHAT: Replace an absent or malformed restored map with an empty session map.
  // WHY: Older persisted sessions predate independent thread surfaces.
  if (!state.threadActiveTabByThreadId || typeof state.threadActiveTabByThreadId !== 'object' || Array.isArray(state.threadActiveTabByThreadId)) {
    state.threadActiveTabByThreadId = {};
  }
  return state.threadActiveTabByThreadId as Record<string, ThreadPanelTab>;
}

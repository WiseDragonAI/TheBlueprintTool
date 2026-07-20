/**
 * WHAT: Resolves one thread's active viewport surface.
 * WHY: Every entry path must normalize missing legacy state to the conversation surface.
 */
import { state, type ThreadPanelTab } from '../../state.js';
import { threadPanelTabState } from './thread-panel-tab-state.js';

export function activeThreadPanelTab(threadId = String(state.threadId ?? '')): ThreadPanelTab {
  const tabs = threadPanelTabState();
  // WHAT: Use the conversation surface when no thread identity is active.
  // WHY: Callers need a valid surface before a default thread is selected.
  if (!threadId) return 'thread';
  // WHAT: Normalize missing and invalid entries to the conversation surface.
  // WHY: Only an explicit `codex-log` selection may activate the diagnostic viewport.
  if (tabs[threadId] !== 'codex-log') tabs[threadId] = 'thread';
  return tabs[threadId];
}

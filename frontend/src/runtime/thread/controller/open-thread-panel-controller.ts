/**
 * WHAT: Performs the complete transition into an open thread panel.
 * WHY: Desktop and responsive entry paths must share selection, surface activation, pin intent, and render order.
 */
import { state } from '../../state.js';
import { renderThreadPanel } from '../effect/render-thread-panel.js';
import { selectThread } from '../effect/select-thread.js';
import { requestThreadViewportEntry } from '../effect/request-thread-viewport-entry.js';
import { activeThreadPanelTab } from '../helper/active-thread-panel-tab.js';

export function openThreadPanelController(threadId = String(state.threadId ?? '') || 'conversation-ledger'): void {
  // WHAT: Resolve a requested thread before the panel becomes visible.
  // WHY: The entry request must carry the final thread identity.
  if (String(state.threadId ?? '') !== threadId) selectThread(threadId, { requestViewportEntry: false });
  // WHAT: Stop when voice ownership prevented the requested selection.
  // WHY: Opening a different thread while recording would detach the active capture.
  if (String(state.threadId ?? '') !== threadId) return;
  state.threadPanelOpen = true;
  const surface = activeThreadPanelTab(threadId);
  requestThreadViewportEntry(threadId, surface, 'panel-open');
  renderThreadPanel();
}

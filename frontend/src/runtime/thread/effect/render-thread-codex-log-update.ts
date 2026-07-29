/**
 * WHAT: Renders a live Codex Log continuation without repainting the conversation panel.
 * WHY: Log polling must not suppress or overwrite an operator's conversation scroll input.
 */
import { state } from '../../state.js';
import { activeThreadPanelTab } from '../helper/active-thread-panel-tab.js';
import { applyThreadViewportState } from './apply-thread-viewport-state.js';
import { saveThreadScrollPosition } from './persist-thread-scroll.js';
import { renderThreadCodexLog } from './render-thread-codex-log.js';

export function renderThreadCodexLogUpdate(): void {
  const threadId = String(state.threadId ?? '');
  const surface = activeThreadPanelTab(threadId);
  const active = Boolean(state.threadPanelOpen && surface === 'codex-log');
  // WHAT: Capture the live viewport before replacing the execution snapshot.
  // WHY: Persistence may lag behind the reader when a new event arrives.
  if (active) saveThreadScrollPosition(threadId, surface, { persist: false });
  renderThreadCodexLog();
  // WHAT: Apply continuation positioning only to an active Codex Log surface.
  // WHY: Hidden log updates must not mutate either viewport.
  if (active) applyThreadViewportState({ active, threadId, surface });
}

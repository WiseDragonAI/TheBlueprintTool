/**
 * WHAT: Renders a live Codex Log continuation without repainting the conversation panel.
 * WHY: Log polling must not suppress or overwrite an operator's conversation scroll input.
 */
import { state } from '../../state.js';
import { activeThreadPanelTab } from '../helper/active-thread-panel-tab.js';
import { applyThreadViewportState } from './apply-thread-viewport-state.js';
import { renderThreadCodexLog } from './render-thread-codex-log.js';
import { suppressThreadScrollTrackingThroughNextFrame } from './render-thread-jump-button.js';

export function renderThreadCodexLogUpdate(): void {
  const threadId = String(state.threadId ?? '');
  const surface = activeThreadPanelTab(threadId);
  const active = Boolean(state.threadPanelOpen && surface === 'codex-log');
  // WHAT: Suppress programmatic log restoration only when the log viewport is visible.
  // WHY: Conversation scrolling remains independently owned while background log output arrives.
  if (active) suppressThreadScrollTrackingThroughNextFrame(surface);
  renderThreadCodexLog();
  // WHAT: Apply continuation positioning only to an active Codex Log surface.
  // WHY: Hidden log updates must not mutate either viewport.
  if (active) applyThreadViewportState({ active, threadId, surface });
}

/**
 * WHAT: Opens the right-side terminal thread panel without stealing keyboard focus.
 * WHY: The first A press should leave voice shortcuts available; a second A focuses text.
 */
import { state } from '../../state.js';
import { renderThreadPanel } from './render-thread-panel.js';

export function openThreadPanel(): void {
  state.threadPanelOpen = true;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  renderThreadPanel();
}

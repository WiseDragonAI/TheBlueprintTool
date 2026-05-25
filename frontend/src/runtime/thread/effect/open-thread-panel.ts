/**
 * WHAT: Opens the right-side terminal thread panel and focuses its composer.
 * WHY: The panel is command-opened with A rather than appearing on selection.
 */
import { state } from '../../state.js';
import { renderThreadPanel } from './render-thread-panel.js';
import { focusThreadDraft } from './focus-thread-draft.js';

export function openThreadPanel(): void {
  state.threadPanelOpen = true;
  if (!state.threadId) state.threadId = 'conversation-ledger';
  renderThreadPanel();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusThreadDraft);
  else setTimeout(focusThreadDraft, 0);
}

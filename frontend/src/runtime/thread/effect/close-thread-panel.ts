/**
 * WHAT: Closes the animated right-side terminal panel.
 * WHY: Esc closes the panel after any active recording has already been canceled.
 */
import { state } from '../../state.js';
import { renderThreadPanel } from './render-thread-panel.js';

export function closeThreadPanel(): void {
  state.threadPanelOpen = false;
  if (state.activeTool === 'thread') state.activeTool = 'select';
  const draft = document.querySelector('.thread-draft') as HTMLTextAreaElement | null;
  draft?.blur();
  renderThreadPanel();
}

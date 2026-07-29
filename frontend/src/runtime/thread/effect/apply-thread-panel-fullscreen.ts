/**
 * WHAT: Applies and toggles the thread inspector's full-viewport width mode.
 * WHY: Expanding the inspector must not rerender the thread, Codex Log, or their interaction state.
 */
import { state } from '../../state.js';

export function applyThreadPanelFullscreen(): void {
  const expanded = Boolean(state.threadPanelFullscreen);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-thread-fullscreen"]')) {
    button.closest<HTMLElement>('.panel')?.classList.toggle('is-thread-fullscreen', expanded);
    const label = expanded ? 'Restore thread panel' : 'Expand thread panel';
    button.setAttribute('aria-pressed', String(expanded));
    button.setAttribute('aria-label', label);
    button.title = label;
  }
}

export function toggleThreadPanelFullscreen(): void {
  state.threadPanelFullscreen = !Boolean(state.threadPanelFullscreen);
  applyThreadPanelFullscreen();
}

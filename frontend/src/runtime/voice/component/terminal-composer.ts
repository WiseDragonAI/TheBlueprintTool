/**
 * WHAT: Renders the terminal text composer used when voice capture is idle.
 * WHY: Text notes should be entered in the same dock footprint as voice, not through detached note buttons.
 */
export function terminalComposer(): string {
  return `
    <section class="terminal-composer is-mobile-text-collapsed">
      <textarea class="thread-draft terminal-input" rows="5" aria-label="Thread draft" placeholder="Write in this thread..."></textarea>
      <div class="terminal-command-row">
        <span class="terminal-command-hint">Ctrl+Enter commits note</span>
        <div class="terminal-command-actions">
          <input class="thread-file-input" type="file" multiple hidden aria-label="Upload files to thread">
          <button class="terminal-button terminal-button--attach terminal-button--compact" type="button" data-action="thread-file-picker" title="Upload files"><span class="terminal-button__key">+</span><svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5V19h14v-4.5"/></svg><span class="terminal-button__label">FILE</span></button>
          <button class="terminal-button terminal-button--compact terminal-button--thread-text" type="button" data-action="toggle-thread-text" aria-expanded="false"><span class="terminal-button__key">T</span><svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14M12 5v14M8.5 19h7"/></svg><span class="terminal-button__label">TEXT</span></button>
          <button class="terminal-button terminal-button--record terminal-button--compact" type="button" data-action="voice-toggle"><span class="terminal-button__key">X</span><svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6"/></svg><span class="terminal-button__label">REC</span></button>
          <button class="terminal-button terminal-button--send terminal-button--compact terminal-button--thread-send" type="button" data-action="submit-thread-draft"><svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3.5-6.5L4 12Z"/><path d="m11.5 13.5 4-4"/></svg><span class="terminal-button__label">SEND</span></button>
        </div>
      </div>
    </section>
  `;
}

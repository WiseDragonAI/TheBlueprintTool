/**
 * WHAT: Renders the terminal text composer used when voice capture is idle.
 * WHY: Text notes should be entered in the same dock footprint as voice, not through detached note buttons.
 */
export function terminalComposer(): string {
  return `
    <section class="terminal-composer">
      <textarea class="thread-draft terminal-input" rows="5" aria-label="Thread draft" placeholder="Write in this thread..."></textarea>
      <div class="terminal-command-row">
        <span class="terminal-command-hint">Ctrl+Enter commits note</span>
        <button class="terminal-button terminal-button--record terminal-button--compact" type="button" data-action="voice-toggle"><span class="terminal-button__key">X</span><span class="terminal-button__label">REC</span></button>
      </div>
    </section>
  `;
}

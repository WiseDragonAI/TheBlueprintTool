/**
 * WHAT: Renders the terminal attachment chips beside the voice composer.
 * WHY: The imported dock style expects this exact attach-strip structure.
 */
export function attachmentStrip(): string {
  const chips = ['decision-context.md', 'relationship-memory.txt', 'agent-run.log'];
  return `
    <div class="attach-zone">
      <div class="attach-strip-wrap">
        <div class="attach-strip">
          ${chips.map((chip) => `<button class="attach-chip" type="button"><span class="type-icon type-txt">TXT</span><span class="chip-name">${chip}</span><span class="chip-remove">x</span></button>`).join('')}
        </div>
        <div class="attach-strip">
          <button class="attach-chip" type="button"><span class="type-icon type-log">LOG</span><span class="chip-name">operator-turn.log</span><span class="chip-remove">x</span></button>
        </div>
        <div class="attach-rail"><span class="attach-thumb"></span></div>
      </div>
    </div>
  `;
}

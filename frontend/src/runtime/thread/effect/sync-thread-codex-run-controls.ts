/**
 * WHAT: Synchronizes the thread launch row and Codex Log activity treatment.
 * WHY: Only a live process blocks another launch; an operator can supersede queued or stale run state.
 */
export function syncThreadCodexRunControls(input: { threadId: string; status: string; active?: boolean; queuePosition?: number | null }): void {
  const heading = document.querySelector<HTMLElement>('.thread-heading');
  const actions = heading?.querySelector<HTMLElement>('.thread-actions');
  if (!heading || !actions || actions.dataset.threadId !== input.threadId) return;
  const running = input.status === 'running';
  const queued = input.status === 'pending';
  const occupied = input.active ?? running;
  actions.hidden = occupied;
  heading.dataset.codexRunning = String(occupied);
  heading.dataset.codexStatus = occupied ? input.status : '';
  const logTab = heading.querySelector<HTMLElement>('#thread-tab-codex-log');
  if (logTab) {
    logTab.dataset.runStatus = occupied ? input.status : '';
    const queueLabel = Number.isInteger(input.queuePosition) ? `, position ${input.queuePosition}` : '';
    logTab.setAttribute('aria-label', occupied ? 'Codex Log, run in progress' : queued ? `Codex Log, queued${queueLabel}` : 'Codex Log');
  }
}

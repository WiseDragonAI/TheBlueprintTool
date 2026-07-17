/**
 * WHAT: Synchronizes the thread launch row and Codex Log activity treatment.
 * WHY: Queued and running work both own the thread until the scheduler or process reaches a terminal state.
 */
export function syncThreadCodexRunControls(input: { threadId: string; status: string; active?: boolean; queuePosition?: number | null }): void {
  const heading = document.querySelector<HTMLElement>('.thread-heading');
  const actions = heading?.querySelector<HTMLElement>('.thread-actions');
  if (!heading || !actions || actions.dataset.threadId !== input.threadId) return;
  const running = input.status === 'running';
  const queued = input.status === 'pending';
  const occupied = queued || (input.active ?? running);
  actions.hidden = occupied;
  heading.dataset.codexRunning = String(occupied);
  heading.dataset.codexStatus = occupied ? input.status : '';
  const logTab = heading.querySelector<HTMLElement>('#thread-tab-codex-log');
  if (logTab) {
    logTab.dataset.runStatus = occupied ? input.status : '';
    const queueLabel = Number.isInteger(input.queuePosition) ? `, position ${input.queuePosition}` : '';
    logTab.setAttribute('aria-label', queued ? `Codex Log, queued${queueLabel}` : occupied ? 'Codex Log, run in progress' : 'Codex Log');
  }
}

/**
 * WHAT: Synchronizes the thread launch row and Codex Log activity treatment.
 * WHY: A queued or running thread session cannot be launched again, while its log remains the useful control.
 */
export function syncThreadCodexRunControls(input: { threadId: string; status: string; queuePosition?: number | null }): void {
  const heading = document.querySelector<HTMLElement>('.thread-heading');
  const actions = heading?.querySelector<HTMLElement>('.thread-actions');
  if (!heading || !actions || actions.dataset.threadId !== input.threadId) return;
  const running = input.status === 'running';
  const queued = input.status === 'pending';
  const occupied = running || queued;
  actions.hidden = occupied;
  heading.dataset.codexRunning = String(occupied);
  heading.dataset.codexStatus = occupied ? input.status : '';
  const logTab = heading.querySelector<HTMLElement>('#thread-tab-codex-log');
  if (logTab) {
    logTab.dataset.runStatus = occupied ? input.status : '';
    const queueLabel = Number.isInteger(input.queuePosition) ? `, position ${input.queuePosition}` : '';
    logTab.setAttribute('aria-label', running ? 'Codex Log, run in progress' : queued ? `Codex Log, queued${queueLabel}` : 'Codex Log');
  }
}

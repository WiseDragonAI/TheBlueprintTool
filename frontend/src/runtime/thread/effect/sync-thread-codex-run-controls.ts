/**
 * WHAT: Synchronizes the thread launch row and Codex Log activity treatment.
 * WHY: A running thread session cannot be launched again, while its log remains the useful control.
 */
export function syncThreadCodexRunControls(input: { threadId: string; running: boolean }): void {
  const heading = document.querySelector<HTMLElement>('.thread-heading');
  const actions = heading?.querySelector<HTMLElement>('.thread-actions');
  if (!heading || !actions || actions.dataset.threadId !== input.threadId) return;
  actions.hidden = input.running;
  heading.dataset.codexRunning = String(input.running);
  const logTab = heading.querySelector<HTMLElement>('#thread-tab-codex-log');
  if (logTab) {
    logTab.dataset.runStatus = input.running ? 'running' : '';
    logTab.setAttribute('aria-label', input.running ? 'Codex Log, run in progress' : 'Codex Log');
  }
}

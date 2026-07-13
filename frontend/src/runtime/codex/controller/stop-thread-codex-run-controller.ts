/**
 * WHAT: Stops the active Codex process represented by the thread Codex Log status strip.
 * WHY: The thread log is the operator-facing running-session surface on mobile and desktop.
 */
import { requestCardSkillRunCancel } from '../effect/request-card-skill-run-cancel.js';

type ThreadCodexStopState = { pending: boolean; error: string };

const stopStateByRunId = new Map<string, ThreadCodexStopState>();

export function threadCodexStopState(runId: string): ThreadCodexStopState {
  return stopStateByRunId.get(runId) ?? { pending: false, error: '' };
}

export function clearThreadCodexStopState(runId: string): void {
  if (runId) stopStateByRunId.delete(runId);
}

function stopLabel(button: HTMLButtonElement): HTMLElement | null {
  return button.querySelector<HTMLElement>('[data-codex-log-stop-label]');
}

function setStopState(button: HTMLButtonElement, state: 'ready' | 'stopping'): void {
  const stopping = state === 'stopping';
  button.disabled = stopping;
  button.dataset.stopPending = stopping ? 'true' : '';
  const label = stopLabel(button);
  if (label) label.textContent = stopping ? 'STOPPING' : 'STOP';
  button.title = stopping ? 'Stopping Codex run' : 'Stop Codex run';
  button.setAttribute('aria-label', button.title);
}

function clearStopError(button: HTMLButtonElement): void {
  button.closest('.thread-codex-log')?.querySelector('[data-codex-log-stop-error]')?.remove();
}

function showStopError(button: HTMLButtonElement, message: string): void {
  const root = button.closest('.thread-codex-log');
  const status = button.closest('.codex-log-status');
  if (!root || !status) return;
  let error = root.querySelector<HTMLElement>('[data-codex-log-stop-error]');
  if (!error) {
    error = document.createElement('p');
    error.className = 'codex-log-stop-error';
    error.dataset.codexLogStopError = '';
    error.setAttribute('role', 'alert');
    status.after(error);
  }
  error.textContent = message;
}

export async function stopThreadCodexRunController(input: {
  button: HTMLButtonElement;
  ledgerId: string;
  cardId: string;
  runId: string;
}): Promise<boolean> {
  const current = threadCodexStopState(input.runId);
  if (!input.ledgerId || !input.cardId || !input.runId || current.pending) return false;
  stopStateByRunId.set(input.runId, { pending: true, error: '' });
  clearStopError(input.button);
  setStopState(input.button, 'stopping');
  const result = await requestCardSkillRunCancel({ ledgerId: input.ledgerId, cardId: input.cardId, runId: input.runId });
  if (result.ok) return true;
  const error = result.error || 'Stop failed.';
  stopStateByRunId.set(input.runId, { pending: false, error });
  setStopState(input.button, 'ready');
  showStopError(input.button, error);
  return false;
}

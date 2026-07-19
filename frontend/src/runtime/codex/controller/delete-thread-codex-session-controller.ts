/**
 * WHAT: Deletes one confirmed thread Codex session and reconciles cached log state.
 * WHY: The UI must expose START only after canonical persistence confirms the old session is gone.
 */
import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { clearThreadCodexStopState } from './stop-thread-codex-run-controller.js';
import { requestThreadCodexSessionDelete } from '../effect/request-thread-codex-session-delete.js';
import { unbindThreadCodexActiveRunLog, unbindThreadCodexRunLog } from '../effect/bind-thread-codex-run-log.js';
import { purgeCardSkillRunLog } from '../effect/poll-card-skill-run.js';

type DeletionState = { pending: boolean; error: string };
type DeletionEffects = { refresh?: () => Promise<unknown>; render?: () => void };
const deletionStateByRunId = new Map<string, DeletionState>();

export function threadCodexSessionDeletionState(runId: string): DeletionState {
  return deletionStateByRunId.get(runId) ?? { pending: false, error: '' };
}

function clearThreadRunCache(threadId: string): void {
  const keys = [
    'threadLogScrollTopByThreadId',
    'threadSelectedRunIdByThreadId',
    'threadSelectedExecutionIdByThreadId',
    'threadRunIdByThreadId',
    'threadRunSummaryByThreadId',
    'threadRunEventsByThreadId',
    'threadCoalescedToolsByThreadId',
    'threadToolGroupDisclosureByThreadId',
    'threadToolRowDisclosureByThreadId',
    'threadRunAnnouncementByThreadId',
    'threadRunAnnouncedSequenceByThreadId',
    'threadActiveRunIdByThreadId',
    'threadActiveRunSummaryByThreadId',
    'threadActiveLeaseKeyByThreadId',
    'threadLastAdmittedRunIdByThreadId',
  ];
  for (const key of keys) {
    const map = state[key] as Record<string, unknown> | undefined;
    if (map && typeof map === 'object') delete map[threadId];
  }
}

function setConfirmPending(pending: boolean): void {
  const confirm = modal.querySelector('[data-action="delete-thread-codex-session"]') as HTMLButtonElement | null;
  if (!confirm) return;
  confirm.disabled = pending;
  confirm.textContent = pending ? 'Deleting session' : 'Delete session';
}

export async function deleteThreadCodexSessionController(
  input: { ledgerId: string; cardId: string; runId: string; threadId: string },
  effects: DeletionEffects = {},
): Promise<boolean> {
  const refresh = effects.refresh ?? refreshRuntimeState;
  const render = effects.render ?? renderThreadPanel;
  if (!input.ledgerId || !input.cardId || !input.runId || !input.threadId || threadCodexSessionDeletionState(input.runId).pending) return false;
  deletionStateByRunId.set(input.runId, { pending: true, error: '' });
  setConfirmPending(true);
  const result = await requestThreadCodexSessionDelete(input);
  if (!result.ok) {
    deletionStateByRunId.set(input.runId, { pending: false, error: result.error || 'Session deletion failed.' });
    setConfirmPending(false);
    modal.close?.();
    render();
    return false;
  }

  deletionStateByRunId.delete(input.runId);
  const identity = { ledgerId: input.ledgerId, cardId: input.cardId, threadId: input.threadId, runId: input.runId };
  unbindThreadCodexRunLog(identity);
  if (String(state.threadActiveRunIdByThreadId?.[input.threadId] ?? '') === input.runId) unbindThreadCodexActiveRunLog(identity);
  purgeCardSkillRunLog(identity);
  if (state.threadRunExecutionsByRunId && typeof state.threadRunExecutionsByRunId === 'object') delete state.threadRunExecutionsByRunId[input.runId];
  clearThreadCodexStopState(input.runId);
  clearThreadRunCache(input.threadId);
  modal.close?.();
  await refresh();
  render();
  return true;
}

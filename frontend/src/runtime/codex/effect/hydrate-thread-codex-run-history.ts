/**
 * WHAT: Hydrates execution indexes for retained thread runs that are not currently selected.
 * WHY: The Codex Log navigator counts execution segments, so every retained run must expose its continuations before selection.
 */
import { state } from '../../state.js';
import { requestCardSkillRunStatus } from './request-card-skill-run-status.js';

const pendingRunIds = new Set<string>();

function executionCache(): Record<string, unknown[]> {
  if (!state.threadRunExecutionsByRunId || typeof state.threadRunExecutionsByRunId !== 'object' || Array.isArray(state.threadRunExecutionsByRunId)) {
    state.threadRunExecutionsByRunId = {};
  }
  return state.threadRunExecutionsByRunId as Record<string, unknown[]>;
}

export function hydrateThreadCodexRunHistory(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
  threadId: string;
  runIds: string[];
}): void {
  const cache = executionCache();
  for (const runId of input.runIds) {
    if (!runId || Array.isArray(cache[runId]) && cache[runId].length > 0 || pendingRunIds.has(runId)) continue;
    pendingRunIds.add(runId);
    void requestCardSkillRunStatus({
      projectId: input.projectId,
      ledgerId: input.ledgerId,
      cardId: input.cardId,
      runId,
      // The execution index is needed here; event hydration remains owned by the selected-run poller.
      since: Number.MAX_SAFE_INTEGER,
    }).then((summary) => {
      if (!summary.ok || summary.executions.length === 0) return;
      cache[runId] = summary.executions;
      if (String(state.threadId ?? '') !== input.threadId) return;
      void import('../../thread/effect/render-thread-codex-log.js').then(({ renderThreadCodexLog }) => renderThreadCodexLog());
    }).finally(() => pendingRunIds.delete(runId));
  }
}

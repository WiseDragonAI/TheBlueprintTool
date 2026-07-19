/**
 * WHAT: Starts a Codex run from the active thread panel and refreshes the canvas.
 * WHY: The created run widget is durable card state authored by the backend.
 */
import { state } from '../../state.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestThreadCodexProcess } from '../effect/request-thread-codex-process.js';
import { requestCardSkillRunContinue } from '../effect/request-card-skill-run-continue.js';
import { resumeExternallyStartedCardSkillRun } from '../effect/poll-card-skill-run.js';
import { bindThreadCodexRunLog } from '../effect/bind-thread-codex-run-log.js';
import { threadCodexCardId } from '../helper/thread-codex-card-id.js';
import { cardCodexThreadRunId } from '../helper/card-codex-thread-run-id.js';

export async function processThreadCodexController(input: { threadId?: string; cardId?: string; runId?: string; codexModel?: string; codexEffort?: string } = {}): Promise<boolean> {
  const ledgerId = String(state.activeTab ?? '').trim();
  const threadId = String(input.threadId ?? state.threadId ?? '').trim();
  const cardId = String(input.cardId ?? '').trim() || threadCodexCardId(state.activeLedger, threadId);
  if (!ledgerId || !threadId || !cardId) return false;
  telemetry('codex-thread-process-start', { ledgerId, threadId, cardId, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '' });
  const card = state.activeLedger?.cards?.find((entry: Record<string, unknown>) => String(entry.id ?? '') === cardId);
  const existingRunId = String(input.runId ?? '').trim() || cardCodexThreadRunId(card);
  const result = existingRunId
    ? await requestCardSkillRunContinue({ ledgerId, cardId, runId: existingRunId, codexModel: input.codexModel, codexEffort: input.codexEffort })
    : await requestThreadCodexProcess({ ledgerId, threadId, cardId, codexModel: input.codexModel, codexEffort: input.codexEffort });
  if (!result.ok) {
    telemetry('codex-thread-process-failed', { ledgerId, threadId, cardId, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', error: result.error ?? '' });
    return false;
  }
  const runId = String(result.run?.id ?? existingRunId).trim();
  const resultStatus = String(result.run?.status ?? '').trim();
  const expectedStatus = resultStatus === 'pending' || resultStatus === 'running' ? resultStatus : undefined;
  const expectedExecutionId = String(result.run?.executionId ?? '').trim() || undefined;
  if (runId) {
    state.threadSelectedRunIdByThreadId ||= {};
    state.threadSelectedRunIdByThreadId[threadId] = runId;
    // The accepted continuation supersedes any cached terminal summary for this run.
    // Bind before refresh so the live poller owns the transition while the panel rerenders.
    bindThreadCodexRunLog({ ledgerId, threadId, cardId, runId, expectedExecutionId, expectedStatus });
  }
  await refreshRuntimeState();
  if (existingRunId) resumeExternallyStartedCardSkillRun({ ledgerId, cardId, runId });
  bindThreadCodexRunLog({ ledgerId, threadId, cardId, runId, expectedExecutionId, expectedStatus });
  telemetry('codex-thread-process-created-widget', { ledgerId, threadId, cardId, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', run: runId });
  return true;
}

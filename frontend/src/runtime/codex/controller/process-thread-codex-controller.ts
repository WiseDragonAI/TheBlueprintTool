/**
 * WHAT: Starts a Codex run from the active thread panel and refreshes the canvas.
 * WHY: The created run widget is durable card state authored by the backend.
 */
import { state } from '../../state.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestThreadCodexProcess } from '../effect/request-thread-codex-process.js';
import { requestCardSkillRunContinue } from '../effect/request-card-skill-run-continue.js';
import { requestCardSkillRunStatus } from '../effect/request-card-skill-run-status.js';
import { bindThreadCodexRunLog } from '../effect/bind-thread-codex-run-log.js';
import { cardCodexThreadRunId } from '../helper/card-codex-thread-run-id.js';
import { threadCodexCardId } from '../helper/thread-codex-card-id.js';

export async function processThreadCodexController(input: { threadId?: string; cardId?: string; codexModel?: string; codexEffort?: string } = {}): Promise<boolean> {
  const ledgerId = String(state.activeTab ?? '').trim();
  const threadId = String(input.threadId ?? state.threadId ?? '').trim();
  const cardId = String(input.cardId ?? '').trim() || threadCodexCardId(state.activeLedger, threadId);
  if (!ledgerId || !threadId || !cardId) return false;
  const card = state.activeLedger?.cards?.find((entry: Record<string, unknown>) => String(entry.id ?? '') === cardId);
  const existingRunId = cardCodexThreadRunId(card);
  if (existingRunId) {
    bindThreadCodexRunLog({ ledgerId, threadId, cardId, runId: existingRunId });
    const summary = await requestCardSkillRunStatus({ ledgerId, cardId, runId: existingRunId });
    if (summary.active || summary.status === 'pending') {
      telemetry('codex-thread-process-focused-active-run', { ledgerId, threadId, cardId, run: existingRunId });
      return true;
    }
    if (!summary.ok) {
      telemetry('codex-thread-process-resume-failed', { ledgerId, threadId, cardId, run: existingRunId, error: summary.error ?? 'Run status unavailable.' });
      return false;
    }
    const continued = await requestCardSkillRunContinue({
      ledgerId,
      cardId,
      runId: existingRunId,
      codexModel: input.codexModel,
      codexEffort: input.codexEffort,
    });
    if (!continued.ok) {
      telemetry('codex-thread-process-resume-failed', { ledgerId, threadId, cardId, run: existingRunId, error: continued.error ?? '' });
      return false;
    }
    await refreshRuntimeState();
    bindThreadCodexRunLog({ ledgerId, threadId, cardId, runId: existingRunId });
    telemetry('codex-thread-process-resumed', { ledgerId, threadId, cardId, run: existingRunId });
    return true;
  }
  telemetry('codex-thread-process-start', { ledgerId, threadId, cardId, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '' });
  const result = await requestThreadCodexProcess({ ledgerId, threadId, cardId, codexModel: input.codexModel, codexEffort: input.codexEffort });
  if (!result.ok) {
    telemetry('codex-thread-process-failed', { ledgerId, threadId, cardId, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', error: result.error ?? '' });
    return false;
  }
  await refreshRuntimeState();
  const runId = String(result.run?.id ?? '').trim();
  bindThreadCodexRunLog({ ledgerId, threadId, cardId, runId });
  telemetry('codex-thread-process-created-widget', { ledgerId, threadId, cardId, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', run: runId });
  return true;
}

/**
 * WHAT: Continues an existing card-scoped Codex skill run with newer thread messages.
 * WHY: A durable run id must resume its captured session and recover with a new session only when that id is missing.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { prepareCardSkillRunEventAppend } from '../effect/prepare-card-skill-run-event-append.js';
import { buildCardSkillContinuePrompt } from '../helper/build-card-skill-continue-prompt.js';
import { buildCardLaunchContext } from '../helper/build-card-launch-context.js';
import { codexRunExecutionFinishedMarker } from '../helper/codex-run-segment-marker.js';
import { resolveCardSkillRunOwnership } from '../helper/resolve-card-skill-run-ownership.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand, resolveCodexResumeCommand } from '../helper/resolve-codex-command.js';
import { threadMessagesAfterLastCodexEvent } from '../helper/thread-messages-after-last-codex-event.js';
import { readCardSkillRunController } from './read-card-skill-run-controller.js';
import { decisionOsCodexEnvironment } from '../helper/decision-os-codex-runtime.js';
import { randomUUID } from 'node:crypto';
import { codexProcessIdentity, enqueueCodexContinuation, findActiveLogicalQueueItem, recordCodexProcessQueueItemProcess, removeCodexProcessQueueItem } from '../helper/codex-process-queue.js';
import { scheduleCodexProcesses, unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { clearCardCodexExecution } from '../helper/clear-card-codex-execution.js';
import { resolveCardSkillRunFiles } from '../helper/resolve-card-skill-run-files.js';
import { persistLedgerProjection } from '@backend/business/task-state/helper/persist-ledger-projection.js';
import { readLedgerProjection } from '@backend/business/task-state/helper/read-ledger-projection.js';
import { withCardCodexAdmission } from '../helper/card-codex-admission-lock.js';
import { cardCodexExecutionOwnership } from '../helper/card-codex-execution-ownership.js';
import { launchCodexExecutionProcess } from '../helper/launch-codex-execution-process.js';
import { projectCardExecutionIntent } from '../helper/project-card-execution-intent.js';
import { codexExecutionCoordinator } from '../helper/codex-execution-runtime.js';
import { isTaskStateBootstrapGate } from '../../task-state/helper/is-task-state-bootstrap-gate.js';
import { TaskExecutionAdmissionError, createTaskExecutionLaunchRequest } from '../helper/task-execution-router.js';
import {
  registerTaskExecutionProcess,
  removeTaskExecutionProcess,
  taskExecutionNodeId,
  taskExecutionRouter,
  taskExecutionState,
} from '../helper/task-execution-runtime.js';
import {
  attachCodexRuntimeChild as attachRuntimeRunChild,
  codexRuntimeRuns as runtimeRuns,
  codexRuntimeStatus as runtimeRunStatus,
  notifyCodexLifecycle as notifyRuntimeCallback,
  publicCodexRuntimeRun as publicRun,
  scheduleCodexRuntime,
  updateCodexRuntimeExecution as updateRuntimeExecution,
  updateCodexRuntimeRun as updateRuntimeRun,
} from '../helper/codex-runtime-run-store.js';

type AnyRecord = Record<string, unknown>;
type ProcessStatus = 'running' | 'complete' | 'failed' | 'cancelled';

function logCodexContinueDebug(phase: string, detail: AnyRecord): void {
  console.log(JSON.stringify({ codexContinueDebug: true, source: 'backend', phase, at: new Date().toISOString(), ...detail }));
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function workspaceRootForDecisionOsRoot(decisionOsRoot: string): string {
  return dirname(decisionOsRoot);
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function reportBackground(runtime: AnyRecord, operation: string, error: unknown, context: AnyRecord): void {
  if (typeof runtime.onCodexBackgroundError === 'function') runtime.onCodexBackgroundError({ operation, error, context });
}

function appendRunStatus(filePath: string, status: ProcessStatus, detail: string): void {
  const heading = status === 'complete' ? 'Completed' : status === 'failed' ? 'Failed' : status === 'cancelled' ? 'Cancelled' : 'Running';
  const markdown = [``, `---`, ``, `Codex run ${heading.toLowerCase()}: ${detail}`].join('\n');
  try {
    writeFileSync(filePath, `${existsSync(filePath) ? readFileSync(filePath, 'utf8').replace(/\s+$/g, '') : ''}${markdown}\n`, 'utf8');
  } catch {
    // The JSONL and stderr log remain the fallback status records.
  }
}

function readRunSessionId(stdoutFile: string): string {
  if (!existsSync(stdoutFile)) return '';
  let sessionId = '';
  for (const line of readFileSync(stdoutFile, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as AnyRecord;
      const nestedPayload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload as AnyRecord : {};
      const capturedSessionId = String(event.thread_id ?? event.session_id ?? nestedPayload.session_id ?? '').trim();
      if (capturedSessionId) sessionId = capturedSessionId;
    } catch {
      // Ignore malformed run lines; later valid lines can still identify the session.
    }
  }
  return sessionId;
}

function outputFileForRunCard(input: { ledger: AnyRecord; decisionOsRoot: string; cardId: string }): string {
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards as AnyRecord[] : [];
  const card = cards.find((entry) => String(entry.id ?? '') === input.cardId);
  const runOutputFile = String(card?.codexThreadRunOutputFile ?? card?.codexRunOutputFile ?? '').trim();
  if (runOutputFile) {
    const relativePath = runOutputFile.replace(/^\.decision-os\//, '');
    const file = resolve(input.decisionOsRoot, relativePath);
    if (isInside(input.decisionOsRoot, file)) return file;
  }
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return resolveCardContentFile(input.decisionOsRoot, comment.contentFile) ?? '';
}

function runFileLineCount(file: string): number {
  return existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim()).length : 0;
}

export async function continueCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const workspaceRoot = workspaceRootForDecisionOsRoot(decisionOsRoot);
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  const traceId = String(payload.traceId ?? '');
  const epoch4Dispatch = payload.epoch4Dispatch === true;
  const queueDispatch = payload.queueDispatch === true || epoch4Dispatch;
  const queueItemId = optionalText(payload.queueItemId);
  const disallowSkills = payload.disallowSkills === true;
  let executionId = optionalText(payload.executionId);
  const router = taskExecutionRouter(runtime);
  const fail = (statusCode: number, error: string, extra: AnyRecord = {}): AnyRecord => {
    logCodexContinueDebug('continue-controller-fail', { traceId, ledgerId, cardId, runId, statusCode, error, ...extra });
    return { ok: false, statusCode, error, runId, ...extra };
  };
  logCodexContinueDebug('continue-controller-entry', { traceId, ledgerId, cardId, runId, decisionOsRoot, workspaceRoot, runtimeStatus: runtimeRunStatus(runtime, runId) });
  if (!ledgerId || !cardId || !runId) return fail(400, 'Missing ledgerId, cardId, or runId.');
  if (!queueDispatch && payload.admissionLocked !== true) {
    return withCardCodexAdmission({ decisionOsRoot, ledgerId, cardId }, () => continueCardSkillRunController({
      action_payload: { ...payload, admissionLocked: true },
      runtime_state: runtime,
    }));
  }
  const existingRuntime = runtimeRuns(runtime)[runId];
  const existingQueue = router ? null : findActiveLogicalQueueItem(decisionOsRoot, { ledgerId, cardId, runId });
  if (!queueDispatch && existingRuntime && ['complete', 'failed', 'cancelled'].includes(String(existingRuntime.status ?? '')) && !existingRuntime.settledAt) {
    return fail(409, 'Run settlement is still in progress.', { executionId: existingRuntime.executionId });
  }
  if (!router && !queueDispatch && (existingRuntime?.status === 'pending' || existingRuntime?.status === 'running' || existingQueue)) {
    const admitted = existingRuntime ?? {
      id: runId,
      executionId: existingQueue?.payload.executionId,
      ledgerId,
      outputCardId: cardId,
      status: existingQueue?.status === 'running' ? 'running' : 'pending',
      queueItemId: existingQueue?.id,
      createdAt: existingQueue?.createdAt,
    };
    const admittedItemId = String(admitted.queueItemId ?? existingQueue?.id ?? '');
    return {
      ok: true,
      statusCode: 202,
      run: publicRun(admitted),
      queued: admitted.status === 'pending',
      queuePosition: admitted.status === 'pending' && admittedItemId
        ? unifiedCodexQueuePosition({ decisionOsRoot, id: admittedItemId, createdAt: String(admitted.createdAt ?? existingQueue?.createdAt ?? ''), runtime })
        : null,
    };
  }
  executionId ||= `codex-execution-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const requestedCodexModel = optionalText(payload.codexModel);
  const requestedCodexEffort = optionalText(payload.codexEffort);
  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return fail(400, 'Unsupported Codex model.', { codexModel: requestedCodexModel });
  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return fail(400, 'Unsupported Codex effort.', { codexEffort: requestedCodexEffort });

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return fail(404, 'Ledger not found.', { ledgerId });

  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return fail(404, 'Ledger file not found.', { ledgerId, ledgerPath });

  const ledger = readLedgerProjection({ ledgerId, ledgerPath, runtime }) as AnyRecord & { cards?: AnyRecord[] };
  const runFiles = resolveCardSkillRunFiles({ ledger, decisionOsRoot, ledgerPath, cardId, runId });
  const { runDirectory, stdoutFile, stderrFile } = runFiles;
  const sessionId = readRunSessionId(stdoutFile);
  const newSession = !sessionId;
  logCodexContinueDebug('run-files-resolved', { traceId, ledgerId, cardId, runId, newSession, runDirectory, stdoutFile, stderrFile, stdoutLineCount: runFileLineCount(stdoutFile), stderrBytes: existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8').length : 0, sessionId });

  const status = await readCardSkillRunController({ action_payload: { ledgerId, cardId, runId, since: 0, traceId }, runtime_state: runtime });
  logCodexContinueDebug('preflight-status', { traceId, ledgerId, cardId, runId, ok: status.ok, status: status.status, lineCount: status.lineCount, persistedEventCount: status.persistedEventCount, latestEventType: status.latestEvent && typeof status.latestEvent === 'object' ? String((status.latestEvent as AnyRecord).type ?? '') : '', error: status.error });
  if (status.ok === false) return status;
  // A freshly restarted server can infer `running` from recent file writes, but
  // only an in-memory runtime entry proves that this server still owns a child.

  if (!resolveCardSkillRunOwnership({ ledger, decisionOsRoot, cardId, runId }).found) {
    return fail(404, 'Run not found on card.', { cardId });
  }
  const continuation = threadMessagesAfterLastCodexEvent({ ledger, decisionOsRoot, cardId, runId, traceId });
  const interrupted = status.status === 'running' || status.status === 'pending' || status.status === 'unknown';
  const messages = continuation.messages.length > 0
    ? continuation.messages
    : interrupted
      ? [{ role: 'operator', message: 'Continue the interrupted task from the durable session context.' }]
      : [];
  logCodexContinueDebug('message-extraction', continuation.debug);
  if (messages.length === 0) return fail(409, 'No thread messages were found after the last Codex session end.');

  const outputFile = existsSync(runFiles.outputFile)
    ? runFiles.outputFile
    : outputFileForRunCard({ ledger, decisionOsRoot, cardId });
  if (!outputFile) return fail(500, 'Run output card content file was not found.', { cardId });
  if (newSession && !existsSync(outputFile)) return fail(500, 'Run output card content file was not found.', { cardId, outputFile });
  const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  const ownership = cardCodexExecutionOwnership(card);
  if (ownership.state === 'contradictory') return fail(409, 'Card has contradictory Codex execution ownership.', ownership);
  if (queueDispatch && !epoch4Dispatch && (!card || String(card.codexActiveRunId ?? '') !== runId || String(card.codexActiveExecutionId ?? '') !== executionId)) {
    return fail(409, 'Queued execution no longer owns the card lease.', { executionId });
  }
  const statusMetadata = status.metadata && typeof status.metadata === 'object' && !Array.isArray(status.metadata) ? status.metadata as AnyRecord : {};
  const codexModel = requestedCodexModel || optionalText(card?.codexRunModel) || optionalText(statusMetadata.codexModel);
  const codexEffort = requestedCodexEffort || optionalText(card?.codexRunEffort) || optionalText(statusMetadata.codexEffort);

  const command = newSession
    ? resolveCodexCommand({ workspaceRoot, runtime, codexModel, codexEffort })
    : resolveCodexResumeCommand({ workspaceRoot, runtime, sessionId, codexModel, codexEffort });
  const executionCoordinator = epoch4Dispatch ? null : codexExecutionCoordinator(runtime);
  let canonicalRecord = executionCoordinator?.store.find(executionId) ?? null;
  if (card && queueDispatch) {
    if (executionCoordinator) {
      try {
        if (!canonicalRecord) canonicalRecord = await executionCoordinator.admit({
          executionId,
          sessionId: runId,
          projectId: String(runtime.projectId ?? ''),
          ledgerId,
          taskId: cardId,
          ownerCardId: cardId,
          kind: 'continuation',
        });
        if (canonicalRecord.phase === 'preparing') canonicalRecord = await executionCoordinator.enqueue(executionId);
        if (canonicalRecord.phase === 'queued') canonicalRecord = await executionCoordinator.claim(executionId);
      } catch (error) {
        return fail(503, error instanceof Error ? error.message : String(error), { code: String((error as { code?: unknown })?.code ?? ''), retryable: true, executionId });
      }
    }
    card.codexActiveRunId = runId;
    card.codexActiveExecutionId = executionId;
    card.codexRunModel = command.model;
    card.codexRunEffort = command.effort;
    if (ledgerId === 'tasks') {
      if (executionCoordinator && canonicalRecord) card.executionIntent = executionCoordinator.intent(canonicalRecord);
      else projectCardExecutionIntent({ card, intentId: runId, state: 'running' });
    }
    stripHydratedThreadNotes(ledger);
    try {
      await persistLedgerProjection({ decisionOsRoot, ledgerId, ledgerPath, ledger, runtime, command: { kind: 'queue-codex-continuation', cardIds: [cardId] } });
    } catch (error) {
      if (isTaskStateBootstrapGate(error)) return fail(503, 'Task-state projection is waiting for relay convergence.', { code: 'codex_execution_projection_pending', retryable: true, executionId });
      throw error;
    }
  }
  const prompt = buildCardSkillContinuePrompt({
    messages,
    disallowSkills,
    newSessionContext: newSession ? {
      workspaceRoot,
      ledgerFile: ledgerPath,
      runId,
      cardId,
      cardTitle: String(card?.title ?? cardId),
      outputFile,
      outputMarkdown: readFileSync(outputFile, 'utf8'),
      context: buildCardLaunchContext({
        projectId: String(runtime.projectId ?? ''),
        ledgerId,
        cardId,
        threadId: `thread-${cardId}`,
        ledger,
        cardMarkdown: readFileSync(outputFile, 'utf8'),
        threadMarkdown: messages.map((message) => `# ${String(message.role ?? '').toLowerCase() === 'agent' ? 'AGENT' : 'OPERATOR'}\n\n${String(message.message ?? message.body ?? '')}`).join('\n\n'),
      }),
    } : undefined,
  });
  if (!queueDispatch && router) {
    const launchRequest = createTaskExecutionLaunchRequest({
      requestId: optionalText(payload.requestId),
      executionId,
      projectId: String(runtime.projectId ?? ''),
      ledgerId,
      sessionId: runId,
      sourceCardId: cardId,
      ownerCardId: cardId,
      kind: 'continuation',
      model: command.model,
      effort: command.effort,
    });
    try {
      const receipt = await router.route(launchRequest);
      const admitted = {
        id: runId,
        executionId: receipt.executionId,
        ledgerId,
        outputCardId: cardId,
        sourceCardTitle: String(card?.title ?? cardId),
        outputFile,
        stdoutFile,
        stderrFile,
        codexModel: command.model,
        codexEffort: command.effort,
        newSession,
        resumeSessionId: newSession ? '' : sessionId,
        continuedMessageCount: messages.length,
        pid: 0,
        status: 'pending',
        createdAt: receipt.requestedAt,
        startedAt: null,
        continuedAt: null,
      };
      updateRuntimeRun(runtime, runId, admitted);
      notifyRuntimeCallback(runtime.onCodexRunAccepted, {
        ledgerId,
        cardId,
        outputCardId: cardId,
        threadId: `thread-${cardId}`,
        runId,
        executionId: receipt.executionId,
        status: 'pending',
        executorNodeId: receipt.executorNodeId,
      });
      return {
        ok: true,
        statusCode: 202,
        receipt,
        run: publicRun(admitted),
        queued: true,
        queuePosition: receipt.executorNodeId === taskExecutionNodeId(runtime)
          ? unifiedCodexQueuePosition({ decisionOsRoot, id: receipt.executionId, createdAt: receipt.requestedAt, runtime })
          : null,
      };
    } catch (error) {
      if (error instanceof TaskExecutionAdmissionError) {
        return fail(error.statusCode, error.code, { context: error.context, executionId });
      }
      throw error;
    }
  }
  if (!queueDispatch) {
    const createdAt = new Date().toISOString();
    const itemId = `codex-continuation-${Date.now()}-${randomUUID().slice(0, 8)}`;
    if (executionCoordinator) {
      try {
        if (!canonicalRecord) canonicalRecord = await executionCoordinator.admit({
            executionId,
            sessionId: runId,
            projectId: String(runtime.projectId ?? ''),
            ledgerId,
            taskId: cardId,
            ownerCardId: cardId,
            kind: 'continuation',
            requestedAt: createdAt,
          });
        if (canonicalRecord.phase === 'preparing') canonicalRecord = await executionCoordinator.enqueue(executionId);
      } catch (error) {
        return fail(503, error instanceof Error ? error.message : String(error), { code: String((error as { code?: unknown })?.code ?? ''), retryable: true, executionId });
      }
    }
    const admitted = enqueueCodexContinuation({
      decisionOsRoot,
      id: itemId,
      createdAt,
      payload: { ledgerId, cardId, runId, executionId, newSession, codexModel: command.model, codexEffort: command.effort, traceId, disallowSkills },
    });
    executionId = String(admitted.payload.executionId ?? executionId);
    if (card) {
      card.codexActiveRunId = runId;
      card.codexActiveExecutionId = executionId;
      card.codexRunModel = command.model;
      card.codexRunEffort = command.effort;
      if (ledgerId === 'tasks') {
        if (executionCoordinator && canonicalRecord) card.executionIntent = executionCoordinator.intent(canonicalRecord);
        else projectCardExecutionIntent({ card, intentId: runId, state: 'queued', changedAt: admitted.createdAt });
      }
      stripHydratedThreadNotes(ledger);
      try {
        await persistLedgerProjection({ decisionOsRoot, ledgerId, ledgerPath, ledger, runtime, command: { kind: 'admit-codex-continuation', cardIds: [cardId] } });
      } catch (error) {
        if (admitted.id === itemId) removeCodexProcessQueueItem(decisionOsRoot, itemId);
        if (executionCoordinator && canonicalRecord && !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(canonicalRecord.phase)) {
          await executionCoordinator.cancel(executionId, 'Codex continuation admission did not complete.').catch(() => undefined);
        }
        throw error;
      }
    }
    updateRuntimeRun(runtime, runId, {
      id: runId, ledgerId, outputCardId: cardId, codexModel: command.model, codexEffort: command.effort,
      status: admitted.status === 'running' ? 'running' : 'pending', executionId, queueItemId: admitted.id, createdAt: admitted.createdAt,
    });
    notifyRuntimeCallback(runtime.onCodexRunAccepted, { ledgerId, cardId, outputCardId: cardId, threadId: `thread-${cardId}`, runId, executionId, status: admitted.status === 'running' ? 'running' : 'pending' });
    const schedule = runtime.scheduleCodexProcesses;
    if (typeof schedule === 'function') await schedule();
    else await scheduleCodexProcesses({ decisionOsRoot, runtime });
    const current = publicRun(runtimeRuns(runtime)[runId]);
    return {
      ok: true, statusCode: 202, run: current, queued: current.status === 'pending',
      queuePosition: current.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot, id: admitted.id, createdAt: admitted.createdAt, runtime }) : null,
    };
  }
  logCodexContinueDebug('spawn-prep', { traceId, ledgerId, cardId, runId, newSession, command: command.command, args: command.args, model: command.model, effort: command.effort, sessionId, promptChars: prompt.length, messageCount: messages.length, outputFile });
  mkdirSync(runDirectory, { recursive: true });
  const eventStartLine = prepareCardSkillRunEventAppend(stdoutFile);
  const run: AnyRecord = {
    id: runId,
    executionId,
    ledgerId,
    outputCardId: cardId,
    sourceCardTitle: String(card?.title ?? cardId),
    outputFile,
    stdoutFile,
    stderrFile,
    codexModel: command.model,
    codexEffort: command.effort,
    newSession,
    resumeSessionId: newSession ? '' : sessionId,
    continuedMessageCount: messages.length,
    pid: 0,
    status: 'running',
    startedAt: '',
    continuedAt: '',
  };
  await launchCodexExecutionProcess({
    decisionOsRoot,
    runtime,
    workspaceRoot,
    ledgerId,
    ledgerPath,
    cardId,
    runId,
    executionId,
    command,
    env: decisionOsCodexEnvironment({ runtime, decisionOsRoot, ledgerFile: ledgerPath }),
    prompt,
    stdoutFile,
    stderrFile,
    segment: newSession ? 'restart' : 'continue',
    startLine: eventStartLine,
    metadata: { sourceCardTitle: String(card?.title ?? cardId), codexModel: command.model, codexEffort: command.effort },
    onSpawn: async (child, continuedAt) => {
      const processStartTime = codexProcessIdentity(child.pid ?? 0);
      const persistedProcess = !epoch4Dispatch && queueItemId
        ? recordCodexProcessQueueItemProcess({ decisionOsRoot, id: queueItemId, processId: child.pid ?? 0, stdoutFile, stderrFile })
        : null;
      if (epoch4Dispatch) {
        const state = taskExecutionState(runtime);
        if (!state) throw new Error('task_execution_state_unavailable');
        registerTaskExecutionProcess(runtime, {
          executionId,
          sessionId: runId,
          child,
          processId: child.pid ?? 0,
          processStartTime,
          startedAt: continuedAt,
          stdoutFile,
          stderrFile,
        });
        try {
          const current = state.executions.find(executionId);
          if (current?.lifecycle.phase === 'starting') await state.executions.transition(executionId, { phase: 'running' });
          else if (current?.lifecycle.phase !== 'running') throw new Error(`task_execution_spawn_phase_invalid:${current?.lifecycle.phase ?? 'missing'}`);
        } catch (error) {
          removeTaskExecutionProcess(runtime, executionId);
          throw error;
        }
      }
      Object.assign(run, { pid: child.pid ?? 0, startedAt: continuedAt, continuedAt });
      updateRuntimeRun(runtime, runId, run);
      attachRuntimeRunChild(runtime, runId, child);
      if (executionCoordinator) void executionCoordinator.spawned(executionId, {
        processId: child.pid ?? null,
        processStartTime: persistedProcess?.processStartTime || null,
        stdoutFile,
        stderrFile,
      }).catch((error: unknown) => reportBackground(runtime, 'project-canonical-continuation-spawn', error, { runId, executionId }));
      logCodexContinueDebug('spawned', { traceId, ledgerId, cardId, runId, newSession, pid: child.pid ?? 0, continuedAt, continuedMessageCount: messages.length });
    },
    onTurnStarted: (_event, observedAt) => {
      if (updateRuntimeExecution(runtime, runId, executionId, { turnStartedAt: observedAt })) {
        if (executionCoordinator) void executionCoordinator.heartbeat(executionId)
          .catch((error: unknown) => reportBackground(runtime, 'publish-canonical-continuation-heartbeat', error, { runId, executionId }));
        notifyRuntimeCallback(runtime.onCodexTurnStarted, { ledgerId, cardId, threadId: `thread-${cardId}`, runId, executionId, status: 'running', startedAt: observedAt });
      }
    },
    onStdoutChunk: (chunk) => logCodexContinueDebug('child-stdout-chunk', { traceId, runId, bytes: chunk.length, preview: chunk.toString('utf8').slice(0, 500) }),
    onStderrChunk: (chunk) => logCodexContinueDebug('child-stderr-chunk', { traceId, runId, bytes: chunk.length, preview: chunk.toString('utf8').slice(0, 500) }),
    onSettled: async (settlement) => {
      if (epoch4Dispatch) removeTaskExecutionProcess(runtime, executionId);
      if (settlement.kind === 'error') {
        logCodexContinueDebug('child-error', { traceId, ledgerId, cardId, runId, message: settlement.error.message, finishedAt: settlement.finishedAt });
        const ownsExecution = updateRuntimeExecution(runtime, runId, executionId, { status: 'failed', error: settlement.error.message, finishedAt: settlement.finishedAt });
        if (!ownsExecution) return;
        appendRunStatus(outputFile, 'failed', `${newSession ? 'new session' : 'resume'} failed: ${settlement.error.message}`);
        appendFileSync(stderrFile, codexRunExecutionFinishedMarker({ runId, executionId, finishedAt: settlement.finishedAt, status: 'failed' }), 'utf8');
        if (executionCoordinator) await executionCoordinator.settle(executionId, { phase: 'failed', error: { code: 'codex_continuation_start_failed', message: settlement.error.message }, result: { status: 'failed', summary: settlement.error.message } });
        if (epoch4Dispatch) {
          const current = taskExecutionState(runtime)?.executions.find(executionId);
          if (current && !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(current.lifecycle.phase)) {
            await taskExecutionState(runtime)!.executions.transition(executionId, {
              phase: 'failed',
              error: { code: 'codex_continuation_start_failed', message: settlement.error.message },
            });
          }
        }
        try { await clearCardCodexExecution({ decisionOsRoot, ledgerId, ledgerPath, cardId, runId, executionId, runtime, terminalState: 'failed' }); }
        catch (error) { runtime.taskStatePersistenceError = error instanceof Error ? error.message : String(error); }
        if (queueItemId) removeCodexProcessQueueItem(decisionOsRoot, queueItemId);
        updateRuntimeExecution(runtime, runId, executionId, { settledAt: new Date().toISOString() });
        scheduleCodexRuntime(runtime, 'schedule-after-continuation-failure', { runId, executionId });
        notifyRuntimeCallback(runtime.onCodexRunSettled, { ledgerId, cardId, threadId: `thread-${cardId}`, runId, executionId, status: 'failed' });
        return;
      }
      const status: ProcessStatus = runtimeRuns(runtime)[runId]?.cancelRequestedAt || runtimeRunStatus(runtime, runId) === 'cancelled'
        ? 'cancelled'
        : settlement.terminalStatus ?? (settlement.exitCode === 0 ? 'complete' : 'failed');
      const detail = status === 'cancelled' ? 'terminated by operator' : `${newSession ? 'new session' : 'resume'} exit code ${settlement.exitCode ?? 'unknown'}`;
      logCodexContinueDebug('child-close', { traceId, ledgerId, cardId, runId, exitCode: settlement.exitCode, status, detail, finishedAt: settlement.finishedAt });
      const ownsExecution = updateRuntimeExecution(runtime, runId, executionId, { status, exitCode: settlement.exitCode, finishedAt: settlement.finishedAt });
      if (!ownsExecution) return;
      appendRunStatus(outputFile, status, detail);
      if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
      appendFileSync(stderrFile, codexRunExecutionFinishedMarker({ runId, executionId, finishedAt: settlement.finishedAt, status }), 'utf8');
      if (executionCoordinator) await executionCoordinator.settle(executionId, {
        phase: status === 'complete' ? 'succeeded' : status,
        result: { status: status === 'complete' ? 'succeeded' : status, summary: detail },
        error: status === 'failed' ? { code: 'codex_continuation_failed', message: detail } : null,
      });
      if (epoch4Dispatch) {
        const current = taskExecutionState(runtime)?.executions.find(executionId);
        if (current && !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(current.lifecycle.phase)) {
          await taskExecutionState(runtime)!.executions.transition(executionId, {
            phase: status === 'complete' ? 'succeeded' : status,
            result: { status: status === 'complete' ? 'succeeded' : status, summary: detail },
            error: status === 'failed' ? { code: 'codex_continuation_failed', message: detail } : null,
          });
        }
      }
      try { await clearCardCodexExecution({ decisionOsRoot, ledgerId, ledgerPath, cardId, runId, executionId, runtime, terminalState: status === 'failed' ? 'failed' : 'terminal' }); }
      catch (error) { runtime.taskStatePersistenceError = error instanceof Error ? error.message : String(error); }
      if (queueItemId) removeCodexProcessQueueItem(decisionOsRoot, queueItemId);
      updateRuntimeExecution(runtime, runId, executionId, { settledAt: new Date().toISOString() });
      scheduleCodexRuntime(runtime, 'schedule-after-continuation-settlement', { runId, executionId, status });
      notifyRuntimeCallback(runtime.onCodexRunSettled, { ledgerId, cardId, threadId: `thread-${cardId}`, runId, executionId, status, exitCode: settlement.exitCode });
    },
  });

  return { ok: true, statusCode: 202, run: publicRun(runtimeRuns(runtime)[runId] ?? run) };
}

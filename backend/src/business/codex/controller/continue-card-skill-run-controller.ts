/**
 * WHAT: Continues an existing card run and re-admits SYSTEM_PROMPT plus CODEX_RUN when recovery requires a fresh session.
 * WHY: A durable run id must resume its captured session while every replacement process retains committed prompt authority.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { prepareCardSkillRunEventAppend } from '../effect/prepare-card-skill-run-event-append.js';
import { buildCardSkillContinuePrompt } from '../helper/build-card-skill-continue-prompt.js';
import { buildCardLaunchContext } from '../helper/build-card-launch-context.js';
import { buildThreadCodexPrompt } from '../helper/build-thread-codex-prompt.js';
import { codexRunExecutionFinishedMarker } from '../helper/codex-run-segment-marker.js';
import { resolveCardSkillRunOwnership } from '../helper/resolve-card-skill-run-ownership.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand, resolveCodexResumeCommand } from '../helper/resolve-codex-command.js';
import { threadMessagesAfterLastCodexEvent } from '../helper/thread-messages-after-last-codex-event.js';
import { decisionOsCodexEnvironment } from '../helper/decision-os-codex-runtime.js';
import { randomUUID } from 'node:crypto';
import { codexProcessIdentity } from '../helper/codex-process-identity.js';
import { unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { resolveCardSkillRunFiles } from '../helper/resolve-card-skill-run-files.js';
import { hasLedgerProjectionSource, readLedgerProjection } from '@backend/business/task-state/helper/read-ledger-projection.js';
import { withCardCodexAdmission } from '../helper/card-codex-admission-lock.js';
import { launchCodexExecutionProcess } from '../helper/launch-codex-execution-process.js';
import {
  admitPipelineDeveloperPrompt,
  PipelinePromptAdmissionError,
} from '../helper/pipeline-prompt-snapshot.js';
import { serverPipelineDecisionOsRoot } from '../helper/server-pipeline-catalog.js';
import {
  commitTaskExecutionSettlement,
  taskExecutionSettlementTimestamp,
} from '../helper/commit-task-execution-settlement.js';
import { TaskExecutionAdmissionError, createTaskExecutionLaunchRequest } from '../helper/task-execution-router.js';
import {
  finalizeTaskExecutionArtifacts,
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
  const disallowSkills = payload.disallowSkills === true;
  let executionId = optionalText(payload.executionId);
  const router = taskExecutionRouter(runtime);
  const fail = (statusCode: number, error: string, extra: AnyRecord = {}): AnyRecord => {
    logCodexContinueDebug('continue-controller-fail', { traceId, ledgerId, cardId, runId, statusCode, error, ...extra });
    return { ok: false, statusCode, error, runId, ...extra };
  };
  logCodexContinueDebug('continue-controller-entry', { traceId, ledgerId, cardId, runId, decisionOsRoot, workspaceRoot, runtimeStatus: runtimeRunStatus(runtime, runId) });
  if (!ledgerId || !cardId || !runId) return fail(400, 'Missing ledgerId, cardId, or runId.');
  if (!epoch4Dispatch && !router) return fail(503, 'Replicated task execution state is unavailable.', { code: 'task_execution_state_unavailable', retryable: true });
  if (!epoch4Dispatch && payload.admissionLocked !== true) {
    return withCardCodexAdmission({ decisionOsRoot, ledgerId, cardId }, () => continueCardSkillRunController({
      action_payload: { ...payload, admissionLocked: true },
      runtime_state: runtime,
    }));
  }
  const existingRuntime = runtimeRuns(runtime)[runId];
  if (!epoch4Dispatch && existingRuntime && ['complete', 'failed', 'cancelled'].includes(String(existingRuntime.status ?? '')) && !existingRuntime.settledAt) {
    return fail(409, 'Run settlement is still in progress.', { executionId: existingRuntime.executionId });
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
  if (!isInside(decisionOsRoot, ledgerPath) || !hasLedgerProjectionSource({ ledgerId, ledgerPath, runtime })) {
    return fail(404, 'Ledger source not found.', { ledgerId, ledgerPath });
  }

  const ledger = readLedgerProjection({ ledgerId, ledgerPath, runtime }) as AnyRecord & { cards?: AnyRecord[] };
  const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  if (!card) return fail(404, 'Run card not found.', { cardId });
  const executionHistory = taskExecutionState(runtime)?.executions.bySessionId(runId) ?? [];
  const previousExecution = executionHistory
    .filter((candidate) => candidate.metadata.executionId !== executionId)
    .sort((left, right) => right.metadata.requestedAt.localeCompare(left.metadata.requestedAt))[0] ?? null;
  const executionMetadata = executionHistory.find((candidate) => candidate.metadata.executionId === executionId)?.metadata
    ?? previousExecution?.metadata;
  const codexModel = requestedCodexModel || optionalText(card.codexRunModel) || optionalText(executionMetadata?.model);
  const codexEffort = requestedCodexEffort || optionalText(card.codexRunEffort) || optionalText(executionMetadata?.effort);

  if (!epoch4Dispatch) {
    const selection = resolveCodexCommand({ workspaceRoot, runtime, codexModel, codexEffort });
    const launchRequest = createTaskExecutionLaunchRequest({
      requestId: optionalText(payload.requestId),
      executionId,
      projectId: String(runtime.projectId ?? ''),
      ledgerId,
      sessionId: runId,
      sourceCardId: cardId,
      ownerCardId: cardId,
      kind: 'continuation',
      model: selection.model,
      effort: selection.effort,
    });
    try {
      const destination = router!.resolveDestination(launchRequest);
      if (!destination.local) {
        // WHAT: Route a remote continuation before inspecting executor-local artifacts.
        // WHY: The requesting node must not require the assigned node's mutable run files.
        const receipt = await router!.route(launchRequest);
        const retainedRun = runtimeRuns(runtime)[runId] ?? {};
        const admitted = {
          id: runId,
          executionId: receipt.executionId,
          ledgerId,
          outputCardId: cardId,
          sourceCardTitle: String(card.title ?? cardId),
          outputFile: outputFileForRunCard({ ledger, decisionOsRoot, cardId }),
          stdoutFile: optionalText(retainedRun.stdoutFile),
          stderrFile: optionalText(retainedRun.stderrFile),
          codexModel: selection.model,
          codexEffort: selection.effort,
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
          queuePosition: null,
        };
      }
    } catch (error) {
      if (error instanceof TaskExecutionAdmissionError) {
        return fail(error.statusCode, error.code, { context: error.context, executionId });
      }
      throw error;
    }
  }

  const runFiles = resolveCardSkillRunFiles({ ledger, decisionOsRoot, ledgerPath, cardId, runId });
  const { runDirectory, stdoutFile, stderrFile } = runFiles;
  const sessionId = readRunSessionId(stdoutFile);
  const newSession = !sessionId;
  logCodexContinueDebug('run-files-resolved', { traceId, ledgerId, cardId, runId, newSession, runDirectory, stdoutFile, stderrFile, stdoutLineCount: runFileLineCount(stdoutFile), stderrBytes: existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8').length : 0, sessionId });

  if (!resolveCardSkillRunOwnership({ ledger, decisionOsRoot, cardId, runId }).found) {
    return fail(404, 'Run not found on card.', { cardId });
  }
  const continuation = threadMessagesAfterLastCodexEvent({ ledger, decisionOsRoot, cardId, runId, traceId });
  const interrupted = !previousExecution || previousExecution.lifecycle.phase !== 'succeeded';
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

  const outputMarkdown = newSession ? readFileSync(outputFile, 'utf8') : '';
  const continuationThreadMarkdown = messages
    .map((message) => `# ${String(message.role ?? '').toLowerCase() === 'agent' ? 'AGENT' : 'OPERATOR'}\n\n${String(message.message ?? message.body ?? '')}`)
    .join('\n\n');
  const launchContext = newSession ? buildCardLaunchContext({
    projectId: String(runtime.projectId ?? ''),
    ledgerId,
    cardId,
    threadId: `thread-${cardId}`,
    ledger,
    cardMarkdown: outputMarkdown,
    threadMarkdown: continuationThreadMarkdown,
  }) : undefined;
  let developerPrompt: string | undefined;
  if (newSession) {
    try {
      // WHAT: Re-admit SYSTEM_PROMPT plus CODEX_RUN before replacing a missing direct-run Codex session.
      // WHY: Recovery is a new process launch and must retain the same committed developer-prompt authority as the initial run.
      const evidence = await admitPipelineDeveloperPrompt({
        ownerDecisionOsRoot: serverPipelineDecisionOsRoot(runtime, decisionOsRoot),
        roots: ['SYSTEM_PROMPT', 'CODEX_RUN'],
      });
      developerPrompt = buildThreadCodexPrompt({
        developerPromptSnapshot: evidence.developerPromptSnapshot,
        workspaceRoot,
        projectId: String(runtime.projectId ?? ''),
        ledgerFile: ledgerPath,
        cardId,
        cardTitle: String(card.title ?? cardId),
        cardMarkdownFile: outputFile,
        cardMarkdown: outputMarkdown,
        threadId: `thread-${cardId}`,
        threadMarkdownFile: '',
        threadMarkdown: continuationThreadMarkdown,
        runSummaryFile: outputFile,
        operatorNoteTimestamp: '',
        context: launchContext!,
        disallowSkills,
      }).developerInstructions;
    } catch (error) {
      if (error instanceof PipelinePromptAdmissionError) {
        return fail(error.statusCode, error.message, {
          code: error.code,
          retryable: error.statusCode >= 500,
        });
      }
      return fail(503, error instanceof Error ? error.message : String(error), {
        code: 'pipeline_prompt_admission_failed',
        retryable: true,
      });
    }
  }
  const command = newSession
    ? resolveCodexCommand({
        workspaceRoot,
        runtime,
        codexModel,
        codexEffort,
        developerInstructions: developerPrompt,
        exactDeveloperInstructions: true,
      })
    : resolveCodexResumeCommand({ workspaceRoot, runtime, sessionId, codexModel, codexEffort });
  const prompt = buildCardSkillContinuePrompt({
    messages,
    disallowSkills,
    newSessionContext: newSession ? {
      workspaceRoot,
      ledgerFile: ledgerPath,
      runId,
      cardId,
      cardTitle: String(card.title ?? cardId),
      outputFile,
      outputMarkdown,
      context: launchContext!,
    } : undefined,
  });
  if (!epoch4Dispatch) {
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
      const receipt = await router!.route(launchRequest);
      const admitted = {
        id: runId,
        executionId: receipt.executionId,
        ledgerId,
        outputCardId: cardId,
        sourceCardTitle: String(card.title ?? cardId),
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
  logCodexContinueDebug('spawn-prep', { traceId, ledgerId, cardId, runId, newSession, command: command.command, args: command.args, model: command.model, effort: command.effort, sessionId, promptChars: prompt.length, messageCount: messages.length, outputFile });
  mkdirSync(runDirectory, { recursive: true });
  const eventStartLine = prepareCardSkillRunEventAppend(stdoutFile);
  const run: AnyRecord = {
    id: runId,
    executionId,
    ledgerId,
    outputCardId: cardId,
    sourceCardTitle: String(card.title ?? cardId),
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
    developerPrompt,
    stdoutFile,
    stderrFile,
    segment: newSession ? 'restart' : 'continue',
    startLine: eventStartLine,
    metadata: { sourceCardTitle: String(card.title ?? cardId), codexModel: command.model, codexEffort: command.effort },
    onSpawn: async (child, continuedAt) => {
      const processStartTime = codexProcessIdentity(child.pid ?? 0);
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
      Object.assign(run, { pid: child.pid ?? 0, startedAt: continuedAt, continuedAt });
      updateRuntimeRun(runtime, runId, run);
      attachRuntimeRunChild(runtime, runId, child);
      logCodexContinueDebug('spawned', { traceId, ledgerId, cardId, runId, newSession, pid: child.pid ?? 0, continuedAt, continuedMessageCount: messages.length });
    },
    onTurnStarted: (_event, observedAt) => {
      if (updateRuntimeExecution(runtime, runId, executionId, { turnStartedAt: observedAt })) {
        notifyRuntimeCallback(runtime.onCodexTurnStarted, { ledgerId, cardId, threadId: `thread-${cardId}`, runId, executionId, status: 'running', startedAt: observedAt });
      }
    },
    onStdoutChunk: (chunk) => logCodexContinueDebug('child-stdout-chunk', { traceId, runId, bytes: chunk.length, preview: chunk.toString('utf8').slice(0, 500) }),
    onStderrChunk: (chunk) => logCodexContinueDebug('child-stderr-chunk', { traceId, runId, bytes: chunk.length, preview: chunk.toString('utf8').slice(0, 500) }),
    onSettled: async (settlement) => {
      let retainProcessForArtifactFailure = false;
      try {
        if (!updateRuntimeExecution(runtime, runId, executionId, {})) return;
        const current = taskExecutionState(runtime)?.executions.find(executionId) ?? null;
        const cancelled = current?.lifecycle.phase === 'cancelling'
          || Boolean(runtimeRuns(runtime)[runId]?.cancelRequestedAt)
          || runtimeRunStatus(runtime, runId) === 'cancelled';
        const requestedPhase = cancelled
          ? 'cancelled'
          : settlement.kind === 'error'
            ? 'failed'
            : settlement.terminalStatus === 'complete'
              ? 'succeeded'
              : settlement.terminalStatus ?? (settlement.exitCode === 0 ? 'succeeded' : 'failed');
        const predictedStatus: ProcessStatus = requestedPhase === 'succeeded' ? 'complete' : requestedPhase;
        const finishedAt = taskExecutionSettlementTimestamp(current, settlement.finishedAt);
        const detail = predictedStatus === 'cancelled'
          ? 'terminated by operator'
          : settlement.kind === 'error'
            ? `${newSession ? 'new session' : 'resume'} failed: ${settlement.error.message}`
            : `${newSession ? 'new session' : 'resume'} exit code ${settlement.exitCode ?? 'unknown'}`;
        logCodexContinueDebug(settlement.kind === 'error' ? 'child-error' : 'child-close', {
          traceId, ledgerId, cardId, runId, exitCode: settlement.exitCode, status: predictedStatus, detail, finishedAt,
        });
        appendRunStatus(outputFile, predictedStatus, detail);
        if (predictedStatus === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
        appendFileSync(stderrFile, codexRunExecutionFinishedMarker({ runId, executionId, finishedAt, status: predictedStatus }), 'utf8');
        try {
          await finalizeTaskExecutionArtifacts({ runtime, executionId, jsonl: stdoutFile, stderr: stderrFile, telemetry: `${stdoutFile}.telemetry.jsonl` });
        } catch (error) {
          retainProcessForArtifactFailure = true;
          throw error;
        }
        const committed = await commitTaskExecutionSettlement({
          runtime,
          executionId,
          requestedPhase,
          settledAt: settlement.finishedAt,
          summary: detail,
          failureCode: settlement.kind === 'error' ? 'codex_continuation_start_failed' : 'codex_continuation_failed',
        });
        const status = committed.status;
        if (status === 'interrupted') throw new Error(`task_execution_settlement_status_invalid:${executionId}:interrupted`);
        updateRuntimeExecution(runtime, runId, executionId, {
          status,
          exitCode: settlement.exitCode,
          error: status === 'failed' ? detail : '',
          finishedAt: committed.finishedAt,
          settledAt: new Date().toISOString(),
        });
        scheduleCodexRuntime(runtime, 'schedule-after-continuation-settlement', { runId, executionId, status });
        if (typeof runtime.onCodexRunSettled === 'function') {
          await runtime.onCodexRunSettled({
            ledgerId, cardId, threadId: `thread-${cardId}`, runId, executionId, status,
            exitCode: settlement.exitCode, finishedAt: committed.finishedAt,
          });
        }
      } finally {
        // WHAT: Retain live process paths through immutable artifact publication.
        // WHY: A terminal read must never lack both a process file and an artifact head.
        if (!retainProcessForArtifactFailure) removeTaskExecutionProcess(runtime, executionId);
      }
    },
  });

  return { ok: true, statusCode: 202, run: publicRun(runtimeRuns(runtime)[runId] ?? run) };
}

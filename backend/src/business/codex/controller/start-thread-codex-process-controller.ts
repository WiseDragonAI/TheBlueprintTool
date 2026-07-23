/**
 * WHAT: Starts a headless Codex process scoped to one card thread.
 * WHY: The thread panel needs a direct Codex action that continues against the same thread messages.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { externalizeCardContent, resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { formatThreadMarkdown, hydrateLedgerThreadNotesFor, resolveThreadContentFile, stripHydratedThreadNotes, writeThreadNotesFile } from '@backend/business/ledger/helper/thread-content-file.js';
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { prepareCardSkillRunEventAppend } from '../effect/prepare-card-skill-run-event-append.js';
import { buildThreadCodexPrompt } from '../helper/build-thread-codex-prompt.js';
import { buildCardLaunchContext } from '../helper/build-card-launch-context.js';
import { codexRunExecutionFinishedMarker } from '../helper/codex-run-segment-marker.js';
import { isCodexThreadArtifactNote } from '../helper/is-codex-thread-artifact-note.js';
import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand, resolveCodexResumeCommand, type CodexCommand } from '../helper/resolve-codex-command.js';
import { codexCapacityResumeDelayMs, isTransientCodexCapacityFailure, readCodexSessionId } from '../helper/transient-codex-capacity-failure.js';
import { decisionOsCodexEnvironment } from '../helper/decision-os-codex-runtime.js';
import { projectCardCodexRun } from '../helper/project-card-codex-run.js';
import { codexProcessIdentity, enqueueCodexThreadProcess, readCodexProcessQueue, recordCodexProcessQueueItemProcess, removeCodexProcessQueueItem } from '../helper/codex-process-queue.js';
import { scheduleCodexProcesses, unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { clearCardCodexExecution } from '../helper/clear-card-codex-execution.js';
import { runtimeCodexRunOwnsLiveProcess } from '../helper/runtime-codex-run-owns-live-process.js';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { cancelCodexPipelineRunController } from './cancel-codex-pipeline-run-controller.js';
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
  scheduleCodexRuntimeTimer,
  updateCodexRuntimeExecution as updateRuntimeExecution,
  updateCodexRuntimeRun as updateRuntimeRun,
} from '../helper/codex-runtime-run-store.js';

type AnyRecord = Record<string, unknown>;
type ProcessStatus = 'running' | 'complete' | 'failed' | 'cancelled';

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function workspaceRootForDecisionOsRoot(decisionOsRoot: string): string {
  return dirname(decisionOsRoot);
}

function ledgerStem(ledgerPath: string): string {
  return basename(ledgerPath, extname(ledgerPath));
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function reportBackground(runtime: AnyRecord, operation: string, error: unknown, context: AnyRecord): void {
  if (typeof runtime.onCodexBackgroundError === 'function') runtime.onCodexBackgroundError({ operation, error, context });
}

async function supersedeNonLiveRun(input: { runtime: AnyRecord; decisionOsRoot: string; runId: string }): Promise<void> {
  removeCodexProcessQueueItem(input.decisionOsRoot, input.runId);
  const pipelineRun = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store.runs.find((candidate) => (
    candidate.id === input.runId
    || candidate.steps.some((step) => step.skills.some((skill) => skill.runId === input.runId))
  ));
  if (pipelineRun && pipelineRun.status !== 'complete' && pipelineRun.status !== 'failed' && pipelineRun.status !== 'cancelled') {
    const activeSkill = pipelineRun.steps.flatMap((step) => step.skills).find((skill) => skill.status === 'running')
      ?? pipelineRun.steps.flatMap((step) => step.skills).find((skill) => skill.status === 'pending');
    await cancelCodexPipelineRunController({
      action_payload: { runId: pipelineRun.id, executionId: activeSkill?.executionId ?? '' },
      runtime_state: input.runtime,
    });
  }
  const run = runtimeRuns(input.runtime)[input.runId];
  if (!run || run.status === 'complete' || run.status === 'failed' || run.status === 'cancelled') return;
  const finishedAt = new Date().toISOString();
  updateRuntimeRun(input.runtime, input.runId, {
    status: 'cancelled',
    error: 'Superseded by an operator-triggered run.',
    finishedAt,
    settledAt: finishedAt,
  });
}

function appendRunStatus(filePath: string, status: ProcessStatus, detail: string): void {
  const heading = status === 'complete' ? 'Completed' : status === 'failed' ? 'Failed' : status === 'cancelled' ? 'Cancelled' : 'Running';
  const markdown = [``, `---`, ``, `Codex run ${heading.toLowerCase()}: ${detail}`].join('\n');
  try {
    writeFileSync(filePath, `${existsSync(filePath) ? readFileSync(filePath, 'utf8').replace(/\s+$/g, '') : ''}${markdown}\n`, 'utf8');
  } catch {
    // The JSONL and stderr files remain the fallback status record.
  }
}

function cardContentFile(input: { decisionOsRoot: string; card: AnyRecord; ledgerPath: string }): string {
  externalizeCardContent({ decisionOsRoot: input.decisionOsRoot, card: input.card, ledgerPath: input.ledgerPath });
  const comment = input.card.comment && typeof input.card.comment === 'object' ? input.card.comment as AnyRecord : {};
  return resolveCardContentFile(input.decisionOsRoot, comment.contentFile) ?? '';
}

function threadContentFile(input: { decisionOsRoot: string; ledger: AnyRecord; ledgerPath: string; threadId: string }): string {
  hydrateLedgerThreadNotesFor(input.ledger, input.decisionOsRoot, input.threadId);
  const notes = normalizeLedgerNotes(input.ledger)[input.threadId] ?? [];
  writeThreadNotesFile({ decisionOsRoot: input.decisionOsRoot, ledger: input.ledger, ledgerPath: input.ledgerPath, threadId: input.threadId, notes });
  const threadFiles = input.ledger.threadFiles && typeof input.ledger.threadFiles === 'object' ? input.ledger.threadFiles as Record<string, unknown> : {};
  return resolveThreadContentFile(input.decisionOsRoot, threadFiles[input.threadId]) ?? '';
}

function threadMarkdownForPrompt(input: { decisionOsRoot: string; ledger: AnyRecord; threadId: string }): { markdown: string; operatorNoteTimestamp: string } | null {
  hydrateLedgerThreadNotesFor(input.ledger, input.decisionOsRoot, input.threadId);
  const notes = (normalizeLedgerNotes(input.ledger)[input.threadId] ?? [])
    .filter((note) => !isCodexThreadArtifactNote(note));
  let operatorNote: AnyRecord | undefined;
  for (let index = notes.length - 1; index >= 0; index -= 1) {
    if (String(notes[index].role ?? '').toLowerCase() !== 'operator') continue;
    operatorNote = notes[index];
    break;
  }
  const operatorNoteTimestamp = typeof operatorNote?.timestamp === 'string' ? operatorNote.timestamp : '';
  const parsedTimestamp = new Date(operatorNoteTimestamp);
  if (!operatorNoteTimestamp || Number.isNaN(parsedTimestamp.getTime()) || parsedTimestamp.toISOString() !== operatorNoteTimestamp) return null;
  return { markdown: formatThreadMarkdown(notes), operatorNoteTimestamp };
}

export async function startThreadCodexProcessController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const workspaceRoot = workspaceRootForDecisionOsRoot(decisionOsRoot);
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const threadId = String(payload.threadId ?? '').trim();
  const payloadCardId = String(payload.cardId ?? '').trim();
  const cardId = payloadCardId || threadId.replace(/^thread-/, '');
  if (!ledgerId || !threadId || !cardId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, threadId, or cardId.' };
  if (threadId !== `thread-${cardId}`) return { ok: false, statusCode: 400, error: 'Thread is not a card thread.', threadId, cardId };

  const requestedCodexModel = optionalText(payload.codexModel);
  const requestedCodexEffort = optionalText(payload.codexEffort);
  const reservedRunId = optionalText(payload.reservedRunId);
  const reservedExecutionId = optionalText(payload.executionId);
  const epoch4Dispatch = payload.epoch4Dispatch === true;
  const queueDispatch = payload.queueDispatch === true || epoch4Dispatch;
  const router = taskExecutionRouter(runtime);
  if (!queueDispatch && payload.admissionLocked !== true) {
    return withCardCodexAdmission({ decisionOsRoot, ledgerId, cardId }, () => startThreadCodexProcessController({
      action_payload: { ...payload, admissionLocked: true },
      runtime_state: runtime,
    }));
  }
  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedCodexModel };
  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedCodexEffort };

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json'), writeBack: true }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };

  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };

  const ledger = readLedgerProjection({ ledgerId, ledgerPath, runtime }) as AnyRecord & { cards?: AnyRecord[] };
  const source = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  if (!source) return { ok: false, statusCode: 404, error: 'Thread target card not found.', cardId, threadId };
  const ownership = cardCodexExecutionOwnership(source);
  if (ownership.state === 'contradictory') return { ok: false, statusCode: 409, error: 'Card has contradictory Codex execution ownership.', ...ownership };
  const activeRunId = ownership.state === 'active' ? ownership.lease.runId : '';
  const activeExecutionId = ownership.state === 'active' ? ownership.lease.executionId : '';
  if (!router && !queueDispatch && activeRunId && activeExecutionId) {
    const queued = readCodexProcessQueue(decisionOsRoot).find((item) => String(item.payload.runId ?? item.id) === activeRunId && String(item.payload.executionId ?? '') === activeExecutionId);
    const live = runtimeRuns(runtime)[activeRunId];
    if (queued || live && (live.status === 'pending' || live.status === 'running')) {
      const run = live ?? { id: activeRunId, executionId: activeExecutionId, ledgerId, outputCardId: cardId, status: queued?.status === 'running' ? 'running' : 'pending', createdAt: queued?.createdAt ?? '' };
      return {
        ok: true,
        statusCode: 202,
        run: publicRun(run),
        queued: String(run.status ?? '') === 'pending',
        queuePosition: queued?.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot, id: queued.id, createdAt: queued.createdAt, runtime }) : null,
      };
    }
  }
  const retainedThreadRunId = String(source.codexThreadRunId ?? '').trim();
  if (!queueDispatch && !activeRunId && retainedThreadRunId) {
    const { continueCardSkillRunController } = await import('./continue-card-skill-run-controller.js');
    return continueCardSkillRunController({
      action_payload: { ...payload, ledgerId, cardId, runId: retainedThreadRunId, admissionLocked: true },
      runtime_state: runtime,
    });
  }
  const sourceCardFile = cardContentFile({ decisionOsRoot, card: source, ledgerPath });
  const sourceThreadFile = threadContentFile({ decisionOsRoot, ledger, ledgerPath, threadId });
  if (!sourceCardFile || !sourceThreadFile) return { ok: false, statusCode: 500, error: 'Could not resolve card or thread markdown file.', cardId, threadId };
  const threadPrompt = threadMarkdownForPrompt({ decisionOsRoot, ledger, threadId });
  if (!threadPrompt) return {
    ok: false,
    statusCode: 400,
    error: 'The latest operator note must have an exact ISO timestamp before Codex can start.',
    cardId,
    threadId,
  };
  const existingRunId = activeRunId;
  if (!router && existingRunId && existingRunId !== reservedRunId) {
    if (queueDispatch || runtimeCodexRunOwnsLiveProcess(runtime, existingRunId, decisionOsRoot)) return {
      ok: false,
      statusCode: 409,
      error: 'Card already owns a live Codex process.',
      cardId,
      threadId,
      runId: existingRunId,
    };
    await supersedeNonLiveRun({ runtime, decisionOsRoot, runId: existingRunId });
  }

  const runId = reservedRunId || `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const executionId = reservedExecutionId || `codex-execution-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runDirectoryRef = `.decision-os/runs/codex-skills/${safeSegment(ledgerStem(ledgerPath))}`;
  const runDirectory = resolve(decisionOsRoot, runDirectoryRef.replace(/^\.decision-os\//, ''));
  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
  const runSummaryRef = `${runDirectoryRef}/${safeSegment(runId)}.md`;
  const runSummaryFile = resolve(decisionOsRoot, runSummaryRef.replace(/^\.decision-os\//, ''));
  if (!queueDispatch && router) {
    const selection = resolveCodexCommand({
      workspaceRoot,
      runtime,
      codexModel: requestedCodexModel,
      codexEffort: requestedCodexEffort,
      developerInstructions: '',
    });
    const launchRequest = createTaskExecutionLaunchRequest({
      requestId: optionalText(payload.requestId),
      executionId,
      projectId: String(runtime.projectId ?? ''),
      ledgerId,
      sessionId: runId,
      sourceCardId: cardId,
      ownerCardId: cardId,
      kind: 'thread',
      model: selection.model,
      effort: selection.effort,
    });
    try {
      const receipt = await router.route(launchRequest);
      const run = {
        id: runId,
        executionId: receipt.executionId,
        skillName: 'decision-os-thread',
        kind: 'thread',
        ledgerId,
        sourceCardId: cardId,
        sourceCardTitle: String(source.title ?? cardId),
        sourceThreadId: threadId,
        outputCardId: cardId,
        outputFile: runSummaryFile,
        stdoutFile,
        stderrFile,
        codexModel: selection.model,
        codexEffort: selection.effort,
        pid: 0,
        status: 'pending',
        createdAt: receipt.requestedAt,
        startedAt: null,
      };
      updateRuntimeRun(runtime, runId, run);
      notifyRuntimeCallback(runtime.onCodexRunAccepted, {
        ledgerId,
        cardId,
        threadId,
        runId,
        executionId: receipt.executionId,
        status: 'pending',
        executorNodeId: receipt.executorNodeId,
      });
      return {
        ok: true,
        statusCode: 202,
        receipt,
        run: publicRun(run),
        queued: true,
        queuePosition: receipt.executorNodeId === taskExecutionNodeId(runtime)
          ? unifiedCodexQueuePosition({ decisionOsRoot, id: receipt.executionId, createdAt: receipt.requestedAt, runtime })
          : null,
        maxConcurrentCodexProcesses: Number(runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object'
          ? (runtime.decisionOsSettings as AnyRecord).maxConcurrentCodexProcesses ?? 1
          : 1),
      };
    } catch (error) {
      if (error instanceof TaskExecutionAdmissionError) {
        return { ok: false, statusCode: error.statusCode, error: error.code, context: error.context, runId, executionId };
      }
      throw error;
    }
  }
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(runSummaryFile, [`# Thread Codex Run`, '', `Status: ${queueDispatch ? 'processing' : 'queued'}`, `Source card: ${String(source.title ?? cardId)}`, `Source thread: ${threadId}`, `Codex run: ${runId}`].join('\n'), 'utf8');

  const cardMarkdown = readFileSync(sourceCardFile, 'utf8');
  const prompt = buildThreadCodexPrompt({
    workspaceRoot,
    projectId: String(runtime.projectId ?? ''),
    ledgerFile: ledgerPath,
    cardId,
    cardTitle: String(source.title ?? cardId),
    cardMarkdownFile: sourceCardFile,
    cardMarkdown,
    threadId,
    threadMarkdownFile: sourceThreadFile,
    threadMarkdown: threadPrompt.markdown,
    runSummaryFile,
    operatorNoteTimestamp: threadPrompt.operatorNoteTimestamp,
    disallowSkills: payload.disallowSkills === true,
    context: buildCardLaunchContext({
      projectId: String(runtime.projectId ?? ''),
      ledgerId,
      cardId,
      threadId,
      ledger,
      cardMarkdown,
      threadMarkdown: threadPrompt.markdown,
    }),
  });
  const command = resolveCodexCommand({
    workspaceRoot,
    runtime,
    codexModel: requestedCodexModel,
    codexEffort: requestedCodexEffort,
    developerInstructions: prompt.developerInstructions,
  });
  const createdAt = new Date().toISOString();
  projectCardCodexRun({
    ledger,
    cardId,
    runId,
    executionId,
    outputFileRef: runSummaryRef,
    codexModel: command.model,
    codexEffort: command.effort,
    ownership: 'thread',
  });
  const executionCoordinator = epoch4Dispatch ? null : codexExecutionCoordinator(runtime);
  let canonicalRecord = executionCoordinator?.store.find(executionId) ?? null;
  if (executionCoordinator) {
    try {
      if (!canonicalRecord) canonicalRecord = await executionCoordinator.admit({
        executionId,
        sessionId: runId,
        projectId: String(runtime.projectId ?? ''),
        ledgerId,
        taskId: cardId,
        ownerCardId: cardId,
        kind: 'thread',
        requestedAt: createdAt,
      });
      if (canonicalRecord.phase === 'preparing') canonicalRecord = await executionCoordinator.enqueue(executionId);
      if (queueDispatch && canonicalRecord.phase === 'queued') canonicalRecord = await executionCoordinator.claim(executionId);
      if (ledgerId === 'tasks') source.executionIntent = executionCoordinator.intent(canonicalRecord);
    } catch (error) {
      return { ok: false, statusCode: 503, code: String((error as { code?: unknown })?.code ?? ''), retryable: true, error: error instanceof Error ? error.message : String(error), runId, executionId };
    }
  } else if (ledgerId === 'tasks') projectCardExecutionIntent({
    card: source,
    intentId: runId,
    state: queueDispatch ? 'running' : 'queued',
    changedAt: createdAt,
  });
  const startedAt = queueDispatch ? createdAt : null;
  const run = {
    id: runId,
    executionId,
    skillName: 'decision-os-thread',
    kind: 'thread',
    ledgerId,
    sourceCardId: cardId,
    sourceCardTitle: String(source.title ?? cardId),
    sourceThreadId: threadId,
    outputCardId: cardId,
    outputFile: runSummaryFile,
    stdoutFile,
    stderrFile,
    codexModel: command.model,
    codexEffort: command.effort,
    pid: 0,
    status: queueDispatch ? 'running' : 'pending',
    createdAt,
    startedAt,
  };
  updateRuntimeRun(runtime, runId, run);

  if (!queueDispatch) {
    try {
      enqueueCodexThreadProcess({
        decisionOsRoot,
        id: runId,
        createdAt,
        payload: { ledgerId, threadId, cardId, runId, executionId, codexModel: command.model, codexEffort: command.effort },
      });
      stripHydratedThreadNotes(ledger);
      await persistLedgerProjection({ decisionOsRoot, ledgerId, ledgerPath, ledger, runtime, command: { kind: 'queue-codex-execution', cardIds: [cardId] } });
    } catch (error) {
      removeCodexProcessQueueItem(decisionOsRoot, runId);
      delete runtimeRuns(runtime)[runId];
      rmSync(runSummaryFile, { force: true });
      if (executionCoordinator && canonicalRecord && !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(canonicalRecord.phase)) {
        await executionCoordinator.cancel(executionId, 'Direct Codex admission did not complete.').catch(() => undefined);
      }
      return { ok: false, statusCode: 500, error: error instanceof Error ? error.message : 'Codex admission failed.', runId };
    }
    notifyRuntimeCallback(runtime.onCodexRunAccepted, { ledgerId, cardId, threadId, runId, executionId, status: 'pending' });
    const schedule = runtime.scheduleCodexProcesses;
    if (typeof schedule === 'function') await schedule();
    else await scheduleCodexProcesses({ decisionOsRoot, runtime });
    const current = publicRun(runtimeRuns(runtime)[runId]);
    return {
      ok: true,
      statusCode: 202,
      run: current,
      queued: current.status === 'pending',
      queuePosition: current.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot, id: runId, createdAt, runtime }) : null,
      maxConcurrentCodexProcesses: Number(runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object' ? (runtime.decisionOsSettings as AnyRecord).maxConcurrentCodexProcesses ?? 1 : 1),
    };
  }

  stripHydratedThreadNotes(ledger);
  try {
    await persistLedgerProjection({ decisionOsRoot, ledgerId, ledgerPath, ledger, runtime, command: { kind: 'start-codex-execution', cardIds: [cardId] } });
  } catch (error) {
    if (isTaskStateBootstrapGate(error)) return { ok: false, statusCode: 503, code: 'codex_execution_projection_pending', retryable: true, error: 'Task-state projection is waiting for relay convergence.', runId, executionId };
    throw error;
  }
  notifyRuntimeCallback(runtime.onCodexRunAccepted, { ledgerId, cardId, threadId, runId, executionId, status: 'running' });

  const launch = async (attemptCommand: CodexCommand, taskInput: string, segment: 'start' | 'continue'): Promise<void> => {
    const eventStartLine = segment === 'start' ? 0 : prepareCardSkillRunEventAppend(stdoutFile);
    const stdoutByteOffset = existsSync(stdoutFile) ? statSync(stdoutFile).size : 0;
    const stderrByteOffset = existsSync(stderrFile) ? statSync(stderrFile).size : 0;
    await launchCodexExecutionProcess({
      decisionOsRoot,
      runtime,
      workspaceRoot,
      ledgerId,
      ledgerPath,
      cardId,
      runId,
      executionId,
      command: attemptCommand,
      env: decisionOsCodexEnvironment({ runtime, decisionOsRoot, ledgerFile: ledgerPath }),
      prompt: taskInput,
      stdoutFile,
      stderrFile,
      segment,
      startLine: eventStartLine,
      metadata: {
        sourceCardTitle: String(source.title ?? cardId),
        sourceThreadId: threadId,
        codexModel: attemptCommand.model,
        codexEffort: attemptCommand.effort,
      },
      onSpawn: async (child, attemptStartedAt) => {
        const processStartTime = codexProcessIdentity(child.pid ?? 0);
        const persistedProcess = epoch4Dispatch
          ? null
          : recordCodexProcessQueueItemProcess({ decisionOsRoot, id: runId, processId: child.pid ?? 0, stdoutFile, stderrFile });
        if (epoch4Dispatch) {
          const state = taskExecutionState(runtime);
          if (!state) throw new Error('task_execution_state_unavailable');
          registerTaskExecutionProcess(runtime, {
            executionId,
            sessionId: runId,
            child,
            processId: child.pid ?? 0,
            processStartTime,
            startedAt: attemptStartedAt,
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
        updateRuntimeRun(runtime, runId, { executionId, pid: child.pid ?? 0, status: 'running', startedAt: attemptStartedAt, transientRetryAt: null });
        attachRuntimeRunChild(runtime, runId, child);
        if (executionCoordinator) void executionCoordinator.spawned(executionId, {
          processId: child.pid ?? null,
          processStartTime: persistedProcess?.processStartTime || null,
          stdoutFile,
          stderrFile,
        }).catch((error: unknown) => reportBackground(runtime, 'project-canonical-codex-spawn', error, { runId, executionId }));
      },
      onTurnStarted: (_event, observedAt) => {
        if (updateRuntimeExecution(runtime, runId, executionId, { turnStartedAt: observedAt })) {
          if (executionCoordinator) void executionCoordinator.heartbeat(executionId)
            .catch((error: unknown) => reportBackground(runtime, 'publish-canonical-codex-heartbeat', error, { runId, executionId }));
          notifyRuntimeCallback(runtime.onCodexTurnStarted, { ledgerId, cardId, threadId, runId, executionId, status: 'running', startedAt: observedAt });
        }
      },
      onSettled: async (settlement) => {
        if (epoch4Dispatch) removeTaskExecutionProcess(runtime, executionId);
        if (settlement.kind === 'error') {
          const ownsExecution = updateRuntimeExecution(runtime, runId, executionId, { status: 'failed', error: settlement.error.message, finishedAt: settlement.finishedAt });
          if (!ownsExecution) return;
          appendRunStatus(runSummaryFile, 'failed', settlement.error.message);
          appendFileSync(stderrFile, codexRunExecutionFinishedMarker({ runId, executionId, finishedAt: settlement.finishedAt, status: 'failed' }), 'utf8');
          if (!epoch4Dispatch) removeCodexProcessQueueItem(decisionOsRoot, runId);
          if (executionCoordinator) await executionCoordinator.settle(executionId, { phase: 'failed', error: { code: 'codex_process_start_failed', message: settlement.error.message }, result: { status: 'failed', summary: settlement.error.message } });
          if (epoch4Dispatch) {
            const current = taskExecutionState(runtime)?.executions.find(executionId);
            if (current && !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(current.lifecycle.phase)) {
              await taskExecutionState(runtime)!.executions.transition(executionId, {
                phase: 'failed',
                error: { code: 'codex_process_start_failed', message: settlement.error.message },
              });
            }
          }
          updateRuntimeExecution(runtime, runId, executionId, { settledAt: new Date().toISOString() });
          try { await clearCardCodexExecution({ decisionOsRoot, ledgerId, ledgerPath, cardId, runId, executionId, runtime, terminalState: 'failed' }); }
          catch (error) { runtime.taskStatePersistenceError = error instanceof Error ? error.message : String(error); }
          scheduleCodexRuntime(runtime, 'schedule-after-thread-start-failure', { runId, executionId });
          notifyRuntimeCallback(runtime.onCodexRunSettled, { ledgerId, cardId, threadId, runId, executionId, status: 'failed' });
          return;
        }
        if (String(runtimeRuns(runtime)[runId]?.executionId ?? '') !== executionId) return;
        const cancelled = Boolean(runtimeRuns(runtime)[runId]?.cancelRequestedAt) || runtimeRunStatus(runtime, runId) === 'cancelled';
        const sessionId = settlement.exitCode === 0 || cancelled ? '' : readCodexSessionId(stdoutFile);
        if (!cancelled && settlement.exitCode !== 0 && sessionId && isTransientCodexCapacityFailure({ stdoutFile, stderrFile, stdoutByteOffset, stderrByteOffset })) {
          const retryAt = new Date(Date.now() + codexCapacityResumeDelayMs).toISOString();
          appendRunStatus(runSummaryFile, 'running', `model capacity reached; resuming the same session after ${codexCapacityResumeDelayMs / 1000} seconds`);
          if (!updateRuntimeExecution(runtime, runId, executionId, { status: 'running', transientRetryAt: retryAt, exitCode: settlement.exitCode })) return;
          scheduleCodexRuntimeTimer(runtime, `capacity-retry:${runId}:${executionId}`, codexCapacityResumeDelayMs, 'resume-thread-after-capacity-wait', () => {
            if (runtimeRunStatus(runtime, runId) !== 'running' || String(runtimeRuns(runtime)[runId]?.executionId ?? '') !== executionId) return;
            const resumeCommand = resolveCodexResumeCommand({ workspaceRoot, runtime, sessionId, codexModel: command.model, codexEffort: command.effort });
            void launch(resumeCommand, 'Continue the interrupted task from the durable session context.', 'continue')
              .catch((error: unknown) => reportBackground(runtime, 'resume-thread-after-capacity-wait', error, { runId, executionId }));
          }, { runId, executionId, sessionId });
          return;
        }
        const status: ProcessStatus = cancelled ? 'cancelled' : settlement.terminalStatus ?? (settlement.exitCode === 0 ? 'complete' : 'failed');
        const detail = status === 'cancelled' ? 'terminated by operator' : `exit code ${settlement.exitCode ?? 'unknown'}`;
        appendRunStatus(runSummaryFile, status, detail);
        if (!updateRuntimeExecution(runtime, runId, executionId, { status, exitCode: settlement.exitCode, finishedAt: settlement.finishedAt })) return;
        appendFileSync(stderrFile, codexRunExecutionFinishedMarker({ runId, executionId, finishedAt: settlement.finishedAt, status }), 'utf8');
        if (!epoch4Dispatch) removeCodexProcessQueueItem(decisionOsRoot, runId);
        if (executionCoordinator) await executionCoordinator.settle(executionId, {
          phase: status === 'complete' ? 'succeeded' : status,
          result: { status: status === 'complete' ? 'succeeded' : status, summary: detail },
          error: status === 'failed' ? { code: 'codex_process_failed', message: detail } : null,
        });
        if (epoch4Dispatch) {
          const current = taskExecutionState(runtime)?.executions.find(executionId);
          if (current && !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(current.lifecycle.phase)) {
            await taskExecutionState(runtime)!.executions.transition(executionId, {
              phase: status === 'complete' ? 'succeeded' : status,
              result: { status: status === 'complete' ? 'succeeded' : status, summary: detail },
              error: status === 'failed' ? { code: 'codex_process_failed', message: detail } : null,
            });
          }
        }
        updateRuntimeExecution(runtime, runId, executionId, { settledAt: new Date().toISOString() });
        try { await clearCardCodexExecution({ decisionOsRoot, ledgerId, ledgerPath, cardId, runId, executionId, runtime, terminalState: status === 'failed' ? 'failed' : 'terminal' }); }
        catch (error) { runtime.taskStatePersistenceError = error instanceof Error ? error.message : String(error); }
        scheduleCodexRuntime(runtime, 'schedule-after-thread-settlement', { runId, executionId, status });
        if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
        notifyRuntimeCallback(runtime.onCodexRunSettled, { ledgerId, cardId, threadId, runId, executionId, status, exitCode: settlement.exitCode });
      },
    });
  };

  await launch(command, prompt.taskContext, 'start');

  return { ok: true, statusCode: 202, run: publicRun(runtimeRuns(runtime)[runId]) };
}

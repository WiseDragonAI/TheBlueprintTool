/**
 * WHAT: Reads one card-scoped Codex skill run from its derived JSONL/log files.
 * WHY: The output card and run id are enough to hydrate live progress without a persisted run manifest.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { type NormalizedRunEvent } from '../helper/card-skill-run-event-types.js';
import { normalizeCardSkillRunDiagnostic, normalizeCardSkillRunEvent } from '../helper/normalize-card-skill-run-event.js';
import { readCardSkillRunEventLines } from '../helper/read-card-skill-run-event-lines.js';
import { codexRunExecutions, codexRunSegmentMetadata, isCodexRunMarkerLine, latestCodexRunSegmentLog, latestCodexRunSegmentStartedAtMs, latestCodexRunSegmentStartLine, type CodexRunExecution, type CodexRunSegmentMetadata } from '../helper/codex-run-segment-marker.js';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { readCodexProcessQueue } from '../helper/codex-process-queue.js';
import { unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { resolveCardSkillRunOwnership } from '../helper/resolve-card-skill-run-ownership.js';
import { runtimeCodexRunOwnsLiveProcess } from '../helper/runtime-codex-run-owns-live-process.js';
import { resolveCardSkillRunFiles } from '../helper/resolve-card-skill-run-files.js';

type AnyRecord = Record<string, unknown>;
type RunStatus = 'pending' | 'running' | 'complete' | 'failed' | 'cancelled' | 'unknown';

const NON_FATAL_CODEX_MODEL_REFRESH_DIAGNOSTIC = /\bcodex_models_manager::manager:\s*failed to refresh available models:\s*timeout waiting for child process to exit\b/i;
const NON_FATAL_APPLY_PATCH_VERIFICATION_DIAGNOSTIC = /\bcodex_core::tools::router:\s*error=apply_patch verification failed:/i;

function isNonFatalCodexDiagnostic(text: string): boolean {
  // WHAT: Recognize the Codex model-catalog refresh timeout that does not terminate the active run.
  // WHY: The line must remain in the raw log without becoming an actionable error or failed run status.
  return NON_FATAL_CODEX_MODEL_REFRESH_DIAGNOSTIC.test(text)
    || NON_FATAL_APPLY_PATCH_VERIFICATION_DIAGNOSTIC.test(text);
}

function actionableCodexLog(log: string): string {
  const lines = log.replace(/\r\n?/g, '\n').split('\n');
  const actionable: string[] = [];
  let suppressPatchContext = false;
  for (const line of lines) {
    if (isCodexRunMarkerLine(line)) continue;
    if (NON_FATAL_APPLY_PATCH_VERIFICATION_DIAGNOSTIC.test(line)) {
      suppressPatchContext = true;
      continue;
    }
    if (suppressPatchContext && /^\d{4}-\d{2}-\d{2}T\S+\s+(?:ERROR|WARN|WARNING|INFO)\b/.test(line)) suppressPatchContext = false;
    if (!suppressPatchContext && !isNonFatalCodexDiagnostic(line)) actionable.push(line);
  }
  return actionable.join('\n');
}

function logCodexContinueDebug(phase: string, detail: AnyRecord): void {
  console.log(JSON.stringify({ codexContinueDebug: true, source: 'backend', phase, at: new Date().toISOString(), ...detail }));
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function runTimestamp(runId: string): number {
  const match = runId.match(/^codex-skill-(\d+)-/);
  const timestamp = Number(match?.[1] ?? 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

function runtimeRunStatus(runtime: AnyRecord, runId: string): RunStatus | null {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const run = runs[runId];
  const status = String(run?.status ?? '');
  return status === 'pending' || status === 'running' || status === 'complete' || status === 'failed' || status === 'cancelled' ? status : null;
}

function runtimeRunMetadata(runtime: AnyRecord, runId: string): CodexRunSegmentMetadata {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const run = runs[runId] ?? {};
  return {
    sourceCardTitle: typeof run.sourceCardTitle === 'string' ? run.sourceCardTitle : '',
    sourceThreadId: typeof run.sourceThreadId === 'string' ? run.sourceThreadId : '',
    codexModel: typeof run.codexModel === 'string' ? run.codexModel : '',
    codexEffort: typeof run.codexEffort === 'string' ? run.codexEffort : '',
  };
}

function latestRunEventStatus(events: NormalizedRunEvent[]): RunStatus | null {
  let status: RunStatus | null = null;
  for (const event of events) {
    if (event.type === 'thread.started' || event.type === 'turn.started') status = 'running';
    if (event.type === 'turn.completed') status = 'complete';
    if (/cancelled|canceled/i.test(event.type)) status = 'cancelled';
    if (/^(?:thread|turn|run)\.failed$/i.test(event.type) || (event.kind === 'run_status' && event.status === 'failed')) status = 'failed';
  }
  return status;
}

function inferredStatus(input: { runtime: AnyRecord; runId: string; events: NormalizedRunEvent[]; stdoutFile: string; stderrFile: string; stderrLog: string }): RunStatus {
  const runtimeStatus = runtimeRunStatus(input.runtime, input.runId);
  if (runtimeStatus) return runtimeStatus;
  const actionableStderrLog = actionableCodexLog(input.stderrLog);
  const logStatus: RunStatus | null = /cancelled|canceled|terminated by operator/i.test(actionableStderrLog)
    ? 'cancelled'
    : /(spawn|enoent|failed|exit code [1-9]|error:)/i.test(actionableStderrLog)
      ? 'failed'
      : null;
  const latestStatus = latestRunEventStatus(input.events);
  const stdoutMtime = fileMtimeMs(input.stdoutFile);
  const stderrMtime = fileMtimeMs(input.stderrFile);
  if (logStatus && stderrMtime >= stdoutMtime) return logStatus;
  if (latestStatus === 'complete') return 'complete';
  if (!existsSync(input.stdoutFile)) return 'unknown';
  const newestWrite = Math.max(stdoutMtime, stderrMtime);
  if (latestStatus === 'running') return Date.now() - newestWrite < 120000 ? 'running' : 'unknown';
  return logStatus ?? (Date.now() - newestWrite < 120000 ? 'running' : 'unknown');
}

function fileMtimeMs(file: string): number {
  return existsSync(file) ? statSync(file).mtimeMs : 0;
}

function runSegmentStartedAtMs(input: { runtime: AnyRecord; runId: string; stderrFile: string }): number {
  const runs = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const run = runs[input.runId] ?? {};
  const runtimeStarted = Date.parse(String(run.startedAt ?? ''));
  const log = existsSync(input.stderrFile) ? readFileSync(input.stderrFile, 'utf8') : '';
  const durableExecutionId = codexRunExecutions({ log, runId: input.runId }).at(-1)?.executionId ?? '';
  if (String(run.executionId ?? '') && String(run.executionId ?? '') !== durableExecutionId) {
    return runtimeStarted || Date.parse(String(run.createdAt ?? '')) || runTimestamp(input.runId);
  }
  return latestCodexRunSegmentStartedAtMs({ log, runId: input.runId }) || runtimeStarted || runTimestamp(input.runId);
}

function executionTelemetryFinishedAtByStartLine(file: string): Map<number, number> {
  const finishedAtByStartLine = new Map<number, number>();
  if (!existsSync(file)) return finishedAtByStartLine;
  for (const line of readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
    try {
      const record = JSON.parse(line) as AnyRecord;
      const turnMatch = String(record.turnId ?? '').match(/:turn-(\d+)-/);
      const startLine = Math.max(0, Number(turnMatch?.[1] ?? 1) - 1);
      const finishedAt = Date.parse(String(record.completedAt ?? ''));
      if (turnMatch && Number.isFinite(finishedAt)) finishedAtByStartLine.set(startLine, Math.max(finishedAtByStartLine.get(startLine) ?? 0, finishedAt));
    } catch {
      // Malformed telemetry records cannot invalidate durable execution markers.
    }
  }
  return finishedAtByStartLine;
}

function executionHistory(input: {
  executions: CodexRunExecution[];
  events: NormalizedRunEvent[];
  currentStatus: RunStatus;
  active: boolean;
  currentElapsedMs: number;
  terminalFileWriteMs: number;
  telemetryFinishedAtByStartLine: Map<number, number>;
}): AnyRecord[] {
  return input.executions.map((execution, index) => {
    const endLine = input.executions[index + 1]?.startLine ?? (input.events.at(-1)?.line ?? execution.startLine);
    const executionEvents = input.events.filter((event) => event.line > execution.startLine && event.line <= endLine);
    const terminal = latestRunEventStatus(executionEvents);
    const current = index === input.executions.length - 1;
    const markerStatus = ['complete', 'failed', 'cancelled'].includes(execution.status) ? execution.status as RunStatus : null;
    const status = current ? input.currentStatus : markerStatus ?? terminal ?? 'unknown';
    const startedAtMs = Date.parse(execution.startedAt) || 0;
    const telemetryFinishedAtMs = input.telemetryFinishedAtByStartLine.get(execution.startLine) ?? 0;
    const nextStartedAtMs = Date.parse(input.executions[index + 1]?.startedAt ?? '') || 0;
    const durableFinishedAtMs = Date.parse(execution.finishedAt) || 0;
    const finishedAtMs = current
      ? (input.active ? 0 : input.terminalFileWriteMs)
      : durableFinishedAtMs || telemetryFinishedAtMs || nextStartedAtMs;
    const elapsedMs = current
      ? input.currentElapsedMs
      : Math.max(0, finishedAtMs - startedAtMs);
    return {
      ...execution,
      endLine: current && input.active ? null : endLine,
      status,
      active: current && input.active,
      finishedAt: finishedAtMs > 0 ? new Date(finishedAtMs).toISOString() : '',
      elapsedMs,
      toolCallCount: uniqueToolCallCount(execution.runId, executionEvents),
      agentMessageCount: executionEvents.filter((event) => event.kind === 'agent_message').length,
      fileChangeCount: executionEvents.filter((event) => event.title === 'File changes').length,
      thinkingCount: executionEvents.filter((event) => event.kind === 'thinking').length,
      warningCount: executionEvents.filter((event) => event.kind === 'warning').length,
      errorCount: executionEvents.filter((event) => event.kind === 'error').length,
      transportStatus: executionEvents.some((event) => event.kind === 'transport') ? 'degraded' : 'ok',
    };
  });
}

function elapsedMs(input: { runtime: AnyRecord; runId: string; status: RunStatus; stdoutFile: string; stderrFile: string }): number {
  const runs = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
  const run = runs[input.runId] ?? {};
  const started = runSegmentStartedAtMs({ runtime: input.runtime, runId: input.runId, stderrFile: input.stderrFile });
  const finished = input.status === 'running' ? Number.NaN : Date.parse(String(run.finishedAt ?? ''));
  const terminalFileWrite = Math.max(fileMtimeMs(input.stdoutFile), fileMtimeMs(input.stderrFile));
  const end = finished || (input.status === 'running' ? Date.now() : terminalFileWrite || Date.now());
  return Math.max(0, end - started);
}

function normalizedRunDiagnostics(log: string): NormalizedRunEvent[] {
  const lines = actionableCodexLog(log).split('\n');
  const diagnostics: NormalizedRunEvent[] = [];
  const structuredRecordStart = /^\d{4}-\d{2}-\d{2}T\S+\s+(?:ERROR|WARN|WARNING|INFO)\b/;
  for (let index = 0; index < lines.length;) {
    const text = lines[index];
    if (!text.trim()) {
      index += 1;
      continue;
    }
    const startLine = index + 1;
    if (!structuredRecordStart.test(text)) {
      diagnostics.push(normalizeCardSkillRunDiagnostic({ line: startLine, text }));
      index += 1;
      continue;
    }
    const record = [text];
    index += 1;
    while (index < lines.length && !structuredRecordStart.test(lines[index])) {
      record.push(lines[index]);
      index += 1;
    }
    while (record.at(-1)?.trim() === '') record.pop();
    diagnostics.push(normalizeCardSkillRunDiagnostic({ line: startLine, text: record.join('\n') }));
  }
  return diagnostics;
}

function uniqueToolCallCount(runId: string, events: NormalizedRunEvent[]): number {
  const identities = new Set<string>();
  for (const event of events) {
    if (event.kind !== 'tool_call') continue;
    identities.add(event.itemId ? `${runId}:item:${event.itemId}` : `${runId}:line:${event.line}`);
  }
  return identities.size;
}

export async function readCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  const since = Math.max(0, Number(payload.since ?? 0) || 0);
  const traceId = String(payload.traceId ?? '');
  logCodexContinueDebug('read-controller-entry', { traceId, ledgerId, cardId, runId, since });
  if (!ledgerId || !cardId || !runId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };

  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }, runtime_state: runtime });
  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };

  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };

  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
  const runReference = resolveCardSkillRunOwnership({ ledger, decisionOsRoot, cardId, runId });
  if (!runReference.found) return { ok: false, statusCode: 404, error: 'Run not found on card.', cardId, runId };

  const persistedPipelineRun = readCodexPipelineStore({ decisionOsRoot }).store.runs
    .find((entry) => entry.steps.some((step) => step.skills.some((skill) => skill.runId === runId)));
  const persistedStep = persistedPipelineRun?.steps.find((step) => step.skills.some((skill) => skill.runId === runId));
  const persistedSkill = persistedStep?.skills.find((skill) => skill.runId === runId);
  const runFiles = resolveCardSkillRunFiles({ ledger, decisionOsRoot, ledgerPath, cardId, runId });
  const stdoutFile = persistedSkill?.stdoutFile || runFiles.stdoutFile;
  const stderrFile = persistedSkill?.stderrFile || runFiles.stderrFile;
  const stderrLog = existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8') : '';
  const parsedLines = readCardSkillRunEventLines(stdoutFile);
  const events = parsedLines.map(normalizeCardSkillRunEvent);
  const executions = codexRunExecutions({ log: stderrLog, runId });
  const runtimeRun = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? (runtime.codexSkillRuns as Record<string, AnyRecord>)[runId] ?? {} : {};
  const runtimeExecutionId = String(runtimeRun.executionId ?? '');
  if (runtimeExecutionId && executions.at(-1)?.executionId !== runtimeExecutionId) {
    executions.push({
      executionId: runtimeExecutionId,
      runId,
      segment: runtimeRun.newSession === true ? 'restart' : executions.length === 0 ? 'start' : 'continue',
      startedAt: String(runtimeRun.startedAt ?? runtimeRun.createdAt ?? ''),
      startLine: parsedLines.at(-1)?.line ?? 0,
      turnStartedAt: String(runtimeRun.turnStartedAt ?? ''),
      turnStartLine: 0,
      finishedAt: String(runtimeRun.finishedAt ?? ''),
      status: String(runtimeRun.status ?? ''),
    });
  }
  const segmentStartLine = latestCodexRunSegmentStartLine({ log: stderrLog, runId });
  const segmentEvents = events.filter((event) => event.line > segmentStartLine);
  const segmentLog = latestCodexRunSegmentLog({ log: stderrLog, runId });
  const diagnostics = normalizedRunDiagnostics(segmentLog);
  const inferred = inferredStatus({ runtime, runId, events: segmentEvents, stdoutFile, stderrFile, stderrLog: segmentLog });
  const inMemoryStatus = runtimeRunStatus(runtime, runId);
  const queuedProcess = readCodexProcessQueue(decisionOsRoot).find((item) => item.id === runId || String(item.payload.runId ?? '') === runId);
  const interruptedProcess = queuedProcess?.status === 'interrupted' ? queuedProcess : null;
  const inferredTerminal = inferred === 'complete' || inferred === 'failed' || inferred === 'cancelled' ? inferred : null;
  const status = inMemoryStatus
    ?? (persistedSkill && (persistedSkill.status === 'complete' || persistedSkill.status === 'failed' || persistedSkill.status === 'cancelled')
      ? persistedSkill.status
      : inferredTerminal ?? (interruptedProcess ? 'failed' : inferred));
  // Retain the response field for clients while making explicit that status reads persist nothing.
  const persistedEventCount = 0;
  // Session history is append-only. Segment filtering is reserved for current-execution
  // status and counters; the global line cursor always addresses the complete log.
  const returnedEvents = events.filter((event) => event.line > since);
  const metadata = {
    ...runtimeRunMetadata(runtime, runId),
    ...codexRunSegmentMetadata({ log: stderrLog, runId }),
    ...(persistedSkill ? { codexModel: persistedSkill.codexModel, codexEffort: persistedSkill.codexEffort } : {}),
  };
  logCodexContinueDebug('read-controller-result', {
    traceId,
    ledgerId,
    cardId,
    runId,
    since,
    status,
    parsedLineCount: parsedLines.length,
    segmentStartLine,
    segmentEventCount: segmentEvents.length,
    lineCount: parsedLines.at(-1)?.line ?? 0,
    returnedEventCount: returnedEvents.length,
    diagnosticCount: diagnostics.length,
    persistedEventCount,
    metadata,
    latestEventType: segmentEvents.at(-1)?.type ?? '',
    latestEventLine: segmentEvents.at(-1)?.line ?? 0,
    stdoutFile,
    stderrFile,
  });
  const active = runtimeCodexRunOwnsLiveProcess(runtime, runId, decisionOsRoot);
  const currentElapsedMs = elapsedMs({ runtime, runId, status, stdoutFile, stderrFile });
  const projectedExecutions = executionHistory({
    executions,
    events,
    currentStatus: status,
    active,
    currentElapsedMs,
    terminalFileWriteMs: Math.max(fileMtimeMs(stdoutFile), fileMtimeMs(stderrFile)),
    telemetryFinishedAtByStartLine: executionTelemetryFinishedAtByStartLine(`${stdoutFile}.telemetry.jsonl`),
  });
  const currentExecution = projectedExecutions.at(-1) ?? null;
  return {
    ok: true,
    statusCode: 200,
    ledgerId,
    cardId,
    runId,
    runKind: runReference.threadLaunched ? 'thread' : 'card',
    pipelineRunId: persistedPipelineRun?.id ?? null,
    pipelineId: persistedPipelineRun?.pipelineId ?? null,
    pipelineName: persistedPipelineRun?.pipelineName ?? '',
    pipelineStepId: persistedStep?.stepId ?? '',
    pipelineStepName: persistedStep?.name ?? '',
    skillName: persistedSkill?.skillName ?? '',
    pipelineStatus: persistedPipelineRun?.status ?? null,
    status,
    active,
    executionId: String(currentExecution?.executionId ?? ''),
    currentExecution,
    executions: projectedExecutions,
    interruptedAt: interruptedProcess?.interruptedAt ?? null,
    queuePosition: status === 'pending' && queuedProcess ? unifiedCodexQueuePosition({ decisionOsRoot, id: queuedProcess.id, createdAt: queuedProcess.createdAt, runtime }) : null,
    startedAt: new Date(runSegmentStartedAtMs({ runtime, runId, stderrFile })).toISOString(),
    elapsedMs: currentElapsedMs,
    lineCount: parsedLines.at(-1)?.line ?? 0,
    nextSince: parsedLines.at(-1)?.line ?? 0,
    toolCallCount: uniqueToolCallCount(runId, segmentEvents),
    agentMessageCount: segmentEvents.filter((event) => event.kind === 'agent_message').length,
    fileChangeCount: segmentEvents.filter((event) => event.title === 'File changes').length,
    thinkingCount: segmentEvents.filter((event) => event.kind === 'thinking').length,
    warningCount: segmentEvents.filter((event) => event.kind === 'warning').length + diagnostics.filter((event) => event.kind === 'warning').length,
    errorCount: segmentEvents.filter((event) => event.kind === 'error').length + diagnostics.filter((event) => event.kind === 'error').length,
    transportStatus: segmentEvents.some((event) => event.kind === 'transport') || diagnostics.some((event) => event.kind === 'transport') ? 'degraded' : 'ok',
    persistedEventCount,
    metadata,
    latestEvent: segmentEvents.at(-1) ?? null,
    events: returnedEvents,
    diagnostics,
    ...(interruptedProcess ? { error: interruptedProcess.interruptionReason } : {}),
  };
}

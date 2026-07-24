/**
 * WHAT: Reads one card-scoped run from replicated execution state and immutable artifacts.
 * WHY: Logs enrich diagnostics but cannot determine lifecycle, liveness, identity, or settlement.
 */
import { existsSync, readFileSync } from 'node:fs';
import { normalizeCardSkillRunDiagnostic, normalizeCardSkillRunEvent } from '../helper/normalize-card-skill-run-event.js';
import { readCardSkillRunEventLines } from '../helper/read-card-skill-run-event-lines.js';
import {
  codexRunSegmentMetadata,
  isCodexRunMarkerLine,
  latestCodexRunSegmentLog,
  latestCodexRunSegmentStartLine,
} from '../helper/codex-run-segment-marker.js';
import { readCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { replicatedPipelineRun } from '../helper/codex-pipeline-runner.js';
import { unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { taskExecutionNodeId, taskExecutionProcess, taskExecutionState } from '../helper/task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;
type RunStatus = 'pending' | 'running' | 'complete' | 'failed' | 'cancelled';

const NON_FATAL_CODEX_MODEL_REFRESH_DIAGNOSTIC = /\bcodex_models_manager::manager:\s*failed to refresh available models:\s*timeout waiting for child process to exit\b/i;
const NON_FATAL_APPLY_PATCH_VERIFICATION_DIAGNOSTIC = /\bcodex_core::tools::router:\s*error=apply_patch verification failed:/i;

function actionableCodexLog(log: string): string {
  const actionable: string[] = [];
  let suppressPatchContext = false;
  for (const line of log.replace(/\r\n?/g, '\n').split('\n')) {
    if (isCodexRunMarkerLine(line)) continue;
    if (NON_FATAL_APPLY_PATCH_VERIFICATION_DIAGNOSTIC.test(line)) {
      suppressPatchContext = true;
      continue;
    }
    if (suppressPatchContext && /^\d{4}-\d{2}-\d{2}T\S+\s+(?:ERROR|WARN|WARNING|INFO)\b/.test(line)) suppressPatchContext = false;
    if (!suppressPatchContext && !NON_FATAL_CODEX_MODEL_REFRESH_DIAGNOSTIC.test(line)) actionable.push(line);
  }
  return actionable.join('\n');
}

function normalizedRunDiagnostics(log: string) {
  const lines = actionableCodexLog(log).split('\n');
  const diagnostics = [];
  const structuredRecordStart = /^\d{4}-\d{2}-\d{2}T\S+\s+(?:ERROR|WARN|WARNING|INFO)\b/;
  for (let index = 0; index < lines.length;) {
    const startLine = index + 1;
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    const record = [lines[index++]];
    if (structuredRecordStart.test(record[0])) {
      while (index < lines.length && !structuredRecordStart.test(lines[index])) record.push(lines[index++]);
    }
    while (record.at(-1)?.trim() === '') record.pop();
    diagnostics.push(normalizeCardSkillRunDiagnostic({ line: startLine, text: record.join('\n') }));
  }
  return diagnostics;
}

function statusForPhase(phase: string): RunStatus {
  if (phase === 'preparing' || phase === 'queued') return 'pending';
  if (phase === 'starting' || phase === 'running' || phase === 'cancelling') return 'running';
  if (phase === 'succeeded') return 'complete';
  if (phase === 'cancelled') return 'cancelled';
  return 'failed';
}

function uniqueToolCallCount(runId: string, events: AnyRecord[]): number {
  const identities = new Set<string>();
  for (const event of events) {
    if (event.kind !== 'tool_call') continue;
    identities.add(event.itemId ? `${runId}:item:${event.itemId}` : `${runId}:line:${event.line}`);
  }
  return identities.size;
}

export async function readCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.cardId ?? '').trim();
  const runId = String(payload.runId ?? '').trim();
  const since = Math.max(0, Number(payload.since ?? 0) || 0);
  if (!ledgerId || !cardId || !runId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };

  const repository = taskExecutionState(runtime)?.executions;
  const history = (repository?.bySessionId(runId) ?? [])
    .filter((record) => record.metadata.ledgerId === ledgerId
      && (record.metadata.sourceCardId === cardId || record.metadata.ownerCardId === cardId))
    .sort((left, right) => left.metadata.requestedAt.localeCompare(right.metadata.requestedAt)
      || left.metadata.executionId.localeCompare(right.metadata.executionId));
  const execution = history.at(-1) ?? null;
  if (!execution) return { ok: false, statusCode: 404, error: 'Execution not found.', cardId, runId };

  const terminal = ['succeeded', 'failed', 'cancelled', 'interrupted'].includes(execution.lifecycle.phase);
  if (execution.lifecycle.executorNodeId !== taskExecutionNodeId(runtime)
    && !(terminal && typeof runtime.taskExecutionArtifactFile === 'function')) {
    return {
      ok: false,
      statusCode: 409,
      error: 'task_execution_wrong_executor',
      executionId: execution.metadata.executionId,
      executorNodeId: execution.lifecycle.executorNodeId,
    };
  }

  const process = taskExecutionProcess(runtime, execution.metadata.executionId);
  const artifactFile = typeof runtime.taskExecutionArtifactFile === 'function'
    ? runtime.taskExecutionArtifactFile as (hash: string) => string
    : () => '';
  const stdoutFile = process?.stdoutFile || (execution.artifacts.jsonl ? artifactFile(execution.artifacts.jsonl.hash) : '');
  const stderrFile = process?.stderrFile || (execution.artifacts.stderr ? artifactFile(execution.artifacts.stderr.hash) : '');
  const stderrLog = stderrFile && existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8') : '';
  const parsedLines = stdoutFile && existsSync(stdoutFile) ? readCardSkillRunEventLines(stdoutFile) : [];
  const events = parsedLines.map(normalizeCardSkillRunEvent);
  const segmentStartLine = latestCodexRunSegmentStartLine({ log: stderrLog, runId });
  const segmentEvents = events.filter((event) => event.line > segmentStartLine);
  const diagnostics = normalizedRunDiagnostics(latestCodexRunSegmentLog({ log: stderrLog, runId }));
  const active = ['starting', 'running', 'cancelling'].includes(execution.lifecycle.phase);
  const status = statusForPhase(execution.lifecycle.phase);
  const startedAt = execution.lifecycle.startedAt ?? execution.metadata.requestedAt;
  const finishedAt = execution.lifecycle.finishedAt;
  const elapsedMs = Math.max(0, Date.parse(finishedAt ?? new Date().toISOString()) - Date.parse(startedAt));

  const storedPipeline = readCodexPipelineStore({ decisionOsRoot: String(runtime.decisionOsRoot ?? '') }).store.runs
    .find((run) => run.id === execution.metadata.pipelineRunId
      || run.steps.some((step) => step.skills.some((skill) => skill.executionId === execution.metadata.executionId)));
  const projectedPipeline = storedPipeline ? replicatedPipelineRun(storedPipeline, runtime) : null;
  const step = storedPipeline?.steps.find((candidate) => candidate.stepId === execution.metadata.pipelineStepId);
  const skill = step?.skills.find((candidate) => candidate.executionId === execution.metadata.executionId);
  const metadata = {
    ...codexRunSegmentMetadata({ log: stderrLog, runId }),
    ...(storedPipeline ? { sourceCardTitle: storedPipeline.sourceCardTitle } : {}),
    codexModel: execution.metadata.model ?? skill?.codexModel ?? '',
    codexEffort: execution.metadata.effort ?? skill?.codexEffort ?? '',
  };
  const executionHistory = history.map((record) => ({
    executionId: record.metadata.executionId,
    runId: record.metadata.sessionId,
    status: statusForPhase(record.lifecycle.phase),
    phase: record.lifecycle.phase,
    active: ['starting', 'running', 'cancelling'].includes(record.lifecycle.phase),
    startedAt: record.lifecycle.startedAt ?? record.metadata.requestedAt,
    finishedAt: record.lifecycle.finishedAt,
    elapsedMs: Math.max(0, Date.parse(record.lifecycle.finishedAt ?? new Date().toISOString())
      - Date.parse(record.lifecycle.startedAt ?? record.metadata.requestedAt)),
  }));

  return {
    ok: true,
    statusCode: 200,
    ledgerId,
    cardId,
    runId,
    runKind: execution.metadata.kind === 'pipeline-skill' ? 'card' : 'thread',
    pipelineRunId: execution.metadata.pipelineRunId,
    pipelineId: storedPipeline?.pipelineId ?? null,
    pipelineName: storedPipeline?.pipelineName ?? '',
    pipelineStepId: execution.metadata.pipelineStepId ?? '',
    pipelineStepName: step?.name ?? '',
    skillName: skill?.skillName ?? '',
    pipelineStatus: projectedPipeline?.status ?? null,
    status,
    active,
    executionId: execution.metadata.executionId,
    phase: execution.lifecycle.phase,
    phaseSince: execution.lifecycle.phaseSince,
    lifecycleRevision: execution.lifecycle.revision,
    executorNodeId: execution.lifecycle.executorNodeId,
    execution,
    currentExecution: executionHistory.at(-1) ?? null,
    executions: executionHistory,
    queuePosition: execution.lifecycle.phase === 'queued'
      ? unifiedCodexQueuePosition({
          decisionOsRoot: String(runtime.decisionOsRoot ?? ''),
          id: execution.metadata.executionId,
          createdAt: execution.metadata.requestedAt,
          runtime,
        })
      : null,
    startedAt,
    finishedAt,
    elapsedMs,
    lineCount: parsedLines.at(-1)?.line ?? 0,
    nextSince: parsedLines.at(-1)?.line ?? 0,
    toolCallCount: uniqueToolCallCount(runId, segmentEvents),
    agentMessageCount: segmentEvents.filter((event) => event.kind === 'agent_message').length,
    fileChangeCount: segmentEvents.filter((event) => event.title === 'File changes').length,
    thinkingCount: segmentEvents.filter((event) => event.kind === 'thinking').length,
    warningCount: segmentEvents.filter((event) => event.kind === 'warning').length + diagnostics.filter((event) => event.kind === 'warning').length,
    errorCount: segmentEvents.filter((event) => event.kind === 'error').length + diagnostics.filter((event) => event.kind === 'error').length,
    transportStatus: segmentEvents.some((event) => event.kind === 'transport') || diagnostics.some((event) => event.kind === 'transport') ? 'degraded' : 'ok',
    persistedEventCount: 0,
    metadata,
    latestEvent: segmentEvents.at(-1) ?? null,
    events: events.filter((event) => event.line > since),
    diagnostics,
    artifacts: execution.artifacts,
    stdoutFile,
    stderrFile,
    ...(execution.lifecycle.error ? { error: execution.lifecycle.error.message } : {}),
  };
}

/**
 * WHAT: Converts legacy direct-queue and pipeline attempt state into canonical execution records once.
 * WHY: Startup must preserve active identities and rollback evidence before legacy lifecycle stores stop being authoritative.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import type { CodexExecutionPhase, CodexExecutionRecord, CodexExecutionResult } from '../../../../../shared/schemas/codex-execution-types.js';
import type { CodexPipelineRun, CodexPipelineRunSkill, CodexPipelineRunStep } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { codexPipelineStoreWriteBlocker, readCodexPipelineStore } from './codex-pipeline-store.js';
import { readCodexProcessQueue, type CodexProcessQueueItem } from './codex-process-queue.js';
import { codexExecutionStoreFile, createCodexExecutionStore, readCodexExecutionStore } from './codex-execution-store.js';
import { createCodexExecutionRecord, transitionCodexExecution } from './codex-execution-transition.js';

export type LegacyCodexExecutionLease = { runId: string; executionId: string } | null;
export type LegacyCodexExecutionLeaseReader = (input: { ledgerId: string; cardId: string }) => LegacyCodexExecutionLease;

export type CodexExecutionMigrationReport = {
  version: 1;
  projectId: string;
  migratedAt: string;
  backupRoot: string;
  queueRecords: number;
  pipelineRecords: number;
  executionCount: number;
  activeExecutionCount: number;
  executionIds: string[];
};

function text(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`codex_execution_migration_${field}_required`);
  return normalized;
}

function time(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return Number.isFinite(Date.parse(normalized)) ? normalized : fallback;
}

function withPhase(input: {
  base: CodexExecutionRecord;
  phase: CodexExecutionPhase;
  phaseSince: string;
  startedAt?: string | null;
  executorNodeId: string;
  processId?: number | null;
  processStartTime?: string | null;
  stdoutFile?: string | null;
  stderrFile?: string | null;
  error?: string;
}): CodexExecutionRecord {
  const transition = (record: CodexExecutionRecord, phase: CodexExecutionPhase, changedAt: string, extra: Record<string, unknown> = {}): CodexExecutionRecord => transitionCodexExecution({
    record,
    expectedExecutionId: record.executionId,
    phase,
    changedAt,
    ...extra,
  });
  if (input.phase === 'preparing') return input.base;
  let record = transition(input.base, 'queued', input.base.requestedAt);
  if (input.phase === 'queued') return record;
  if (input.phase === 'cancelled' && !input.startedAt) {
    return transition(record, 'cancelled', input.phaseSince, { result: { status: 'cancelled', summary: input.error ?? '' } });
  }
  if (input.phase === 'interrupted' && !input.startedAt) {
    return transition(record, 'interrupted', input.phaseSince, { result: { status: 'interrupted', summary: input.error ?? '' } });
  }
  const startedAt = input.startedAt ?? input.phaseSince;
  record = transition(record, 'starting', startedAt, { executorNodeId: input.executorNodeId });
  if (input.phase === 'starting') return record;
  record = transition(record, 'running', startedAt, {
    processId: input.processId ?? null,
    processStartTime: input.processStartTime ?? null,
    stdoutFile: input.stdoutFile ?? null,
    stderrFile: input.stderrFile ?? null,
  });
  if (input.phase === 'running') return record;
  const result: CodexExecutionResult = { status: input.phase as CodexExecutionResult['status'], summary: input.error ?? '' };
  return transition(record, input.phase, input.phaseSince, {
    result,
    error: input.phase === 'failed' ? { code: 'legacy_codex_execution_failed', message: input.error || 'Legacy Codex execution failed.' } : null,
  });
}

function queuePhase(item: CodexProcessQueueItem): CodexExecutionPhase {
  if (item.status === 'running') return 'running';
  if (item.status === 'interrupted') return 'interrupted';
  return 'queued';
}

function queueRecord(input: { item: CodexProcessQueueItem; projectId: string; nodeId: string }): CodexExecutionRecord {
  const { item } = input;
  const executionId = text(item.payload.executionId, 'execution_id');
  const runId = text(item.payload.runId ?? item.id, 'run_id');
  const ledgerId = text(item.payload.ledgerId, 'ledger_id');
  const cardId = text(item.payload.cardId, 'card_id');
  const requestedAt = time(item.createdAt, new Date(0).toISOString());
  const phase = queuePhase(item);
  const phaseSince = phase === 'running'
    ? time(item.startedAt, requestedAt)
    : phase === 'interrupted' ? time(item.interruptedAt, time(item.startedAt, requestedAt)) : requestedAt;
  const base = createCodexExecutionRecord({
    executionId,
    sessionId: runId,
    projectId: input.projectId,
    ledgerId,
    taskId: cardId,
    ownerCardId: cardId,
    kind: item.kind,
    requestedAt,
  });
  return withPhase({
    base,
    phase,
    phaseSince,
    startedAt: item.startedAt,
    executorNodeId: input.nodeId,
    processId: item.processId > 0 ? item.processId : null,
    processStartTime: item.processStartTime || null,
    stdoutFile: item.stdoutFile || null,
    stderrFile: item.stderrFile || null,
    error: item.interruptionReason,
  });
}

function pipelinePhase(status: string): CodexExecutionPhase {
  if (status === 'running') return 'running';
  if (status === 'complete') return 'succeeded';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return 'queued';
}

function pipelineRecord(input: {
  run: CodexPipelineRun;
  step: CodexPipelineRunStep;
  skill: CodexPipelineRunSkill;
  projectId: string;
  nodeId: string;
}): CodexExecutionRecord {
  const { run, step, skill } = input;
  const requestedAt = time(run.createdAt, new Date(0).toISOString());
  const phase = pipelinePhase(skill.status);
  const phaseSince = phase === 'queued'
    ? requestedAt
    : phase === 'running' ? time(skill.startedAt, requestedAt) : time(skill.finishedAt, time(skill.startedAt, requestedAt));
  const executorNodeId = skill.executor?.nodeId || input.nodeId;
  const base = createCodexExecutionRecord({
    executionId: text(skill.executionId, 'execution_id'),
    sessionId: text(skill.runId, 'run_id'),
    projectId: input.projectId,
    ledgerId: text(run.ledgerId, 'ledger_id'),
    taskId: text(run.sourceCardId, 'task_id'),
    ownerCardId: text(step.outputCardId, 'owner_card_id'),
    kind: 'pipeline-skill',
    pipelineRunId: text(run.id, 'pipeline_run_id'),
    pipelineStepId: text(step.id, 'pipeline_step_id'),
    pipelineSkillRunId: text(skill.runId, 'pipeline_skill_run_id'),
    requestedAt,
  });
  return withPhase({
    base,
    phase,
    phaseSince,
    startedAt: skill.startedAt,
    executorNodeId,
    processId: Number(skill.processId ?? 0) > 0 ? Number(skill.processId) : null,
    processStartTime: skill.processStartTime || null,
    stdoutFile: skill.stdoutFile || null,
    stderrFile: skill.stderrFile || null,
    error: skill.error,
  });
}

function active(phase: CodexExecutionPhase): boolean {
  return phase === 'preparing' || phase === 'queued' || phase === 'starting' || phase === 'running';
}

function assertLease(record: CodexExecutionRecord, readLease: LegacyCodexExecutionLeaseReader): void {
  if (record.ledgerId !== 'tasks' || !active(record.phase) || (record.kind === 'pipeline-skill' && record.phase === 'queued')) return;
  const lease = readLease({ ledgerId: record.ledgerId, cardId: record.ownerCardId });
  const expectedRunId = record.pipelineSkillRunId ?? record.sessionId;
  if (!lease || lease.runId !== expectedRunId || lease.executionId !== record.executionId) {
    throw new Error(`codex_execution_migration_lease_mismatch:${record.ownerCardId}:${record.executionId}`);
  }
}

export function prepareLegacyCodexExecutions(input: {
  projectId: string;
  nodeId: string;
  queue: readonly CodexProcessQueueItem[];
  pipelineRuns: readonly CodexPipelineRun[];
  readLease: LegacyCodexExecutionLeaseReader;
}): { records: CodexExecutionRecord[]; queueRecords: number; pipelineRecords: number } {
  const pipelineAttempts = input.pipelineRuns.flatMap((run) => {
    const flattened = run.steps.flatMap((step) => step.skills.map((skill) => ({ run, step, skill })));
    if (run.status === 'complete' || run.status === 'failed' || run.status === 'cancelled') return flattened;
    const running = flattened.filter((entry) => entry.skill.status === 'running');
    const historical = flattened.filter((entry) => entry.skill.status === 'complete' || entry.skill.status === 'failed' || entry.skill.status === 'cancelled');
    const next = running.length === 0 ? flattened.find((entry) => entry.skill.status === 'pending') : null;
    return [...historical, ...running, ...(next ? [next] : [])];
  });
  const records = [
    ...input.queue.map((item) => queueRecord({ item, projectId: input.projectId, nodeId: input.nodeId })),
    ...pipelineAttempts.map(({ run, step, skill }) => pipelineRecord({ run, step, skill, projectId: input.projectId, nodeId: input.nodeId })),
  ];
  const byExecutionId = new Map<string, CodexExecutionRecord>();
  for (const record of records) {
    const previous = byExecutionId.get(record.executionId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error(`codex_execution_migration_duplicate_conflict:${record.executionId}`);
    byExecutionId.set(record.executionId, record);
  }
  const unique = [...byExecutionId.values()];
  for (const record of unique) assertLease(record, input.readLease);
  return {
    records: unique.sort((left, right) => left.requestedAt.localeCompare(right.requestedAt) || left.executionId.localeCompare(right.executionId)),
    queueRecords: input.queue.length,
    pipelineRecords: pipelineAttempts.length,
  };
}

export function migrateLegacyCodexExecutions(input: {
  decisionOsRoot: string;
  projectId: string;
  nodeId: string;
  readLease: LegacyCodexExecutionLeaseReader;
  backupRoot?: string;
  migratedAt?: string;
}): { applied: boolean; report: CodexExecutionMigrationReport | null } {
  if (existsSync(codexExecutionStoreFile(input.decisionOsRoot))) {
    readCodexExecutionStore(input);
    return { applied: false, report: null };
  }
  const pipeline = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  const blocker = codexPipelineStoreWriteBlocker(pipeline);
  if (blocker) throw new Error(`codex_execution_migration_pipeline_store_invalid:${blocker.code}:${blocker.message}`);
  const prepared = prepareLegacyCodexExecutions({
    projectId: input.projectId,
    nodeId: input.nodeId,
    queue: readCodexProcessQueue(input.decisionOsRoot),
    pipelineRuns: pipeline.store.runs,
    readLease: input.readLease,
  });
  const migratedAt = input.migratedAt ?? new Date().toISOString();
  const stamp = migratedAt.replaceAll(':', '-');
  const backupRoot = resolve(input.backupRoot ?? resolve(dirname(input.decisionOsRoot), `${basename(input.decisionOsRoot)}-codex-execution-rollback`, `${stamp}-${input.nodeId}`));
  if (existsSync(backupRoot)) throw new Error('codex_execution_migration_backup_exists');
  mkdirSync(backupRoot, { recursive: true });
  for (const name of ['codex-process-queue.json', 'codex-pipelines.json']) {
    const source = resolve(input.decisionOsRoot, name);
    if (existsSync(source)) copyFileSync(source, resolve(backupRoot, name));
  }
  createCodexExecutionStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId }).replace(prepared.records);
  const report: CodexExecutionMigrationReport = {
    version: 1,
    projectId: input.projectId,
    migratedAt,
    backupRoot,
    queueRecords: prepared.queueRecords,
    pipelineRecords: prepared.pipelineRecords,
    executionCount: prepared.records.length,
    activeExecutionCount: prepared.records.filter((record) => active(record.phase)).length,
    executionIds: prepared.records.map((record) => record.executionId),
  };
  writeFileSync(resolve(backupRoot, 'migration-report.json'), `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { applied: true, report };
}

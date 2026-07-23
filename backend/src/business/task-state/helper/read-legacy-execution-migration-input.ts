/**
 * WHAT: Reads retired Codex execution stores exclusively for the epoch-4 offline migration.
 * WHY: Migration must preserve and validate legacy bytes without keeping either store in the runtime authority graph.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  codexExecutionPhases,
  codexExecutionStoreVersion,
  type CodexExecutionPhase,
  type CodexExecutionRecord,
  type CodexProcessQueuePayload,
} from '../../../../../shared/schemas/codex-execution-types.js';

type AnyRecord = Record<string, unknown>;

export type LegacyCodexProcessQueueItem = {
  id: string;
  kind: 'thread' | 'continuation';
  status: 'pending' | 'running' | 'interrupted';
  createdAt: string;
  startedAt: string | null;
  interruptedAt: string | null;
  interruptionReason: string;
  processId: number;
  processStartTime: string;
  stdoutFile: string;
  stderrFile: string;
  payload: CodexProcessQueuePayload;
};

const maximumExecutionStoreBytes = 16 * 1024 * 1024;
const executionPhases = new Set<CodexExecutionPhase>(codexExecutionPhases);
const terminalPhases = new Set<CodexExecutionPhase>(['succeeded', 'failed', 'cancelled', 'interrupted']);

class LegacyCodexExecutionStoreCorruptionError extends Error {
  readonly code = 'legacy_codex_execution_store_corrupt';

  constructor(readonly file: string, cause: unknown) {
    super(`Could not read the canonical Codex execution store ${file}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export function legacyCodexExecutionStoreFile(decisionOsRoot: string): string {
  return resolve(decisionOsRoot, 'codex-executions.json');
}

function requiredText(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`codex_execution_${field}_required`);
  return text;
}

function iso(value: unknown, field: string): string {
  const text = requiredText(value, field);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`codex_execution_${field}_invalid`);
  return text;
}

function assertLegacyExecution(record: CodexExecutionRecord): void {
  requiredText(record.executionId, 'id');
  requiredText(record.sessionId, 'session_id');
  requiredText(record.projectId, 'project_id');
  requiredText(record.ledgerId, 'ledger_id');
  requiredText(record.taskId, 'task_id');
  requiredText(record.ownerCardId, 'owner_card_id');
  if (!['thread', 'continuation', 'voice', 'pipeline-skill'].includes(record.kind)) throw new Error('codex_execution_kind_invalid');
  if (!executionPhases.has(record.phase)) throw new Error('codex_execution_phase_invalid');
  iso(record.requestedAt, 'requested_at');
  iso(record.phaseSince, 'phase_since');
  if (record.startedAt !== null) iso(record.startedAt, 'started_at');
  if (record.finishedAt !== null) iso(record.finishedAt, 'finished_at');
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) throw new Error('codex_execution_revision_invalid');
  if (record.processId !== null && (!Number.isSafeInteger(record.processId) || record.processId < 1)) throw new Error('codex_execution_process_id_invalid');
  if (terminalPhases.has(record.phase) !== Boolean(record.finishedAt)) throw new Error('codex_execution_terminal_timestamp_invalid');
  if (record.kind === 'pipeline-skill' && (!record.pipelineRunId || !record.pipelineStepId || !record.pipelineSkillRunId)) {
    throw new Error('codex_execution_pipeline_identity_invalid');
  }
}

export function readLegacyCodexExecutions(input: { decisionOsRoot: string; projectId: string }): CodexExecutionRecord[] {
  const file = legacyCodexExecutionStoreFile(input.decisionOsRoot);
  if (!existsSync(file)) return [];
  try {
    if (statSync(file).size > maximumExecutionStoreBytes) throw new Error(`store exceeds ${maximumExecutionStoreBytes} bytes`);
    const document = JSON.parse(readFileSync(file, 'utf8')) as AnyRecord;
    if (document.version !== codexExecutionStoreVersion || document.projectId !== input.projectId || !Array.isArray(document.executions)) {
      throw new Error('unsupported document identity');
    }
    const executionIds = new Set<string>();
    return document.executions.map((value) => {
      const record = value as CodexExecutionRecord;
      assertLegacyExecution(record);
      if (record.projectId !== input.projectId) throw new Error(`execution project mismatch: ${record.executionId}`);
      if (executionIds.has(record.executionId)) throw new Error(`duplicate execution id: ${record.executionId}`);
      executionIds.add(record.executionId);
      return structuredClone(record);
    });
  } catch (error) {
    if (error instanceof LegacyCodexExecutionStoreCorruptionError) throw error;
    throw new LegacyCodexExecutionStoreCorruptionError(file, error);
  }
}

function normalizeQueueItem(value: unknown): LegacyCodexProcessQueueItem | null {
  const item = value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
  const id = String(item.id ?? '').trim();
  if (!id || (item.kind !== 'thread' && item.kind !== 'continuation') || !['pending', 'running', 'interrupted'].includes(String(item.status ?? ''))
    || !item.payload || typeof item.payload !== 'object' || Array.isArray(item.payload)) return null;
  const status = item.status as LegacyCodexProcessQueueItem['status'];
  return {
    id,
    kind: item.kind,
    status,
    createdAt: String(item.createdAt ?? ''),
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : null,
    interruptedAt: status === 'interrupted' && typeof item.interruptedAt === 'string' ? item.interruptedAt : null,
    interruptionReason: status === 'interrupted' ? String(item.interruptionReason ?? '') : '',
    processId: Math.max(0, Number(item.processId ?? 0) || 0),
    processStartTime: String(item.processStartTime ?? ''),
    stdoutFile: String(item.stdoutFile ?? ''),
    stderrFile: String(item.stderrFile ?? ''),
    payload: item.payload as CodexProcessQueuePayload,
  };
}

export function readLegacyCodexProcessQueue(decisionOsRoot: string): LegacyCodexProcessQueueItem[] {
  const file = resolve(decisionOsRoot, 'codex-process-queue.json');
  if (!existsSync(file)) return [];
  const document = JSON.parse(readFileSync(file, 'utf8')) as AnyRecord;
  if ((document.version !== undefined && document.version !== 1) || !Array.isArray(document.items)) {
    throw new Error(`legacy_codex_process_queue_identity_invalid:${file}`);
  }
  const items = document.items.map(normalizeQueueItem);
  if (items.some((item) => item === null)) throw new Error(`legacy_codex_process_queue_item_invalid:${file}`);
  return items as LegacyCodexProcessQueueItem[];
}

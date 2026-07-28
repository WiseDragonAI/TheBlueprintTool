/**
 * WHAT: Persists node-local Codex process identities independently from the HTTP server process.
 * WHY: A replacement server must adopt an exact surviving process without making PID state replicated business authority.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type TaskExecutionProcessLease = {
  executionId: string;
  sessionId: string;
  processId: number;
  processStartTime: string;
  processGroupId: number;
  startedAt: string;
  stdoutFile: string;
  stderrFile: string;
};

function leaseFile(decisionOsRoot: string): string {
  return resolve(decisionOsRoot, 'task-state', 'codex-process-leases.json');
}

function normalizedLease(value: unknown): TaskExecutionProcessLease | null {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const executionId = String(record.executionId ?? '').trim();
  const sessionId = String(record.sessionId ?? '').trim();
  const processId = Math.max(0, Number(record.processId ?? 0) || 0);
  const processStartTime = String(record.processStartTime ?? '').trim();
  const startedAt = String(record.startedAt ?? '').trim();
  const stdoutFile = String(record.stdoutFile ?? '').trim();
  const stderrFile = String(record.stderrFile ?? '').trim();
  if (!executionId || !sessionId || !processId || !processStartTime || !startedAt || !stdoutFile || !stderrFile) return null;
  return {
    executionId,
    sessionId,
    processId,
    processStartTime,
    processGroupId: Math.max(0, Number(record.processGroupId ?? processId) || processId),
    startedAt,
    stdoutFile,
    stderrFile,
  };
}

export function readTaskExecutionProcessLeases(decisionOsRoot: string): TaskExecutionProcessLease[] {
  const file = leaseFile(decisionOsRoot);
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown; leases?: unknown };
  if (parsed.version !== 1 || !Array.isArray(parsed.leases)) throw new Error(`invalid_codex_process_lease_registry:${file}`);
  const leases = parsed.leases.map(normalizedLease);
  const executionIds = new Set(leases.map((lease) => lease?.executionId));
  if (leases.some((lease) => !lease) || executionIds.size !== leases.length) throw new Error(`invalid_codex_process_lease_registry:${file}`);
  return leases as TaskExecutionProcessLease[];
}

function writeTaskExecutionProcessLeases(decisionOsRoot: string, leases: TaskExecutionProcessLease[]): void {
  const file = leaseFile(decisionOsRoot);
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify({ version: 1, leases }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

export function upsertTaskExecutionProcessLease(decisionOsRoot: string, lease: TaskExecutionProcessLease): void {
  const leases = readTaskExecutionProcessLeases(decisionOsRoot).filter((entry) => entry.executionId !== lease.executionId);
  writeTaskExecutionProcessLeases(decisionOsRoot, [...leases, lease].sort((left, right) => left.executionId.localeCompare(right.executionId)));
}

export function removeTaskExecutionProcessLease(decisionOsRoot: string, executionId: string): void {
  const before = readTaskExecutionProcessLeases(decisionOsRoot);
  const after = before.filter((entry) => entry.executionId !== executionId);
  if (after.length !== before.length) writeTaskExecutionProcessLeases(decisionOsRoot, after);
}

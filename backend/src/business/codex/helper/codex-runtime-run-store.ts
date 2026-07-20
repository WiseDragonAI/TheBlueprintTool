/**
 * WHAT: Owns in-memory Codex runtime records and exact-execution mutation.
 * WHY: Every launch kind must replace stale execution state and keep child handles non-serializable.
 */
import type { ChildProcess } from 'node:child_process';

type AnyRecord = Record<string, unknown>;

export function codexRuntimeRuns(runtime: AnyRecord): Record<string, AnyRecord> {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' && !Array.isArray(runtime.codexSkillRuns)
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  runtime.codexSkillRuns = runs;
  return runs;
}

export function codexRuntimeRun(runtime: AnyRecord, runId: string): AnyRecord | undefined {
  return codexRuntimeRuns(runtime)[runId];
}

export function updateCodexRuntimeRun(runtime: AnyRecord, runId: string, patch: AnyRecord): AnyRecord {
  const runs = codexRuntimeRuns(runtime);
  const current = runs[runId];
  const currentExecutionId = String(current?.executionId ?? '');
  const nextExecutionId = String(patch.executionId ?? '');
  // WHAT: Replace runtime state when a new execution claims the durable session.
  // WHY: Attempt-local status and handles from an older execution must not leak forward.
  if (!current || nextExecutionId && currentExecutionId !== nextExecutionId) runs[runId] = { ...patch };
  else Object.assign(current, patch);
  return runs[runId];
}

export function updateCodexRuntimeExecution(runtime: AnyRecord, runId: string, executionId: string, patch: AnyRecord): boolean {
  const run = codexRuntimeRun(runtime, runId);
  // WHAT: Reject stale execution callbacks before mutating shared runtime state.
  // WHY: One durable run can contain several sequential execution attempts.
  if (!run || String(run.executionId ?? '') !== executionId) return false;
  Object.assign(run, patch);
  return true;
}

export function attachCodexRuntimeChild(runtime: AnyRecord, runId: string, child: ChildProcess): void {
  const run = codexRuntimeRun(runtime, runId);
  // WHAT: Ignore attachment after the runtime owner has disappeared.
  // WHY: A child handle without an execution record cannot be cancelled or projected safely.
  if (!run) return;
  Object.defineProperty(run, 'child', { value: child, writable: true, configurable: true, enumerable: false });
}

export function codexRuntimeStatus(runtime: AnyRecord, runId: string): string {
  return String(codexRuntimeRun(runtime, runId)?.status ?? '');
}

export function publicCodexRuntimeRun(run: AnyRecord): AnyRecord {
  const { child: _child, ...publicRun } = run;
  return publicRun;
}

export function notifyCodexLifecycle(callback: unknown, event: AnyRecord): void {
  // WHAT: Publish only through an installed lifecycle boundary.
  // WHY: Tests and non-server callers intentionally omit event subscribers.
  if (typeof callback === 'function') callback(event);
}

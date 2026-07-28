/**
 * WHAT: Exposes the project-scoped epoch-4 router and replicated task state from runtime state.
 * WHY: Controllers and the scheduler need one typed authority without importing the HTTP server composition root.
 */
import type { ChildProcess } from 'node:child_process';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskExecutionRouter } from './task-execution-router.js';
import {
  readTaskExecutionProcessLeases,
  removeTaskExecutionProcessLease,
  upsertTaskExecutionProcessLease,
} from './task-execution-process-lease.js';

type AnyRecord = Record<string, unknown>;

export type TaskExecutionProcess = {
  executionId: string;
  sessionId: string;
  child: ChildProcess | null;
  processId: number;
  processStartTime: string;
  startedAt: string;
  stdoutFile: string;
  stderrFile: string;
};

export type TaskExecutionCancellationResult = {
  ok: boolean;
  statusCode: number;
  executionId: string;
  executorNodeId?: string;
  phase?: string;
  revision?: number;
  cancellationRequested?: boolean;
  error?: string;
};

function processRegistry(runtime: AnyRecord): Map<string, TaskExecutionProcess> {
  const current = runtime.taskExecutionProcesses;
  if (current instanceof Map) return current as Map<string, TaskExecutionProcess>;
  const decisionOsRoot = String(runtime.decisionOsRoot ?? '').trim();
  const registry = new Map<string, TaskExecutionProcess>(
    decisionOsRoot
      ? readTaskExecutionProcessLeases(decisionOsRoot).map((lease) => [lease.executionId, { ...lease, child: null }])
      : [],
  );
  Object.defineProperty(runtime, 'taskExecutionProcesses', {
    value: registry,
    configurable: true,
    enumerable: false,
  });
  return registry;
}

export function taskExecutionRouter(runtime: AnyRecord): TaskExecutionRouter | null {
  const router = runtime.taskExecutionRouter;
  return router && typeof router === 'object' ? router as TaskExecutionRouter : null;
}

export function taskExecutionState(runtime: AnyRecord): ProjectTaskState | null {
  const state = runtime.taskExecutionState;
  return state && typeof state === 'object' ? state as ProjectTaskState : null;
}

export function taskExecutionNodeId(runtime: AnyRecord): string {
  const settings = runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object'
    ? runtime.decisionOsSettings as AnyRecord
    : {};
  return String(runtime.taskExecutionNodeId ?? settings.federationNodeId ?? 'local').trim() || 'local';
}

export function registerTaskExecutionProcess(runtime: AnyRecord, process: TaskExecutionProcess): void {
  const registry = processRegistry(runtime);
  if (registry.has(process.executionId)) throw new Error(`task_execution_process_already_registered:${process.executionId}`);
  const decisionOsRoot = String(runtime.decisionOsRoot ?? '').trim();
  if (decisionOsRoot && process.processId > 0 && process.processStartTime && process.stdoutFile && process.stderrFile) upsertTaskExecutionProcessLease(decisionOsRoot, {
    executionId: process.executionId,
    sessionId: process.sessionId,
    processId: process.processId,
    processStartTime: process.processStartTime,
    processGroupId: process.processId,
    startedAt: process.startedAt,
    stdoutFile: process.stdoutFile,
    stderrFile: process.stderrFile,
  });
  registry.set(process.executionId, process);
}

export function taskExecutionProcess(runtime: AnyRecord, executionId: string): TaskExecutionProcess | null {
  return processRegistry(runtime).get(executionId) ?? null;
}

export function removeTaskExecutionProcess(runtime: AnyRecord, executionId: string): TaskExecutionProcess | null {
  const registry = processRegistry(runtime);
  const process = registry.get(executionId) ?? null;
  registry.delete(executionId);
  const decisionOsRoot = String(runtime.decisionOsRoot ?? '').trim();
  if (decisionOsRoot) removeTaskExecutionProcessLease(decisionOsRoot, executionId);
  return process;
}

export function taskExecutionProcesses(runtime: AnyRecord): TaskExecutionProcess[] {
  return [...processRegistry(runtime).values()];
}

export async function finalizeTaskExecutionArtifacts(input: {
  runtime: AnyRecord;
  executionId: string;
  jsonl?: string;
  stderr?: string;
  telemetry?: string;
  result?: string;
}): Promise<void> {
  const state = taskExecutionState(input.runtime);
  if (!state) return;
  await state.finalizeExecutionArtifacts(input.executionId, {
    jsonl: input.jsonl,
    stderr: input.stderr,
    telemetry: input.telemetry,
    result: input.result,
  });
}

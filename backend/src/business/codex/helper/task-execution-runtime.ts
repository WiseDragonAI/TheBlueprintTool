/**
 * WHAT: Exposes the project-scoped epoch-4 router and replicated task state from runtime state.
 * WHY: Controllers and the scheduler need one typed authority without importing the HTTP server composition root.
 */
import type { ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { replaceTextFileAtomically } from '../../ledger/helper/card-content-file.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskExecutionRouter } from './task-execution-router.js';

type AnyRecord = Record<string, unknown>;

export type TaskExecutionProcess = {
  executionId: string;
  sessionId: string;
  child: ChildProcess;
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
  const registry = new Map<string, TaskExecutionProcess>();
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
  registry.set(process.executionId, process);
}

export function taskExecutionProcess(runtime: AnyRecord, executionId: string): TaskExecutionProcess | null {
  return processRegistry(runtime).get(executionId) ?? null;
}

export function removeTaskExecutionProcess(runtime: AnyRecord, executionId: string): TaskExecutionProcess | null {
  const registry = processRegistry(runtime);
  const process = registry.get(executionId) ?? null;
  registry.delete(executionId);
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

export async function finalizeSyntheticTaskExecutionArtifacts(input: {
  runtime: AnyRecord;
  executionId: string;
  reason: string;
}): Promise<void> {
  const state = taskExecutionState(input.runtime);
  const current = state?.executions.find(input.executionId);
  if (!state || !current || (current.artifacts.jsonl && current.artifacts.stderr)) return;
  const decisionOsRoot = String(input.runtime.decisionOsRoot ?? resolve(state.store.root, '..', '..')).trim();
  if (!decisionOsRoot) throw new Error(`task_execution_evidence_root_missing:${input.executionId}`);
  const safeExecutionId = input.executionId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'execution';
  const directory = resolve(decisionOsRoot, 'task-execution-evidence', safeExecutionId);
  const jsonl = resolve(directory, 'recovery.jsonl');
  const stderr = resolve(directory, 'recovery.stderr.log');
  mkdirSync(directory, { recursive: true });
  replaceTextFileAtomically(jsonl, `${JSON.stringify({
    type: 'decision_os.execution_recovery',
    executionId: input.executionId,
    reason: input.reason,
  })}\n`);
  replaceTextFileAtomically(stderr, `${input.reason}\n`);
  await finalizeTaskExecutionArtifacts({ runtime: input.runtime, executionId: input.executionId, jsonl, stderr });
}

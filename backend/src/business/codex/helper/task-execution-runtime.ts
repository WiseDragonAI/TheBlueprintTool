/**
 * WHAT: Exposes the project-scoped epoch-4 router and replicated task state from runtime state.
 * WHY: Controllers and the scheduler need one typed authority without importing the HTTP server composition root.
 */
import type { ChildProcess } from 'node:child_process';
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

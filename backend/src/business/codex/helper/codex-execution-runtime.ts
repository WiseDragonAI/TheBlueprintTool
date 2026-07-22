/**
 * WHAT: Exposes the project-scoped canonical execution coordinator from runtime state.
 * WHY: Controllers retain their stable envelopes while lifecycle ownership moves behind one typed boundary.
 */
import type { CodexExecutionCoordinator } from './codex-execution-coordinator.js';

type AnyRecord = Record<string, unknown>;

export function codexExecutionCoordinator(runtime: AnyRecord): CodexExecutionCoordinator | null {
  const coordinator = runtime.codexExecutionCoordinator;
  if (!coordinator || typeof coordinator !== 'object') return null;
  return coordinator as CodexExecutionCoordinator;
}

export function installCodexExecutionCoordinator(runtime: AnyRecord, coordinator: CodexExecutionCoordinator): void {
  Object.defineProperty(runtime, 'codexExecutionCoordinator', {
    value: coordinator,
    writable: false,
    configurable: true,
    enumerable: false,
  });
}

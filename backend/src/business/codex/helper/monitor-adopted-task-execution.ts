/**
 * WHAT: Replays and follows a surviving Codex process after an HTTP server replacement.
 * WHY: Durable process adoption must keep card output and terminal execution state convergent.
 */
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { createCardSkillRunEventIngestor } from '../effect/ingest-card-skill-run-events.js';
import { flushCardSkillRunEventIngestor } from '../effect/flush-card-skill-run-event-ingestor.js';
import { isSameCodexProcess } from './codex-process-identity.js';
import { resolvePipelineLedgerContext } from './codex-pipeline-runner.js';
import {
  finalizeTaskExecutionArtifacts,
  removeTaskExecutionProcess,
  taskExecutionProcess,
  taskExecutionState,
} from './task-execution-runtime.js';
import type { TerminalCodexStatus } from './reconcile-terminal-codex-process.js';

type AnyRecord = Record<string, unknown>;

function monitors(runtime: AnyRecord): Map<string, NodeJS.Timeout> {
  const current = runtime.adoptedTaskExecutionMonitors;
  if (current instanceof Map) return current as Map<string, NodeJS.Timeout>;
  const created = new Map<string, NodeJS.Timeout>();
  Object.defineProperty(runtime, 'adoptedTaskExecutionMonitors', {
    value: created,
    configurable: true,
    enumerable: false,
  });
  return created;
}

function reportFailure(runtime: AnyRecord, executionId: string, error: unknown): void {
  if (typeof runtime.onCodexBackgroundError !== 'function') return;
  try {
    runtime.onCodexBackgroundError({
      operation: 'monitor-adopted-task-execution',
      error: error instanceof Error ? error : new Error(String(error)),
      context: { executionId },
    });
  } catch {
    // Diagnostics cannot fail adopted process monitoring.
  }
}

export function monitorAdoptedTaskExecution(runtime: AnyRecord, executionId: string): void {
  const activeMonitors = monitors(runtime);
  if (activeMonitors.has(executionId)) return;
  const state = taskExecutionState(runtime);
  const process = taskExecutionProcess(runtime, executionId);
  const execution = state?.executions.find(executionId);
  const decisionOsRoot = String(runtime.decisionOsRoot ?? '').trim();
  if (!state || !process || !execution || !decisionOsRoot) return;
  const context = resolvePipelineLedgerContext({
    decisionOsRoot,
    runtime,
    ledgerId: execution.metadata.ledgerId,
  });
  if (!context) throw new Error(`task_execution_ledger_not_found:${execution.metadata.ledgerId}`);

  let terminalStatus: TerminalCodexStatus | null = null;
  let offset = 0;
  let settling = false;
  let flushed = false;
  let poll!: () => void;
  const ingestor = createCardSkillRunEventIngestor({
    decisionOsRoot,
    ledgerId: execution.metadata.ledgerId,
    ledgerPath: context.ledgerPath,
    cardId: execution.metadata.ownerCardId,
    runId: execution.metadata.sessionId,
    executionId,
    startLine: 0,
    projectId: execution.metadata.projectId,
    runtime,
    onTerminalEvent: (event) => {
      if (event.status === 'complete' || event.status === 'failed' || event.status === 'cancelled') {
        terminalStatus = event.status;
      }
    },
  });
  const ingestAvailable = (): void => {
    if (!existsSync(process.stdoutFile)) return;
    const size = statSync(process.stdoutFile).size;
    if (size <= offset) return;
    const descriptor = openSync(process.stdoutFile, 'r');
    try {
      while (offset < size) {
        const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, size - offset));
        const bytesRead = readSync(descriptor, chunk, 0, chunk.length, offset);
        if (bytesRead <= 0) break;
        offset += bytesRead;
        ingestor.ingest(chunk.subarray(0, bytesRead));
      }
    } finally {
      closeSync(descriptor);
    }
  };
  const settle = async (): Promise<void> => {
    if (settling) return;
    settling = true;
    const timer = activeMonitors.get(executionId);
    if (timer) clearInterval(timer);
    activeMonitors.delete(executionId);
    try {
      ingestAvailable();
      if (!flushed) {
        flushCardSkillRunEventIngestor(ingestor, execution.metadata.sessionId);
        flushed = true;
      }
      const current = state.executions.find(executionId);
      const cancelled = current?.lifecycle.phase === 'cancelling' || terminalStatus === 'cancelled';
      const phase = cancelled ? 'cancelled' : terminalStatus === 'complete' ? 'succeeded' : terminalStatus === 'failed' ? 'failed' : 'interrupted';
      await finalizeTaskExecutionArtifacts({
        runtime,
        executionId,
        jsonl: process.stdoutFile,
        stderr: process.stderrFile,
        telemetry: `${process.stdoutFile}.telemetry.jsonl`,
      });
      if (current && !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(current.lifecycle.phase)) {
        await state.executions.transition(executionId, {
          phase,
          result: {
            status: phase,
            summary: phase === 'interrupted'
              ? 'The adopted Codex process exited without a terminal event.'
              : `The adopted Codex process reported ${terminalStatus ?? phase}.`,
          },
          error: phase === 'failed'
            ? { code: 'codex_process_failed', message: 'The adopted Codex process reported failure.' }
            : null,
        });
      }
      removeTaskExecutionProcess(runtime, executionId);
      if (typeof runtime.onCodexRunSettled === 'function') {
        await runtime.onCodexRunSettled({
          ledgerId: execution.metadata.ledgerId,
          cardId: execution.metadata.sourceCardId,
          outputCardId: execution.metadata.ownerCardId,
          threadId: `thread-${execution.metadata.sourceCardId}`,
          runId: execution.metadata.sessionId,
          executionId,
          status: terminalStatus ?? phase,
          finishedAt: new Date().toISOString(),
        });
      }
      if (typeof runtime.scheduleCodexProcesses === 'function') await runtime.scheduleCodexProcesses();
    } catch (error) {
      settling = false;
      reportFailure(runtime, executionId, error);
      const retryTimer = setInterval(poll, 250);
      retryTimer.unref?.();
      activeMonitors.set(executionId, retryTimer);
    }
  };
  poll = (): void => {
    try {
      ingestAvailable();
      if (!isSameCodexProcess(process.processId, process.processStartTime)) void settle();
    } catch (error) {
      reportFailure(runtime, executionId, error);
    }
  };
  try {
    if (existsSync(process.stdoutFile)) {
      const existing = readFileSync(process.stdoutFile);
      ingestor.ingest(existing);
      offset = existing.length;
    }
  } catch (error) {
    reportFailure(runtime, executionId, error);
  }
  const timer = setInterval(poll, 50);
  timer.unref?.();
  activeMonitors.set(executionId, timer);
  poll();
}

export function stopAdoptedTaskExecutionMonitors(runtime: AnyRecord): void {
  const current = runtime.adoptedTaskExecutionMonitors;
  if (!(current instanceof Map)) return;
  for (const timer of current.values()) clearInterval(timer as NodeJS.Timeout);
  current.clear();
}

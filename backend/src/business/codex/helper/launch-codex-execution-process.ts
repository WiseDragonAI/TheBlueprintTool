/**
 * WHAT: Launches one Codex process with direct durable-file stdio, ingestion, and one-shot settlement.
 * WHY: Codex must survive replacement of the HTTP server that launched it.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import {
  appendFileSync,
  closeSync,
  existsSync,
  openSync,
  readSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createCardSkillRunEventIngestor } from '../effect/ingest-card-skill-run-events.js';
import { flushCardSkillRunEventIngestor } from '../effect/flush-card-skill-run-event-ingestor.js';
import { codexRunSegmentMarker, codexRunTurnStartedMarker, type CodexRunSegment, type CodexRunSegmentMetadata } from './codex-run-segment-marker.js';
import { createTerminalCodexProcessReconciler, signalCodexProcessTree, type TerminalCodexStatus } from './reconcile-terminal-codex-process.js';
import type { CodexCommand } from './resolve-codex-command.js';
import { codexExecutionTimeoutMs, reportCodexBackgroundFailure } from './codex-runtime-run-store.js';
import { taskExecutionState } from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

export type CodexProcessSettlement =
  | { kind: 'error'; error: Error; exitCode: null; terminalStatus: TerminalCodexStatus | null; finishedAt: string }
  | { kind: 'close'; exitCode: number | null; terminalStatus: TerminalCodexStatus | null; finishedAt: string };

function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function createFileTail(input: {
  path: string;
  startOffset: number;
  onChunk: (chunk: Buffer) => void;
  onError: (error: unknown) => void;
}): { drain(): Promise<void>; stop(): Promise<void> } {
  let offset = input.startOffset;
  let stopped = false;
  let activeDrain: Promise<void> | null = null;
  const readAvailable = async (): Promise<void> => {
    try {
      const size = fileSize(input.path);
      if (size <= offset) return;
      const descriptor = openSync(input.path, 'r');
      try {
        let bytesSinceYield = 0;
        while (offset < size) {
          const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, size - offset));
          const bytesRead = readSync(descriptor, chunk, 0, chunk.length, offset);
          if (bytesRead <= 0) break;
          offset += bytesRead;
          bytesSinceYield += bytesRead;
          input.onChunk(chunk.subarray(0, bytesRead));
          if (bytesSinceYield >= 256 * 1024 && offset < size) {
            bytesSinceYield = 0;
            await new Promise<void>((resolveYield) => setImmediate(resolveYield));
          }
        }
      } finally {
        closeSync(descriptor);
      }
    } catch (error) {
      input.onError(error);
    }
  };
  const drain = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (activeDrain) return activeDrain;
    activeDrain = readAvailable().finally(() => {
      activeDrain = null;
    });
    return activeDrain;
  };
  const timer = setInterval(() => void drain(), 25);
  timer.unref?.();
  return {
    drain,
    async stop() {
      stopped = true;
      clearInterval(timer);
      await activeDrain;
      await readAvailable();
    },
  };
}

export async function launchCodexExecutionProcess(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  workspaceRoot: string;
  ledgerId: string;
  ledgerPath: string;
  cardId: string;
  runId: string;
  executionId: string;
  command: CodexCommand;
  env: NodeJS.ProcessEnv;
  developerPrompt?: string;
  prompt: string;
  stdoutFile: string;
  stderrFile: string;
  telemetryFile?: string;
  segment: CodexRunSegment;
  startLine: number;
  startedAt?: string;
  metadata?: CodexRunSegmentMetadata;
  onSpawn: (child: ChildProcess, startedAt: string) => void | Promise<void>;
  onTurnStarted?: (event: { line: number }, observedAt: string) => void;
  onStdoutChunk?: (chunk: Buffer) => void;
  onStderrChunk?: (chunk: Buffer) => void;
  onSettled: (settlement: CodexProcessSettlement) => unknown;
}): Promise<{ child: ChildProcess; startedAt: string }> {
  const startedAt = String(input.startedAt ?? '').trim() || new Date().toISOString();
  appendFileSync(input.stderrFile, codexRunSegmentMarker({
    runId: input.runId,
    executionId: input.executionId,
    startedAt,
    segment: input.segment,
    startLine: input.startLine,
    metadata: input.metadata,
  }), 'utf8');
  const stdoutStartOffset = fileSize(input.stdoutFile);
  const stderrStartOffset = fileSize(input.stderrFile);
  if (input.developerPrompt !== undefined) {
    appendFileSync(input.stdoutFile, `${JSON.stringify({
      type: 'decision_os.developer_prompt',
      prompt: input.developerPrompt,
    })}\n`, 'utf8');
  }
  appendFileSync(input.stdoutFile, `${JSON.stringify({
    type: 'decision_os.user_prompt',
    prompt: input.prompt,
  })}\n`, 'utf8');
  const promptFile = `${input.stderrFile}.${input.executionId}.stdin`;
  writeFileSync(promptFile, input.prompt, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  let stdinDescriptor: number | undefined;
  let stdoutDescriptor: number | undefined;
  let stderrDescriptor: number | undefined;
  let child: ChildProcess;
  try {
    stdinDescriptor = openSync(promptFile, 'r');
    stdoutDescriptor = openSync(input.stdoutFile, 'a');
    stderrDescriptor = openSync(input.stderrFile, 'a');
    child = spawn(input.command.command, input.command.args, {
      cwd: input.workspaceRoot,
      env: input.env,
      stdio: [stdinDescriptor, stdoutDescriptor, stderrDescriptor],
      detached: process.platform !== 'win32',
    });
  } finally {
    if (stdinDescriptor !== undefined) closeSync(stdinDescriptor);
    if (stdoutDescriptor !== undefined) closeSync(stdoutDescriptor);
    if (stderrDescriptor !== undefined) closeSync(stderrDescriptor);
    if (existsSync(promptFile)) unlinkSync(promptFile);
  }
  child.unref();
  let terminalStatus: TerminalCodexStatus | null = null;
  let backgroundStopRequested = false;
  let executionDeadline: NodeJS.Timeout | undefined;
  let forceStopDeadline: NodeJS.Timeout | undefined;
  const reportFailure = (operation: string, error: unknown): void => {
    reportCodexBackgroundFailure(input.runtime, operation, error, {
      ledgerId: input.ledgerId,
      cardId: input.cardId,
      runId: input.runId,
      executionId: input.executionId,
    });
  };
  const stopForFailure = (operation: string, error: unknown): void => {
    reportFailure(operation, error);
    if (backgroundStopRequested) return;
    backgroundStopRequested = true;
    signalCodexProcessTree({ child, signal: 'SIGTERM' });
    forceStopDeadline = setTimeout(() => {
      if (child.exitCode === null) signalCodexProcessTree({ child, signal: 'SIGKILL' });
    }, 2_000);
    // WHAT: Keep the bounded kill deadline referenced after the execution deadline fires.
    // WHY: The detached child cannot own delivery of its close settlement.
    forceStopDeadline.ref?.();
  };
  const invokeCallback = (operation: string, callback: () => unknown): void => {
    try {
      void Promise.resolve(callback()).catch((error: unknown) => reportFailure(operation, error));
    } catch (error) {
      reportFailure(operation, error);
    }
  };
  const terminalReconciler = createTerminalCodexProcessReconciler({
    child,
    closeGraceMs: input.runtime.codexTerminalCloseGraceMs,
    forceKillGraceMs: input.runtime.codexTerminalForceKillGraceMs,
    onTerminalStatus: (status) => { terminalStatus = status; },
  });
  const executionTimeoutMs = codexExecutionTimeoutMs(input.runtime);
  executionDeadline = setTimeout(() => {
    stopForFailure('codex-execution-timeout', new Error(`Codex execution exceeded ${executionTimeoutMs}ms.`));
  }, executionTimeoutMs);
  // WHAT: Keep one finite lifecycle owner referenced until process settlement.
  // WHY: Direct-file stdio and the detached child otherwise leave close callbacks unobservable.
  executionDeadline.ref?.();
  const ingestor = createCardSkillRunEventIngestor({
    decisionOsRoot: input.decisionOsRoot,
    ledgerId: input.ledgerId,
    ledgerPath: input.ledgerPath,
    cardId: input.cardId,
    runId: input.runId,
    executionId: input.executionId,
    startLine: input.startLine,
    telemetryFile: input.telemetryFile ?? `${input.stdoutFile}.telemetry.jsonl`,
    projectId: taskExecutionState(input.runtime)?.executions.find(input.executionId)?.metadata.projectId
      ?? String(input.runtime.projectId ?? ''),
    runtime: input.runtime,
    onTerminalEvent: terminalReconciler.observe,
    onTurnStarted: (event, observedAt) => {
      try {
        appendFileSync(input.stderrFile, codexRunTurnStartedMarker({ runId: input.runId, executionId: input.executionId, startedAt: observedAt, line: event.line }), 'utf8');
      } catch (error) {
        stopForFailure('persist-codex-turn-marker', error);
        return;
      }
      if (input.onTurnStarted) invokeCallback('publish-codex-turn-started', () => input.onTurnStarted?.({ line: event.line }, observedAt));
    },
  });
  const stdoutTail = createFileTail({
    path: input.stdoutFile,
    startOffset: stdoutStartOffset,
    onChunk: (chunk) => {
      try {
        ingestor.ingest(chunk);
      } catch (error) {
        stopForFailure('ingest-codex-output', error);
        return;
      }
      if (input.onStdoutChunk) invokeCallback('observe-codex-stdout', () => input.onStdoutChunk?.(chunk));
    },
    onError: (error) => stopForFailure('read-codex-stdout-log', error),
  });
  const stderrTail = createFileTail({
    path: input.stderrFile,
    startOffset: stderrStartOffset,
    onChunk: (chunk) => {
      if (input.onStderrChunk) invokeCallback('observe-codex-stderr', () => input.onStderrChunk?.(chunk));
    },
    onError: (error) => stopForFailure('read-codex-stderr-log', error),
  });
  let settled = false;
  let spawnReady = false;
  let pendingSettlement: CodexProcessSettlement | null = null;
  const settle = async (settlement: CodexProcessSettlement): Promise<void> => {
    if (settled) return;
    settled = true;
    clearTimeout(executionDeadline);
    clearTimeout(forceStopDeadline);
    terminalReconciler.dispose();
    await Promise.all([stdoutTail.stop(), stderrTail.stop()]);
    try {
      flushCardSkillRunEventIngestor(ingestor, input.runId);
    } catch (error) {
      reportFailure('flush-codex-output-events', error);
    }
    invokeCallback('settle-codex-process', () => input.onSettled(settlement));
  };
  const requestSettlement = (settlement: CodexProcessSettlement): void => {
    if (spawnReady) void settle(settlement);
    else pendingSettlement ??= settlement;
  };
  child.once('error', (error) => requestSettlement({ kind: 'error', error, exitCode: null, terminalStatus, finishedAt: new Date().toISOString() }));
  child.once('close', (exitCode) => requestSettlement({ kind: 'close', exitCode, terminalStatus, finishedAt: new Date().toISOString() }));
  try {
    await input.onSpawn(child, startedAt);
  } catch (error) {
    clearTimeout(executionDeadline);
    clearTimeout(forceStopDeadline);
    terminalReconciler.dispose();
    await Promise.all([stdoutTail.stop(), stderrTail.stop()]);
    signalCodexProcessTree({ child, signal: 'SIGKILL' });
    throw error;
  }
  spawnReady = true;
  if (pendingSettlement) void settle(pendingSettlement);
  return { child, startedAt };
}

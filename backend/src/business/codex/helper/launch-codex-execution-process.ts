/**
 * WHAT: Launches one Codex child with the canonical stream, marker, ingestion, and one-shot settlement lifecycle.
 * WHY: Thread start, continuation, and pipeline execution must not implement divergent process engines.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, type WriteStream } from 'node:fs';
import { createCardSkillRunEventIngestor } from '../effect/ingest-card-skill-run-events.js';
import { flushCardSkillRunEventIngestor } from '../effect/flush-card-skill-run-event-ingestor.js';
import { codexRunSegmentMarker, codexRunTurnStartedMarker, type CodexRunSegment, type CodexRunSegmentMetadata } from './codex-run-segment-marker.js';
import { createTerminalCodexProcessReconciler, signalCodexProcessTree, type TerminalCodexStatus } from './reconcile-terminal-codex-process.js';
import type { CodexCommand } from './resolve-codex-command.js';
import { codexExecutionTimeoutMs, reportCodexBackgroundFailure } from './codex-runtime-run-store.js';

type AnyRecord = Record<string, unknown>;

export type CodexProcessSettlement =
  | { kind: 'error'; error: Error; exitCode: null; terminalStatus: TerminalCodexStatus | null; finishedAt: string }
  | { kind: 'close'; exitCode: number | null; terminalStatus: TerminalCodexStatus | null; finishedAt: string };

function finishStreams(stdout: WriteStream, stderr: WriteStream, callback: () => void): void {
  let pending = 2;
  const done = (): void => {
    pending -= 1;
    // WHAT: Settle the execution only after both append streams are closed.
    // WHY: Consumers must never observe terminal state before durable log bytes are flushed.
    if (pending === 0) callback();
  };
  for (const stream of [stdout, stderr]) {
    // WHAT: Count an already-finished stream immediately and end every writable stream.
    // WHY: Error and close paths share one deterministic two-stream barrier.
    if (stream.destroyed || stream.writableEnded) done();
    else stream.end(done);
  }
}

export function launchCodexExecutionProcess(input: {
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
  prompt: string;
  stdoutFile: string;
  stderrFile: string;
  telemetryFile?: string;
  segment: CodexRunSegment;
  startLine: number;
  startedAt?: string;
  metadata?: CodexRunSegmentMetadata;
  onSpawn: (child: ChildProcess, startedAt: string) => void;
  onTurnStarted?: (event: { line: number }, observedAt: string) => void;
  onStdoutChunk?: (chunk: Buffer) => void;
  onStderrChunk?: (chunk: Buffer) => void;
  onSettled: (settlement: CodexProcessSettlement) => unknown;
}): { child: ChildProcess; startedAt: string } {
  const startedAt = String(input.startedAt ?? '').trim() || new Date().toISOString();
  const child = spawn(input.command.command, input.command.args, {
    cwd: input.workspaceRoot,
    env: input.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  const stdout = createWriteStream(input.stdoutFile, { flags: 'a' });
  const stderr = createWriteStream(input.stderrFile, { flags: 'a' });
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
    forceStopDeadline.unref?.();
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
  executionDeadline.unref?.();
  const ingestor = createCardSkillRunEventIngestor({
    decisionOsRoot: input.decisionOsRoot,
    ledgerId: input.ledgerId,
    ledgerPath: input.ledgerPath,
    cardId: input.cardId,
    runId: input.runId,
    startLine: input.startLine,
    telemetryFile: input.telemetryFile ?? `${input.stdoutFile}.telemetry.jsonl`,
    projectId: String(input.runtime.projectId ?? ''),
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
  try {
    appendFileSync(input.stderrFile, codexRunSegmentMarker({
      runId: input.runId,
      executionId: input.executionId,
      startedAt,
      segment: input.segment,
      startLine: input.startLine,
      metadata: input.metadata,
    }), 'utf8');
    input.onSpawn(child, startedAt);
  } catch (error) {
    clearTimeout(executionDeadline);
    clearTimeout(forceStopDeadline);
    terminalReconciler.dispose();
    child.once('error', () => undefined);
    signalCodexProcessTree({ child, signal: 'SIGKILL' });
    child.stdin.destroy();
    stdout.destroy();
    stderr.destroy();
    throw error;
  }
  stdout.on('error', (error) => stopForFailure('write-codex-stdout-log', error));
  stderr.on('error', (error) => stopForFailure('write-codex-stderr-log', error));
  child.stdout.on('error', (error) => stopForFailure('read-codex-stdout', error));
  child.stderr.on('error', (error) => stopForFailure('read-codex-stderr', error));
  child.stdout.on('data', (chunk: Buffer) => {
    try {
      ingestor.ingest(chunk);
    } catch (error) {
      stopForFailure('ingest-codex-output', error);
      return;
    }
    if (input.onStdoutChunk) invokeCallback('observe-codex-stdout', () => input.onStdoutChunk?.(chunk));
  });
  child.stderr.on('data', (chunk: Buffer) => {
    if (input.onStderrChunk) invokeCallback('observe-codex-stderr', () => input.onStderrChunk?.(chunk));
  });
  child.stdin.on('error', () => undefined);
  child.stdout.pipe(stdout, { end: false });
  child.stderr.pipe(stderr, { end: false });
  child.stdin.end(input.prompt);

  let settled = false;
  const settle = (settlement: CodexProcessSettlement): void => {
    // WHAT: Accept only the first process terminal signal.
    // WHY: Node can emit both `error` and `close` for one failed launch.
    if (settled) return;
    settled = true;
    clearTimeout(executionDeadline);
    clearTimeout(forceStopDeadline);
    terminalReconciler.dispose();
    finishStreams(stdout, stderr, () => {
      try {
        flushCardSkillRunEventIngestor(ingestor, input.runId);
      } catch (error) {
        reportFailure('flush-codex-output-events', error);
      }
      invokeCallback('settle-codex-process', () => input.onSettled(settlement));
    });
  };
  child.once('error', (error) => settle({ kind: 'error', error, exitCode: null, terminalStatus, finishedAt: new Date().toISOString() }));
  child.once('close', (exitCode) => settle({ kind: 'close', exitCode, terminalStatus, finishedAt: new Date().toISOString() }));
  return { child, startedAt };
}

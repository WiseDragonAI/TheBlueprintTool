/**
 * WHAT: Owns one finite asynchronous child-process execution and its bounded diagnostics.
 * WHY: Git and delivery subprocess failures must settle inside their owning request scope.
 */
import { spawn, type ChildProcess } from 'node:child_process';

export type BoundedProcessTermination = 'timeout' | 'cancelled' | null;

export type BoundedProcessResult = {
  ok: boolean;
  command: string;
  args: string[];
  pid: number | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  termination: BoundedProcessTermination;
  stdout: string;
  stderr: string;
  stdoutTruncatedBytes: number;
  stderrTruncatedBytes: number;
  spawnError: string | null;
  context: Record<string, unknown>;
};

export type RunBoundedProcessInput = {
  command: string;
  args?: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Buffer;
  deadlineMs: number;
  killGraceMs?: number;
  maximumOutputBytes?: number;
  signal?: AbortSignal;
  context?: Record<string, unknown>;
};

type BoundedOutput = {
  chunks: Buffer[];
  retainedBytes: number;
  truncatedBytes: number;
};

function appendBounded(output: BoundedOutput, chunk: Buffer, maximumBytes: number): void {
  const available = Math.max(0, maximumBytes - output.retainedBytes);
  if (available > 0) {
    const retained = chunk.subarray(0, available);
    output.chunks.push(retained);
    output.retainedBytes += retained.byteLength;
  }
  output.truncatedBytes += Math.max(0, chunk.byteLength - available);
}

function signalChild(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (child.pid && process.platform !== 'win32') {
      process.kill(-child.pid, signal);
      return;
    }
    child.kill(signal);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code !== 'ESRCH') throw error;
  }
}

export async function runBoundedProcess(input: RunBoundedProcessInput): Promise<BoundedProcessResult> {
  if (!input.command.trim()) throw new Error('A bounded process command is required.');
  if (!Number.isFinite(input.deadlineMs) || input.deadlineMs <= 0) {
    throw new Error('A bounded process requires a finite positive deadline.');
  }
  const args = [...(input.args ?? [])];
  const deadlineMs = Math.max(1, Math.floor(input.deadlineMs));
  const killGraceMs = Math.max(10, Math.min(10_000, Math.floor(input.killGraceMs ?? 1_000)));
  const maximumOutputBytes = Math.max(1_024, Math.min(16 * 1024 * 1024, Math.floor(input.maximumOutputBytes ?? 1024 * 1024)));
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const stdout: BoundedOutput = { chunks: [], retainedBytes: 0, truncatedBytes: 0 };
  const stderr: BoundedOutput = { chunks: [], retainedBytes: 0, truncatedBytes: 0 };
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let termination: BoundedProcessTermination = null;
  let spawnError: string | null = null;
  let settled = false;
  let deadlineTimer: NodeJS.Timeout | null = null;
  let forceKillTimer: NodeJS.Timeout | null = null;
  let forceSettlementTimer: NodeJS.Timeout | null = null;
  let exitSettlementTimer: NodeJS.Timeout | null = null;

  return await new Promise<BoundedProcessResult>((resolve) => {
    const child = spawn(input.command, args, {
      cwd: input.cwd,
      env: input.env ?? process.env,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const cleanup = (): void => {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (forceSettlementTimer) clearTimeout(forceSettlementTimer);
      if (exitSettlementTimer) clearTimeout(exitSettlementTimer);
      input.signal?.removeEventListener('abort', cancel);
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      child.stdin?.removeAllListeners();
      child.removeAllListeners();
    };

    const settle = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      const finishedAtMs = Date.now();
      resolve({
        ok: termination === null && spawnError === null && exitCode === 0,
        command: input.command,
        args,
        pid: child.pid ?? null,
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
        exitCode,
        signal: exitSignal,
        termination,
        stdout: Buffer.concat(stdout.chunks).toString('utf8'),
        stderr: Buffer.concat(stderr.chunks).toString('utf8'),
        stdoutTruncatedBytes: stdout.truncatedBytes,
        stderrTruncatedBytes: stderr.truncatedBytes,
        spawnError,
        context: { ...(input.context ?? {}) },
      });
    };

    const terminate = (reason: Exclude<BoundedProcessTermination, null>): void => {
      if (settled || termination) return;
      termination = reason;
      try { signalChild(child, 'SIGTERM'); }
      catch (error) { spawnError ??= error instanceof Error ? error.message : String(error); }
      forceKillTimer = setTimeout(() => {
        try { signalChild(child, 'SIGKILL'); }
        catch (error) { spawnError ??= error instanceof Error ? error.message : String(error); }
        forceSettlementTimer = setTimeout(settle, killGraceMs);
      }, killGraceMs);
    };

    function cancel(): void {
      terminate('cancelled');
    }

    child.stdout?.on('data', (chunk: Buffer | string) => {
      appendBounded(stdout, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), maximumOutputBytes);
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      appendBounded(stderr, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), maximumOutputBytes);
    });
    child.stdin?.on('error', (error) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPIPE' && code !== 'ERR_STREAM_DESTROYED') spawnError ??= error.message;
    });
    child.on('error', (error) => {
      spawnError = error.message;
      settle();
    });
    child.on('exit', (code, signal) => {
      exitCode = code;
      exitSignal = signal;
      exitSettlementTimer = setTimeout(settle, killGraceMs);
    });
    child.on('close', (code, signal) => {
      exitCode ??= code;
      exitSignal ??= signal;
      settle();
    });

    deadlineTimer = setTimeout(() => terminate('timeout'), deadlineMs);
    if (input.signal) {
      if (input.signal.aborted) cancel();
      else input.signal.addEventListener('abort', cancel, { once: true });
    }
    if (input.input === undefined) child.stdin?.end();
    else child.stdin?.end(input.input);
  });
}

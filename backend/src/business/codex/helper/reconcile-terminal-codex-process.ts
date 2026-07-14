/**
 * WHAT: Reconciles a terminal Codex lifecycle event with a wrapper process that has not exited.
 * WHY: Codex can emit a terminal JSONL event while its wrapper and descendants remain alive indefinitely.
 */
import type { ChildProcess } from 'node:child_process';
import type { NormalizedRunEvent } from './card-skill-run-event-types.js';

export type TerminalCodexStatus = 'complete' | 'failed' | 'cancelled';

function positiveDelay(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function signalProcessTree(child: ChildProcess, signal: NodeJS.Signals): boolean {
  if (!child.pid) return false;
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch {
      // Fall back to the direct child when the process group has already disappeared.
    }
  }
  try {
    return child.kill(signal);
  } catch {
    return false;
  }
}

export function createTerminalCodexProcessReconciler(input: {
  child: ChildProcess;
  closeGraceMs?: unknown;
  forceKillGraceMs?: unknown;
  onTerminalStatus: (status: TerminalCodexStatus) => void;
}): { observe(event: NormalizedRunEvent): void; dispose(): void } {
  const closeGraceMs = positiveDelay(input.closeGraceMs, 5_000);
  const forceKillGraceMs = positiveDelay(input.forceKillGraceMs, 2_000);
  let terminalTimer: NodeJS.Timeout | undefined;
  let forceKillTimer: NodeJS.Timeout | undefined;
  let terminalObserved = false;
  let closed = false;

  const dispose = (): void => {
    closed = true;
    if (terminalTimer) clearTimeout(terminalTimer);
    if (forceKillTimer) clearTimeout(forceKillTimer);
    terminalTimer = undefined;
    forceKillTimer = undefined;
  };
  input.child.once('close', dispose);

  return {
    observe(event) {
      if (terminalObserved || closed || event.kind !== 'run_status') return;
      if (event.status !== 'complete' && event.status !== 'failed' && event.status !== 'cancelled') return;
      terminalObserved = true;
      input.onTerminalStatus(event.status);
      terminalTimer = setTimeout(() => {
        terminalTimer = undefined;
        if (closed || input.child.exitCode !== null || input.child.signalCode !== null) return;
        signalProcessTree(input.child, 'SIGTERM');
        forceKillTimer = setTimeout(() => {
          forceKillTimer = undefined;
          if (closed || input.child.exitCode !== null || input.child.signalCode !== null) return;
          signalProcessTree(input.child, 'SIGKILL');
        }, forceKillGraceMs);
        forceKillTimer.unref?.();
      }, closeGraceMs);
      terminalTimer.unref?.();
    },
    dispose,
  };
}

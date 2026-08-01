/**
 * WHAT: Runs one admitted test command with bounded lifecycle and byte-preserving output streams.
 * WHY: Test evidence must settle stdout and stderr after process exit and must support cancellation.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { Writable } from 'node:stream';
import type { TestCommand } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry.js';

export type TestProcessResult = { pid: number | null; exitCode: number | null; signal: NodeJS.Signals | null; timedOut: boolean; startedAt: string; finishedAt: string };

export async function runTestProcess(input: { command: TestCommand; stdout: Writable; stderr: Writable; timeoutMs: number; signal?: AbortSignal }): Promise<TestProcessResult> {
  const startedAt = new Date().toISOString();
  const ownsProcessGroup = process.platform !== 'win32';
  const child = spawn(input.command.executable, input.command.args, { cwd: input.command.cwd, env: { ...process.env, ...input.command.env }, stdio: ['ignore', 'pipe', 'pipe'], detached: ownsProcessGroup });
  telemetry('test-process-started', { testId: input.command.testId, pid: child.pid ?? null });
  child.stdout.pipe(input.stdout, { end: false });
  child.stderr.pipe(input.stderr, { end: false });
  let timedOut = false;
  let escalation: NodeJS.Timeout | null = null;
  const signalChild = (signal: NodeJS.Signals) => {
    try {
      // WHAT: Signal the owned process group on POSIX and the direct child elsewhere.
      // WHY: Lease wrappers and test runners may spawn descendants that must not be orphaned on cancellation.
      if (ownsProcessGroup && child.pid) process.kill(-child.pid, signal); else child.kill(signal);
    } catch { /* A concurrently settled child already satisfied termination. */ }
  };
  const terminate = () => {
    // WHAT: Signal only a child that has not already recorded an exit code.
    // WHY: Late deadline and cancellation callbacks must not target a recycled process identity.
    if (child.exitCode === null) {
      signalChild('SIGTERM');
      escalation = setTimeout(() => {
        // WHAT: Escalate termination only while the same child remains unsettled.
        // WHY: A child may ignore SIGTERM and every bounded wait still requires settlement.
        if (child.exitCode === null) {
          // WHAT: Escalate the same owned process group after the grace deadline.
          // WHY: Descendants that ignore SIGTERM must not retain the verification lease or output pipes.
          signalChild('SIGKILL');
        }
      }, 2_000);
    }
  };
  const timer = setTimeout(() => { timedOut = true; terminate(); }, input.timeoutMs);
  input.signal?.addEventListener('abort', terminate, { once: true });
  const [exitCode, signal] = await once(child, 'close') as [number | null, NodeJS.Signals | null];
  clearTimeout(timer);
  // WHAT: Clear a pending escalation after the child settles.
  // WHY: A late SIGKILL must never target a recycled process identity.
  if (escalation) clearTimeout(escalation);
  input.signal?.removeEventListener('abort', terminate);
  telemetry('test-process-settled', { testId: input.command.testId, exitCode, signal, timedOut });
  return { pid: child.pid ?? null, exitCode, signal, timedOut, startedAt, finishedAt: new Date().toISOString() };
}

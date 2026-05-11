/**
 * WHAT: Execution stack trace capture from a TestRun.
 * WHY: reports need a compact success/failure stack signal.
 */
import type { ExecutionStackTrace, TestRun } from '../../../lib/types.js';

export function captureExecutionStackTrace(testRun: TestRun): ExecutionStackTrace {
  const output = `${testRun.stderr}\n${testRun.stdout}`;
  const frames = output
    .split('\n')
    .filter((line) => line.includes(' at ') || line.includes('.ts:') || line.includes('.js:'))
    .slice(0, 20);
  const fallbackFrames = output.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 20);

  return {
    status: testRun.exitCode === 0 ? 'success' : 'failure',
    frames: frames.length > 0 ? frames : fallbackFrames,
  };
}

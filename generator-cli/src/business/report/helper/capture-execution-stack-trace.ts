/**
 * WHAT: ExecutionStackTrace capture helper.
 * WHY: main integration tests must report stack traces for success and failure.
 */
import type { ExecutionStackTrace, TestRun } from '../../../lib/types.js';

export function captureExecutionStackTrace(testRun: TestRun): ExecutionStackTrace {
  const output = `${testRun.stdout}\n${testRun.stderr}`.trim();
  return {
    status: testRun.exitCode === 0 ? 'success' : 'failure',
    frames: output.length > 0 ? output.split('\n').slice(-20) : [`exitCode:${testRun.exitCode}`],
  };
}

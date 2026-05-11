/**
 * WHAT: node:test execution helper.
 * WHY: report mode must execute tests and preserve stdout, stderr, and exit status.
 */
import type { ProcessPort, TestRun } from '../../../lib/types.js';
import { nodeProcess } from '../../../lib/node-test/node-process.js';

export async function runNodeTest(command: string, processPort: ProcessPort = nodeProcess, cwd = process.cwd()): Promise<TestRun> {
  const result = await processPort.exec(command, cwd);
  return {
    command,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    traces: [],
  };
}

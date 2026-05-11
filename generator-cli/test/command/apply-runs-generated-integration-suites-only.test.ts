/**
 * WHAT: Spec f4c2d8e9 test for apply-mode generated suite execution.
 * WHY: generated unit tests are intentionally red until implementation, so apply runs integration suites only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGeneratedWorktreeController } from '../../src/index.js';
import { masterLedgerPath, specsLedgerPath, tempDir } from '../fixture/scenario.js';
import type { ProcessPort } from '../../src/index.js';

test('apply mode runs generated integration suites without generated unit tests', async () => {
  const commands: string[] = [];
  const processPort: ProcessPort = {
    async exec(command: string) {
      commands.push(command);
      return { exitCode: 0, stdout: `ok:${command}`, stderr: '' };
    },
  };
  const result = await applyGeneratedWorktreeController(
    { masterLedgerFile: masterLedgerPath, specsLedgerFile: specsLedgerPath, output: await tempDir('generator-apply-') },
    { process: processPort, cwd: process.cwd() },
  );

  assert.equal(result.ok, true);
  const testCommand = commands.find((command) => command.includes('node --test'));
  assert.ok(testCommand);
  assert.equal(testCommand.includes('test/unit'), false);
});

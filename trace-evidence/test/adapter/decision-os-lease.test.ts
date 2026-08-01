/**
 * WHAT: Verifies Decision OS wraps tests with its repository verification lease.
 * WHY: The trace tool must not create an unleased test execution path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DecisionOsAdapter } from '../../src/business/adapter/decision-os-adapter.js';

test('wraps direct test argv with decision-os-verify', async () => {
  const adapter = new DecisionOsAdapter('/repo');
  const wrapped = await adapter.wrapTestCommandWithLease({ jobId: 'job-1', command: { testId: 'test-1', executable: 'node', args: ['--test', 'a.test.ts'], cwd: '/repo', env: {} } });
  assert.equal(wrapped.executable, process.execPath);
  assert.deepEqual(wrapped.args, ['/repo/bin/decision-os-verify.mjs', '--', 'node', '--test', 'a.test.ts']);
});

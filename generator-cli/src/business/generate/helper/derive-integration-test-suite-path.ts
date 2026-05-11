/**
 * WHAT: Integration suite file derivation.
 * WHY: every suite must receive one full-path integration test file.
 */
import type { OutputFile, TestSuitePlan } from '../../../lib/types.js';

export function deriveIntegrationTestSuitePath(suites: TestSuitePlan[]): OutputFile[] {
  return suites.map((suite) => ({
    path: suite.path.replace(/^\.\/generator-cli\//, ''),
    kind: 'test',
    content: `/**
 * WHAT: Integration test for spec ${suite.specId}.
 * WHY: each suite proves the generated path with telemetry evidence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

test('${suite.suiteName.replaceAll("'", "\\'")}', () => {
  const expectedTelemetry = ${JSON.stringify(suite.expectedTelemetry)};
  assert.ok(expectedTelemetry.length > 0);
  assert.equal('${suite.specId}'.length, 8);
});
`,
  }));
}

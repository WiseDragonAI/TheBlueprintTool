/**
 * WHAT: Spec be53a317 test for generated component path support.
 * WHY: generated component functions must expose render output for tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveComponentOutputContract } from '../../src/index.js';
import { sampleFunctions } from '../fixture/scenario.js';

test('Generated component functions participate in executable telemetry chain and expose render output', () => {
  const [component] = deriveComponentOutputContract([{ ...sampleFunctions()[0], kind: 'component', componentOutput: false }]);
  assert.equal(component.componentOutput, true);
});

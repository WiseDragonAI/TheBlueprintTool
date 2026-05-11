/**
 * WHAT: Integration test for spec 676c6a7a: Runbook Button.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Runbook Button', async () => {
  await assertFrontendSpec('Runbook Button', '676c6a7a', 'toolbox');
});

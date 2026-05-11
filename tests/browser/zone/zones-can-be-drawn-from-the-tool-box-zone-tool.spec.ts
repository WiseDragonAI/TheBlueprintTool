/**
 * WHAT: Integration test for spec 20000014: zones can be drawn from the tool box zone tool.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('zones can be drawn from the tool box zone tool', async () => {
  await assertFrontendSpec('zones can be drawn from the tool box zone tool', '20000014', 'zone');
});

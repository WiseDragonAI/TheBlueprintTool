/**
 * WHAT: Integration test for spec 33c20993: Shortcut Help Button.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Shortcut Help Button', async () => {
  await assertFrontendSpec('Shortcut Help Button', '33c20993', 'toolbox');
});

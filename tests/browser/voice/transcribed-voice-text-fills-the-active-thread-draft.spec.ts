/**
 * WHAT: Integration test for spec 6cc37b58: Transcribed voice text fills the active thread draft..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Transcribed voice text fills the active thread draft.', async () => {
  await assertFrontendSpec('Transcribed voice text fills the active thread draft.', '6cc37b58', 'voice');
});

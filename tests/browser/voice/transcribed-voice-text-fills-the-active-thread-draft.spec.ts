/**
 * WHAT: Integration test for spec 6cc37b58: Transcribed voice text updates the optimistic voice note..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Transcribed voice text updates the optimistic voice note.', async () => {
  await assertFrontendSpec('Transcribed voice text updates the optimistic voice note.', '6cc37b58', 'voice');
});

/**
 * WHAT: Integration test for spec b5a783cd: Voice transcription status is visible in the UI..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice transcription status is visible in the UI.', async () => {
  await assertFrontendSpec('Voice transcription status is visible in the UI.', 'b5a783cd', 'voice');
});

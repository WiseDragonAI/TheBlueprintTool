/**
 * WHAT: Integration test for spec 5c4e5c22: Voice transcription upload is optimistic..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Voice transcription upload is optimistic.', async () => {
  await assertFrontendSpec('Voice transcription upload is optimistic.', '5c4e5c22', 'voice');
});

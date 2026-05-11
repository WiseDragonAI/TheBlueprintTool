/**
 * WHAT: Integration test for spec c0c42d20: Voice transcription is optional and configuration-gated..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice transcription is optional and configuration-gated.', async () => {
  await assertFrontendSpec('Voice transcription is optional and configuration-gated.', 'c0c42d20', 'voice');
});

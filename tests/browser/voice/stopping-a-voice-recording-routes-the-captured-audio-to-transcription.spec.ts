/**
 * WHAT: Integration test for spec 8b1ff788: Stopping a voice recording uploads captured audio before transcription..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Stopping a voice recording uploads captured audio before transcription.', async () => {
  await assertFrontendSpec('Stopping a voice recording uploads captured audio before transcription.', '8b1ff788', 'voice');
});

/**
 * WHAT: Integration test for spec c73a0e4d: Voice transcription timeout exposes retry.
 * WHY: A restarted or interrupted transcription must not leave a voice note permanently busy.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice transcription timeout exposes retry.', async () => {
  await assertFrontendSpec('Voice transcription timeout exposes retry.', 'c73a0e4d', 'voice');
});

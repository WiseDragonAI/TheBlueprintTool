/**
 * WHAT: Integration test for spec 21b2b050: Voice audio is transient until transcription completes..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice audio is transient until transcription completes.', async () => {
  await assertFrontendSpec('Voice audio is transient until transcription completes.', '21b2b050', 'voice');
});

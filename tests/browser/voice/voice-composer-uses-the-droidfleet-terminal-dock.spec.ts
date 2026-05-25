/**
 * WHAT: Integration test for spec b8d4f0a2: Voice composer uses the DroidFleet terminal dock.
 * WHY: Voice controls must reuse the terminal dock class contract instead of the old box UI.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice composer uses the DroidFleet terminal dock.', async () => {
  await assertFrontendSpec('Voice composer uses the DroidFleet terminal dock.', 'b8d4f0a2', 'voice');
});

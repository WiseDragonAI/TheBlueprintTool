/**
 * WHAT: Integration test for spec 9c44b0a1: Voice dock renders live capture state, not mock content.
 * WHY: The imported dock must be wired to real runtime state and must not show fake attachments.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice dock renders live capture state, not mock content.', async () => {
  await assertFrontendSpec('Voice dock renders live capture state, not mock content.', '9c44b0a1', 'voice');
});

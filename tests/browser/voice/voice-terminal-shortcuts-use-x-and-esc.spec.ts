/**
 * WHAT: Integration test for spec c6f91a24: Voice terminal shortcuts use X and Esc.
 * WHY: Voice capture must be keyboard-first inside the terminal panel.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice terminal shortcuts use X and Esc.', async () => {
  await assertFrontendSpec('Voice terminal shortcuts use X and Esc.', 'c6f91a24', 'voice');
});

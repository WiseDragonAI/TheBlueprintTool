/**
 * WHAT: Integration test for spec 6e18b4d2: Connected card highlights use the inherited card color glow.
 * WHY: Connected-card selection feedback must be visible and carry the card color identity.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Connected card highlights use the inherited card color glow', async () => {
  await assertFrontendSpec('Connected card highlights use the inherited card color glow', '6e18b4d2', 'selection');
});

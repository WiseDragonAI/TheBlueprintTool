/**
 * WHAT: Integration test for spec 7b2e4c90: Cards visually inherit the color of the regular zone they intersect.
 * WHY: Card theme identity must follow zone containment, while groups remain visual containers only.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Cards visually inherit the color of the regular zone they intersect', async () => {
  await assertFrontendSpec('Cards visually inherit the color of the regular zone they intersect', '7b2e4c90', 'card');
});

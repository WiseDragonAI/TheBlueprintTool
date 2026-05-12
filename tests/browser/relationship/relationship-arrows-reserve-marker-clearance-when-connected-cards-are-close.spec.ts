/**
 * WHAT: Integration test for spec 3f9c2a11: Relationship arrows reserve marker clearance when connected cards are close.
 * WHY: Close card routing must not collapse arrowheads into card borders.
 */
import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Relationship arrows reserve marker clearance when connected cards are close', async () => {
  await assertFrontendSpec('Relationship arrows reserve marker clearance when connected cards are close', '3f9c2a11', 'relationship');
});

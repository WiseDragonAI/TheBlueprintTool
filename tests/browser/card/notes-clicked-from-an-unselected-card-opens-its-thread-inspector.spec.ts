/**
 * WHAT: Integration test for spec a4f8d2c9: Notes clicked from an unselected card opens its thread inspector.
 * WHY: Notes is a direct thread action, not a no-op until separate selection.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Notes clicked from an unselected card opens its thread inspector.', async () => {
  await assertFrontendSpec('Notes clicked from an unselected card opens its thread inspector.', 'a4f8d2c9', 'card');
});

/**
 * WHAT: Integration test for spec 8f43d21c: Zones use darker transparent fill than their primary border color.
 * WHY: Zone surfaces must remain visible without becoming opaque cards.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Zones use darker transparent fill than their primary border color', async () => {
  await assertFrontendSpec('Zones use darker transparent fill than their primary border color', '8f43d21c', 'zone');
});

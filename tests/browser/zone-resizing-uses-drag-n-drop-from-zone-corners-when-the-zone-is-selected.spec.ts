/**
 * WHAT: Integration test for spec 20000005: zone resizing uses drag n drop from zone corners when the zone is selected.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('zone resizing uses drag n drop from zone corners when the zone is selected', async () => {
  await assertFrontendSpec('zone resizing uses drag n drop from zone corners when the zone is selected', '20000005', 'selection');
});

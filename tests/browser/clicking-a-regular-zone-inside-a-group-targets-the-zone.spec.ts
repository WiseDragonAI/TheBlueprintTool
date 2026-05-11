/**
 * WHAT: Integration test for spec 2476bfa1: Clicking a regular zone inside a group targets the zone.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Clicking a regular zone inside a group targets the zone', async () => {
  await assertFrontendSpec('Clicking a regular zone inside a group targets the zone', '2476bfa1', 'group');
});

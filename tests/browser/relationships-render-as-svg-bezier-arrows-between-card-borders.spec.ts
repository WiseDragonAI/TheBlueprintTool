/**
 * WHAT: Integration test for spec 61bea65c: Relationships render as SVG bezier arrows between card borders.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Relationships render as SVG bezier arrows between card borders', async () => {
  await assertFrontendSpec('Relationships render as SVG bezier arrows between card borders', '61bea65c', 'relationship');
});

/**
 * WHAT: Integration test for spec 61261091: Dragging an unselected card selects the card and drags it.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Dragging an unselected card selects the card and drags it', async () => {
  await assertFrontendSpec('Dragging an unselected card selects the card and drags it', '61261091', 'selection');
});

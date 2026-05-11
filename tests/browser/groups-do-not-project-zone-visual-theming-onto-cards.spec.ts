/**
 * WHAT: Integration test for spec abad6dcb: Groups do not project zone visual theming onto cards.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Groups do not project zone visual theming onto cards', async () => {
  await assertFrontendSpec('Groups do not project zone visual theming onto cards', 'abad6dcb', 'group');
});

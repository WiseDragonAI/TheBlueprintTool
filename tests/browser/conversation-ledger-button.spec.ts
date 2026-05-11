/**
 * WHAT: Integration test for spec 7abd939e: Conversation Ledger Button.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../frontend/src/test/spec-assertions.js';

test('Conversation Ledger Button', async () => {
  await assertFrontendSpec('Conversation Ledger Button', '7abd939e', 'thread');
});

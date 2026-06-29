/**
 * WHAT: Integration test for spec e6a91d34: decision-os state drives ledger tabs and routes.
 * WHY: Specs and data tabs must map to the hidden decision-os .decision-os ledgers.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('decision-os state drives ledger tabs and routes.', async () => {
  await assertFrontendSpec('decision-os state drives ledger tabs and routes.', 'e6a91d34', 'navigation');
});

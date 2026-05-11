/**
 * WHAT: Integration test for spec e6a91d34: Blueprinttool state drives ledger tabs and routes.
 * WHY: Specs and data tabs must map to the hidden CoreV2 .blueprinttool ledgers.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Blueprinttool state drives ledger tabs and routes.', async () => {
  await assertFrontendSpec('Blueprinttool state drives ledger tabs and routes.', 'e6a91d34', 'navigation');
});

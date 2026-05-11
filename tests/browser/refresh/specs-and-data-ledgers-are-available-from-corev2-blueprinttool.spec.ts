/**
 * WHAT: Integration test for spec c5a84d77: Specs and data ledgers are available from CoreV2 .blueprinttool.
 * WHY: Live spec editing needs ledger files in the workbench state directory.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Specs and data ledgers are available from CoreV2 .blueprinttool', async () => {
  await assertFrontendSpec('Specs and data ledgers are available from CoreV2 .blueprinttool', 'c5a84d77', 'refresh');
});

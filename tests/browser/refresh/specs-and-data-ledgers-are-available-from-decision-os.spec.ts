/**
 * WHAT: Integration test for spec c5a84d77: Specs and data ledgers are available from decision-os .decision-os.
 * WHY: Live spec editing needs ledger files in the workbench state directory.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Specs and data ledgers are available from decision-os .decision-os', async () => {
  await assertFrontendSpec('Specs and data ledgers are available from decision-os .decision-os', 'c5a84d77', 'refresh');
});

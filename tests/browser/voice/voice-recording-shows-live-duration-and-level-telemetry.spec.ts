/**
 * WHAT: Integration test for spec 040cef84: Voice recording shows live duration and level telemetry..
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Voice recording shows live duration and level telemetry.', async () => {
  await assertFrontendSpec('Voice recording shows live duration and level telemetry.', '040cef84', 'voice');
});

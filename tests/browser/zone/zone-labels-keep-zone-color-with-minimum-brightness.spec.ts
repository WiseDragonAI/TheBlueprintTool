/**
 * WHAT: Integration test for spec 5ac8d0f1: Zone labels keep zone color with minimum brightness.
 * WHY: Zone labels must remain readable while preserving zone color identity.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Zone labels keep zone color with minimum brightness', async () => {
  await assertFrontendSpec('Zone labels keep zone color with minimum brightness', '5ac8d0f1', 'zone');
});

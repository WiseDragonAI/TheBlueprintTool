/**
 * WHAT: Integration test for spec c90ad7e1: Canvas UI uses Ubuntu font.
 * WHY: CoreV2 should inherit the Core canvas typography convention.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Canvas UI uses Ubuntu font', async () => {
  await assertFrontendSpec('Canvas UI uses Ubuntu font', 'c90ad7e1', 'canvas');
});

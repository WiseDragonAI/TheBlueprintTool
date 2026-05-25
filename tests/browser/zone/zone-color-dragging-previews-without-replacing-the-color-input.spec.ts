/**
 * WHAT: Integration test for spec a2f9c013: Zone color dragging previews without replacing the color input.
 * WHY: Native color picker drag interaction must not be interrupted by ledger re-render commits.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Zone color dragging previews without replacing the color input', async () => {
  await assertFrontendSpec('Zone color dragging previews without replacing the color input', 'a2f9c013', 'zone');
});

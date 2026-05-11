/**
 * WHAT: Integration test for spec f2d6c8b1: Tab click loads the active ledger graph into the canvas.
 * WHY: Navigation tabs must run the full derive-route, load-ledger-state, render-canvas-surface flow.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Tab click loads the active ledger graph into the canvas.', async () => {
  await assertFrontendSpec('Tab click loads the active ledger graph into the canvas.', 'f2d6c8b1', 'navigation');
});

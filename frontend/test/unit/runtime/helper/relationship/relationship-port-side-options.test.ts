/**
 * WHAT: Unit test for runtime helper relationship-port-side-options.
 * WHY: each helper function must have one dedicated unit test file after implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { relationshipPortSideOptions } from '@frontend/runtime/helper/relationship/relationship-port-side-options.js';

test('relationship-port-side-options returns the canonical relationship border sides', () => {
  assert.deepEqual(relationshipPortSideOptions(), ['left', 'right', 'top', 'bottom']);
});

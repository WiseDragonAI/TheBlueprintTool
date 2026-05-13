/**
 * WHAT: Integration test for spec 3fd7a96a: Zones and groups always expose an edit icon for name and zone color changes.
 * WHY: Editable region identity must remain available on static, created, and ledger-rendered canvas regions.
 */

import test from 'node:test';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

test('Zones and groups always expose an edit icon for name and zone color changes', async () => {
  await assertFrontendSpec('Zones and groups always expose an edit icon for name and zone color changes', '3fd7a96a', 'group');
});

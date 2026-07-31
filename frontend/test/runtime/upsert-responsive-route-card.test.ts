/**
 * WHAT: Verifies exact card-detail responses are installed whether the navigation snapshot is current or stale.
 * WHY: A new task must expose its ordinary Codex RUN controls without requiring the combined voice-launch shortcut.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { upsertResponsiveRouteCard } from '../../src/app/responsive/upsert-responsive-route-card.js';

test('appends a newly created route card missing from the navigation snapshot', () => {
  const existing = { id: 'card-existing', title: 'Existing' };
  const created = { id: 'card-created', title: 'New task intake' };

  assert.deepEqual(upsertResponsiveRouteCard([existing], created), [existing, created]);
});

test('replaces an existing route card without changing ledger order', () => {
  const first = { id: 'card-first', title: 'First' };
  const stale = { id: 'card-target', title: 'Stale' };
  const fresh = { id: 'card-target', title: 'Fresh' };

  assert.deepEqual(upsertResponsiveRouteCard([first, stale], fresh), [first, fresh]);
});

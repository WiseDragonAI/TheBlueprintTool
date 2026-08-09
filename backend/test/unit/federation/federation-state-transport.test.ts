/**
 * WHAT: Verifies strict canonical admission of terminal federation state rejections.
 * WHY: Relay and node must use identical bounded collision coordinates.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFederationStateRejection } from '../../../../shared/federation-state-transport.js';

test('normalizes sorted collision coordinates and rejects duplicates', () => {
  const base = {
    code: 'task_current_dot_collision',
    key: 'card\u0000card-a',
    stateHash: 'a'.repeat(64),
    receiverStateHash: 'b'.repeat(64),
  };
  const first = { entityType: 'card', entityId: 'card-a', path: 'title', dot: { replicaId: 'desktop', counter: 1 } };
  const second = { entityType: 'card', entityId: 'card-a', path: 'title', dot: { replicaId: 'mobile', counter: 2 } };
  const normalized = normalizeFederationStateRejection({ ...base, collisions: [second, first] });
  assert.deepEqual(normalized.collisions, [first, second]);
  assert.throws(() => normalizeFederationStateRejection({ ...base, collisions: [first, first] }), /invalid_federation_state_rejection/);
  assert.throws(() => normalizeFederationStateRejection({ ...base, collisions: [first], localEntity: {} }), /invalid_federation_state_rejection/);
});

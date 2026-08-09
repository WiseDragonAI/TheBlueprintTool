/**
 * WHAT: Proves collision recovery distinguishes predecessor dirt from its exact successor hash.
 * WHY: Sequential same-key collision generations must each publish once without duplicating an in-flight successor.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPendingFederationRepair } from '../../../../src/business/server/helper/federation-repair-recovery.js';

test('attributes pending recovery only to exact project, entity, and successor hashes', () => {
  const projectId = 'project-a';
  const key = 'execution\u0000run-a';
  const expected = { [key]: 'b'.repeat(64) };

  assert.equal(hasPendingFederationRepair([
    { projectId, entityKey: key, stateHash: 'a'.repeat(64) },
  ], projectId, expected), false);
  assert.equal(hasPendingFederationRepair([
    { projectId, entityKey: key, stateHash: expected[key] },
  ], projectId, expected), true);
  assert.equal(hasPendingFederationRepair([
    { projectId: 'project-b', entityKey: key, stateHash: expected[key] },
    { projectId, entityKey: 'execution\u0000run-b', stateHash: expected[key] },
  ], projectId, expected), false);
});

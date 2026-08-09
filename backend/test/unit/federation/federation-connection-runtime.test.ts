/**
 * WHAT: Verifies relay repair project selection at the full connection-runtime boundary.
 * WHY: Durable cold repair must not depend on an advertised owner remaining online.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { relayRepairProjectIds } from '@backend/business/federation/runtime/federation-connection-runtime.js';

test('relay repair selection retains offline projects and deduplicates duplicate owners', () => {
  const projects = [
    { localProjectId: 'project-b', ownerNodeId: 'node-a', online: false },
    { localProjectId: 'project-a', ownerNodeId: 'node-a', online: false },
    { localProjectId: 'project-a', ownerNodeId: 'node-c', online: true },
  ];

  assert.deepEqual(relayRepairProjectIds(projects), ['project-a', 'project-b']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { federatedProjectCatalog } from '@backend/business/server/helper/federated-project-catalog.js';

test('returns one logical project with node-scoped replica descriptors', () => {
  const projects = federatedProjectCatalog({
    localNode: { nodeId: 'workstation', nodeLabel: 'Workstation' },
    localProjects: [{ id: 'project-1', name: 'Decision OS', available: true, ledgers: [{ id: 'tasks' }] }],
    remoteProjects: [{ id: 'mobile:project-1', localProjectId: 'project-1', name: 'Decision OS', ownerNodeId: 'mobile', ownerNodeLabel: 'Mobile', online: true }],
  });

  assert.equal(projects.length, 1);
  assert.equal(projects[0].id, 'project-1');
  assert.equal(projects[0].replicaCount, 2);
  assert.deepEqual((projects[0].replicas as Array<Record<string, unknown>>).map((replica) => replica.nodeId), ['mobile', 'workstation']);
  assert.ok((projects[0].replicas as Array<Record<string, unknown>>).every((replica) => replica.projectId === 'project-1'));
  assert.equal(Object.hasOwn(projects[0], 'ownerNodeId'), false);
  assert.equal(Object.hasOwn(projects[0], 'localProjectId'), false);
});

test('keeps an offline replica attached without duplicating the project', () => {
  const projects = federatedProjectCatalog({
    localNode: { nodeId: 'workstation', nodeLabel: 'Workstation' },
    localProjects: [{ id: 'project-1', name: 'Decision OS', available: true }],
    remoteProjects: [{ localProjectId: 'project-1', name: 'Decision OS', ownerNodeId: 'mobile', ownerNodeLabel: 'Mobile', online: false }],
  });

  assert.equal(projects.length, 1);
  assert.equal(projects[0].available, true);
  assert.equal((projects[0].replicas as Array<Record<string, unknown>>).find((replica) => replica.nodeId === 'mobile')?.online, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { federatedControlRoomProjection } from '@backend/business/server/helper/federated-control-room-projection.js';

test('merges Exec tasks and upgrades an older remote Active projection', () => {
  const result = federatedControlRoomProjection({
    localProjection: {
      fingerprint: 'local', projects: [], queue: [], exec: [{ cardId: 'local', projectId: 'a', status: 'task-execution' }],
      backlog: [], done: [], allTasks: [], diagnostics: [], ledgers: [],
    },
    localOwner: { nodeId: 'local-node', nodeLabel: 'Local', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'remote-node', nodeLabel: 'Remote', remote: true },
      projection: {
        fingerprint: 'remote', projects: [], queue: [],
        active: [{ cardId: 'remote', projectId: 'b', status: 'task-active', activeSince: '2026-07-17T05:00:00.000Z' }],
        backlog: [], done: [], allTasks: [], diagnostics: [], ledgers: [],
      },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  assert.deepEqual(result.exec.map((task: Record<string, unknown>) => task.cardId), ['local', 'remote']);
  assert.equal(result.exec[1].projectId, 'remote-node:b');
  assert.equal(result.exec[1].status, 'task-execution');
  assert.equal(result.exec[1].executionSince, '2026-07-17T05:00:00.000Z');
  assert.equal(result.active, undefined);
});

test('merges the federation Queue by rank and newest waiting time instead of owner node', () => {
  const result = federatedControlRoomProjection({
    localProjection: {
      fingerprint: 'local', projects: [],
      queue: [
        { cardId: 'local-ranked', projectId: 'a', ledgerId: 'specs', queueRank: 1, waitingTime: 1 },
        { cardId: 'local-oldest', projectId: 'a', ledgerId: 'specs', queueRank: null, waitingTime: 10 },
      ],
      exec: [], backlog: [], done: [], allTasks: [], diagnostics: [], ledgers: [],
    },
    localOwner: { nodeId: 'local-node', nodeLabel: 'Local', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'remote-node', nodeLabel: 'Remote', remote: true },
      projection: {
        fingerprint: 'remote', projects: [],
        queue: [
          { cardId: 'remote-middle', projectId: 'b', ledgerId: 'specs', queueRank: null, waitingTime: 20 },
          { cardId: 'remote-newest', projectId: 'b', ledgerId: 'specs', queueRank: null, waitingTime: 30 },
        ],
        exec: [], backlog: [], done: [], allTasks: [], diagnostics: [], ledgers: [],
      },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  assert.deepEqual(result.queue.map((task: Record<string, unknown>) => task.cardId), [
    'local-ranked',
    'remote-newest',
    'remote-middle',
    'local-oldest',
  ]);
  assert.deepEqual(result.queue.map((task: Record<string, unknown>) => task.ownerNodeId), [
    'local-node',
    'remote-node',
    'remote-node',
    'local-node',
  ]);
});

test('projects one authoritative task for replicas of the same logical project', () => {
  const localTask = { cardId: 'card-1', projectId: 'project-1', ledgerId: 'specs', title: 'Task', status: 'task-backlog' };
  const remoteTask = { ...localTask, status: 'task-waiting' };
  const result = federatedControlRoomProjection({
    localProjection: {
      fingerprint: 'local', projects: [{ id: 'project-1', name: 'Project', originFingerprint: 'origin-a' }],
      queue: [], exec: [], backlog: [localTask], done: [], allTasks: [localTask], diagnostics: [], ledgers: ['Specs'],
    },
    localOwner: { nodeId: 'workstation', nodeLabel: 'Workstation', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'mobile', nodeLabel: 'Mobile', remote: true },
      projection: {
        fingerprint: 'remote', projects: [{ id: 'project-1', name: 'Project', originFingerprint: 'origin-a' }],
        queue: [remoteTask], exec: [], backlog: [], done: [], allTasks: [remoteTask], diagnostics: [], ledgers: ['Specs'],
      },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].replicaCount, 2);
  assert.equal(result.allTasks.length, 1);
  assert.equal(result.queue.length, 0);
  assert.equal(result.backlog.length, 1);
  assert.equal(result.backlog[0].ownerNodeId, 'workstation');
  assert.equal(result.backlog[0].replicaCount, 2);
  assert.equal(result.backlog[0].conflict, true);
  assert.equal(result.diagnostics.filter((entry: Record<string, unknown>) => entry.type === 'federation_task_conflict').length, 1);
});

test('uses stable project identity across repository transport changes', () => {
  const task = { cardId: 'card-1', projectId: 'project-1', ledgerId: 'specs', title: 'Task', status: 'task-waiting' };
  const result = federatedControlRoomProjection({
    localProjection: {
      fingerprint: 'local', projects: [{ id: 'project-1', name: 'Local', originFingerprint: 'origin-a' }],
      queue: [task], exec: [], backlog: [], done: [], allTasks: [task], diagnostics: [], ledgers: [],
    },
    localOwner: { nodeId: 'workstation', nodeLabel: 'Workstation', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'mobile', nodeLabel: 'Mobile', remote: true },
      projection: {
        fingerprint: 'remote', projects: [{ id: 'project-1', name: 'Remote', originFingerprint: 'origin-b' }],
        queue: [task], exec: [], backlog: [], done: [], allTasks: [task], diagnostics: [], ledgers: [],
      },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  assert.equal(result.projects.length, 1);
  assert.equal(result.queue.length, 1);
  assert.equal(result.queue[0].replicaCount, 2);
  assert.equal(result.diagnostics.filter((entry: Record<string, unknown>) => entry.type === 'federation_task_conflict').length, 0);
});

test('keeps equal card ids separate when their stable project ids differ', () => {
  const localTask = { cardId: 'card-1', projectId: 'project-1', ledgerId: 'specs', title: 'Task', status: 'task-waiting' };
  const remoteTask = { ...localTask, projectId: 'project-2' };
  const result = federatedControlRoomProjection({
    localProjection: {
      fingerprint: 'local', projects: [{ id: 'project-1', name: 'Local', originFingerprint: 'origin-a' }],
      queue: [localTask], exec: [], backlog: [], done: [], allTasks: [localTask], diagnostics: [], ledgers: [],
    },
    localOwner: { nodeId: 'workstation', nodeLabel: 'Workstation', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'mobile', nodeLabel: 'Mobile', remote: true },
      projection: {
        fingerprint: 'remote', projects: [{ id: 'project-2', name: 'Remote', originFingerprint: 'origin-a' }],
        queue: [remoteTask], exec: [], backlog: [], done: [], allTasks: [remoteTask], diagnostics: [], ledgers: [],
      },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  assert.equal(result.projects.length, 2);
  assert.equal(result.queue.length, 2);
});

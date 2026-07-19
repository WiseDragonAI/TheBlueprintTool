import test from 'node:test';
import assert from 'node:assert/strict';
import { federatedControlRoomProjection } from '@backend/business/server/helper/federated-control-room-projection.js';

test('merges Exec tasks and upgrades an older remote Active projection', () => {
  const result = federatedControlRoomProjection({
    localProjection: {
      fingerprint: 'local', projects: [], queue: [], exec: [{ cardId: 'local', projectId: 'a', cardStatus: 'todo', status: 'task-execution', executionObservation: { kind: 'codex-process' } }],
      backlog: [], done: [], allTasks: [], diagnostics: [], ledgers: [],
    },
    localOwner: { nodeId: 'local-node', nodeLabel: 'Local', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'remote-node', nodeLabel: 'Remote', remote: true },
      projection: {
        fingerprint: 'remote', projects: [], queue: [],
        active: [{ cardId: 'remote', projectId: 'b', cardStatus: 'todo', status: 'task-active', activeSince: '2026-07-17T05:00:00.000Z', executionObservation: { kind: 'codex-process' } }],
        backlog: [], done: [], allTasks: [], diagnostics: [], ledgers: [],
      },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  assert.deepEqual(result.exec.map((task: Record<string, unknown>) => task.cardId), ['local', 'remote']);
  assert.equal(result.exec[1].projectId, 'b');
  assert.equal(result.exec[1].status, 'task-execution');
  assert.equal(result.exec[1].executionSince, '2026-07-17T05:00:00.000Z');
  assert.equal(result.active, undefined);
});

test('merges the federation Queue only by newest waiting time instead of owner node', () => {
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
    'remote-newest',
    'remote-middle',
    'local-oldest',
    'local-ranked',
  ]);
  assert.deepEqual(result.queue.map((task: Record<string, unknown>) => task.ownerNodeId), [
    'remote-node',
    'remote-node',
    'local-node',
    'local-node',
  ]);
});

test('changes the projection fingerprint when retained remote replicas change presence', () => {
  const project = { id: 'project-remote', name: 'Remote project' };
  const task = { cardId: 'card-remote', projectId: project.id, ledgerId: 'specs', cardStatus: 'backlog', status: 'task-backlog' };
  const projectPresence = (online: boolean) => federatedControlRoomProjection({
    localProjection: { fingerprint: 'local', projects: [], queue: [], exec: [], backlog: [], done: [], allTasks: [], diagnostics: [], ledgers: [] },
    localOwner: { nodeId: 'local-node', nodeLabel: 'Local', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'remote-node', nodeLabel: 'Remote', remote: true, online },
      projection: { fingerprint: 'unchanged-replica', projects: [project], queue: [], exec: [], backlog: [task], done: [], allTasks: [task], diagnostics: [], ledgers: ['Specs'] },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  const offline = projectPresence(false);
  const online = projectPresence(true);

  assert.notEqual(online.fingerprint, offline.fingerprint);
  assert.equal(offline.backlog[0].ownerOnline, false);
  assert.equal(online.backlog[0].ownerOnline, true);
  assert.equal(offline.backlog[0].status, 'task-backlog', 'retained offline tasks preserve their persisted workflow status');
});

test('keeps the local workstation task authoritative when a mobile replica disagrees', () => {
  const localTask = { cardId: 'card-1', projectId: 'project-1', ledgerId: 'specs', title: 'Task', cardStatus: 'backlog', status: 'task-backlog' };
  const remoteTask = { ...localTask, cardStatus: 'todo', status: 'task-waiting' };
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

test('keeps equal card ids separate when their ledger ids differ', () => {
  const localTask = { cardId: 'card-1', projectId: 'project-1', ledgerId: 'tasks', title: 'Task', cardStatus: 'todo', status: 'task-waiting' };
  const remoteTask = {
    ...localTask,
    ledgerId: 'specs',
    status: 'task-execution',
    codexRunId: 'run-mobile',
    executionSince: '2026-07-18T08:00:00.000Z',
    executionObservation: { kind: 'codex-process', runId: 'run-mobile' },
  };
  const result = federatedControlRoomProjection({
    localProjection: {
      fingerprint: 'local', projects: [{ id: 'project-1', name: 'Project' }],
      queue: [localTask], exec: [], backlog: [], done: [], allTasks: [localTask], diagnostics: [], ledgers: ['Tasks'],
    },
    localOwner: { nodeId: 'workstation', nodeLabel: 'Workstation', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'mobile', nodeLabel: 'Mobile', remote: true },
      projection: {
        fingerprint: 'remote', projects: [{ id: 'project-1', name: 'Project' }],
        queue: [], exec: [remoteTask], backlog: [], done: [], allTasks: [remoteTask], diagnostics: [], ledgers: ['Specs'],
      },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  assert.equal(result.allTasks.length, 2);
  assert.equal(result.exec.length, 1);
  assert.equal(result.exec[0].ledgerId, 'specs');
  assert.equal(result.exec[0].executionNodeId, 'mobile');
  assert.equal(result.exec[0].codexRunId, 'run-mobile');
  assert.equal(result.exec[0].replicaCount, 1);
  assert.equal(result.exec[0].conflict, false);
});

test('retains every verified execution observation as one execution conflict', () => {
  const task = { cardId: 'card-1', projectId: 'project-1', ledgerId: 'tasks', title: 'Task', cardStatus: 'todo', status: 'task-execution' };
  const result = federatedControlRoomProjection({
    localProjection: {
      fingerprint: 'local', projects: [{ id: 'project-1', name: 'Project' }], queue: [], backlog: [], done: [],
      exec: [{ ...task, codexRunId: 'run-workstation', executionObservation: { kind: 'codex-process', runId: 'run-workstation' } }],
      allTasks: [{ ...task, codexRunId: 'run-workstation', executionObservation: { kind: 'codex-process', runId: 'run-workstation' } }], diagnostics: [], ledgers: ['Tasks'],
    },
    localOwner: { nodeId: 'workstation', nodeLabel: 'Workstation', remote: false },
    remoteProjections: [{
      owner: { nodeId: 'mobile', nodeLabel: 'Mobile', remote: true },
      projection: {
        fingerprint: 'remote', projects: [{ id: 'project-1', name: 'Project' }], queue: [], backlog: [], done: [],
        exec: [{ ...task, codexRunId: 'run-mobile', executionObservation: { kind: 'codex-process', runId: 'run-mobile' } }],
        allTasks: [{ ...task, codexRunId: 'run-mobile', executionObservation: { kind: 'codex-process', runId: 'run-mobile' } }], diagnostics: [], ledgers: ['Tasks'],
      },
    }],
    diagnostics: [],
  }) as Record<string, any>;

  assert.equal(result.exec.length, 1);
  assert.equal(result.exec[0].projectId, 'project-1');
  assert.deepEqual(result.exec[0].executionObservations.map((observation: Record<string, unknown>) => observation.nodeId), ['mobile', 'workstation']);
  assert.equal(result.exec[0].conflict, true);
  assert.equal(result.diagnostics.filter((entry: Record<string, unknown>) => entry.type === 'federation_execution_conflict').length, 1);
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

test('produces symmetric placement from either node orientation', () => {
  const project = { id: 'project-1', name: 'Project' };
  const workstationTask = { cardId: 'card-1', projectId: 'project-1', ledgerId: 'tasks', title: 'Task', cardStatus: 'backlog', status: 'task-backlog' };
  const mobileTask = { ...workstationTask, cardStatus: 'todo', status: 'task-waiting', executionObservation: { kind: 'codex-process', runId: 'run-mobile' } };
  const projection = (task: Record<string, unknown>, fingerprint: string) => ({
    fingerprint, projects: [project],
    queue: task.status === 'task-waiting' ? [task] : [],
    exec: task.status === 'task-execution' ? [task] : [],
    backlog: task.status === 'task-backlog' ? [task] : [], done: [], allTasks: [task], diagnostics: [], ledgers: ['Tasks'],
  });
  const workstation = federatedControlRoomProjection({
    localProjection: projection(workstationTask, 'workstation'),
    localOwner: { nodeId: 'workstation', nodeLabel: 'Workstation', remote: false },
    remoteProjections: [{ projection: projection(mobileTask, 'mobile'), owner: { nodeId: 'mobile', nodeLabel: 'Mobile', remote: true } }],
    diagnostics: [],
  }) as Record<string, any>;
  const mobile = federatedControlRoomProjection({
    localProjection: projection(mobileTask, 'mobile'),
    localOwner: { nodeId: 'mobile', nodeLabel: 'Mobile', remote: false },
    remoteProjections: [{ projection: projection(workstationTask, 'workstation'), owner: { nodeId: 'workstation', nodeLabel: 'Workstation', remote: true } }],
    diagnostics: [],
  }) as Record<string, any>;
  const placement = (result: Record<string, any>) => Object.fromEntries(['queue', 'exec', 'backlog', 'done'].map((list) => [list, result[list].map((task: Record<string, unknown>) => [task.projectId, task.ledgerId, task.cardId])]));

  assert.deepEqual(placement(workstation), placement(mobile));
  assert.deepEqual(placement(workstation), { queue: [], exec: [['project-1', 'tasks', 'card-1']], backlog: [], done: [] });
});

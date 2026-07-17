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

import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTaskIntentToProjection, taskIdentity, taskIntentConfirmed } from '../src/app/responsive/optimistic-task-projection.js';

const task = { projectId: 'project-a', ownerNodeId: 'phone', ledgerId: 'tasks', cardId: 'card-a', status: 'task-waiting', cardStatus: 'todo' };

function projection() {
  return { queue: [task], exec: [], backlog: [], done: [], allTasks: [task] };
}

test('pending deletion removes a task from every stale projection collection', () => {
  const next = projection();
  applyTaskIntentToProjection(next, taskIdentity(task), { kind: 'delete', task, acknowledged: false });
  assert.deepEqual(next, { queue: [], exec: [], backlog: [], done: [], allTasks: [] });
});

test('pending lifecycle transition moves a task over stale server status', () => {
  const next = projection();
  applyTaskIntentToProjection(next, taskIdentity(task), { kind: 'lifecycle', lifecycleStatus: 'backlog', task, acknowledged: false });
  assert.equal(next.queue.length, 0);
  assert.equal(next.backlog[0]?.status, 'task-backlog');
  assert.equal(next.allTasks[0]?.cardStatus, 'backlog');
});

test('logical task identity is stable across serving replicas and assignment changes', () => {
  assert.equal(
    taskIdentity(task),
    taskIdentity({ ...task, ownerNodeId: 'workstation', assignedNodeId: 'workstation' }),
  );
});

test('intent confirmation requires acknowledgement plus matching authoritative state', () => {
  assert.equal(taskIntentConfirmed({ kind: 'delete', acknowledged: false }, undefined), false);
  assert.equal(taskIntentConfirmed({ kind: 'delete', acknowledged: true }, undefined), true);
  assert.equal(taskIntentConfirmed({ kind: 'lifecycle', lifecycleStatus: 'done', acknowledged: true }, { ...task, status: 'task-complete', cardStatus: 'done' }), true);
  assert.equal(taskIntentConfirmed({ kind: 'lifecycle', lifecycleStatus: 'done', acknowledged: true }, task), false);
});

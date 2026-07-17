import test from 'node:test';
import assert from 'node:assert/strict';
import { compareControlRoomQueueTasks } from '@backend/business/server/helper/control-room-queue-order.js';

test('orders queue tasks by explicit rank, newest waiting time, and stable identity', () => {
  const tasks = [
    { projectId: 'project-b', ledgerId: 'specs', cardId: 'same-time-b', waitingTime: 20 },
    { projectId: 'project-a', ledgerId: 'specs', cardId: 'invalid-time', waitingTime: Number.NaN },
    { projectId: 'project-a', ledgerId: 'specs', cardId: 'older', waitingTime: 10 },
    { projectId: 'project-a', ledgerId: 'specs', cardId: 'ranked', queueRank: 1, waitingTime: 1 },
    { projectId: 'project-a', ledgerId: 'specs', cardId: 'same-time-a', waitingTime: 20 },
  ];

  assert.deepEqual(tasks.sort(compareControlRoomQueueTasks).map((task) => task.cardId), [
    'ranked',
    'same-time-a',
    'same-time-b',
    'older',
    'invalid-time',
  ]);
});

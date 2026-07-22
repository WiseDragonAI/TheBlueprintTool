import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createCodexExecutionCoordinator, CodexExecutionProjectionPendingError } from '@backend/business/codex/helper/codex-execution-coordinator.js';

const executionInput = {
  executionId: 'execution-a',
  sessionId: 'session-a',
  projectId: 'project-a',
  ledgerId: 'tasks',
  taskId: 'task-a',
  ownerCardId: 'card-a',
  kind: 'thread' as const,
};

test('publishes only after the canonical record and task projection are durable', async () => {
  const root = resolve(mkdtempSync(resolve(tmpdir(), 'codex-coordinator-')), '.decision-os');
  const order: string[] = [];
  const coordinator = createCodexExecutionCoordinator({
    decisionOsRoot: root,
    projectId: 'project-a',
    nodeId: 'workstation',
    project: async ({ record }) => {
      assert.equal(coordinator.store.find(record.executionId)?.revision, record.revision);
      order.push(`project:${record.phase}`);
    },
    publish: ({ record }) => { order.push(`publish:${record.phase}`); },
  });
  await coordinator.admit(executionInput);
  await coordinator.enqueue('execution-a');
  await coordinator.claim('execution-a');
  await coordinator.spawned('execution-a', { processId: 42, processStartTime: '100', stdoutFile: '/tmp/a.jsonl', stderrFile: '/tmp/a.log' });
  assert.deepEqual(order, [
    'project:preparing', 'publish:preparing',
    'project:queued', 'publish:queued',
    'project:starting', 'publish:starting',
    'project:running', 'publish:running', 'publish:running',
  ]);
  assert.equal(coordinator.dto('execution-a')?.live, true);
});

test('retains a durable transition and suppresses publication while task projection is pending', async () => {
  const root = resolve(mkdtempSync(resolve(tmpdir(), 'codex-coordinator-')), '.decision-os');
  let rejectProjection = false;
  const published: string[] = [];
  const coordinator = createCodexExecutionCoordinator({
    decisionOsRoot: root,
    projectId: 'project-a',
    nodeId: 'workstation',
    project: async () => { if (rejectProjection) throw new Error('task_state_bootstrap_incomplete'); },
    publish: ({ record }) => { published.push(record.phase); },
  });
  await coordinator.admit(executionInput);
  rejectProjection = true;
  await assert.rejects(coordinator.enqueue('execution-a'), CodexExecutionProjectionPendingError);
  assert.equal(coordinator.store.find('execution-a')?.phase, 'queued');
  assert.deepEqual(published, ['preparing']);
  rejectProjection = false;
  await coordinator.reproject('execution-a');
  assert.deepEqual(published, ['preparing', 'queued']);
});

test('expires executor observations without changing the replicated intent', async () => {
  const root = resolve(mkdtempSync(resolve(tmpdir(), 'codex-coordinator-')), '.decision-os');
  let time = Date.parse('2026-07-23T01:00:00.000Z');
  const coordinator = createCodexExecutionCoordinator({
    decisionOsRoot: root,
    projectId: 'project-a',
    nodeId: 'workstation',
    observationTtlMs: 1_000,
    now: () => new Date(time),
    project: async () => {},
    publish: () => {},
  });
  await coordinator.admit(executionInput);
  await coordinator.enqueue('execution-a');
  await coordinator.claim('execution-a');
  await coordinator.spawned('execution-a', { processId: 42, processStartTime: '100', stdoutFile: null, stderrFile: null });
  assert.equal(coordinator.dto('execution-a')?.live, true);
  time += 1_001;
  assert.equal(coordinator.dto('execution-a')?.live, false);
  assert.equal(coordinator.dto('execution-a')?.phase, 'running');
});

test('applies the runtime pause gate before claim and leaves queued work durable', async () => {
  const root = resolve(mkdtempSync(resolve(tmpdir(), 'codex-coordinator-pause-')), '.decision-os');
  let paused = false;
  const coordinator = createCodexExecutionCoordinator({
    decisionOsRoot: root,
    projectId: 'project-a',
    nodeId: 'workstation',
    project: async () => {},
    publish: () => {},
    assertAvailable: () => { if (paused) throw new Error('runtime-scope-paused'); },
  });
  await coordinator.admit(executionInput);
  await coordinator.enqueue('execution-a');
  paused = true;
  await assert.rejects(coordinator.claim('execution-a'), /runtime-scope-paused/);
  assert.equal(coordinator.store.find('execution-a')?.phase, 'queued');
});

test('publishes canonical DTO heartbeats and stops them at settlement', async () => {
  const root = resolve(mkdtempSync(resolve(tmpdir(), 'codex-coordinator-heartbeat-')), '.decision-os');
  const publications: Array<{ live: boolean; phase: string; observation: unknown }> = [];
  const coordinator = createCodexExecutionCoordinator({
    decisionOsRoot: root,
    projectId: 'project-a',
    nodeId: 'workstation',
    observationTtlMs: 300,
    project: async () => {},
    publish: ({ execution, observation }) => { publications.push({ live: execution.live, phase: execution.phase, observation }); },
  });
  await coordinator.admit(executionInput);
  await coordinator.enqueue('execution-a');
  await coordinator.claim('execution-a');
  await coordinator.spawned('execution-a', { processId: 42, processStartTime: '100', stdoutFile: null, stderrFile: null });
  const afterSpawn = publications.length;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 280));
  assert.ok(publications.length > afterSpawn);
  assert.equal(publications.at(-1)?.live, true);
  assert.ok(publications.at(-1)?.observation);
  await coordinator.settle('execution-a', { phase: 'succeeded', result: { status: 'succeeded', summary: 'complete' } });
  const afterSettlement = publications.length;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 280));
  assert.equal(publications.length, afterSettlement);
  assert.deepEqual(coordinator.dto('execution-a')?.validActions, ['restart', 'open-log']);
  coordinator.dispose();
});

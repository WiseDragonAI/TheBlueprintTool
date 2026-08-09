/**
 * WHAT: Proves causal ordering and containment for externally edited task Markdown.
 * WHY: A watcher event is not success until the matching immutable head commits.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createProjectContentRuntime } from '../../../../src/business/server/runtime/project-content-runtime.js';
import type { ProjectTaskState } from '../../../../src/business/task-state/helper/project-task-state.js';

const emptyDelta = { version: 'decision-os-task-state/4' as const, projectId: 'project-a', entities: [] };

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function fixture(recordContentContribution: () => Promise<typeof emptyDelta>, retainedHeads: unknown[] = []) {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-content-runtime-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  const contentFile = '.decision-os/cards/tasks/card-a.md';
  const file = resolve(decisionOsRoot, 'cards/tasks/card-a.md');
  mkdirSync(resolve(decisionOsRoot, 'cards/tasks'), { recursive: true });
  mkdirSync(resolve(decisionOsRoot, 'threads/tasks'), { recursive: true });
  writeFileSync(resolve(decisionOsRoot, 'state.json'), JSON.stringify({
    tabs: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(file, 'Initial body.');
  const ledger = {
    cards: [{ id: 'card-a', comment: { contentFile } }],
    annotations: [], relationships: [], threadFiles: {},
  };
  const writes: string[] = [];
  const invalidations: unknown[] = [];
  const federation: string[] = [];
  const incidents: unknown[] = [];
  const state = {
    projection: () => ({ ledger }),
    store: { contentHeads: () => retainedHeads },
    recordContentContribution,
    recordContentContributionReceipt: async () => {
      const delta = await recordContentContribution();
      return {
        delta,
        committedResourceIds: delta.entities.length > 0 ? [contentFile] : [],
      };
    },
  } as unknown as ProjectTaskState;
  const runtime = createProjectContentRuntime({
    activeDecisionOsRoot: decisionOsRoot,
    globalClients: new Set([{ write: (message: string) => { writes.push(message); } }] as never[]),
    invalidateProject: (_projectId, changes) => { invalidations.push(changes); },
    pauseWatcher: () => undefined,
    project: () => ({ id: 'project-a', available: true, decisionOsRoot } as never),
    projectId: 'project-a',
    publishFederationChange: () => { federation.push('published'); },
    publishPipelineSnapshot: () => undefined,
    recordWatcherIncident: (incident) => { incidents.push(incident); return { id: 'incident-a', scope: 'watcher' }; },
    refreshProject: () => undefined,
    serverClosing: () => false,
    stateForProject: () => state,
    taskState: () => state,
  });
  return { contentFile, federation, file, incidents, invalidations, runtime, workspace, writes };
}

test('task SSE remains blocked until the external content head commit settles', async (context) => {
  const commit = deferred<typeof emptyDelta>();
  const stateDelta = { ...emptyDelta, entities: [{ entityType: 'resource', entityId: '.decision-os/cards/tasks/card-a.md', changes: [] }] };
  const setup = fixture(() => commit.promise);
  context.after(async () => { await setup.runtime.watcher.close(); rmSync(setup.workspace, { recursive: true, force: true }); });
  await setup.runtime.ready;

  writeFileSync(setup.file, 'External edit.');
  await new Promise((resolveWait) => setTimeout(resolveWait, 90));
  assert.equal(setup.writes.length, 0);
  assert.equal(setup.invalidations.length, 0);
  commit.resolve(stateDelta as never);
  await setup.runtime.watcher.flush();

  assert.equal(setup.invalidations.length, 1);
  assert.equal(setup.writes.filter((message) => message.includes('event: card-content-change')).length, 1);
  assert.equal(setup.federation.length, 0);
});

test('failed external head capture emits no revision, SSE, invalidation, or direct federation success', async (context) => {
  const setup = fixture(async () => { throw new Error('task_content_capture_failed'); });
  context.after(async () => { await setup.runtime.watcher.close(); rmSync(setup.workspace, { recursive: true, force: true }); });
  await setup.runtime.ready;

  rmSync(setup.file);
  await new Promise((resolveWait) => setTimeout(resolveWait, 90));
  await setup.runtime.watcher.flush();

  assert.equal(setup.runtime.revisions.current('tasks'), 0);
  assert.equal(setup.writes.length, 0);
  assert.equal(setup.invalidations.length, 0);
  assert.equal(setup.federation.length, 0);
  assert.equal(setup.incidents.length, 1);
});

test('startup reconciliation blocks readiness until changed local bytes commit', async (context) => {
  const commit = deferred<typeof emptyDelta>();
  const stateDelta = { ...emptyDelta, entities: [{ entityType: 'resource', entityId: '.decision-os/cards/tasks/card-a.md', changes: [] }] };
  let calls = 0;
  const setup = fixture(() => { calls += 1; return commit.promise; }, [{}]);
  context.after(async () => { await setup.runtime.watcher.close(); rmSync(setup.workspace, { recursive: true, force: true }); });
  let ready = false;
  void setup.runtime.ready.then(() => { ready = true; });
  await new Promise((resolveWait) => setTimeout(resolveWait, 20));
  assert.equal(ready, false);
  commit.resolve(stateDelta as never);
  assert.equal(await setup.runtime.ready, true);
  assert.equal(calls, 1);
  assert.equal(setup.writes.filter((message) => message.includes('event: card-content-change')).length, 1);
});

test('startup scan leaves headless resources held and emits no success event', async (context) => {
  let calls = 0;
  const setup = fixture(async () => { calls += 1; return emptyDelta; });
  context.after(async () => { await setup.runtime.watcher.close(); rmSync(setup.workspace, { recursive: true, force: true }); });

  assert.equal(await setup.runtime.ready, true);
  assert.equal(calls, 0);
  assert.equal(setup.writes.length, 0);
  assert.equal(setup.invalidations.length, 0);
});

test('unchanged startup bytes produce no revision, invalidation, or SSE mutation', async (context) => {
  let calls = 0;
  const setup = fixture(async () => { calls += 1; return emptyDelta; }, [{}]);
  context.after(async () => { await setup.runtime.watcher.close(); rmSync(setup.workspace, { recursive: true, force: true }); });

  assert.equal(await setup.runtime.ready, true);
  assert.equal(calls, 1);
  assert.equal(setup.runtime.revisions.current('tasks'), 0);
  assert.equal(setup.writes.length, 0);
  assert.equal(setup.invalidations.length, 0);
});

test('empty watcher contribution cannot claim a concurrent canonical head transition', async (context) => {
  const commit = deferred<typeof emptyDelta>();
  const retainedHeads: unknown[] = [];
  const setup = fixture(() => commit.promise, retainedHeads);
  context.after(async () => { await setup.runtime.watcher.close(); rmSync(setup.workspace, { recursive: true, force: true }); });
  await setup.runtime.ready;
  retainedHeads.push({ hash: 'before' });
  setup.writes.length = 0;
  setup.invalidations.length = 0;

  writeFileSync(setup.file, 'Canonical bytes observed by watcher.');
  await new Promise((resolveWait) => setTimeout(resolveWait, 90));
  retainedHeads.splice(0, retainedHeads.length, { hash: 'canonical-commit' });
  commit.resolve(emptyDelta);
  await setup.runtime.watcher.flush();

  assert.equal(setup.writes.length, 0);
  assert.equal(setup.invalidations.length, 0);
});

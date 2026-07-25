/**
 * WHAT: Verifies exact Epoch 4 object installation before synchronous task mutation.
 * WHY: Missing, conflicting, and corrupt resource state must produce no watcher-visible default file.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import {
  materializeTaskMutationInputs,
  TaskContentMaterializationError,
} from '../../../src/business/federation/helper/materialize-task-mutation-inputs.js';
import { createFederationContentReplicaStore } from '../../../src/business/federation/helper/federation-content-replica-store.js';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';

const projectId = 'project-a';
const threadId = 'thread-card-a';
const key = `.decision-os/threads/tasks/${threadId}.md`;
const mutation = { action: 'append-note', note: { id: 'note-new', threadId, role: 'agent' as const, body: 'New answer.' } };

function fixture() {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-mutation-materialize-'));
  const decisionOsRoot = resolve(workspace, '.decision-os');
  const cacheRoot = resolve(workspace, '.content-cache');
  mkdirSync(decisionOsRoot, { recursive: true });
  const store = createTaskCurrentStateStore({
    decisionOsRoot,
    projectId,
    initializeLedger: { cards: [], annotations: [], relationships: [] },
    initializeReplica: { replicaId: 'workstation', counter: 0 },
  });
  const contentStore = createFederationContentReplicaStore({ decisionOsRoot: cacheRoot });
  const ledger = { cards: [], annotations: [], relationships: [], threadFiles: { [threadId]: key } };
  return { workspace, decisionOsRoot, store, contentStore, ledger, file: resolve(workspace, key) };
}

async function publishHead(context: ReturnType<typeof fixture>, body: string, replicaId = 'phone') {
  const hash = createHash('sha256').update(body).digest('hex');
  await context.store.mutate({
    replicaId,
    changes: [{
      entityType: 'resource',
      entityId: key,
      changes: [{
        path: 'head',
        operation: 'set',
        value: { type: 'thread-markdown', key, hash, bytes: Buffer.byteLength(body), changedAt: '2026-07-26T00:00:00.000Z' },
      }],
    }],
  });
  return hash;
}

test('installs exact locally retained object bytes without changing the projected head', async (context) => {
  const state = fixture();
  context.after(async () => { await state.store.flush(); rmSync(state.workspace, { recursive: true, force: true }); });
  const body = '# OPERATOR\n<!-- decision-os:note {"id":"note-old"} -->\n\nExisting question.\n';
  const hash = await publishHead(state, body);
  const objectFile = resolve(state.store.root, 'objects', hash.slice(0, 2), hash);
  mkdirSync(dirname(objectFile), { recursive: true });
  writeFileSync(objectFile, body);
  const beforeHeads = state.store.contentHeads(key);

  await materializeTaskMutationInputs({
    projectId,
    decisionOsRoot: state.decisionOsRoot,
    ledger: state.ledger,
    mutation,
    store: state.store,
    contentStore: state.contentStore,
    drain: null,
  });

  assert.equal(readFileSync(state.file, 'utf8'), body);
  assert.deepEqual(state.store.contentHeads(key), beforeHeads);
});

test('rejects an existing stale sidecar without replacing its bytes', async (context) => {
  const state = fixture();
  context.after(async () => { await state.store.flush(); rmSync(state.workspace, { recursive: true, force: true }); });
  const authoritative = '# OPERATOR\n<!-- decision-os:note {"id":"note-current"} -->\n\nCurrent question.\n';
  await publishHead(state, authoritative);
  mkdirSync(dirname(state.file), { recursive: true });
  writeFileSync(state.file, 'local stale bytes');

  await assert.rejects(materializeTaskMutationInputs({
    projectId,
    decisionOsRoot: state.decisionOsRoot,
    ledger: state.ledger,
    mutation,
    store: state.store,
    contentStore: state.contentStore,
    drain: null,
  }), (error: unknown) => (
    error instanceof TaskContentMaterializationError
    && error.statusCode === 409
    && error.code === 'task_content_local_mismatch'
  ));
  assert.equal(readFileSync(state.file, 'utf8'), 'local stale bytes');
});

test('returns unavailable without creating a sidecar when the object cannot be obtained', async (context) => {
  const state = fixture();
  context.after(async () => { await state.store.flush(); rmSync(state.workspace, { recursive: true, force: true }); });
  await publishHead(state, 'remote only');

  await assert.rejects(materializeTaskMutationInputs({
    projectId,
    decisionOsRoot: state.decisionOsRoot,
    ledger: state.ledger,
    mutation,
    store: state.store,
    contentStore: state.contentStore,
    drain: null,
  }), (error: unknown) => (
    error instanceof TaskContentMaterializationError
    && error.statusCode === 503
    && error.code === 'task_content_unavailable'
  ));
  assert.equal(existsSync(state.file), false);
});

test('demands and installs verified relay bytes when the local object is absent', async (context) => {
  const state = fixture();
  context.after(async () => { await state.store.flush(); rmSync(state.workspace, { recursive: true, force: true }); });
  const body = '# OPERATOR\n<!-- decision-os:note {"id":"note-relay"} -->\n\nRelay question.\n';
  const hash = await publishHead(state, body);
  let drainCount = 0;

  await materializeTaskMutationInputs({
    projectId,
    decisionOsRoot: state.decisionOsRoot,
    ledger: state.ledger,
    mutation,
    store: state.store,
    contentStore: state.contentStore,
    drain: async () => {
      drainCount += 1;
      const objectFile = state.contentStore.objectFile(hash);
      mkdirSync(dirname(objectFile), { recursive: true });
      writeFileSync(objectFile, body);
    },
  });

  assert.equal(drainCount, 1);
  assert.equal(readFileSync(state.file, 'utf8'), body);
});

test('validation failure occurs before a verified sidecar becomes watcher-visible', async (context) => {
  const state = fixture();
  context.after(async () => { await state.store.flush(); rmSync(state.workspace, { recursive: true, force: true }); });
  const body = '# OPERATOR\n\nMissing timestamp.\n';
  const hash = await publishHead(state, body);
  const objectFile = resolve(state.store.root, 'objects', hash.slice(0, 2), hash);
  mkdirSync(dirname(objectFile), { recursive: true });
  writeFileSync(objectFile, body);

  await assert.rejects(materializeTaskMutationInputs({
    projectId,
    decisionOsRoot: state.decisionOsRoot,
    ledger: state.ledger,
    mutation,
    store: state.store,
    contentStore: state.contentStore,
    drain: null,
    validate: () => {
      throw new Error('invalid_execution_input');
    },
  }), /invalid_execution_input/);
  assert.equal(existsSync(state.file), false);
});

test('rejects corrupt locally retained bytes without creating a sidecar', async (context) => {
  const state = fixture();
  context.after(async () => { await state.store.flush(); rmSync(state.workspace, { recursive: true, force: true }); });
  const hash = await publishHead(state, 'expected bytes');
  const objectFile = resolve(state.store.root, 'objects', hash.slice(0, 2), hash);
  mkdirSync(dirname(objectFile), { recursive: true });
  writeFileSync(objectFile, 'corrupt bytes');

  await assert.rejects(materializeTaskMutationInputs({
    projectId,
    decisionOsRoot: state.decisionOsRoot,
    ledger: state.ledger,
    mutation,
    store: state.store,
    contentStore: state.contentStore,
    drain: null,
  }), (error: unknown) => (
    error instanceof TaskContentMaterializationError
    && error.statusCode === 503
    && error.code === 'task_content_verification_failed'
  ));
  assert.equal(existsSync(state.file), false);
});

test('returns conflict without creating a sidecar for concurrent content heads', async (context) => {
  const state = fixture();
  const phoneRoot = resolve(state.workspace, '.phone');
  const tabletRoot = resolve(state.workspace, '.tablet');
  const phone = createTaskCurrentStateStore({ decisionOsRoot: phoneRoot, projectId, initializeLedger: {}, initializeReplica: { replicaId: 'phone', counter: 0 } });
  const tablet = createTaskCurrentStateStore({ decisionOsRoot: tabletRoot, projectId, initializeLedger: {}, initializeReplica: { replicaId: 'tablet', counter: 0 } });
  context.after(async () => {
    await Promise.all([state.store.flush(), phone.flush(), tablet.flush()]);
    rmSync(state.workspace, { recursive: true, force: true });
  });
  const contribution = async (store: ReturnType<typeof createTaskCurrentStateStore>, replicaId: string, body: string) => {
    const hash = createHash('sha256').update(body).digest('hex');
    await store.mutate({
      replicaId,
      changes: [{
        entityType: 'resource',
        entityId: key,
        changes: [{ path: 'head', operation: 'set', value: { type: 'thread-markdown', key, hash, bytes: Buffer.byteLength(body), changedAt: '2026-07-26T00:00:00.000Z' } }],
      }],
    });
    return store.activeDelta([`resource\u0000${key}`]);
  };
  await state.store.merge(await contribution(phone, 'phone', 'phone bytes'));
  await state.store.merge(await contribution(tablet, 'tablet', 'tablet bytes'));

  await assert.rejects(materializeTaskMutationInputs({
    projectId,
    decisionOsRoot: state.decisionOsRoot,
    ledger: state.ledger,
    mutation,
    store: state.store,
    contentStore: state.contentStore,
    drain: null,
  }), (error: unknown) => (
    error instanceof TaskContentMaterializationError
    && error.statusCode === 409
    && error.code === 'task_content_conflict'
  ));
  assert.equal(existsSync(state.file), false);
});

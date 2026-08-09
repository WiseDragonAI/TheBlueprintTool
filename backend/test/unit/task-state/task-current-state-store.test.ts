/**
 * WHAT: Verifies sharded crash durability and history-independent storage work.
 * WHY: A card mutation must never rewrite a project projection or retain permanent mutation files.
 */
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { finalizeTaskCurrentEntity, taskCurrentEntityByteLimit, taskCurrentStateVersion, type TaskCurrentEntity } from '../../../../shared/task-current-state-core.js';

const todoLifecycle = { status: 'todo', changedAt: '2026-07-21T00:00:00.000Z', waitingAt: '2026-07-21T00:00:00.000Z', closedAt: null };

test('one card mutation leaves one shard and removes its short-lived journal after materialization', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-store-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: todoLifecycle }] }] });
  await store.flush();
  const stateRoot = resolve(root, 'task-state', 'project-a');
  assert.equal(readdirSync(resolve(stateRoot, 'current', 'card')).length, 1);
  assert.equal(readdirSync(resolve(stateRoot, 'journal')).length, 0);
  assert.equal(existsSync(resolve(stateRoot, 'projection.json')), false);
  assert.equal(existsSync(resolve(stateRoot, 'events')), false);
  assert.equal(existsSync(resolve(stateRoot, 'snapshots')), false);
});

test('enhanced repair keeps journal authority until its attempt releases shard materialization', async (context) => {
  const sourceRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-deferred-source-'));
  const targetRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-deferred-target-'));
  context.after(() => {
    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(targetRoot, { recursive: true, force: true });
  });
  const source = createTaskCurrentStateStore({ decisionOsRoot: sourceRoot, projectId: 'project-a', initializeLedger: {} });
  await source.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: todoLifecycle }] }] });
  await source.flush();
  const target = createTaskCurrentStateStore({ decisionOsRoot: targetRoot, projectId: 'project-a', initializeLedger: {} });
  await target.merge(source.activeDelta(), { deferMaterialization: 'attempt-a' });

  const targetStateRoot = resolve(targetRoot, 'task-state', 'project-a');
  assert.equal(target.rootHash(), source.rootHash());
  assert.equal(readdirSync(resolve(targetStateRoot, 'journal')).length, 1);
  assert.match(readdirSync(resolve(targetStateRoot, 'journal'))[0], /\.wal$/);
  assert.equal(existsSync(resolve(targetStateRoot, 'current', 'card')), false);

  const walFile = resolve(targetStateRoot, 'journal', readdirSync(resolve(targetStateRoot, 'journal'))[0]);
  const committedBytes = readFileSync(walFile, 'utf8');
  appendFileSync(walFile, '{"torn":');

  const restarted = createTaskCurrentStateStore({ decisionOsRoot: targetRoot, projectId: 'project-a' });
  assert.equal(restarted.rootHash(), source.rootHash());
  assert.equal(readFileSync(walFile, 'utf8'), `${committedBytes}{"torn":`);
  await restarted.flush();
  assert.equal(readdirSync(resolve(targetStateRoot, 'current', 'card')).length, 1);
  assert.equal(readdirSync(resolve(targetStateRoot, 'journal')).length, 1);
  assert.equal(readFileSync(walFile, 'utf8'), `${committedBytes}{"torn":`);

  target.resumeMaterialization('attempt-a');
  await target.flush();
});

test('repair group durably accepts healthy delivery and retains complete collision evidence', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-collision-target-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  const local = await store.mutate({ replicaId: 'workstation', changes: [{ entityType: 'card', entityId: 'collision-card', changes: [{ path: 'title', operation: 'set', value: 'Local' }] }] });
  await store.flush();
  const localEntity = local.delta.entities[0];
  const remoteCollision = finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: 'project-a',
    entityType: localEntity.entityType,
    entityId: localEntity.entityId,
    fields: { ...structuredClone(localEntity.fields), title: { ...structuredClone(localEntity.fields.title), candidates: [{ ...structuredClone(localEntity.fields.title.candidates[0]), value: 'Remote' }] } },
  });
  const healthy = finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: 'project-a',
    entityType: 'card',
    entityId: 'healthy-card',
    fields: {
      '$entity': { clock: { relay: 1 }, candidates: [{ dot: { replicaId: 'relay', counter: 1 }, operation: 'set', value: true }] },
      title: { clock: { relay: 1 }, candidates: [{ dot: { replicaId: 'relay', counter: 1 }, operation: 'set', value: 'Healthy' }] },
    },
  });
  const result = await store.mergeRepairGroup([
    { attemptId: 'attempt-a', deliveryId: 'mixed-delivery', delta: { version: taskCurrentStateVersion, projectId: 'project-a', entities: [healthy, remoteCollision] } },
  ], 'attempt-a');

  assert.deepEqual(result.deliveries[0].accepted.map((entry) => entry.key), ['card\u0000healthy-card']);
  assert.equal(result.deliveries[0].rejected.length, 1);
  assert.equal(store.projectedEntity('card', 'healthy-card')?.title, 'Healthy');
  assert.equal(store.projectedEntity('card', 'collision-card')?.title, 'Local');
  const evidence = store.repairCollisionEvidence('attempt-a');
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].localEntity.stateHash, localEntity.stateHash);
  assert.equal(evidence[0].remoteEntity.stateHash, remoteCollision.stateHash);
  assert.deepEqual(evidence[0].collisions, [{ entityType: 'card', entityId: 'collision-card', path: 'title', dot: { replicaId: 'workstation', counter: 1 } }]);
  store.resumeMaterialization('attempt-a');
  await store.flush();
  const journalDirectory = resolve(root, 'task-state', 'project-a', 'journal');
  assert.equal(readdirSync(journalDirectory).filter((name) => name.endsWith('.wal')).length, 1);

  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal(restarted.projectedEntity('card', 'healthy-card')?.title, 'Healthy');
  assert.equal(restarted.projectedEntity('card', 'collision-card')?.title, 'Local');
  assert.deepEqual(restarted.repairCollisionEvidence('attempt-a'), evidence);
  const receipt = await restarted.recoverRepairCollisionLocalAuthority('attempt-a');
  assert.equal(restarted.projectedEntity('card', 'collision-card')?.title, 'Local');
  assert.equal(restarted.clock()[receipt.replicaId], 1);
  await restarted.flush();
  const recoveredRestart = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.deepEqual(await recoveredRestart.recoverRepairCollisionLocalAuthority('attempt-a'), receipt);
  assert.equal(recoveredRestart.clock()[receipt.replicaId], 1);
});

test('publication collision adopts exact retained receiver bytes and recovers through the deterministic successor', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-publication-collision-'));
  const receiverRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-publication-archive-source-'));
  context.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(receiverRoot, { recursive: true, force: true }); });
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  const local = await store.mutate({ replicaId: 'workstation', changes: [{ entityType: 'card', entityId: 'collision-card', changes: [{ path: 'title', operation: 'set', value: 'Local' }] }] });
  const localEntity = local.delta.entities[0];
  const remoteEntity = finalizeTaskCurrentEntity({
    ...structuredClone(localEntity),
    fields: { ...structuredClone(localEntity.fields), title: { ...structuredClone(localEntity.fields.title), candidates: [{ ...structuredClone(localEntity.fields.title.candidates[0]), value: 'Remote' }] } },
  });
  const receiver = createTaskCurrentStateStore({ decisionOsRoot: receiverRoot, projectId: 'project-a', initializeLedger: {} });
  await receiver.merge({ version: taskCurrentStateVersion, projectId: 'project-a', entities: [remoteEntity] });
  await store.mergeRepairGroup([{ attemptId: 'prior-repair', deliveryId: 'prior-delivery', delta: receiver.activeDelta() }], 'prior-repair');
  const rejection = store.repairCollisionEvidence('prior-repair')[0];
  const adopted = await store.adoptPublicationCollisionEvidence({
    attemptId: 'publication:delivery-a',
    deliveryId: 'delivery-a',
    rejected: [{ code: rejection.code, key: rejection.key, stateHash: localEntity.stateHash, receiverStateHash: remoteEntity.stateHash, collisions: rejection.collisions }],
    submittedEntities: [localEntity],
  });
  assert.equal(adopted.length, 1);
  assert.equal(adopted[0].direction, 'publication');
  assert.equal(adopted[0].localEntity.stateHash, localEntity.stateHash);
  assert.equal(adopted[0].remoteEntity.stateHash, remoteEntity.stateHash);
  const receipt = await store.recoverRepairCollisionLocalAuthority('publication:delivery-a');
  assert.equal(Object.keys(receipt.resultingStateHashes)[0], 'card\u0000collision-card');
  await store.flush();
  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.deepEqual(restarted.repairCollisionEvidence('publication:delivery-a'), adopted);
  assert.deepEqual(await restarted.recoverRepairCollisionLocalAuthority('publication:delivery-a'), receipt);
});

test('restart reconstructs projection, clock, and buckets from current shards only', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-restart-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const first = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await first.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'lifecycle', operation: 'set', value: todoLifecycle }] }] });
  await first.flush();
  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal((restarted.projection().ledger.cards as Array<Record<string, unknown>>)[0].status, 'todo');
  assert.equal(restarted.clock().desktop, 1);
  assert.deepEqual(restarted.bucketManifest(), first.bucketManifest());
});

test('concurrent local mutations reserve unique causal dots before journaling', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-concurrent-dots-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  const [first, second] = await Promise.all([
    store.mutate({ replicaId: 'workstation', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'First' }] }] }),
    store.mutate({ replicaId: 'workstation', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Second' }] }] }),
  ]);

  assert.deepEqual([first.batch.dot.counter, second.batch.dot.counter], [1, 2]);
  assert.equal(store.projectedEntity('card', 'card-a')?.title, 'Second');
  await store.flush();
  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal(restarted.projectedEntity('card', 'card-a')?.title, 'Second');
});

test('a state-lost writer advances beyond its joined replica clock before writing', async (context) => {
  const sourceRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-counter-source-'));
  const recoveredRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-counter-recovered-'));
  context.after(() => {
    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(recoveredRoot, { recursive: true, force: true });
  });
  const source = createTaskCurrentStateStore({ decisionOsRoot: sourceRoot, projectId: 'project-a', initializeLedger: {} });
  for (let counter = 1; counter <= 4; counter += 1) {
    await source.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: `Revision ${counter}` }] }] });
  }
  const recovered = createTaskCurrentStateStore({ decisionOsRoot: recoveredRoot, projectId: 'project-a', initializeLedger: {} });
  await recovered.merge(source.activeDelta());
  const mutation = await recovered.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Recovered writer' }] }] });

  assert.equal(mutation.batch.dot.counter, 5);
  assert.equal(mutation.batch.context.desktop, 4);
  assert.equal(recovered.projection().conflicts.some((conflict) => conflict.entityId === 'card-a' && conflict.path === 'title'), false);
  await Promise.all([source.flush(), recovered.flush()]);
});

test('local mutations keep migration-sized project clocks out of entity registers and retained journal replay', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-sparse-context-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  const entities: TaskCurrentEntity[] = Array.from({ length: 800 }, (_, index) => {
    const replicaId = `migration:project-a:card:card-${String(index).padStart(4, '0')}:${'source'.repeat(12)}`;
    return finalizeTaskCurrentEntity({
      version: taskCurrentStateVersion,
      projectId: 'project-a',
      entityType: 'card',
      entityId: `card-${String(index).padStart(4, '0')}`,
      fields: {
        '$entity': { clock: { [replicaId]: 1 }, candidates: [{ dot: { replicaId, counter: 1 }, operation: 'set', value: true }] },
        title: { clock: { [replicaId]: 1 }, candidates: [{ dot: { replicaId, counter: 1 }, operation: 'set', value: `Card ${index}` }] },
      },
    });
  });
  await store.merge({ version: taskCurrentStateVersion, projectId: 'project-a', entities });
  assert.deepEqual(Object.keys(store.projection().clock), [...Object.keys(store.projection().clock)].sort());
  await store.flush();
  assert.ok(Buffer.byteLength(JSON.stringify(store.clock())) > taskCurrentEntityByteLimit);
  assert.deepEqual(store.clientClock(), {});

  const mutation = await store.mutate({
    replicaId: 'workstation',
    changes: [{ entityType: 'card', entityId: 'new-card', changes: [{ path: 'title', operation: 'set', value: 'New card' }] }],
  });
  assert.deepEqual(mutation.batch.context, {});
  assert.deepEqual(store.clientClock(), { workstation: 1 });
  assert.ok(Buffer.byteLength(JSON.stringify(mutation.delta.entities[0])) < taskCurrentEntityByteLimit);
  await store.flush();

  const journalDirectory = resolve(root, 'task-state', 'project-a', 'journal');
  writeFileSync(resolve(journalDirectory, 'retained-global-context.json'), JSON.stringify({
    version: taskCurrentStateVersion,
    mutation: {
      version: taskCurrentStateVersion,
      batchId: 'retained-global-context',
      projectId: 'project-a',
      replicaId: 'workstation',
      emittedAt: '2026-07-21T21:25:07.027Z',
      dot: { replicaId: 'workstation', counter: 2 },
      context: store.clock(),
      changes: [{ entityType: 'card', entityId: 'new-card', changes: [{ path: 'title', operation: 'set', value: 'Recovered card' }] }],
      activationTaskId: 'new-card',
      replication: 'active',
    },
  }));
  assert.ok(readFileSync(resolve(journalDirectory, 'retained-global-context.json')).byteLength > taskCurrentEntityByteLimit);

  const restarted = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' });
  assert.equal(restarted.projectedEntity('card', 'new-card')?.title, 'Recovered card');
  assert.ok(Buffer.byteLength(JSON.stringify(restarted.entity('card', 'new-card'))) < taskCurrentEntityByteLimit);
  await restarted.flush();
  assert.equal(readdirSync(journalDirectory).length, 0);
});

test('materialized collections use identity indexes and generation-cached sorted arrays', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-index-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await store.mutate({ replicaId: 'desktop', changes: [
    { entityType: 'card', entityId: 'card-b', changes: [{ path: 'title', operation: 'set', value: 'B' }] },
    { entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'A' }] },
  ] });
  const firstCards = store.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.deepEqual(firstCards.map((card) => card.id), ['card-a', 'card-b']);
  assert.equal(store.projection().ledger.cards, firstCards);
  assert.equal(store.projectedEntity('card', 'card-b')?.title, 'B');

  await store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'annotation', entityId: 'zone-a', changes: [{ path: 'title', operation: 'set', value: 'Zone' }] }] });
  assert.equal(store.projection().ledger.cards, firstCards, 'an unrelated collection keeps its cached read array');
  await store.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-b', changes: [{ path: 'title', operation: 'set', value: 'Changed' }] }] });
  const changedCards = store.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.notEqual(changedCards, firstCards);
  assert.equal(changedCards[1].title, 'Changed');
  await store.flush();
});

test('missing format marker requires the offline migration entrypoint', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-format-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  assert.throws(() => createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' }), /offline_migration_required/);
});

test('held publication metadata stays local and activation does not change entity hashes', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-held-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });
  await store.mutate({ replicaId: 'desktop', activationTaskId: 'card-a', replication: 'held', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Local' }] }] });
  await store.flush();
  const entity = store.entity('card', 'card-a')!;
  const stateRoot = resolve(root, 'task-state', 'project-a');
  assert.equal(Object.hasOwn(entity, 'replication'), false);
  assert.equal(Object.hasOwn(entity, 'activationTaskId'), false);
  assert.equal(store.activeDelta().entities.length, 0);
  assert.equal(readdirSync(resolve(stateRoot, 'local', 'held')).length, 1);
  const beforeHash = entity.stateHash;
  const activated = await store.activate('card-a');
  assert.equal(activated.entities[0].stateHash, beforeHash);
  await store.flush();
  assert.equal(store.activeDelta().entities.length, 1);
  assert.equal(readdirSync(resolve(stateRoot, 'local', 'held')).length, 0);
});

test('duplicate incoming state creates no journal and no shard rewrite', async (context) => {
  const sourceRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-duplicate-source-'));
  const targetRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-duplicate-target-'));
  context.after(() => { rmSync(sourceRoot, { recursive: true, force: true }); rmSync(targetRoot, { recursive: true, force: true }); });
  const source = createTaskCurrentStateStore({ decisionOsRoot: sourceRoot, projectId: 'project-a', initializeLedger: {} });
  const target = createTaskCurrentStateStore({ decisionOsRoot: targetRoot, projectId: 'project-a', initializeLedger: {} });
  const mutation = await source.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Once' }] }] });
  await target.merge(mutation.delta);
  await target.flush();
  const shard = resolve(targetRoot, 'task-state', 'project-a', 'current', 'card', 'card-a.json');
  const beforeBytes = readFileSync(shard, 'utf8');
  const duplicate = await target.merge(mutation.delta);
  assert.equal(duplicate.changed, false);
  assert.equal(target.diagnostics().journalCount, 0);
  await target.flush();
  assert.equal(readFileSync(shard, 'utf8'), beforeBytes);
  await source.flush();
});

test('runtime rejects a v2 format marker without automatic migration', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-v2-reject-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const stateRoot = resolve(root, 'task-state', 'project-a');
  const formatFile = resolve(stateRoot, 'format.json');
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(formatFile, JSON.stringify({ version: 2, projectId: 'project-a', baselineRoot: '' }), { flag: 'wx' });
  assert.throws(() => createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a' }), /unsupported_task_current_state_format/);
});

test('concurrent thread notes converge as independent entities', async (context) => {
  const desktopRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-note-desktop-'));
  const mobileRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-note-mobile-'));
  context.after(() => { rmSync(desktopRoot, { recursive: true, force: true }); rmSync(mobileRoot, { recursive: true, force: true }); });
  const initial = { notes: {}, threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' } };
  const desktop = createTaskCurrentStateStore({ decisionOsRoot: desktopRoot, projectId: 'project-a', initializeLedger: initial });
  const mobile = createTaskCurrentStateStore({ decisionOsRoot: mobileRoot, projectId: 'project-a', initializeLedger: initial });
  const left = await desktop.mutate({ replicaId: 'desktop', changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-left', changes: [{ path: 'threadId', operation: 'set', value: 'thread-card-a' }, { path: 'role', operation: 'set', value: 'operator' }] }] });
  const right = await mobile.mutate({ replicaId: 'mobile', changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-right', changes: [{ path: 'threadId', operation: 'set', value: 'thread-card-a' }, { path: 'role', operation: 'set', value: 'agent' }] }] });
  await desktop.merge(right.delta);
  await mobile.merge(left.delta);
  const desktopNotes = (desktop.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'];
  const mobileNotes = (mobile.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'];
  assert.deepEqual(desktopNotes, mobileNotes);
  assert.deepEqual(desktopNotes.map((note) => note.role), ['operator', 'agent']);
  await Promise.all([desktop.flush(), mobile.flush()]);
});

test('concurrent card update and deletion retain an explicit presence conflict', async (context) => {
  const desktopRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-presence-desktop-'));
  const mobileRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-presence-mobile-'));
  context.after(() => { rmSync(desktopRoot, { recursive: true, force: true }); rmSync(mobileRoot, { recursive: true, force: true }); });
  const initial = { cards: [{ id: 'card-a', title: 'Initial', status: 'todo' }], annotations: [], relationships: [] };
  const desktop = createTaskCurrentStateStore({ decisionOsRoot: desktopRoot, projectId: 'project-a', initializeLedger: initial });
  const mobile = createTaskCurrentStateStore({ decisionOsRoot: mobileRoot, projectId: 'project-a', initializeLedger: initial });
  const update = await desktop.mutate({ replicaId: 'desktop', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: 'title', operation: 'set', value: 'Updated' }] }] });
  const deletion = await mobile.mutate({ replicaId: 'mobile', changes: [{ entityType: 'card', entityId: 'card-a', changes: [{ path: '$entity', operation: 'tombstone' }] }] });

  await desktop.merge(deletion.delta);
  await mobile.merge(update.delta);

  assert.equal(desktop.rootHash(), mobile.rootHash());
  assert.equal(desktop.projection().conflicts.some((conflict) => conflict.entityId === 'card-a' && conflict.path === '$entity'), true);
  assert.deepEqual(desktop.projection(), mobile.projection());
});

test('thread-note tombstones retain the deleted-note projection', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-note-delete-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({
    decisionOsRoot: root,
    projectId: 'project-a',
    initializeLedger: { notes: { 'thread-card-a': [{ id: 'note-a', role: 'operator', timestamp: '2026-07-21T00:00:00.000Z', message: 'Remove me.' }] } },
  });
  await store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-a', changes: [{ path: '$entity', operation: 'tombstone' }] }],
  });
  assert.deepEqual((store.projection().ledger.notes as Record<string, unknown[]>)['thread-card-a'], []);
  assert.deepEqual((store.projection().ledger.deletedNoteIds as Record<string, string[]>)['thread-card-a'], ['note-a']);
  await store.flush();
});

test('thread-note tombstones recover their thread identity from the stable entity id', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-note-delete-identity-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: {} });

  await store.mutate({
    replicaId: 'desktop',
    changes: [{ entityType: 'thread-note', entityId: 'thread-card-a/note-a', changes: [{ path: '$entity', operation: 'tombstone' }] }],
  });

  assert.deepEqual((store.projection().ledger.deletedNoteIds as Record<string, string[]>)['thread-card-a'], ['note-a']);
  assert.equal(Object.hasOwn(store.projection().ledger.deletedNoteIds as Record<string, string[]>, ''), false);
});

/**
 * WHAT: Verifies command-scoped persistence, held activation, and immediate delta publication.
 * WHY: The application command boundary must remain intact while persistence stays lane-scoped.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { applyLedgerMutation, type LedgerMutation } from '../../../src/business/ledger/helper/apply-ledger-mutation.js';
import { createProjectTaskState } from '../../../src/business/task-state/helper/project-task-state.js';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { taskCommandForMutation } from '../../../src/business/task-state/helper/task-mutation-command.js';
import type { TaskStateDelta } from '../../../src/business/task-state/helper/task-current-state-types.js';
import { materializeTaskMutationInputs } from '../../../src/business/federation/helper/materialize-task-mutation-inputs.js';
import { createFederationContentReplicaStore } from '../../../src/business/federation/helper/federation-content-replica-store.js';

type AnyRecord = Record<string, unknown>;

test('serializes mutation preparation against the latest project projection', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-prepared-mutation-'));
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: 'card-a', title: 'Task', status: 'todo' }],
    annotations: [],
    relationships: [],
  }));
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolveGate) => { releaseFirst = resolveGate; });
  const preparedTitles: string[] = [];
  const prepareTitle = (title: string, gate?: Promise<void>) => async (before: AnyRecord) => {
    const cards = before.cards as AnyRecord[];
    preparedTitles.push(String(cards[0].title));
    await gate;
    const after = structuredClone(before);
    (after.cards as AnyRecord[])[0].title = title;
    return { after };
  };

  const first = state.executePreparedMutation(
    { action: 'patch-card', cardPatch: { id: 'card-a', title: 'First' } },
    prepareTitle('First', firstGate),
  );
  await new Promise<void>((resolveTick) => setImmediate(resolveTick));
  const second = state.executePreparedMutation(
    { action: 'patch-card', cardPatch: { id: 'card-a', title: 'Second' } },
    prepareTitle('Second'),
  );
  await new Promise<void>((resolveTick) => setImmediate(resolveTick));

  assert.deepEqual(preparedTitles, ['Task']);
  releaseFirst?.();
  await Promise.all([first, second]);
  assert.deepEqual(preparedTitles, ['Task', 'First']);
  assert.equal((state.projection().ledger.cards as AnyRecord[])[0].title, 'Second');
});

test('configured writer remains read-only until project bootstrap converges', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-write-gate-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ cards: [{ id: 'card-a', title: 'Task', status: 'todo' }], annotations: [], relationships: [] }));
  let writable = false;
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true, canWrite: () => writable });

  assert.throws(() => state.transitionCardLifecycle('card-a', 'done'), /task_state_bootstrap_incomplete/);
  writable = true;
  assert.equal((await state.transitionCardLifecycle('card-a', 'done')).changed, true);
});

test('replicated execution repository publishes through the project task-state write boundary', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-execution-repository-'));
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 } }],
    annotations: [], relationships: [],
  }));
  const published: TaskStateDelta[] = [];
  let writable = false;
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
    canWrite: () => writable,
    publish: (delta) => { published.push(delta); },
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const metadata = {
    executionId: 'execution-a', requestId: 'request-a', sessionId: 'session-a', projectId: 'project-a', ledgerId: 'tasks',
    taskId: 'master', sourceCardId: 'master', ownerCardId: 'master', kind: 'thread' as const, requestedAt: '2026-07-23T01:01:00.000Z',
    model: null, effort: null, pipelineRunId: null, pipelineStepId: null, pipelineSkillRunId: null,
    predecessorExecutionId: null, restartOfExecutionId: null,
  };

  await assert.rejects(state.executions.admit({ metadata, executorNodeId: 'workstation' }), /task_state_bootstrap_incomplete/);
  writable = true;
  await state.executions.admit({ metadata, executorNodeId: 'workstation' });

  assert.equal(state.executions.find('execution-a')?.lifecycle.phase, 'preparing');
  assert.equal(published.length, 1);
  assert.deepEqual(published[0].entities.map((entity) => [entity.entityType, entity.entityId]), [['execution', 'execution-a']]);
});

test('execution artifacts use only the execution artifact lane as replicated reachability', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-execution-artifacts-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const jsonl = resolve(root, 'runs', 'codex-skills', 'tasks', 'session-a.jsonl');
  const stderr = resolve(root, 'runs', 'codex-skills', 'tasks', 'session-a.log');
  mkdirSync(dirname(jsonl), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  writeFileSync(jsonl, '{"type":"turn.completed"}\n');
  writeFileSync(stderr, 'complete\n');
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });

  await state.executions.admit({
    executorNodeId: 'workstation',
    metadata: {
      executionId: 'execution-artifacts',
      requestId: 'request-artifacts',
      sessionId: 'session-a',
      projectId: 'project-a',
      ledgerId: 'tasks',
      taskId: 'master-a',
      sourceCardId: 'master-a',
      ownerCardId: 'master-a',
      kind: 'thread',
      requestedAt: '2026-07-23T01:01:00.000Z',
      model: null,
      effort: null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
  });
  await state.executions.transition('execution-artifacts', { phase: 'succeeded' });
  const finalized = await state.finalizeExecutionArtifacts('execution-artifacts', { jsonl, stderr });

  assert.ok(finalized.artifacts.jsonl);
  assert.ok(finalized.artifacts.stderr);
  assert.equal(state.store.contentHeads().length, 0);
  assert.equal(
    existsSync(resolve(state.store.root, 'objects', finalized.artifacts.jsonl!.hash.slice(0, 2), finalized.artifacts.jsonl!.hash)),
    true,
  );
  assert.equal(
    existsSync(resolve(state.store.root, 'objects', finalized.artifacts.stderr!.hash.slice(0, 2), finalized.artifacts.stderr!.hash)),
    true,
  );
});

test('task intake publishes no state until its first durable content contribution activates its shards', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-current-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ modelName: 'tasks', cards: [], annotations: [], relationships: [], threadFiles: {} }));
  const published: TaskStateDelta[] = [];
  const content: string[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true,
    publish: (delta) => { published.push(delta); }, publishContent: (resource) => { content.push(resource); },
  });
  const execute = async (mutation: LedgerMutation) => {
    const before = structuredClone(state.projection().ledger);
    const after = structuredClone(before);
    const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
    assert.equal(applied.ok, true);
    return state.executeMutation(mutation, before, after, applied.changedContentFiles);
  };
  await execute({ action: 'create-task-intake', assignedNodeId: 'workstation', annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' }, card: { id: 'card-a', title: 'Local task', status: 'todo', labels: ['master-task'], domainId: 'tasks', comment: { what: 'Task' } } });
  assert.equal(published.length, 0);
  await execute({ action: 'append-note', note: { id: 'note-a', threadId: 'thread-card-a', body: 'Activate it.', role: 'operator', status: 'pending' } });
  assert.ok(published.flatMap((delta) => delta.entities).some((entity) => entity.entityType === 'card' && entity.entityId === 'card-a'));
  const noteDelta = published.find((delta) => delta.entities.some((entity) => entity.entityType === 'thread-note' && entity.entityId === 'thread-card-a/note-a'));
  assert.ok(noteDelta);
  assert.ok(noteDelta.entities.some((entity) => (
    entity.entityType === 'thread-note'
    && entity.entityId === 'thread-card-a/note-a'
    && entity.fields.status?.candidates.some((candidate) => candidate.value === 'pending')
  )));
  assert.ok(published.flatMap((delta) => delta.entities).some((entity) => (
    entity.entityType === 'resource' && entity.entityId === '.decision-os/threads/tasks/thread-card-a.md'
  )));
  assert.deepEqual(content, [
    '.decision-os/cards/tasks/card-a.md',
    '.decision-os/threads/tasks/thread-card-a.md',
    '.decision-os/threads/tasks/thread-card-a.md',
  ]);
  assert.equal(((state.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0]).message, undefined);
  assert.equal(((state.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0]).role, 'operator');
  assert.equal(((state.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0]).status, 'pending');
  assert.equal((state.projection().ledger.threadFiles as Record<string, string>)['thread-card-a'], '.decision-os/threads/tasks/thread-card-a.md');
  assert.match(readFileSync(resolve(root, 'threads', 'tasks', 'thread-card-a.md'), 'utf8'), /Activate it\./);
  assert.equal((state.projection().ledger.cards as Array<Record<string, unknown>>)[0].replicationState, undefined);
  assert.equal(state.store.entity('card', 'card-a')?.fields.replicationState, undefined);

  await state.flush();
  const restarted = createProjectTaskState({
    projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath,
  });
  assert.equal((restarted.projection().ledger.threadFiles as Record<string, string>)['thread-card-a'], '.decision-os/threads/tasks/thread-card-a.md');
  assert.equal(((restarted.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0]).status, 'pending');
  assert.equal(restarted.store.contentHeads('.decision-os/threads/tasks/thread-card-a.md').length, 1);
  assert.match(readFileSync(resolve(root, 'threads', 'tasks', 'thread-card-a.md'), 'utf8'), /Activate it\./);
  await restarted.flush();
});

test('voice note mutations replicate the transcript sidecar without publishing raw audio heads', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-voice-content-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const threadId = 'thread-card-a';
  const threadFile = resolve(root, 'threads', 'tasks', `${threadId}.md`);
  const voiceFile = resolve(root, 'voice-uploads', 'voice-a.webm');
  mkdirSync(dirname(threadFile), { recursive: true });
  mkdirSync(dirname(voiceFile), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({
    modelName: 'tasks',
    cards: [{ id: 'card-a', title: 'Task', status: 'todo' }],
    annotations: [],
    relationships: [],
    threadFiles: {},
  }));
  writeFileSync(threadFile, '');
  writeFileSync(voiceFile, 'raw voice bytes');
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  const mutation: LedgerMutation = {
    action: 'append-note',
    note: {
      id: 'note-voice',
      threadId,
      body: 'Persisted transcript.',
      role: 'operator',
      status: 'pending',
      voiceFileRef: voiceFile,
      revision: 4,
    },
  };

  const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
  assert.equal(applied.ok, true);
  const committed = await state.executeMutation(mutation, before, after, applied.changedContentFiles);

  assert.ok(committed.deltas.flatMap((delta) => delta.entities).some((entity) => (
    entity.entityType === 'thread-note' && entity.entityId === `${threadId}/note-voice`
  )));
  assert.ok(committed.deltas.flatMap((delta) => delta.entities).some((entity) => (
    entity.entityType === 'ledger'
    && entity.entityId === `tasks:threadFiles/${threadId}`
    && entity.fields[`threadFiles/${threadId}`]?.candidates.some((candidate) => candidate.value === `.decision-os/threads/tasks/${threadId}.md`)
  )));
  assert.ok(committed.deltas.flatMap((delta) => delta.entities).some((entity) => (
    entity.entityType === 'thread-note'
    && entity.entityId === `${threadId}/note-voice`
    && entity.fields.status?.candidates.some((candidate) => candidate.value === 'pending')
  )));
  assert.equal(state.store.contentHeads(`.decision-os/threads/tasks/${threadId}.md`).length, 1);
  assert.equal(state.store.contentHeads(voiceFile).length, 0);
});

test('restore-note causally replaces a tombstone without importing unrelated sidecar notes', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-note-restore-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const threadId = 'thread-card-a';
  const threadFile = resolve(root, 'threads', 'tasks', `${threadId}.md`);
  mkdirSync(dirname(threadFile), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({
    modelName: 'tasks',
    cards: [{ id: 'card-a', title: 'Task', status: 'todo' }],
    annotations: [],
    relationships: [],
    threadFiles: { [threadId]: `.decision-os/threads/tasks/${threadId}.md` },
    notes: {},
    deletedNoteIds: { [threadId]: ['note-test'] },
  }));
  writeFileSync(threadFile, [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-test","timestamp":"2026-07-23T07:23:23.028Z"} -->',
    '',
    'test',
    '',
    '# AGENT',
    '<!-- decision-os:note {"id":"sidecar-only","timestamp":"2026-07-23T07:24:00.000Z"} -->',
    '',
    'Do not import me.',
    '',
  ].join('\n'));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  const mutation: LedgerMutation = { action: 'restore-note', note: { id: 'note-test', threadId } };

  const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
  assert.equal(applied.ok, true);
  const restored = await state.executeMutation(mutation, before, after, applied.changedContentFiles);

  assert.equal(restored.changed, true);
  assert.deepEqual((state.projection().ledger.deletedNoteIds as Record<string, string[]>)[threadId], []);
  assert.deepEqual(
    ((state.projection().ledger.notes as Record<string, AnyRecord[]>)[threadId] ?? []).map((note) => note.id),
    ['note-test'],
  );
  assert.equal(state.store.entity('thread-note', `${threadId}/note-test`)?.fields.$entity?.candidates[0]?.operation, 'remove');
  assert.equal(state.store.entity('thread-note', `${threadId}/sidecar-only`), null);
  assert.ok(restored.deltas[0].entities.some((entity) => entity.entityType === 'resource' && entity.entityId === `.decision-os/threads/tasks/${threadId}.md`));

  const retryBefore = structuredClone(state.projection().ledger);
  const retryAfter = structuredClone(retryBefore);
  const retryMutation: LedgerMutation = { action: 'restore-note', note: { id: 'note-test', threadId } };
  const retryApplied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: retryAfter, mutation: retryMutation });
  assert.equal(retryApplied.ok, true);
  const retry = await state.executeMutation(retryMutation, retryBefore, retryAfter, retryApplied.changedContentFiles);
  assert.equal(retry.changed, false);
  assert.deepEqual(retry.deltas.flatMap((delta) => delta.entities), []);
});

test('restore-note adopts an orphan sidecar without rewriting its notes', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-note-orphan-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const threadId = 'thread-card-orphan';
  const threadRef = `.decision-os/threads/tasks/${threadId}.md`;
  const threadFile = resolve(root, 'threads', 'tasks', `${threadId}.md`);
  const original = [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-operator","timestamp":"2026-07-25T12:29:56.759Z"} -->',
    '',
    '# AGENT',
    '<!-- decision-os:note {"id":"note-agent","timestamp":"2026-07-25T12:35:25.075Z"} -->',
    '',
    'Persisted answer.',
    '',
  ].join('\n');
  mkdirSync(dirname(threadFile), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({
    modelName: 'tasks',
    cards: [{ id: 'card-orphan', title: 'Task', status: 'todo' }],
    annotations: [],
    relationships: [],
    threadFiles: {},
    notes: {},
  }));
  writeFileSync(threadFile, original);
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  const mutation: LedgerMutation = { action: 'restore-note', note: { id: 'note-agent', threadId } };

  const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
  assert.equal(applied.ok, true);
  const restored = await state.executeMutation(mutation, before, after, applied.changedContentFiles);

  assert.equal(restored.changed, true);
  assert.equal((state.projection().ledger.threadFiles as Record<string, string>)[threadId], threadRef);
  assert.equal(readFileSync(threadFile, 'utf8'), original);
  assert.deepEqual(
    ((state.projection().ledger.notes as Record<string, AnyRecord[]>)[threadId] ?? []).map((note) => [note.id, note.timestamp]),
    [['note-agent', '2026-07-25T12:35:25.075Z']],
  );
});

test('assigned held task activates and reloads with one logical identity on both replicas', async (context) => {
  const workstationRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-assigned-held-workstation-'));
  const phoneRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-assigned-held-phone-'));
  const workstationLedger = resolve(workstationRoot, 'tasks.json');
  const phoneLedger = resolve(phoneRoot, 'tasks.json');
  const emptyLedger = { modelName: 'tasks', cards: [], annotations: [], relationships: [], threadFiles: {} };
  writeFileSync(workstationLedger, JSON.stringify(emptyLedger));
  writeFileSync(phoneLedger, JSON.stringify(emptyLedger));
  const published: TaskStateDelta[] = [];
  const workstation = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: workstationRoot,
    tasksLedgerFile: workstationLedger,
    initialize: true,
    publish: (delta) => { published.push(delta); },
  });
  const phone = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'phone',
    decisionOsRoot: phoneRoot,
    tasksLedgerFile: phoneLedger,
    initialize: true,
  });
  context.after(async () => {
    await Promise.all([workstation.flush(), phone.flush()]);
    rmSync(workstationRoot, { recursive: true, force: true });
    rmSync(phoneRoot, { recursive: true, force: true });
  });
  const execute = async (mutation: LedgerMutation) => {
    const before = structuredClone(workstation.projection().ledger);
    const after = structuredClone(before);
    const applied = applyLedgerMutation({ decisionOsRoot: workstationRoot, ledgerPath: workstationLedger, ledger: after, mutation });
    assert.equal(applied.ok, true);
    return workstation.executeMutation(mutation, before, after, applied.changedContentFiles);
  };

  await execute({
    action: 'create-task-intake',
    assignedNodeId: 'phone',
    annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' },
    card: { id: 'card-a', title: 'Phone task', status: 'todo', labels: ['master-task'], domainId: 'tasks', comment: { what: 'Task' } },
  });
  assert.equal(published.length, 0);

  await execute({ action: 'append-note', note: { id: 'note-a', threadId: 'thread-card-a', body: 'Publish it.', role: 'agent' } });
  assert.ok(published.length > 0);
  for (const delta of published) await phone.store.merge(delta);
  await Promise.all([workstation.flush(), phone.flush()]);

  for (const state of [workstation, phone]) {
    const cards = state.projection().ledger.cards as Array<Record<string, any>>;
    assert.equal(cards.length, 1);
    assert.equal(cards[0].id, 'card-a');
    assert.equal(cards[0].assignment.nodeId, 'phone');
  }

  const reopenedWorkstation = createTaskCurrentStateStore({ decisionOsRoot: workstationRoot, projectId: 'project-a' });
  const reopenedPhone = createTaskCurrentStateStore({ decisionOsRoot: phoneRoot, projectId: 'project-a' });
  assert.equal((reopenedWorkstation.projection().ledger.cards as Array<Record<string, any>>).length, 1);
  assert.equal((reopenedPhone.projection().ledger.cards as Array<Record<string, any>>).length, 1);
  assert.equal((reopenedWorkstation.projection().ledger.cards as Array<Record<string, any>>)[0].assignment.nodeId, 'phone');
  assert.equal((reopenedPhone.projection().ledger.cards as Array<Record<string, any>>)[0].assignment.nodeId, 'phone');
});

test('held deletion reports local projection changes without publishing federation state', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-held-delete-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ modelName: 'tasks', cards: [], annotations: [], relationships: [], threadFiles: {} }));
  const published: TaskStateDelta[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true,
    publish: (delta) => { published.push(delta); },
  });
  const execute = async (mutation: LedgerMutation) => {
    const before = structuredClone(state.projection().ledger);
    const after = structuredClone(before);
    const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
    assert.equal(applied.ok, true);
    return state.executeMutation(mutation, before, after, applied.changedContentFiles);
  };

  await execute({
    action: 'create-task-intake',
    assignedNodeId: 'workstation',
    annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' },
    card: { id: 'card-a', title: 'Local task', status: 'todo', labels: ['master-task'], domainId: 'tasks', comment: { what: 'Task' } },
  });
  const deletion = await execute({ action: 'delete-card', cardId: 'card-a' });

  assert.equal(deletion.changed, true);
  assert.equal(deletion.deltas.length, 0);
  assert.ok(deletion.localChanges.some((change) => change.entityType === 'card' && change.entityId === 'card-a'));
  assert.equal(published.length, 0);
  assert.equal((state.projection().ledger.cards as Array<Record<string, unknown>>).some((card) => card.id === 'card-a'), false);
});

test('master-task creation persists one master assignment and leaves subtasks inherited', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-assignment-create-'));
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ modelName: 'tasks', cards: [], annotations: [], relationships: [], threadFiles: {} }));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const mutation: LedgerMutation = {
    action: 'create-master-task',
    assignedNodeId: 'phone',
    annotation: { id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#123456' },
    card: { id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], domainId: 'tasks' },
    cards: [{ id: 'child', title: 'Child', status: 'todo', labels: ['subtask'], domainId: 'tasks' }],
    relationships: [{ id: 'rel-child', from: 'master', to: 'child', label: 'subtask', position: 0 }],
  };
  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);

  const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
  assert.equal(applied.ok, true);
  await state.executeMutation(mutation, before, after, applied.changedContentFiles);

  const cards = state.projection().ledger.cards as AnyRecord[];
  const assignment = cards.find((card) => card.id === 'master')?.assignment as AnyRecord;
  assert.equal(assignment.nodeId, 'phone');
  assert.equal(assignment.revision, 1);
  assert.match(String(assignment.changedAt), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(cards.find((card) => card.id === 'child')?.assignment, undefined);
  assert.equal(state.store.entity('card', 'master')?.fields.assignment?.candidates.length, 1);
  assert.equal(state.store.entity('card', 'child')?.fields.assignment, undefined);
  for (const resource of [
    '.decision-os/cards/tasks/master.md',
    '.decision-os/cards/tasks/child.md',
    '.decision-os/threads/tasks/thread-master.md',
    '.decision-os/threads/tasks/thread-child.md',
  ]) {
    const [head] = state.store.contentHeads(resource);
    assert.ok(head, `missing content head for ${resource}`);
    assert.equal(existsSync(resolve(root, 'task-state', 'project-a', 'objects', head.hash.slice(0, 2), head.hash)), true);
  }
});

test('card description patch commits its Markdown head with the structural mutation', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-card-head-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const cardFile = resolve(root, 'cards', 'tasks', 'card-a.md');
  mkdirSync(dirname(cardFile), { recursive: true });
  writeFileSync(cardFile, '# Before\n');
  writeFileSync(ledgerPath, JSON.stringify({
    modelName: 'tasks',
    cards: [{
      id: 'card-a',
      title: 'Task',
      status: 'todo',
      comment: { contentFile: '.decision-os/cards/tasks/card-a.md', what: 'Before' },
    }],
    annotations: [],
    relationships: [],
    threadFiles: {},
  }));
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  const mutation: LedgerMutation = {
    action: 'patch-card',
    cardPatch: { id: 'card-a', description: 'Persist this body.' },
  };

  const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
  assert.equal(applied.ok, true);
  const committed = await state.executeMutation(mutation, before, after, applied.changedContentFiles);
  const resource = '.decision-os/cards/tasks/card-a.md';
  const [head] = state.store.contentHeads(resource);

  assert.ok(committed.deltas[0].entities.some((entity) => entity.entityType === 'resource' && entity.entityId === resource));
  assert.equal(readFileSync(cardFile, 'utf8'), 'Persist this body.');
  assert.equal(head.bytes, Buffer.byteLength('Persist this body.'));
  assert.equal(existsSync(resolve(root, 'task-state', 'project-a', 'objects', head.hash.slice(0, 2), head.hash)), true);
});

test('historical referenced Markdown files receive idempotent heads without synthesizing missing content', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-content-head-repair-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const cardKey = '.decision-os/cards/tasks/card-a.md';
  const missingCardKey = '.decision-os/cards/tasks/card-missing.md';
  const threadKey = '.decision-os/threads/tasks/thread-card-a.md';
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'threads', 'tasks'), { recursive: true });
  writeFileSync(resolve(root, 'cards', 'tasks', 'card-a.md'), 'Historical card body.');
  writeFileSync(resolve(root, 'threads', 'tasks', 'thread-card-a.md'), 'Historical thread body.');
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [
      { id: 'card-a', title: 'A', comment: { contentFile: cardKey } },
      { id: 'card-missing', title: 'Missing', comment: { contentFile: missingCardKey } },
    ],
    annotations: [],
    relationships: [],
    threadFiles: { 'thread-card-a': threadKey },
  }));
  const published: TaskStateDelta[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
    publish: (delta) => { published.push(delta); },
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });

  const first = await state.repairMissingContentHeads();
  const second = await state.repairMissingContentHeads();

  assert.deepEqual(first.repaired.map((head) => head.key).sort(), [cardKey, threadKey].sort());
  assert.deepEqual(first.missing, [missingCardKey]);
  assert.deepEqual(second.repaired, []);
  assert.deepEqual(second.missing, [missingCardKey]);
  assert.equal(state.store.contentHeads(cardKey).length, 1);
  assert.equal(state.store.contentHeads(threadKey).length, 1);
  assert.equal(state.store.contentHeads(missingCardKey).length, 0);
  assert.equal(existsSync(resolve(root, 'cards', 'tasks', 'card-missing.md')), false);
  assert.equal(published.flatMap((delta) => delta.entities).filter((entity) => entity.entityType === 'resource').length, 2);
});

test('reassignment resolves concurrent assignment candidates and advances their maximum revision', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-assignment-resolve-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-assignment-resolve-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const ledger = {
    cards: [{ id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 } }],
    annotations: [], relationships: [],
  };
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const remote = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: ledger });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });

  const local = await state.store.mutate({
    replicaId: 'workstation',
    changes: [{ entityType: 'card', entityId: 'master', changes: [{ path: 'assignment', operation: 'set', value: { nodeId: 'workstation', changedAt: '2026-07-23T02:00:00.000Z', revision: 2 } }] }],
  });
  const concurrent = await remote.mutate({
    replicaId: 'phone',
    changes: [{ entityType: 'card', entityId: 'master', changes: [{ path: 'assignment', operation: 'set', value: { nodeId: 'phone', changedAt: '2026-07-23T02:00:01.000Z', revision: 3 } }] }],
  });
  assert.equal(local.delta.entities.length, 1);
  await state.store.merge(concurrent.delta);
  assert.equal(state.projection().conflicts.some((conflict) => conflict.kind === 'assignment-conflict'), true);

  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  const mutation: LedgerMutation = { action: 'reassign-task', cardId: 'master', assignedNodeId: 'phone' };
  const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
  assert.equal(applied.ok, true);
  await state.executeMutation(mutation, before, after, applied.changedContentFiles);

  const assignment = (state.projection().ledger.cards as AnyRecord[])[0].assignment as AnyRecord;
  assert.equal(assignment.nodeId, 'phone');
  assert.equal(assignment.revision, 4);
  assert.equal(state.projection().conflicts.some((conflict) => conflict.kind === 'assignment-conflict'), false);
  assert.equal(state.store.entity('card', 'master')?.fields.assignment?.candidates.length, 1);
});

test('reassignment rejects inherited subtasks and tasks in every active execution phase', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-assignment-fences-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const ledger = {
    cards: [
      { id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], assignment: { nodeId: 'workstation', changedAt: '2026-07-23T01:00:00.000Z', revision: 1 } },
      { id: 'child', title: 'Child', status: 'todo', labels: ['subtask'] },
    ],
    annotations: [],
    relationships: [{ id: 'rel-child', from: 'master', to: 'child', label: 'subtask', position: 0 }],
  };
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });

  const inheritedLedger = structuredClone(state.projection().ledger);
  const inherited = applyLedgerMutation({
    decisionOsRoot: root,
    ledgerPath,
    ledger: inheritedLedger,
    mutation: { action: 'reassign-task', cardId: 'child', assignedNodeId: 'phone' },
  });
  assert.equal(inherited.ok, false);
  assert.equal(inherited.error?.statusCode, 409);
  assert.equal(inherited.error?.body.error, 'task_assignment_inherited');

  const executionId = 'execution-active';
  await state.store.mutate({
    replicaId: 'workstation',
    changes: [{
      entityType: 'execution',
      entityId: executionId,
      changes: [
        { path: 'metadata', operation: 'set', value: {
          executionId, requestId: 'request-active', sessionId: 'session-active', projectId: 'project-a', ledgerId: 'tasks',
          taskId: 'master', sourceCardId: 'master', ownerCardId: 'master', kind: 'thread', requestedAt: '2026-07-23T03:00:00.000Z',
          model: null, effort: null, pipelineRunId: null, pipelineStepId: null, pipelineSkillRunId: null,
          predecessorExecutionId: null, restartOfExecutionId: null,
        } },
        { path: 'lifecycle', operation: 'set', value: {
          phase: 'starting', phaseSince: '2026-07-23T03:00:01.000Z', startedAt: null, finishedAt: null,
          executorNodeId: 'workstation', providerSessionId: null, result: null, error: null, revision: 3,
        } },
        { path: 'artifacts', operation: 'set', value: {
          jsonl: null, stderr: null, telemetry: null, result: null, changedAt: '2026-07-23T03:00:00.000Z', revision: 1,
        } },
      ],
    }],
  });
  for (const phase of ['starting', 'running', 'cancelling'] as const) {
    if (phase !== 'starting') {
      await state.executions.transition(executionId, { phase });
    }
    assert.equal(state.executions.find(executionId)?.lifecycle.phase, phase);
    const before = structuredClone(state.projection().ledger);
    const after = structuredClone(before);
    const mutation: LedgerMutation = { action: 'reassign-task', cardId: 'master', assignedNodeId: 'phone' };
    assert.equal(applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation }).ok, true);
    await assert.rejects(state.executeMutation(mutation, before, after), /task_execution_active:master/);
    const master = (state.projection().ledger.cards as AnyRecord[]).find((card) => card.id === 'master');
    assert.equal((master?.assignment as AnyRecord).nodeId, 'workstation');
  }
});

test('unchanged content bytes do not create a second resource mutation when file metadata changes', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-content-dedupe-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  const contentFile = resolve(root, 'cards', 'tasks', 'card-a.md');
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({ cards: [{ id: 'card-a', title: 'Task', status: 'todo' }], annotations: [], relationships: [] }));
  writeFileSync(contentFile, '# Same bytes\n');
  const published: TaskStateDelta[] = [];
  const publishedContent: string[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true,
    publish: (delta) => { published.push(delta); }, publishContent: (resource) => { publishedContent.push(resource); },
  });

  await state.recordContentContribution('card-a', '.decision-os/cards/tasks/card-a.md');
  utimesSync(contentFile, new Date('2026-07-22T01:00:00.000Z'), new Date('2026-07-22T01:00:00.000Z'));
  await state.recordContentContribution('card-a', '.decision-os/cards/tasks/card-a.md');

  assert.equal(state.store.contentHeads('.decision-os/cards/tasks/card-a.md').length, 1);
  assert.equal(publishedContent.length, 1);
  assert.equal(published.flatMap((delta) => delta.entities).filter((entity) => entity.entityType === 'resource').length, 1);
});

test('reasserting preserved local bytes causally resolves concurrent content heads', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-content-resolve-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-content-resolve-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const resource = '.decision-os/cards/tasks/card-a.md';
  const contentFile = resolve(root, 'cards', 'tasks', 'card-a.md');
  const ledger = { cards: [{ id: 'card-a', title: 'Task', status: 'todo' }], annotations: [], relationships: [] };
  mkdirSync(dirname(contentFile), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  writeFileSync(contentFile, 'Preserved workstation body.');
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  const remote = createTaskCurrentStateStore({
    decisionOsRoot: remoteRoot,
    projectId: 'project-a',
    initializeLedger: ledger,
  });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });

  await state.recordContentContribution('card-a', resource);
  const preserved = state.store.contentHeads(resource)[0];
  const concurrent = await remote.mutate({
    replicaId: 'phone',
    changes: [{
      entityType: 'resource',
      entityId: resource,
      changes: [{
        path: 'head',
        operation: 'set',
        value: {
          type: 'card-markdown',
          key: resource,
          hash: '5'.repeat(64),
          bytes: 229,
          changedAt: '2026-07-26T00:00:00.000Z',
        },
      }],
    }],
  });
  await state.store.merge(concurrent.delta);
  assert.equal(state.store.contentHeads(resource).length, 2);

  const resolved = await state.recordContentContribution('card-a', resource);

  assert.equal(resolved.entities.some((entity) => entity.entityType === 'resource' && entity.entityId === resource), true);
  assert.deepEqual(state.store.contentHeads(resource), [preserved]);
});

test('reconciles a concurrent thread candidate only when local Markdown is its lossless note superset', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-thread-superset-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-thread-superset-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const resource = '.decision-os/threads/tasks/thread-card-a.md';
  const contentFile = resolve(root, 'threads', 'tasks', 'thread-card-a.md');
  const remoteBody = '# OPERATOR\n<!-- decision-os:note {"id":"note-a"} -->\n\nFirst note.\n';
  const localBody = `${remoteBody}\n# AGENT\n<!-- decision-os:note {"id":"note-b"} -->\n\nSecond note.\n`;
  const remoteHash = createHash('sha256').update(remoteBody).digest('hex');
  const ledger = {
    cards: [{ id: 'card-a', title: 'Task', status: 'todo' }],
    annotations: [], relationships: [], threadFiles: { 'thread-card-a': resource },
  };
  mkdirSync(dirname(contentFile), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  writeFileSync(contentFile, localBody);
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const remote = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: ledger });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });
  await state.recordContentContribution('card-a', resource);
  mkdirSync(resolve(state.store.root, 'objects', remoteHash.slice(0, 2)), { recursive: true });
  writeFileSync(resolve(state.store.root, 'objects', remoteHash.slice(0, 2), remoteHash), remoteBody);
  const concurrent = await remote.mutate({
    replicaId: 'phone',
    changes: [{
      entityType: 'resource', entityId: resource,
      changes: [{ path: 'head', operation: 'set', value: { type: 'thread-markdown', key: resource, hash: remoteHash, bytes: Buffer.byteLength(remoteBody), changedAt: '2026-07-31T00:00:00.000Z' } }],
    }],
  });
  await state.store.merge(concurrent.delta);

  assert.equal(await state.reconcileSupersetThreadContentConflict(resource), true);
  assert.deepEqual(state.store.contentHeads(resource).map((head) => head.hash), [createHash('sha256').update(localBody).digest('hex')]);
});

test('preserves a same-note thread body divergence as an explicit conflict', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-thread-divergence-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-thread-divergence-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const resource = '.decision-os/threads/tasks/thread-card-a.md';
  const contentFile = resolve(root, 'threads', 'tasks', 'thread-card-a.md');
  const localBody = '# OPERATOR\n<!-- decision-os:note {"id":"note-a"} -->\n\nLocal body.\n';
  const remoteBody = '# OPERATOR\n<!-- decision-os:note {"id":"note-a"} -->\n\nRemote body.\n';
  const remoteHash = createHash('sha256').update(remoteBody).digest('hex');
  const ledger = { cards: [{ id: 'card-a', title: 'Task', status: 'todo' }], annotations: [], relationships: [], threadFiles: { 'thread-card-a': resource } };
  mkdirSync(dirname(contentFile), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  writeFileSync(contentFile, localBody);
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'workstation', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const remote = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: ledger });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });
  await state.recordContentContribution('card-a', resource);
  mkdirSync(resolve(state.store.root, 'objects', remoteHash.slice(0, 2)), { recursive: true });
  writeFileSync(resolve(state.store.root, 'objects', remoteHash.slice(0, 2), remoteHash), remoteBody);
  const concurrent = await remote.mutate({
    replicaId: 'phone',
    changes: [{
      entityType: 'resource', entityId: resource,
      changes: [{ path: 'head', operation: 'set', value: { type: 'thread-markdown', key: resource, hash: remoteHash, bytes: Buffer.byteLength(remoteBody), changedAt: '2026-07-31T00:00:00.000Z' } }],
    }],
  });
  await state.store.merge(concurrent.delta);

  assert.equal(await state.reconcileSupersetThreadContentConflict(resource), false);
  assert.equal(state.store.contentHeads(resource).length, 2);
});

test('watcher observation ignores materialization and publishes only the post-mutation thread head', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-materialized-mutation-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const threadId = 'thread-card-a';
  const key = `.decision-os/threads/tasks/${threadId}.md`;
  const threadFile = resolve(root, 'threads', 'tasks', `${threadId}.md`);
  const original = [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-existing","timestamp":"2026-07-26T00:00:00.000Z"} -->',
    '',
    'Existing question.',
    '',
  ].join('\n');
  mkdirSync(dirname(threadFile), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: 'card-a', title: 'Task', status: 'todo' }],
    annotations: [],
    relationships: [],
    threadFiles: { [threadId]: key },
  }));
  writeFileSync(threadFile, original);
  const published: TaskStateDelta[] = [];
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
    publish: (delta) => { published.push(delta); },
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  await state.recordContentContribution('card-a', key);
  const initialHead = state.store.contentHeads(key)[0];
  const initialResourcePublications = published.flatMap((delta) => delta.entities)
    .filter((entity) => entity.entityType === 'resource' && entity.entityId === key).length;
  rmSync(threadFile);
  const mutation: LedgerMutation = {
    action: 'append-note',
    note: { id: 'note-new', threadId, role: 'agent', body: 'New answer.' },
  };

  await materializeTaskMutationInputs({
    projectId: 'project-a',
    decisionOsRoot: root,
    ledger: state.projection().ledger,
    mutation,
    store: state.store,
    contentStore: createFederationContentReplicaStore({ decisionOsRoot: resolve(root, 'federation-cache') }),
    drain: null,
  });
  // WHAT: Simulate the watcher observing exact materialized bytes before the intended mutation.
  // WHY: Reinstalling the active head must be a no-op; only the subsequent user edit may advance content.
  await state.recordContentContribution('card-a', key);
  assert.deepEqual(state.store.contentHeads(key), [initialHead]);
  assert.equal(
    published.flatMap((delta) => delta.entities)
      .filter((entity) => entity.entityType === 'resource' && entity.entityId === key).length,
    initialResourcePublications,
  );

  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  const applied = applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation });
  assert.equal(applied.ok, true);
  await state.executeMutation(mutation, before, after, applied.changedContentFiles);
  const finalMarkdown = readFileSync(threadFile, 'utf8');
  const finalHeads = state.store.contentHeads(key);
  assert.match(finalMarkdown, /Existing question\./);
  assert.match(finalMarkdown, /New answer\./);
  assert.equal(finalHeads.length, 1);
  assert.notEqual(finalHeads[0].hash, initialHead.hash);
  assert.equal(
    published.flatMap((delta) => delta.entities)
      .filter((entity) => entity.entityType === 'resource' && entity.entityId === key).length,
    initialResourcePublications + 1,
  );
});

test('projection commands modify only declared entity lanes', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-scope-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ cards: [{ id: 'a', status: 'todo' }, { id: 'b', status: 'todo' }], annotations: [], relationships: [] }));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const changed = structuredClone(state.projection().ledger);
  (changed.cards as Array<Record<string, unknown>>)[0].status = 'done';
  (changed.cards as Array<Record<string, unknown>>)[1].status = 'done';
  await state.executeProjectionCommand({ kind: 'one-card', cardIds: ['a'] }, changed);
  const cards = state.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.equal(cards.find((card) => card.id === 'a')?.status, 'done');
  assert.equal(cards.find((card) => card.id === 'b')?.status, 'todo');
});

test('lifecycle command changes one atomic card lane without note tombstones', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-lifecycle-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: 'a', title: 'A', status: 'todo' }, { id: 'b', title: 'B', status: 'todo' }],
    annotations: [], relationships: [], notes: { 'thread-a': [{ id: 'note-a', message: 'Keep me' }] },
  }));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const beforeA = state.store.entity('card', 'a');
  const beforeB = state.store.entity('card', 'b');
  const beforeNote = state.store.entity('thread-note', 'thread-a/note-a');

  const result = await state.transitionCardLifecycle('a', 'done');

  assert.equal(result.deltas.length, 1);
  assert.deepEqual(result.deltas[0].entities.map((entity) => [entity.entityType, entity.entityId]), [['card', 'a']]);
  assert.deepEqual(result.localChanges, [{ entityType: 'card', entityId: 'a' }]);
  assert.notEqual(state.store.entity('card', 'a')?.stateHash, beforeA?.stateHash);
  assert.equal(state.store.entity('card', 'b')?.stateHash, beforeB?.stateHash);
  assert.equal(state.store.entity('thread-note', 'thread-a/note-a')?.stateHash, beforeNote?.stateHash);
  const lifecycle = state.store.entity('card', 'a')?.fields.lifecycle?.candidates[0]?.value as Record<string, unknown>;
  assert.equal(lifecycle.status, 'done');
  assert.equal(lifecycle.waitingAt, null);
  assert.equal(lifecycle.closedAt, lifecycle.changedAt);
  assert.match(String(lifecycle.changedAt), /^\d{4}-\d{2}-\d{2}T/);
});

test('successful execution settlement refreshes the waiting timestamp without reopening a closed task', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-settlement-waiting-'));
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [
      {
        id: 'open',
        title: 'Open',
        status: 'todo',
        lifecycle: {
          status: 'todo',
          changedAt: '2026-07-20T00:00:00.000Z',
          waitingAt: '2026-07-20T00:00:00.000Z',
          closedAt: null,
        },
      },
      {
        id: 'closed',
        title: 'Closed',
        status: 'done',
        lifecycle: {
          status: 'done',
          changedAt: '2026-07-25T00:00:00.000Z',
          waitingAt: null,
          closedAt: '2026-07-25T00:00:00.000Z',
        },
      },
    ],
    annotations: [],
    relationships: [],
  }));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const finishedAt = '2026-07-25T06:37:53.459Z';
  const olderFinishedAt = '2026-07-25T06:37:52.459Z';

  const refreshed = await state.transitionCardLifecycle('open', 'todo', finishedAt);
  const repeated = await state.transitionCardLifecycle('open', 'todo', finishedAt);
  const regressed = await state.transitionCardLifecycle('open', 'todo', olderFinishedAt);
  const ignored = await state.transitionCardLifecycle('closed', 'todo', finishedAt);
  const cards = state.projection().ledger.cards as AnyRecord[];

  assert.equal(refreshed.changed, true);
  assert.equal(repeated.changed, false);
  assert.equal(regressed.changed, false);
  assert.equal(ignored.changed, false);
  assert.deepEqual(cards.find((card) => card.id === 'open')?.lifecycle, {
    status: 'todo',
    changedAt: finishedAt,
    waitingAt: finishedAt,
    closedAt: null,
  });
  assert.equal((cards.find((card) => card.id === 'closed')?.lifecycle as AnyRecord).status, 'done');
});

test('lifecycle conflicts block completion until a scoped lifecycle resolution', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-conflict-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-conflict-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const ledger = {
    cards: [{ id: 'master', title: 'Master', status: 'todo', labels: ['master-task'] }],
    annotations: [], relationships: [],
  };
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  const state = createProjectTaskState({ projectId: 'project-a', writerId: 'desktop', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  const remote = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: ledger });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });

  await state.transitionCardLifecycle('master', 'backlog');
  const remoteDone = await remote.mutate({
    replicaId: 'phone',
    changes: [{ entityType: 'card', entityId: 'master', changes: [{ path: 'lifecycle', operation: 'set', value: { status: 'done', changedAt: '2026-07-21T03:00:00.000Z', waitingAt: null, closedAt: '2026-07-21T03:00:00.000Z' } }] }],
  });
  await state.store.merge(remoteDone.delta);
  assert.equal(state.projection().conflicts[0]?.kind, 'task-conflict');

  const before = structuredClone(state.projection().ledger);
  const after = structuredClone(before);
  assert.equal(applyLedgerMutation({ decisionOsRoot: root, ledgerPath, ledger: after, mutation: { action: 'complete-master-task', masterTaskId: 'master' } }).ok, true);
  await assert.rejects(state.executeMutation({ action: 'complete-master-task', masterTaskId: 'master' }, before, after), /task_lifecycle_conflict:master/);

  const unresolved = await state.reconcileMergeableConflicts();
  assert.equal(unresolved.changed, false);
  assert.equal(state.projection().conflicts[0]?.kind, 'task-conflict');

  await state.transitionCardLifecycle('master', 'todo');
  assert.equal(state.projection().conflicts.length, 0);
});

test('same-status lifecycle refreshes converge causally without changing thread state', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-lifecycle-reconcile-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-lifecycle-reconcile-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const threadFile = resolve(root, 'threads', 'tasks', 'thread-card-a.md');
  const threadBody = [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-22T12:36:30.895Z"} -->',
    '',
    'Keep this note byte-identical.',
    '',
  ].join('\n');
  mkdirSync(dirname(threadFile), { recursive: true });
  writeFileSync(threadFile, threadBody);
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: 'card-a', title: 'Task', status: 'todo' }],
    annotations: [],
    relationships: [],
    threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' },
    notes: {
      'thread-card-a': [{
        id: 'note-a',
        role: 'operator',
        status: 'pending',
        timestamp: '2026-07-22T12:36:30.895Z',
      }],
    },
  }));
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  const remote = createTaskCurrentStateStore({
    decisionOsRoot: remoteRoot,
    projectId: 'project-a',
    initializeLedger: { cards: [], annotations: [], relationships: [] },
  });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });
  await state.store.mutate({
    replicaId: 'workstation',
    changes: [{
      entityType: 'card',
      entityId: 'card-a',
      changes: [{
        path: 'lifecycle',
        operation: 'set',
        value: {
          status: 'todo',
          changedAt: '2026-07-25T17:59:10.163Z',
          waitingAt: '2026-07-25T17:59:10.163Z',
          closedAt: null,
        },
      }],
    }],
  });
  const phone = await remote.mutate({
    replicaId: 'phone',
    changes: [{
      entityType: 'card',
      entityId: 'card-a',
      changes: [{
        path: 'lifecycle',
        operation: 'set',
        value: {
          status: 'todo',
          changedAt: '2026-07-22T12:36:30.895Z',
          waitingAt: '2026-07-22T12:36:30.895Z',
          closedAt: null,
        },
      }],
    }],
  });
  await state.store.merge(phone.delta);
  assert.equal(state.projection().conflicts.some((conflict) => conflict.entityId === 'card-a' && conflict.path === 'lifecycle'), true);
  const notesBefore = structuredClone((state.projection().ledger.notes as AnyRecord)['thread-card-a']);

  const resolved = await state.reconcileMergeableConflicts();

  assert.equal(resolved.changed, true);
  assert.equal(state.projection().conflicts.some((conflict) => conflict.entityId === 'card-a' && conflict.path === 'lifecycle'), false);
  assert.deepEqual(
    (state.projection().ledger.cards as AnyRecord[]).find((card) => card.id === 'card-a')?.lifecycle,
    {
      status: 'todo',
      changedAt: '2026-07-25T17:59:10.163Z',
      waitingAt: '2026-07-25T17:59:10.163Z',
      closedAt: null,
    },
  );
  assert.deepEqual((state.projection().ledger.notes as AnyRecord)['thread-card-a'], notesBefore);
  assert.equal(readFileSync(threadFile, 'utf8'), threadBody);
  assert.equal(state.store.entity('card', 'card-a')?.fields.lifecycle?.candidates.length, 1);
  assert.equal((await state.reconcileMergeableConflicts()).changed, false);
});

test('missing execution artifacts converge to the retained immutable evidence head', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-project-artifact-reconcile-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-project-artifact-reconcile-remote-'));
  const ledgerPath = resolve(root, 'tasks.json');
  writeFileSync(ledgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  const remote = createTaskCurrentStateStore({
    decisionOsRoot: remoteRoot,
    projectId: 'project-a',
    initializeLedger: { cards: [], annotations: [], relationships: [] },
  });
  context.after(async () => {
    await Promise.all([state.flush(), remote.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });
  const metadata = {
    executionId: 'execution-a',
    requestId: 'request-a',
    sessionId: 'session-a',
    projectId: 'project-a',
    ledgerId: 'tasks',
    taskId: 'card-a',
    sourceCardId: 'card-a',
    ownerCardId: 'card-a',
    kind: 'thread',
    requestedAt: '2026-07-22T12:36:30.895Z',
    model: null,
    effort: null,
    pipelineRunId: null,
    pipelineStepId: null,
    pipelineSkillRunId: null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  };
  const lifecycle = {
    phase: 'interrupted',
    phaseSince: '2026-07-22T12:36:31.000Z',
    startedAt: null,
    finishedAt: '2026-07-22T12:36:31.000Z',
    executorNodeId: 'workstation',
    providerSessionId: null,
    result: { status: 'interrupted', summary: '' },
    error: null,
    revision: 1,
  };
  const jsonl = {
    hash: 'fa93b6e3c9a865c735d43d0569fa3ea89f294e99f7ac81104ec14d4af3b022cc',
    bytes: 227,
    mediaType: 'application/x-ndjson',
  };
  const local = await state.store.mutate({
    replicaId: 'workstation',
    changes: [{
      entityType: 'execution',
      entityId: 'execution-a',
      changes: [
        { path: 'metadata', operation: 'set', value: metadata },
        { path: 'lifecycle', operation: 'set', value: lifecycle },
        {
          path: 'artifacts',
          operation: 'set',
          value: {
            jsonl: null,
            stderr: null,
            telemetry: null,
            result: null,
            changedAt: '2026-07-22T12:36:31.000Z',
            revision: 1,
          },
        },
      ],
    }],
  });
  assert.equal(local.delta.entities.length, 1);
  const phone = await remote.mutate({
    replicaId: 'phone',
    changes: [{
      entityType: 'execution',
      entityId: 'execution-a',
      changes: [
        { path: 'metadata', operation: 'set', value: metadata },
        { path: 'lifecycle', operation: 'set', value: lifecycle },
        {
          path: 'artifacts',
          operation: 'set',
          value: {
            jsonl,
            stderr: null,
            telemetry: null,
            result: null,
            changedAt: '2026-07-22T12:36:32.000Z',
            revision: 2,
          },
        },
      ],
    }],
  });
  await state.store.merge(phone.delta);
  assert.deepEqual(state.executions.diagnostics(), [{
    executionId: 'execution-a',
    code: 'task_execution_conflict',
    lanes: ['artifacts'],
    taskId: 'card-a',
  }]);

  const resolved = await state.reconcileMergeableConflicts();

  assert.equal(resolved.changed, true);
  assert.deepEqual(state.executions.diagnostics(), []);
  assert.deepEqual(state.executions.find('execution-a')?.artifacts, {
    jsonl,
    stderr: null,
    telemetry: null,
    result: null,
    changedAt: '2026-07-22T12:36:32.000Z',
    revision: 2,
  });
  assert.equal(state.store.entity('execution', 'execution-a')?.fields.artifacts?.candidates.length, 1);
  assert.equal((await state.reconcileMergeableConflicts()).changed, false);

  const competing = await remote.mutate({
    replicaId: 'phone',
    changes: [{
      entityType: 'execution',
      entityId: 'execution-a',
      changes: [{
        path: 'artifacts',
        operation: 'set',
        value: {
          jsonl: {
            hash: '0a93b6e3c9a865c735d43d0569fa3ea89f294e99f7ac81104ec14d4af3b022cc',
            bytes: 228,
            mediaType: 'application/x-ndjson',
          },
          stderr: null,
          telemetry: null,
          result: null,
          changedAt: '2026-07-22T12:36:33.000Z',
          revision: 3,
        },
      }],
    }],
  });
  await state.store.merge(competing.delta);
  assert.equal((await state.reconcileMergeableConflicts()).changed, false);
  assert.deepEqual(state.executions.diagnostics(), [{
    executionId: 'execution-a',
    code: 'task_execution_conflict',
    lanes: ['artifacts'],
    taskId: 'card-a',
  }]);
});

test('master completion emits one lifecycle lane per positioned graph member', () => {
  const before = {
    cards: [
      { id: 'master', status: 'todo', labels: ['master-task'] },
      { id: 'child-a', status: 'todo', title: 'A' },
      { id: 'child-b', status: 'todo', title: 'B' },
    ],
    relationships: [
      { id: 'rel-b', from: 'master', to: 'child-b', label: 'subtask', position: 1 },
      { id: 'rel-a', from: 'master', to: 'child-a', label: 'subtask', position: 0 },
    ],
  };
  const after = structuredClone(before);
  for (const card of after.cards) card.status = 'done';

  const command = taskCommandForMutation({ mutation: { action: 'complete-master-task', masterTaskId: 'master' }, before, after });

  assert.deepEqual(command.changes.map((change) => change.entityId), ['master', 'child-a', 'child-b']);
  assert.ok(command.changes.every((change) => change.changes.length === 1 && change.changes[0].path === 'lifecycle'));
});

test('task commands reject changes to immutable card creation time', () => {
  const before = { cards: [{ id: 'card-a', status: 'todo', createdAt: '2026-07-21T01:00:00.000Z' }] };
  const after = { cards: [{ id: 'card-a', status: 'todo', createdAt: '2026-07-21T02:00:00.000Z' }] };
  assert.throws(() => taskCommandForMutation({ mutation: { action: 'patch-card', cardPatch: { id: 'card-a', title: 'A' } }, before, after }), /immutable_card_created_at/);
});

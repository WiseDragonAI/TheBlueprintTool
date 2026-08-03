/**
 * WHAT: Verifies epoch-4 execution persistence, indexes, transitions, idempotency, and conflict visibility.
 * WHY: The replicated repository must be complete before launch and recovery paths can abandon legacy execution files.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import type { TaskExecutionMetadata } from '../../../src/business/task-state/helper/task-current-state-types.js';
import { taskCurrentStateVersion } from '../../../src/business/task-state/helper/task-current-state-types.js';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { createTaskExecutionRepository } from '../../../src/business/task-state/helper/task-execution-repository.js';

function metadata(input: Partial<TaskExecutionMetadata> = {}): TaskExecutionMetadata {
  return {
    executionId: 'execution-a',
    requestId: 'request-a',
    sessionId: 'session-a',
    projectId: 'project-a',
    ledgerId: 'tasks',
    taskId: 'master-a',
    sourceCardId: 'master-a',
    ownerCardId: 'master-a',
    kind: 'thread',
    requestedAt: '2026-07-23T01:00:00.000Z',
    model: null,
    effort: null,
    pipelineRunId: null,
    pipelineStepId: null,
    pipelineSkillRunId: null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
    ...input,
  };
}

test('admits idempotently into epoch-4 state and rebuilds every required local index', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-repository-'));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: { cards: [], annotations: [], relationships: [] } });
  const repository = createTaskExecutionRepository({ store, writerId: 'workstation', projectId: 'project-a' });
  context.after(async () => { await store.flush(); rmSync(root, { recursive: true, force: true }); });

  const admitted = await repository.admit({ metadata: metadata(), executorNodeId: 'workstation' });
  const firstRoot = store.rootHash();
  const retried = await repository.admit({ metadata: metadata(), executorNodeId: 'workstation' });

  assert.deepEqual(retried, admitted);
  assert.equal(store.rootHash(), firstRoot);
  assert.equal(admitted.lifecycle.phase, 'preparing');
  assert.equal(admitted.lifecycle.executorNodeId, 'workstation');
  assert.equal(admitted.artifacts.revision, 1);
  assert.equal(repository.findByRequest('master-a', 'request-a')?.metadata.executionId, 'execution-a');
  assert.deepEqual(repository.byTaskId('master-a').map((record) => record.metadata.executionId), ['execution-a']);
  assert.deepEqual(repository.bySessionId('session-a').map((record) => record.metadata.executionId), ['execution-a']);
  assert.deepEqual(repository.byPhase('preparing').map((record) => record.metadata.executionId), ['execution-a']);
  assert.deepEqual(repository.byExecutorNodeId('workstation').map((record) => record.metadata.executionId), ['execution-a']);
  assert.deepEqual(repository.byPipelineRunId('pipeline-a'), []);
  assert.equal(existsSync(resolve(root, 'codex-executions.json')), false);
  await assert.rejects(
    repository.admit({ metadata: metadata(), executorNodeId: 'phone' }),
    /task_execution_request_conflict:request-a/,
  );
});

test('indexes pipeline identity and preserves legal awaited lifecycle plus terminal artifact revisions', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-repository-transition-'));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: { cards: [], annotations: [], relationships: [] } });
  const repository = createTaskExecutionRepository({
    store,
    writerId: 'workstation',
    projectId: 'project-a',
    now: () => new Date('2026-07-23T01:00:10.000Z'),
  });
  context.after(async () => { await store.flush(); rmSync(root, { recursive: true, force: true }); });
  const pipelineMetadata = metadata({
    executionId: 'execution-pipeline',
    requestId: 'request-pipeline',
    sessionId: 'session-pipeline',
    sourceCardId: 'source-a',
    ownerCardId: 'output-a',
    kind: 'pipeline-skill',
    pipelineRunId: 'pipeline-a',
    pipelineStepId: 'step-a',
    pipelineSkillRunId: 'skill-a',
  });

  await repository.admit({ metadata: pipelineMetadata, executorNodeId: 'workstation' });
  assert.deepEqual(repository.byPipelineRunId('pipeline-a').map((record) => record.metadata.executionId), ['execution-pipeline']);
  await repository.transition('execution-pipeline', { phase: 'queued' });
  await repository.transition('execution-pipeline', { phase: 'starting' });
  await assert.rejects(
    repository.transition('execution-pipeline', { phase: 'running', executorNodeId: 'phone' }),
    /task_execution_executor_immutable:execution-pipeline/,
  );
  await repository.transition('execution-pipeline', { phase: 'running' });
  const bound = await repository.transition('execution-pipeline', { phase: 'running', providerSessionId: 'provider-a' });
  assert.equal(bound.lifecycle.phase, 'running');
  assert.equal(bound.lifecycle.providerSessionId, 'provider-a');
  await assert.rejects(
    repository.transition('execution-pipeline', { phase: 'cancelling', providerSessionId: 'provider-b' }),
    /task_execution_provider_session_immutable:execution-pipeline/,
  );
  await assert.rejects(
    repository.transition('execution-pipeline', { phase: 'cancelling', changedAt: '2026-07-23T00:59:00.000Z' }),
    /task_execution_timestamp_regression:execution-pipeline/,
  );
  const stopAcceptedAt = '2026-07-23T01:00:10.000Z';
  const cleanupSettledAt = '2026-07-23T01:00:12.000Z';
  const cancelling = await repository.transition('execution-pipeline', { phase: 'cancelling', changedAt: stopAcceptedAt });
  assert.equal(cancelling.lifecycle.finishedAt, stopAcceptedAt);
  const cancelled = await repository.transition('execution-pipeline', {
    phase: 'cancelled',
    changedAt: cleanupSettledAt,
    result: { status: 'cancelled', summary: 'Cancelled by operator.' },
  });

  assert.equal(cancelled.lifecycle.revision, 7);
  assert.equal(cancelled.lifecycle.providerSessionId, 'provider-a');
  assert.equal(cancelled.lifecycle.finishedAt, stopAcceptedAt);
  assert.equal(cancelled.lifecycle.phaseSince, cleanupSettledAt);
  assert.deepEqual(repository.byPhase('cancelled').map((record) => record.metadata.executionId), ['execution-pipeline']);
  await assert.rejects(repository.transition('execution-pipeline', { phase: 'running' }), /task_execution_transition_invalid:cancelled:running/);

  const finalized = await repository.finalizeArtifacts('execution-pipeline', {
    jsonl: { hash: 'a'.repeat(64), bytes: 128, mediaType: 'application/x-ndjson' },
    stderr: { hash: 'b'.repeat(64), bytes: 0, mediaType: 'text/plain' },
  });
  assert.equal(finalized.artifacts.revision, 2);
  assert.equal(finalized.artifacts.jsonl?.hash, 'a'.repeat(64));
  assert.equal(finalized.artifacts.stderr?.hash, 'b'.repeat(64));
});

test('publishes execution tombstones and session deletion state atomically after terminal settlement', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-session-delete-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-session-delete-remote-'));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: { cards: [], annotations: [], relationships: [] } });
  const remoteStore = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: { cards: [], annotations: [], relationships: [] } });
  const repository = createTaskExecutionRepository({ store, writerId: 'workstation', projectId: 'project-a' });
  const artifact = resolve(root, 'runs', 'session-a.jsonl');
  mkdirSync(resolve(root, 'runs'), { recursive: true });
  writeFileSync(artifact, '{"type":"turn.completed"}\n');
  context.after(async () => {
    await Promise.all([store.flush(), remoteStore.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });

  await repository.admit({ metadata: metadata(), executorNodeId: 'workstation' });
  await repository.transition('execution-a', { phase: 'queued' });
  await assert.rejects(repository.deleteSession('session-a'), /task_execution_session_active/);
  assert.ok(repository.find('execution-a'));
  await repository.transition('execution-a', {
    phase: 'cancelled',
    result: { status: 'cancelled', summary: 'Cancelled before launch.' },
  });

  const deleted = await repository.deleteSession('session-a', '2026-07-23T01:01:00.000Z');

  assert.deepEqual(deleted.map((record) => record.metadata.executionId), ['execution-a']);
  assert.equal(repository.find('execution-a'), null);
  const executionTombstone = store.entity('execution', 'execution-a');
  assert.equal(executionTombstone?.fields.$entity.candidates[0].operation, 'tombstone');
  const sessionDeletion = store.entity('resource', 'codex-session:session-a');
  assert.equal(sessionDeletion?.fields.kind.candidates[0].value, 'codex-session-deletion');
  assert.equal(sessionDeletion?.fields.deletedAt.candidates[0].value, '2026-07-23T01:01:00.000Z');
  assert.deepEqual(sessionDeletion?.fields.executionIds.candidates[0].value, ['execution-a']);
  await remoteStore.merge({
    version: taskCurrentStateVersion,
    projectId: 'project-a',
    entities: [executionTombstone!, sessionDeletion!],
  });
  assert.equal(remoteStore.entity('execution', 'execution-a')?.fields.$entity.candidates[0].operation, 'tombstone');
  assert.equal(remoteStore.entity('resource', 'codex-session:session-a')?.fields.kind.candidates[0].value, 'codex-session-deletion');
  assert.equal(existsSync(artifact), true);
});

test('rebuild exposes concurrent lifecycle candidates as an explicit execution conflict', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-repository-conflict-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-repository-conflict-remote-'));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: { cards: [], annotations: [], relationships: [] } });
  const remoteStore = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: { cards: [], annotations: [], relationships: [] } });
  const repository = createTaskExecutionRepository({ store, writerId: 'workstation', projectId: 'project-a' });
  const remote = createTaskExecutionRepository({ store: remoteStore, writerId: 'phone', projectId: 'project-a' });
  context.after(async () => {
    await Promise.all([store.flush(), remoteStore.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });

  await repository.admit({ metadata: metadata(), executorNodeId: 'workstation' });
  await remote.admit({ metadata: metadata(), executorNodeId: 'phone' });
  await store.merge(remoteStore.activeDelta());

  assert.deepEqual(repository.diagnostics(), [{
    executionId: 'execution-a',
    code: 'task_execution_conflict',
    lanes: ['lifecycle'],
    taskId: 'master-a',
  }]);
  assert.throws(() => repository.find('execution-a'), /task_execution_conflict:execution-a:lifecycle/);
  assert.deepEqual(repository.all(), []);
  assert.doesNotThrow(() => repository.all().find((record) => record.metadata.executionId === 'execution-a') ?? null);
  await assert.rejects(repository.transition('execution-a', { phase: 'queued' }), /task_execution_conflict:execution-a:lifecycle/);
});

test('concurrent execution identities for one request remain blocked as an idempotency conflict', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-request-conflict-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-request-conflict-remote-'));
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId: 'project-a', initializeLedger: { cards: [], annotations: [], relationships: [] } });
  const remoteStore = createTaskCurrentStateStore({ decisionOsRoot: remoteRoot, projectId: 'project-a', initializeLedger: { cards: [], annotations: [], relationships: [] } });
  const repository = createTaskExecutionRepository({ store, writerId: 'workstation', projectId: 'project-a' });
  const remote = createTaskExecutionRepository({ store: remoteStore, writerId: 'phone', projectId: 'project-a' });
  context.after(async () => {
    await Promise.all([store.flush(), remoteStore.flush()]);
    rmSync(root, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });

  await repository.admit({ metadata: metadata(), executorNodeId: 'workstation' });
  await remote.admit({
    metadata: metadata({ executionId: 'execution-b' }),
    executorNodeId: 'workstation',
  });
  await store.merge(remoteStore.activeDelta());

  assert.deepEqual(repository.diagnostics(), [
    { executionId: 'execution-a', code: 'task_execution_request_conflict', lanes: ['metadata'], taskId: 'master-a' },
    { executionId: 'execution-b', code: 'task_execution_request_conflict', lanes: ['metadata'], taskId: 'master-a' },
  ]);
  assert.deepEqual(repository.all(), []);
  assert.throws(() => repository.findByRequest('master-a', 'request-a'), /task_execution_request_conflict:execution-a:metadata/);
  await assert.rejects(
    repository.admit({ metadata: metadata({ executionId: 'execution-c' }), executorNodeId: 'workstation' }),
    /task_execution_request_conflict:request-a/,
  );
});

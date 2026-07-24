/**
 * WHAT: Verifies explicit post-convergence collection of session-owned execution bytes.
 * WHY: Shared hashes and permanent causal tombstones make eager per-session unlinking unsafe.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { collectExecutionArtifacts } from '../../../src/business/task-state/helper/collect-execution-artifacts.js';
import { createProjectTaskState } from '../../../src/business/task-state/helper/project-task-state.js';

function metadata(executionId: string, sessionId: string, requestedAt: string) {
  return {
    executionId,
    requestId: `request-${executionId}`,
    sessionId,
    projectId: 'project-a',
    ledgerId: 'tasks',
    taskId: `task-${executionId}`,
    sourceCardId: `task-${executionId}`,
    ownerCardId: `task-${executionId}`,
    kind: 'thread' as const,
    requestedAt,
    model: null,
    effort: null,
    pipelineRunId: null,
    pipelineStepId: null,
    pipelineSkillRunId: null,
    predecessorExecutionId: null,
    restartOfExecutionId: null,
  };
}

test('collects only retention-eligible unreferenced bytes at the recorded converged root', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-artifact-gc-'));
  const ledgerPath = resolve(root, 'tasks.json');
  const runRoot = resolve(root, 'runs', 'codex-skills', 'tasks');
  mkdirSync(runRoot, { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  const state = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: root,
    tasksLedgerFile: ledgerPath,
    initialize: true,
  });
  context.after(async () => { await state.flush(); rmSync(root, { recursive: true, force: true }); });

  const sessionA = 'codex-skill-session-a';
  const sessionB = 'codex-skill-session-b';
  const aJsonl = resolve(runRoot, `${sessionA}.jsonl`);
  const aStderr = resolve(runRoot, `${sessionA}.log`);
  const aOutput = resolve(runRoot, `${sessionA}.md`);
  const aTelemetry = `${aJsonl}.telemetry.jsonl`;
  const bJsonl = resolve(runRoot, `${sessionB}.jsonl`);
  const bStderr = resolve(runRoot, `${sessionB}.log`);
  for (const [file, bytes] of [
    [aJsonl, '{"session":"a"}\n'],
    [aStderr, 'shared stderr\n'],
    [aOutput, '# Result A\n'],
    [aTelemetry, '{"metric":"a"}\n'],
    [bJsonl, '{"session":"b"}\n'],
    [bStderr, 'shared stderr\n'],
  ]) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }

  await state.executions.admit({
    metadata: metadata('execution-a', sessionA, '2026-07-23T01:00:00.000Z'),
    executorNodeId: 'workstation',
  });
  await state.executions.transition('execution-a', { phase: 'succeeded', changedAt: '2026-07-23T01:01:00.000Z' });
  const executionA = await state.finalizeExecutionArtifacts('execution-a', {
    jsonl: aJsonl,
    stderr: aStderr,
    telemetry: aTelemetry,
  });
  await state.executions.admit({
    metadata: metadata('execution-b', sessionB, '2026-07-23T02:00:00.000Z'),
    executorNodeId: 'workstation',
  });
  await state.executions.transition('execution-b', { phase: 'succeeded', changedAt: '2026-07-23T02:01:00.000Z' });
  const executionB = await state.finalizeExecutionArtifacts('execution-b', {
    jsonl: bJsonl,
    stderr: bStderr,
  });
  assert.equal(executionA.artifacts.stderr?.hash, executionB.artifacts.stderr?.hash);

  await state.executions.deleteSession(sessionA, '2026-07-24T00:00:00.000Z');
  await state.flush();
  const convergedRoot = state.store.rootHash();
  const stateBytesBefore = JSON.stringify(state.store.activeDelta());
  const uniqueObject = resolve(
    state.store.root,
    'objects',
    executionA.artifacts.jsonl!.hash.slice(0, 2),
    executionA.artifacts.jsonl!.hash,
  );
  const sharedObject = resolve(
    state.store.root,
    'objects',
    executionA.artifacts.stderr!.hash.slice(0, 2),
    executionA.artifacts.stderr!.hash,
  );

  const early = await collectExecutionArtifacts({
    store: state.store,
    decisionOsRoot: root,
    projectId: 'project-a',
    nodeId: 'workstation',
    eligibleBefore: '2026-07-23T23:59:59.999Z',
    convergedRoot,
  });
  assert.deepEqual(early.eligibleSessionIds, []);
  assert.equal(existsSync(uniqueObject), true);
  assert.equal(existsSync(aJsonl), true);

  await assert.rejects(
    collectExecutionArtifacts({
      store: state.store,
      decisionOsRoot: root,
      projectId: 'project-a',
      nodeId: 'workstation',
      eligibleBefore: '2026-07-25T00:00:00.000Z',
      convergedRoot: 'f'.repeat(64),
    }),
    /artifact_gc_root_mismatch/,
  );

  const collected = await collectExecutionArtifacts({
    store: state.store,
    decisionOsRoot: root,
    projectId: 'project-a',
    nodeId: 'workstation',
    eligibleBefore: '2026-07-25T00:00:00.000Z',
    convergedRoot,
  });
  assert.deepEqual(collected.eligibleSessionIds, [sessionA]);
  assert.ok(collected.deletedObjectHashes.includes(executionA.artifacts.jsonl!.hash));
  assert.ok(collected.retainedObjectHashes.includes(executionA.artifacts.stderr!.hash));
  assert.equal(existsSync(uniqueObject), false);
  assert.equal(existsSync(sharedObject), true);
  assert.equal([aJsonl, aStderr, aOutput, aTelemetry].every((file) => !existsSync(file)), true);
  assert.equal(existsSync(bJsonl), true);
  assert.equal(existsSync(bStderr), true);
  assert.equal(state.store.rootHash(), convergedRoot);
  assert.equal(JSON.stringify(state.store.activeDelta()), stateBytesBefore);

  const repeated = await collectExecutionArtifacts({
    store: state.store,
    decisionOsRoot: root,
    projectId: 'project-a',
    nodeId: 'workstation',
    eligibleBefore: '2026-07-25T00:00:00.000Z',
    convergedRoot,
  });
  assert.ok(repeated.absentObjectHashes.includes(executionA.artifacts.jsonl!.hash));
  assert.equal(repeated.deletedObjectHashes.length, 0);
  assert.equal(repeated.deletedRawFiles.length, 0);
  assert.equal(state.store.rootHash(), convergedRoot);
  assert.equal(JSON.stringify(state.store.activeDelta()), stateBytesBefore);
});

test('retains every byte when replicated session deletion state is conflicted', async (context) => {
  const localRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-artifact-gc-conflict-local-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-execution-artifact-gc-conflict-remote-'));
  const localLedger = resolve(localRoot, 'tasks.json');
  const remoteLedger = resolve(remoteRoot, 'tasks.json');
  const sessionId = 'codex-skill-conflicted-session';
  const rawFile = resolve(localRoot, 'runs', 'codex-skills', 'tasks', `${sessionId}.jsonl`);
  mkdirSync(dirname(rawFile), { recursive: true });
  writeFileSync(rawFile, '{"session":"conflicted"}\n');
  writeFileSync(localLedger, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  writeFileSync(remoteLedger, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
  const local = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'workstation',
    decisionOsRoot: localRoot,
    tasksLedgerFile: localLedger,
    initialize: true,
  });
  const remote = createProjectTaskState({
    projectId: 'project-a',
    writerId: 'phone',
    decisionOsRoot: remoteRoot,
    tasksLedgerFile: remoteLedger,
    initialize: true,
  });
  context.after(async () => {
    await Promise.all([local.flush(), remote.flush()]);
    rmSync(localRoot, { recursive: true, force: true });
    rmSync(remoteRoot, { recursive: true, force: true });
  });
  const executionMetadata = metadata('execution-conflicted', sessionId, '2026-07-23T01:00:00.000Z');
  await local.executions.admit({ metadata: executionMetadata, executorNodeId: 'workstation' });
  await local.executions.transition('execution-conflicted', { phase: 'succeeded', changedAt: '2026-07-23T01:01:00.000Z' });
  const finalized = await local.finalizeExecutionArtifacts('execution-conflicted', { jsonl: rawFile });
  await remote.executions.admit({ metadata: executionMetadata, executorNodeId: 'workstation' });
  await remote.executions.transition('execution-conflicted', { phase: 'succeeded', changedAt: '2026-07-23T01:01:00.000Z' });
  await local.executions.deleteSession(sessionId, '2026-07-24T00:00:00.000Z');
  await remote.executions.deleteSession(sessionId, '2026-07-24T01:00:00.000Z');
  await local.store.merge(remote.store.activeDelta());
  await local.flush();
  const objectFile = resolve(
    local.store.root,
    'objects',
    finalized.artifacts.jsonl!.hash.slice(0, 2),
    finalized.artifacts.jsonl!.hash,
  );

  await assert.rejects(
    collectExecutionArtifacts({
      store: local.store,
      decisionOsRoot: localRoot,
      projectId: 'project-a',
      nodeId: 'workstation',
      eligibleBefore: '2026-07-25T00:00:00.000Z',
      convergedRoot: local.store.rootHash(),
    }),
    /artifact_gc_session_field_conflict:codex-session:codex-skill-conflicted-session:deletedAt/,
  );
  assert.equal(existsSync(rawFile), true);
  assert.equal(existsSync(objectFile), true);
});

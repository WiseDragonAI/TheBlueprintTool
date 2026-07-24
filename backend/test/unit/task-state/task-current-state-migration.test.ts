/**
 * WHAT: Verifies the explicit offline cutover and rollback boundary.
 * WHY: Runtime startup must accept only the new format while migration preserves the old state outside active storage.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import test from 'node:test';
import { createTaskCurrentStateStore } from '../../../src/business/task-state/helper/task-current-state-store.js';
import { migrateTaskCurrentState } from '../../../src/business/task-state/helper/task-current-state-migration.js';
import { createTaskExecutionRepository } from '../../../src/business/task-state/helper/task-execution-repository.js';

test('offline migration rejects a project identifier that can escape task-state storage', async () => {
  await assert.rejects(
    migrateTaskCurrentState({ decisionOsRoot: '/unused', projectId: '../outside', nodeId: 'workstation', tasksLedgerFile: '/unused/tasks.json' }),
    /invalid_task_migration_project_id/,
  );
});

test('offline migration installs current shards, references current content, and publishes a final format marker', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const projectId = 'project-a';
  const stateRoot = resolve(root, 'task-state', projectId);
  const cardFile = resolve(root, 'cards', 'tasks', 'card-a.md');
  const threadFile = resolve(root, 'threads', 'tasks', 'thread-card-a.md');
  const tasksFile = resolve(root, 'tasks.json');
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'threads', 'tasks'), { recursive: true });
  mkdirSync(stateRoot, { recursive: true });
  const retainedObject = Buffer.from('retained v2 object');
  const retainedObjectHash = createHash('sha256').update(retainedObject).digest('hex');
  mkdirSync(resolve(stateRoot, 'objects', retainedObjectHash.slice(0, 2)), { recursive: true });
  writeFileSync(resolve(stateRoot, 'objects', retainedObjectHash.slice(0, 2), retainedObjectHash), retainedObject);
  writeFileSync(cardFile, '#master-task #task-active\n\nWaiting since: 2026-07-20T10:00:00.000Z\n\nMigrated body\n\n## B. Subtasks\n\n1. [Child](card:child-a)\n');
  writeFileSync(threadFile, '# OPERATOR\n<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-21T00:00:00.000Z"} -->\n\nMigrated note.\n');
  const ledger = {
    cards: [
      { id: 'card-a', title: 'Migrated', labels: ['master-task'], comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } },
      { id: 'child-a', title: 'Child', labels: ['subtask'] },
    ],
    annotations: [], relationships: [{ id: 'relationship-a', from: 'card-a', to: 'child-a', label: 'subtask' }],
    threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' },
    deletedNoteIds: { 'thread-card-a': ['note-a', 'genuinely-deleted'] },
  };
  writeFileSync(tasksFile, JSON.stringify(ledger));
  writeFileSync(resolve(stateRoot, 'projection.json'), JSON.stringify({ version: 2, projectId, ledger, conflicts: [] }));
  writeFileSync(resolve(stateRoot, 'old-event-segment.jsonl'), '{}\n');
  const result = await migrateTaskCurrentState({ decisionOsRoot: root, projectId, nodeId: 'workstation', tasksLedgerFile: tasksFile });
  context.after(() => rmSync(resolve(root, '..', `${basename(root)}-task-state-rollback`), { recursive: true, force: true }));
  assert.equal(existsSync(resolve(result.backup, 'projects', projectId, 'decision-os', 'task-state', projectId, 'old-event-segment.jsonl')), true);
  assert.equal(existsSync(resolve(result.backup, 'projects', projectId, 'decision-os', 'tasks.json')), true);
  assert.equal(existsSync(resolve(result.root, 'format.json')), true);
  assert.equal(existsSync(resolve(result.root, 'old-event-segment.jsonl')), false);
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  const cards = store.projection().ledger.cards as Array<Record<string, unknown>>;
  assert.equal(cards.find((card) => card.id === 'card-a')?.title, 'Migrated');
  assert.equal((cards.find((card) => card.id === 'card-a')?.lifecycle as Record<string, unknown>).waitingAt, '2026-07-20T10:00:00.000Z');
  assert.deepEqual(cards.find((card) => card.id === 'child-a')?.labels, []);
  assert.equal((store.projection().ledger.relationships as Array<Record<string, unknown>>)[0].position, 0);
  const head = store.contentHeads('.decision-os/cards/tasks/card-a.md')[0];
  assert.ok(head.hash);
  assert.equal(existsSync(resolve(result.root, 'objects', head.hash.slice(0, 2), head.hash)), false);
  const rewrittenBody = readFileSync(resolve(root, 'cards', 'tasks', 'card-a.md'), 'utf8');
  assert.match(rewrittenBody, /Migrated body/);
  assert.doesNotMatch(rewrittenBody, /Waiting since:|## B\. Subtasks|#task-active/);
  const note = (store.projection().ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-card-a'][0];
  assert.equal(note.message, undefined);
  assert.equal(note.timestamp, '2026-07-21T00:00:00.000Z');
  const threadHead = store.contentHeads('.decision-os/threads/tasks/thread-card-a.md')[0];
  assert.ok(threadHead.hash);
  assert.equal(existsSync(resolve(result.root, 'objects', threadHead.hash.slice(0, 2), threadHead.hash)), false);
  assert.match(readFileSync(threadFile, 'utf8'), /Migrated note\./);
  const report = JSON.parse(readFileSync(result.report, 'utf8')) as Record<string, any>;
  assert.equal(report.semanticInventory.cards, 2);
  assert.equal(report.semanticInventory.notes, 1);
  assert.equal(report.semanticInventory.deletions, 1);
  assert.equal(report.semanticInventory.entityDeletions, 1);
  assert.equal(report.semanticInventory.resourceHeads, 2);
  assert.deepEqual(report.objectInventory, { referencedObjects: 2, installedObjects: 0, installedBytes: 0, referencedWorkspaceBytes: 136 });
  assert.equal(existsSync(resolve(result.root, 'objects', retainedObjectHash.slice(0, 2), retainedObjectHash)), false);
  assert.deepEqual(report.recoveredNoteDeletions, [{ threadId: 'thread-card-a', noteId: 'note-a' }]);
  assert.equal(report.sourceValueAudit.find((entry: Record<string, unknown>) => entry.cardId === 'card-a').waitingAtSource, 'card-markdown');
  assert.match(report.canonicalProjectionChecksum, /^[a-f0-9]{64}$/);
});

test('epoch-3 removed ledger fields become causal tombstones when their presence lane remained set', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-removed-ledger-field-migration-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => [root, rollbackRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const stateRoot = resolve(root, 'task-state', projectId);
  const entityId = 'tasks:threadFiles/thread-obsolete';
  const path = 'threadFiles/thread-obsolete';
  const tasksFile = resolve(root, 'tasks.json');
  mkdirSync(resolve(stateRoot, 'current', 'ledger'), { recursive: true });
  writeFileSync(tasksFile, JSON.stringify({ cards: [], annotations: [], relationships: [], threadFiles: {} }));
  writeFileSync(resolve(stateRoot, 'format.json'), JSON.stringify({
    stateProtocol: 'decision-os-task-state/3',
    stateSchema: 3,
    baselineEpoch: 3,
    projectId,
    baselineRoot: 'epoch-3-root',
  }));
  writeFileSync(resolve(stateRoot, 'current', 'ledger', `${encodeURIComponent(entityId)}.json`), JSON.stringify({
    version: 3,
    projectId,
    entityType: 'ledger',
    entityId,
    fields: {
      $entity: {
        clock: { workstation: 7 },
        candidates: [{ dot: { replicaId: 'workstation', counter: 7 }, operation: 'set', value: true }],
      },
      [path]: {
        clock: { workstation: 7 },
        candidates: [{ dot: { replicaId: 'workstation', counter: 7 }, operation: 'remove' }],
      },
    },
    stateHash: 'legacy',
  }));

  const result = await migrateTaskCurrentState({
    decisionOsRoot: root,
    projectId,
    nodeId: 'workstation',
    tasksLedgerFile: tasksFile,
    backupRoot: rollbackRoot,
  });
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  const presence = store.entity('ledger', entityId)?.fields.$entity;
  assert.equal(presence?.candidates[0].operation, 'tombstone');
  assert.equal((store.projection().ledger.threadFiles as Record<string, unknown> | undefined)?.['thread-obsolete'], undefined);
  assert.equal(JSON.parse(readFileSync(result.report, 'utf8')).semanticInventory.entityDeletions, 1);
});

test('epoch-3 migration assigns master tasks and collapses every legacy execution authority into epoch-4 entities', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-epoch4-execution-migration-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => [root, rollbackRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const stateRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const stdoutFile = resolve(root, 'runs', 'direct.jsonl');
  const stderrFile = resolve(root, 'runs', 'direct.log');
  mkdirSync(resolve(root, 'runs'), { recursive: true });
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(stdoutFile, '{"type":"turn.started"}\n');
  writeFileSync(stderrFile, 'legacy stderr\n');
  const ledger = {
    cards: [
      {
        id: 'master-a',
        title: 'Master',
        labels: ['master-task'],
        executionIntent: { id: 'intent-execution', state: 'running', changedAt: '2026-07-22T03:00:00.000Z', startedAt: '2026-07-22T03:00:00.000Z' },
        codexActiveRunId: 'intent-session',
        codexActiveExecutionId: 'intent-execution',
        codexThreadRunId: 'intent-session',
        codexThreadRunIds: ['historic-session', 'intent-session'],
        codexThreadRunOutputFiles: { 'historic-session': stdoutFile },
      },
      { id: 'child-a', title: 'Child', labels: ['subtask'] },
    ],
    annotations: [],
    relationships: [{ id: 'subtask-a', from: 'master-a', to: 'child-a', label: 'subtask', position: 0 }],
  };
  writeFileSync(tasksFile, JSON.stringify(ledger));
  writeFileSync(resolve(stateRoot, 'format.json'), JSON.stringify({
    stateProtocol: 'decision-os-task-state/3',
    stateSchema: 3,
    baselineEpoch: 3,
    projectId,
    baselineRoot: 'epoch-3-root',
  }));
  writeFileSync(resolve(stateRoot, 'projection.json'), JSON.stringify({ version: 3, projectId, ledger, conflicts: [] }));
  writeFileSync(resolve(root, 'codex-executions.json'), JSON.stringify({
    version: 1,
    projectId,
    updatedAt: '2026-07-22T02:00:00.000Z',
    executions: [{
      executionId: 'direct-execution',
      sessionId: 'direct-session',
      projectId,
      ledgerId: 'tasks',
      taskId: 'master-a',
      ownerCardId: 'master-a',
      kind: 'thread',
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      phase: 'running',
      requestedAt: '2026-07-22T01:00:00.000Z',
      phaseSince: '2026-07-22T01:01:00.000Z',
      startedAt: '2026-07-22T01:01:00.000Z',
      finishedAt: null,
      executorNodeId: 'workstation',
      processId: 42,
      processStartTime: 'legacy-process',
      stdoutFile,
      stderrFile,
      result: null,
      error: null,
      revision: 4,
    }, {
      executionId: 'deleted-task-execution',
      sessionId: 'deleted-task-session',
      projectId,
      ledgerId: 'tasks',
      taskId: 'deleted-task',
      ownerCardId: 'deleted-task',
      kind: 'thread',
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      phase: 'cancelled',
      requestedAt: '2026-07-21T01:00:00.000Z',
      phaseSince: '2026-07-21T01:01:00.000Z',
      startedAt: null,
      finishedAt: '2026-07-21T01:01:00.000Z',
      executorNodeId: null,
      processId: null,
      processStartTime: null,
      stdoutFile: null,
      stderrFile: null,
      result: { status: 'cancelled', summary: 'Task was deleted after cancellation.' },
      error: null,
      revision: 2,
    }],
  }));
  writeFileSync(resolve(root, 'codex-process-queue.json'), JSON.stringify({
    version: 1,
    items: [{
      id: 'direct-session',
      kind: 'thread',
      status: 'running',
      createdAt: '2026-07-22T01:00:00.000Z',
      startedAt: '2026-07-22T01:01:00.000Z',
      interruptedAt: null,
      interruptionReason: '',
      processId: 42,
      processStartTime: 'legacy-process',
      stdoutFile,
      stderrFile,
      payload: { ledgerId: 'tasks', cardId: 'master-a', runId: 'direct-session', executionId: 'direct-execution' },
    }],
  }));
  writeFileSync(resolve(root, 'codex-pipelines.json'), JSON.stringify({
    version: 1,
    pipelines: [],
    steps: [],
    skillLibrary: [],
    activeWorkspaceRun: 'pipeline-run',
    runs: [{
      id: 'pipeline-run',
      pipelineId: null,
      pipelineName: 'Legacy pipeline',
      temporary: true,
      executionMode: 'local',
      ledgerId: 'tasks',
      sourceCardId: 'master-a',
      sourceCardTitle: 'Master',
      status: 'running',
      createdAt: '2026-07-22T02:00:00.000Z',
      updatedAt: '2026-07-22T02:10:00.000Z',
      startedAt: '2026-07-22T02:00:00.000Z',
      finishedAt: null,
      resumedAt: null,
      error: '',
      steps: [{
        id: 'pipeline-step',
        stepId: 'step-a',
        name: 'Step A',
        purpose: '',
        outputCardId: 'child-a',
        status: 'running',
        startedAt: '2026-07-22T02:00:00.000Z',
        finishedAt: null,
        error: '',
        skills: [
          {
            id: 'skill-a',
            pipelineSkillId: 'skill-a',
            skillName: 'analysis',
            runId: 'pipeline-skill-a',
            executionId: 'pipeline-execution-a',
            status: 'complete',
            codexModel: 'gpt-5.6-sol',
            codexEffort: 'medium',
            stdoutFile: '',
            stderrFile: '',
            startedAt: '2026-07-22T02:00:00.000Z',
            finishedAt: '2026-07-22T02:05:00.000Z',
            error: '',
          },
          {
            id: 'skill-b',
            pipelineSkillId: 'skill-b',
            skillName: 'implementation',
            runId: 'pipeline-skill-b',
            executionId: 'pipeline-execution-b',
            status: 'pending',
            codexModel: 'gpt-5.6-sol',
            codexEffort: 'high',
            stdoutFile: '',
            stderrFile: '',
            startedAt: null,
            finishedAt: null,
            error: '',
          },
        ],
      }],
    }],
  }));

  const result = await migrateTaskCurrentState({
    decisionOsRoot: root,
    projectId,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    tasksLedgerFile: tasksFile,
    backupRoot: rollbackRoot,
  });

  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  const cards = store.projection().ledger.cards as Array<Record<string, any>>;
  assert.deepEqual(cards.find((card) => card.id === 'master-a')?.assignment, { nodeId: 'workstation', changedAt: '1970-01-01T00:00:00.000Z', revision: 1 });
  assert.equal(cards.find((card) => card.id === 'child-a')?.assignment, undefined);
  assert.equal(cards.find((card) => card.id === 'master-a')?.executionIntent, undefined);
  assert.equal(cards.find((card) => card.id === 'master-a')?.codexActiveExecutionId, undefined);
  assert.equal((store.entity('execution', 'direct-execution')?.fields.lifecycle.candidates[0].value as Record<string, unknown>).phase, 'interrupted');
  assert.equal((store.entity('execution', 'pipeline-execution-a')?.fields.lifecycle.candidates[0].value as Record<string, unknown>).phase, 'succeeded');
  assert.equal((store.entity('execution', 'pipeline-execution-b')?.fields.lifecycle.candidates[0].value as Record<string, unknown>).phase, 'interrupted');
  assert.equal((store.entity('execution', 'pipeline-execution-b')?.fields.metadata.candidates[0].value as Record<string, unknown>).predecessorExecutionId, 'pipeline-execution-a');
  assert.equal((store.entity('execution', 'historic-session:execution:0')?.fields.lifecycle.candidates[0].value as Record<string, unknown>).phase, 'interrupted');
  const executions = createTaskExecutionRepository({ store, writerId: 'workstation', projectId });
  assert.equal(executions.all().length, 6, JSON.stringify(executions.diagnostics()));
  assert.equal(executions.byTaskId('master-a').length, 5);
  assert.equal(executions.byTaskId('deleted-task').length, 1);
  assert.equal(executions.byPipelineRunId('pipeline-run').length, 2);
  assert.equal(executions.byPhase('interrupted').length, 4);
  assert.equal(executions.byExecutorNodeId('workstation').length, 6);
  assert.deepEqual(executions.diagnostics(), []);
  const artifact = (store.entity('execution', 'direct-execution')?.fields.artifacts.candidates[0].value as Record<string, any>).jsonl;
  assert.equal(readFileSync(resolve(result.root, 'objects', artifact.hash.slice(0, 2), artifact.hash), 'utf8'), '{"type":"turn.started"}\n');
  assert.equal(existsSync(resolve(root, 'codex-executions.json')), false);
  assert.equal(existsSync(resolve(root, 'codex-process-queue.json')), false);
  assert.deepEqual(JSON.parse(readFileSync(resolve(root, 'codex-pipelines.json'), 'utf8')).runs, []);
  assert.equal(existsSync(resolve(result.backup, 'projects', projectId, 'decision-os', 'codex-executions.json')), true);
  assert.equal(existsSync(resolve(result.backup, 'projects', projectId, 'decision-os', 'codex-process-queue.json')), true);
  const report = JSON.parse(readFileSync(result.report, 'utf8')) as Record<string, any>;
  assert.deepEqual(
    { stateProtocol: report.stateProtocol, stateSchema: report.stateSchema, baselineEpoch: report.baselineEpoch },
    { stateProtocol: 'decision-os-task-state/4', stateSchema: 4, baselineEpoch: 4 },
  );
  assert.deepEqual(report.assignmentCoverage, { assignedTasks: 1, inheritedSubtasks: 1, missingAssignments: [] });
  assert.equal(report.executionMigration.executionCount, 6);
  assert.equal(report.executionMigration.interruptedCount, 4);
  assert.equal(report.executionMigration.artifactCount, 2);
  assert.deepEqual(report.executionMigration.retainedDeletedTaskIds, ['deleted-task']);
  assert.equal(report.missingObjects, 0);
  assert.equal(report.journalCount, 0);
});

test('migration preflight rejects broken subtask ownership before writing or backing up files', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-preflight-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(rollbackRoot, { recursive: true, force: true });
  });
  const projectId = 'project-a';
  const stateRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const ledger = {
    cards: [{ id: 'master-a', title: 'Master', labels: ['master-task'] }],
    annotations: [],
    relationships: [{ id: 'broken', from: 'master-a', to: 'missing-child', label: 'subtask' }],
  };
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(tasksFile, JSON.stringify(ledger));
  writeFileSync(resolve(stateRoot, 'projection.json'), JSON.stringify({ version: 2, projectId, ledger, conflicts: [] }));
  const beforeLedger = readFileSync(tasksFile, 'utf8');
  const beforeProjection = readFileSync(resolve(stateRoot, 'projection.json'), 'utf8');

  await assert.rejects(migrateTaskCurrentState({ decisionOsRoot: root, projectId, nodeId: 'workstation', tasksLedgerFile: tasksFile, backupRoot: rollbackRoot }), /invalid_subtask_relationships:broken/);

  assert.equal(readFileSync(tasksFile, 'utf8'), beforeLedger);
  assert.equal(readFileSync(resolve(stateRoot, 'projection.json'), 'utf8'), beforeProjection);
  assert.equal(existsSync(rollbackRoot), false);
});

test('migration preserves corrupt execution evidence byte-identically and performs no partial cutover', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-corrupt-execution-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => [root, rollbackRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const tasksFile = resolve(root, 'tasks.json');
  const corruptExecutionFile = resolve(root, 'codex-executions.json');
  const corruptBytes = '{"version":1,"executions":[';
  writeFileSync(tasksFile, JSON.stringify({ cards: [{ id: 'master-a', title: 'Master' }], annotations: [], relationships: [] }));
  writeFileSync(corruptExecutionFile, corruptBytes);

  await assert.rejects(migrateTaskCurrentState({
    decisionOsRoot: root,
    projectId,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    tasksLedgerFile: tasksFile,
    backupRoot: rollbackRoot,
  }), /Could not read the canonical Codex execution store/);

  assert.equal(readFileSync(corruptExecutionFile, 'utf8'), corruptBytes);
  assert.equal(existsSync(resolve(root, 'task-state', projectId, 'format.json')), false);
  assert.equal(existsSync(rollbackRoot), false);
});

test('migration refuses to publish epoch 3 when a retained resource head has no collected object', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-missing-object-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(rollbackRoot, { recursive: true, force: true });
  });
  const projectId = 'project-a';
  const stateRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const missingHash = createHash('sha256').update('missing').digest('hex');
  mkdirSync(resolve(stateRoot, 'current', 'resource'), { recursive: true });
  writeFileSync(resolve(stateRoot, 'format.json'), JSON.stringify({ version: 2, projectId, baselineRoot: 'legacy' }));
  writeFileSync(resolve(stateRoot, 'current', 'resource', 'missing.json'), JSON.stringify({
    version: 2, projectId, entityType: 'resource', entityId: '.decision-os/files/missing.bin', replication: 'active', stateHash: 'legacy',
    fields: { head: { clock: { desktop: 1 }, candidates: [{ dot: { replicaId: 'desktop', counter: 1 }, operation: 'set', value: { type: 'managed-asset', key: '.decision-os/files/missing.bin', hash: missingHash, bytes: 7, changedAt: '2026-07-21T00:00:00.000Z' } }] } },
  }));
  writeFileSync(tasksFile, JSON.stringify({ cards: [], annotations: [], relationships: [] }));

  await assert.rejects(migrateTaskCurrentState({ decisionOsRoot: root, projectId, nodeId: 'workstation', tasksLedgerFile: tasksFile, backupRoot: rollbackRoot }), /missing_migrated_task_content_object/);

  assert.equal(JSON.parse(readFileSync(resolve(stateRoot, 'format.json'), 'utf8')).version, 2);
  assert.equal(existsSync(rollbackRoot), true);
});

test('migration joins epoch-3 current entities from every writable node before encoding epoch 4', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-union-'));
  const remoteRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-remote-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => [root, remoteRoot, rollbackRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const activeRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const entity = (replicaId: string, fields: Record<string, unknown>, entityType = 'card', entityId = 'card-a') => ({
    version: 3,
    projectId,
    entityType,
    entityId,
    fields: Object.fromEntries(Object.entries(fields).map(([path, value]) => [path, { clock: { [replicaId]: 1 }, candidates: [{ dot: { replicaId, counter: 1 }, operation: 'set', value }] }])),
    replication: 'active',
    stateHash: 'legacy',
  });
  mkdirSync(resolve(activeRoot, 'current', 'card'), { recursive: true });
  mkdirSync(resolve(activeRoot, 'current', 'resource'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'card'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'ledger'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'resource'), { recursive: true });
  mkdirSync(resolve(remoteRoot, 'current', 'thread-note'), { recursive: true });
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'threads', 'tasks'), { recursive: true });
  const localKey = '.decision-os/cards/tasks/card-a.md';
  const localBody = Buffer.from('Current workstation body.\n');
  const staleLocalBody = Buffer.from('Stale baseline body.\n');
  const staleLocalHash = createHash('sha256').update(staleLocalBody).digest('hex');
  mkdirSync(resolve(activeRoot, 'objects', staleLocalHash.slice(0, 2)), { recursive: true });
  writeFileSync(resolve(activeRoot, 'objects', staleLocalHash.slice(0, 2), staleLocalHash), staleLocalBody);
  writeFileSync(resolve(root, 'cards', 'tasks', 'card-a.md'), localBody);
  writeFileSync(resolve(activeRoot, 'format.json'), JSON.stringify({
    stateProtocol: 'decision-os-task-state/3',
    stateSchema: 3,
    baselineEpoch: 3,
    projectId,
    baselineRoot: 'legacy-a',
  }));
  writeFileSync(resolve(activeRoot, 'current', 'card', 'card-a.json'), JSON.stringify(entity('desktop', { title: 'Joined title', labels: ['master-task'], comment: { contentFile: localKey } })));
  writeFileSync(resolve(activeRoot, 'current', 'resource', 'stale-local.json'), JSON.stringify(entity('baseline-content', {
    head: { type: 'card-markdown', key: localKey, hash: staleLocalHash, bytes: staleLocalBody.byteLength, changedAt: '2026-07-20T00:00:00.000Z' },
  }, 'resource', localKey)));
  writeFileSync(resolve(remoteRoot, 'current', 'card', 'card-a.json'), JSON.stringify(entity('mobile', { status: 'done' })));
  writeFileSync(resolve(remoteRoot, 'current', 'card', 'deleted-card.json'), JSON.stringify({
    version: 3, projectId, entityType: 'card', entityId: 'deleted-card',
    fields: { $entity: { clock: { mobile: 1 }, candidates: [{ dot: { replicaId: 'mobile', counter: 1 }, operation: 'tombstone' }] } }, replication: 'active', stateHash: 'legacy',
  }));
  const remoteObject = Buffer.from('remote-only immutable object');
  const remoteHash = createHash('sha256').update(remoteObject).digest('hex');
  const remoteKey = '.decision-os/files/remote-only.bin';
  mkdirSync(resolve(remoteRoot, 'objects', remoteHash.slice(0, 2)), { recursive: true });
  writeFileSync(resolve(remoteRoot, 'objects', remoteHash.slice(0, 2), remoteHash), remoteObject);
  writeFileSync(resolve(remoteRoot, 'current', 'resource', 'remote-only.json'), JSON.stringify(entity('mobile', {
    head: { type: 'managed-asset', key: remoteKey, hash: remoteHash, bytes: remoteObject.byteLength, changedAt: '2026-07-21T00:00:00.000Z' },
  }, 'resource', remoteKey)));
  const threadId = 'thread-card-a';
  const noteId = 'note-recovered';
  writeFileSync(resolve(root, 'threads', 'tasks', `${threadId}.md`), `# OPERATOR\n<!-- decision-os:note {"id":"${noteId}","timestamp":"2026-07-21T01:00:00.000Z"} -->\n\nRecovered from sidecar.\n`);
  writeFileSync(resolve(remoteRoot, 'current', 'ledger', 'thread-file.json'), JSON.stringify(entity('mobile', {
    [`threadFiles/${threadId}`]: `.decision-os/threads/tasks/${threadId}.md`,
  }, 'ledger', `tasks:threadFiles/${threadId}`)));
  writeFileSync(resolve(remoteRoot, 'current', 'thread-note', `${encodeURIComponent(`${threadId}/${noteId}`)}.json`), JSON.stringify({
    version: 3, projectId, entityType: 'thread-note', entityId: `${threadId}/${noteId}`,
    fields: { $entity: { clock: { workstation: 17 }, candidates: [{ dot: { replicaId: 'workstation', counter: 17 }, operation: 'tombstone' }] } }, replication: 'active', stateHash: 'legacy',
  }));
  writeFileSync(tasksFile, JSON.stringify({
    cards: [{ id: 'card-a', title: 'Stale ledger', status: 'backlog' }], annotations: [], relationships: [],
    threadFiles: { [threadId]: `.decision-os/threads/tasks/${threadId}.md` },
  }));

  const result = await migrateTaskCurrentState({ decisionOsRoot: root, projectId, nodeId: 'workstation', tasksLedgerFile: tasksFile, backupRoot: rollbackRoot, sourceStateRoots: [remoteRoot] });
  const report = JSON.parse(readFileSync(result.report, 'utf8')) as Record<string, any>;

  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  const card = (store.projection().ledger.cards as Array<Record<string, any>>)[0];
  assert.equal(card.title, 'Joined title');
  assert.equal(card.lifecycle.status, 'done');
  assert.equal(existsSync(resolve(result.backup, 'projects', projectId, 'source-state-roots', '1', 'current', 'card', 'card-a.json')), true);
  assert.equal(store.entity('card', 'deleted-card')?.fields.$entity.candidates[0].operation, 'tombstone');
  assert.equal(store.entity('card', 'deleted-card')?.fields.$entity.clock.mobile, 1);
  assert.deepEqual(store.contentHeads(localKey).map((head) => ({ sourceReplicaId: head.sourceReplicaId, hash: head.hash })), [{ sourceReplicaId: 'workstation', hash: createHash('sha256').update(localBody).digest('hex') }]);
  assert.equal(store.contentHeads(remoteKey)[0].hash, remoteHash);
  assert.equal(readFileSync(resolve(result.root, 'objects', remoteHash.slice(0, 2), remoteHash), 'utf8'), remoteObject.toString());
  const recoveredPresence = store.entity('thread-note', `${threadId}/${noteId}`)?.fields.$entity;
  assert.equal(recoveredPresence?.clock.workstation, 18);
  assert.equal(recoveredPresence?.candidates[0].operation, 'set');
  assert.deepEqual((store.projection().ledger.deletedNoteIds as Record<string, string[]>)[threadId], []);
  assert.equal(report.sourceEntityInventory.resource, 2);
  assert.equal(report.sourceEntityInventory.card, 2);
  assert.equal(report.baselineCounter, 18);
  assert.equal(report.currentEntityInventory.resource, 3);
  assert.equal(report.semanticInventory.entityDeletions, 1);
});

test('migration preserves projection-only node entities, conflicts, notes, and content heads beside current shards', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-projection-union-'));
  const phoneRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-phone-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => [root, phoneRoot, rollbackRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const activeRoot = resolve(root, 'task-state', projectId);
  const phoneStateRoot = resolve(phoneRoot, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const sharedCardRef = '.decision-os/cards/tasks/shared-card.md';
  const phoneCardRef = '.decision-os/cards/tasks/phone-only.md';
  const phoneThreadRef = '.decision-os/threads/tasks/thread-phone-only.md';
  const localSharedBody = Buffer.from('Workstation body.\n');
  const phoneSharedBody = Buffer.from('Phone body.\n');
  const phoneCardBody = Buffer.from('#task-active\n\nWaiting since: 2026-07-20T10:00:00.000Z\n\nPhone-only body.\n');
  const phoneThreadBody = Buffer.from('# OPERATOR\n<!-- decision-os:note {"id":"phone-note","timestamp":"2026-07-21T01:00:00.000Z"} -->\n\nPhone-only note.\n');
  const resource = (key: string, bytes: Buffer, type: 'card-markdown' | 'thread-markdown') => ({ type, key, hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength, changedAt: '2026-07-21T01:00:00.000Z' });
  const resources = [resource(sharedCardRef, phoneSharedBody, 'card-markdown'), resource(phoneCardRef, phoneCardBody, 'card-markdown'), resource(phoneThreadRef, phoneThreadBody, 'thread-markdown')];
  const currentEntity = {
    version: 2, projectId, entityType: 'card', entityId: 'shared-card', replication: 'active', stateHash: 'legacy',
    fields: {
      title: { clock: { workstation: 1 }, candidates: [{ dot: { replicaId: 'workstation', counter: 1 }, operation: 'set', value: 'Workstation title' }] },
      comment: { clock: { workstation: 1 }, candidates: [{ dot: { replicaId: 'workstation', counter: 1 }, operation: 'set', value: { contentFile: sharedCardRef } }] },
    },
  };
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  writeFileSync(resolve(root, 'cards', 'tasks', 'shared-card.md'), localSharedBody);
  mkdirSync(resolve(activeRoot, 'current', 'card'), { recursive: true });
  writeFileSync(resolve(activeRoot, 'format.json'), JSON.stringify({ version: 2, projectId, baselineRoot: 'legacy' }));
  writeFileSync(resolve(activeRoot, 'current', 'card', 'shared-card.json'), JSON.stringify(currentEntity));
  writeFileSync(tasksFile, JSON.stringify({ cards: [{ id: 'shared-card', title: 'Stale title' }], annotations: [], relationships: [] }));
  mkdirSync(phoneStateRoot, { recursive: true });
  writeFileSync(resolve(phoneStateRoot, 'projection.json'), JSON.stringify({
    version: 1,
    projectId,
    sourceNodeId: 'phone',
    ledger: {
      cards: [
        { id: 'shared-card', title: 'Phone title', comment: { contentFile: sharedCardRef } },
        { id: 'phone-only', title: 'Phone only', comment: { contentFile: phoneCardRef } },
      ],
      annotations: [{ id: 'phone-zone', label: 'Phone zone', x: 0, y: 0, width: 100, height: 100 }],
      relationships: [{ id: 'phone-relationship', from: 'shared-card', to: 'phone-only', label: 'subtask' }],
      threadFiles: { 'thread-phone-only': phoneThreadRef },
    },
    conflicts: [],
  }));
  writeFileSync(resolve(phoneStateRoot, 'content-manifest.json'), JSON.stringify({ version: 1, projectId, generatedAt: '2026-07-21T01:00:00.000Z', complete: true, resources }));
  for (const [entry, bytes] of [[resources[0], phoneSharedBody], [resources[1], phoneCardBody], [resources[2], phoneThreadBody]] as const) {
    mkdirSync(resolve(phoneStateRoot, 'objects', entry.hash.slice(0, 2)), { recursive: true });
    writeFileSync(resolve(phoneStateRoot, 'objects', entry.hash.slice(0, 2), entry.hash), bytes);
  }

  const result = await migrateTaskCurrentState({ decisionOsRoot: root, projectId, nodeId: 'workstation', tasksLedgerFile: tasksFile, backupRoot: rollbackRoot, sourceStateRoots: [phoneStateRoot] });
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  const projection = store.projection();
  assert.equal((projection.ledger.cards as Array<Record<string, unknown>>).some((card) => card.id === 'phone-only'), true);
  assert.equal((projection.ledger.annotations as Array<Record<string, unknown>>).some((zone) => zone.id === 'phone-zone'), true);
  assert.equal((projection.ledger.relationships as Array<Record<string, unknown>>).find((relationship) => relationship.id === 'phone-relationship')?.position, 0);
  assert.equal((projection.ledger.threadFiles as Record<string, string>)['thread-phone-only'], phoneThreadRef);
  assert.equal(((projection.ledger.notes as Record<string, Array<Record<string, unknown>>>)['thread-phone-only'][0]).id, 'phone-note');
  const titleConflict = projection.conflicts.find((conflict) => conflict.entityType === 'card' && conflict.entityId === 'shared-card' && conflict.path === 'title');
  assert.deepEqual(new Set(titleConflict?.candidates.map((candidate) => candidate.value)), new Set(['Workstation title', 'Phone title']));
  const phoneHead = store.contentHeads(phoneCardRef).find((head) => readFileSync(resolve(result.root, 'objects', head.hash.slice(0, 2), head.hash), 'utf8').includes('Phone-only body.'));
  assert.ok(phoneHead);
  assert.doesNotMatch(readFileSync(resolve(result.root, 'objects', phoneHead.hash.slice(0, 2), phoneHead.hash), 'utf8'), /Waiting since:|#task-active/);
  assert.match(readFileSync(resolve(root, 'cards', 'tasks', 'phone-only.md'), 'utf8'), /Phone-only body/);
  const sharedHeads = store.contentHeads(sharedCardRef);
  assert.deepEqual(new Set(sharedHeads.map((head) => head.hash)), new Set([
    createHash('sha256').update(localSharedBody).digest('hex'),
    createHash('sha256').update(phoneSharedBody).digest('hex'),
  ]));
  assert.deepEqual(new Set(sharedHeads.map((head) => head.sourceReplicaId)), new Set(['workstation', 'phone']));
  const localSharedHead = sharedHeads.find((head) => head.sourceReplicaId === 'workstation')!;
  const phoneSharedHead = sharedHeads.find((head) => head.sourceReplicaId === 'phone')!;
  assert.equal(existsSync(resolve(result.root, 'objects', localSharedHead.hash.slice(0, 2), localSharedHead.hash)), false);
  assert.equal(existsSync(resolve(result.root, 'objects', phoneSharedHead.hash.slice(0, 2), phoneSharedHead.hash)), true);
  const report = JSON.parse(readFileSync(result.report, 'utf8')) as Record<string, any>;
  assert.deepEqual(report.projectionSources, [{ sourceNodeId: 'phone', entityCount: 6, resourceCount: 3 }]);
});

test('independent node migrations converge and retain routable content sources', async (context) => {
  const workstationRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-independent-workstation-'));
  const phoneRoot = mkdtempSync(resolve(tmpdir(), 'decision-os-independent-phone-'));
  context.after(() => [workstationRoot, phoneRoot, `${workstationRoot}-rollback`, `${phoneRoot}-rollback`].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'shared-project';
  const sharedRef = '.decision-os/cards/tasks/shared.md';
  const workstationOnlyRef = '.decision-os/cards/tasks/workstation-only.md';
  const phoneOnlyRef = '.decision-os/cards/tasks/phone-only.md';
  const prepareNode = (root: string, sharedTitle: string, uniqueId: string, uniqueRef: string): string => {
    mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
    writeFileSync(resolve(root, sharedRef.replace(/^\.decision-os\//, '')), `${sharedTitle} body.\n`);
    writeFileSync(resolve(root, uniqueRef.replace(/^\.decision-os\//, '')), `${uniqueId} body.\n`);
    const tasksFile = resolve(root, 'tasks.json');
    writeFileSync(tasksFile, JSON.stringify({
      cards: [
        {
          id: 'shared',
          title: sharedTitle,
          executionIntent: { id: 'shared-execution', state: 'queued', changedAt: '2026-07-22T00:00:00.000Z' },
          comment: { contentFile: sharedRef },
        },
        { id: uniqueId, title: uniqueId, comment: { contentFile: uniqueRef } },
      ],
      annotations: [], relationships: [],
    }));
    return tasksFile;
  };
  const workstationTasks = prepareNode(workstationRoot, 'Workstation title', 'workstation-only', workstationOnlyRef);
  const phoneTasks = prepareNode(phoneRoot, 'Phone title', 'phone-only', phoneOnlyRef);
  const workstationResult = await migrateTaskCurrentState({ decisionOsRoot: workstationRoot, projectId, nodeId: 'workstation', tasksLedgerFile: workstationTasks, backupRoot: `${workstationRoot}-rollback` });
  const phoneResult = await migrateTaskCurrentState({ decisionOsRoot: phoneRoot, projectId, nodeId: 'phone', tasksLedgerFile: phoneTasks, backupRoot: `${phoneRoot}-rollback` });
  const workstation = createTaskCurrentStateStore({ decisionOsRoot: workstationRoot, projectId });
  const phone = createTaskCurrentStateStore({ decisionOsRoot: phoneRoot, projectId });

  await workstation.merge(phone.activeDelta());
  await phone.merge(workstation.activeDelta());
  await Promise.all([workstation.flush(), phone.flush()]);

  assert.equal(workstation.rootHash(), phone.rootHash());
  assert.equal((workstation.entity('execution', 'shared-execution')?.fields.lifecycle.candidates[0].value as Record<string, unknown>).phase, 'interrupted');
  assert.equal(workstation.projection().conflicts.some((conflict) => conflict.entityType === 'execution' && conflict.entityId === 'shared-execution'), false);
  assert.deepEqual(new Set((workstation.projection().ledger.cards as Array<Record<string, unknown>>).map((card) => card.id)), new Set(['shared', 'workstation-only', 'phone-only']));
  const titleConflict = workstation.projection().conflicts.find((conflict) => conflict.entityType === 'card' && conflict.entityId === 'shared' && conflict.path === 'title');
  assert.deepEqual(new Set(titleConflict?.candidates.map((candidate) => candidate.value)), new Set(['Workstation title', 'Phone title']));
  assert.deepEqual(new Set(workstation.contentHeads(sharedRef).map((head) => head.sourceReplicaId)), new Set(['workstation', 'phone']));
  const phoneOnlyHead = workstation.contentHeads(phoneOnlyRef)[0];
  assert.equal(phoneOnlyHead.sourceReplicaId, 'phone');
  assert.equal(readFileSync(resolve(phoneRoot, phoneOnlyRef.replace(/^\.decision-os\//, '')), 'utf8'), 'phone-only body.\n');
  assert.equal(existsSync(resolve(phoneResult.root, 'objects', phoneOnlyHead.hash.slice(0, 2), phoneOnlyHead.hash)), false);
  assert.equal(existsSync(resolve(workstationResult.root, 'objects', phoneOnlyHead.hash.slice(0, 2), phoneOnlyHead.hash)), false);
});

test('migration references local audio and images without copying their bytes into backup or epoch-4 objects', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-current-migration-media-reference-'));
  const rollbackRoot = `${root}-rollback`;
  context.after(() => [root, rollbackRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const projectId = 'project-a';
  const tasksFile = resolve(root, 'tasks.json');
  const cardFile = resolve(root, 'cards', 'tasks', 'card-a.md');
  const threadFile = resolve(root, 'threads', 'tasks', 'thread-card-a.md');
  const imageFile = resolve(root, 'assets', 'large-image.png');
  const voiceFile = resolve(root, 'voice-uploads', 'large-voice.webm');
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'threads', 'tasks'), { recursive: true });
  mkdirSync(resolve(root, 'assets'), { recursive: true });
  mkdirSync(resolve(root, 'voice-uploads'), { recursive: true });
  const image = Buffer.alloc(1024 * 1024, 0x49);
  const voice = Buffer.alloc(2 * 1024 * 1024, 0x56);
  writeFileSync(imageFile, image);
  writeFileSync(voiceFile, voice);
  writeFileSync(cardFile, 'Card body.\n\n![Large](.decision-os/assets/large-image.png)\n');
  writeFileSync(threadFile, `# OPERATOR\n<!-- decision-os:note ${JSON.stringify({ id: 'note-a', timestamp: '2026-07-21T00:00:00.000Z', voiceFileRef: voiceFile })} -->\n\nVoice note.\n`);
  writeFileSync(tasksFile, JSON.stringify({
    cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }],
    annotations: [],
    relationships: [],
    threadFiles: { 'thread-card-a': '.decision-os/threads/tasks/thread-card-a.md' },
  }));

  const result = await migrateTaskCurrentState({ decisionOsRoot: root, projectId, nodeId: 'workstation', tasksLedgerFile: tasksFile, backupRoot: rollbackRoot });
  const imageHash = createHash('sha256').update(image).digest('hex');
  const voiceHash = createHash('sha256').update(voice).digest('hex');
  const store = createTaskCurrentStateStore({ decisionOsRoot: root, projectId });
  assert.equal(store.contentHeads('.decision-os/assets/large-image.png')[0].hash, imageHash);
  assert.equal(store.contentHeads('.decision-os/voice-uploads/large-voice.webm')[0].hash, voiceHash);
  assert.equal(existsSync(resolve(result.root, 'objects', imageHash.slice(0, 2), imageHash)), false);
  assert.equal(existsSync(resolve(result.root, 'objects', voiceHash.slice(0, 2), voiceHash)), false);
  assert.deepEqual(readFileSync(imageFile), image);
  assert.deepEqual(readFileSync(voiceFile), voice);
  const manifest = JSON.parse(readFileSync(resolve(result.backup, 'source-manifest.json'), 'utf8')) as { entries: Array<{ file: string; archive: boolean; archiveFile: string }> };
  const media = manifest.entries.filter((entry) => entry.file === imageFile || entry.file === voiceFile);
  assert.deepEqual(media.map((entry) => ({ file: entry.file, archive: entry.archive, archiveFile: entry.archiveFile })), [
    { file: imageFile, archive: false, archiveFile: '' },
    { file: voiceFile, archive: false, archiveFile: '' },
  ]);
  const backupNames = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? backupNames(file) : [entry.name];
  });
  assert.equal(backupNames(result.backup).includes('large-image.png'), false);
  assert.equal(backupNames(result.backup).includes('large-voice.webm'), false);
});

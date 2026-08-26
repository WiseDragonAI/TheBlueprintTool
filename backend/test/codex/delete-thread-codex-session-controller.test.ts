/**
 * WHAT: Behavioral coverage for deleting a card thread's Codex session.
 * WHY: Deletion must enforce ownership, settle live children, remove artifacts, and permit a fresh launch identity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import { deleteThreadCodexSessionController } from '@backend/business/codex/controller/delete-thread-codex-session-controller.js';
import { readCardSkillRunController } from '@backend/business/codex/controller/read-card-skill-run-controller.js';
import { createTaskCurrentStateStore } from '@backend/business/task-state/helper/task-current-state-store.js';
import { createTaskExecutionRepository } from '@backend/business/task-state/helper/task-execution-repository.js';

function fixture(): { workspace: string; decisionOsRoot: string; ledgerPath: string; runId: string; cardId: string; artifacts: string[] } {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-delete-thread-session-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const runId = `codex-skill-${Date.now() - 1000}-delete01`;
  const cardId = 'card-thread-session';
  const runDirectory = join(decisionOsRoot, 'runs', 'codex-skills', 'specs');
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Thread target',
      codexThreadRunId: runId,
      codexThreadRunOutputFile: `.decision-os/runs/codex-skills/specs/${runId}.md`,
      codexRunModel: 'gpt-5.5',
      codexRunEffort: 'high',
      comment: { what: 'Keep this card.' },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  const artifacts = [
    join(runDirectory, `${runId}.jsonl`),
    join(runDirectory, `${runId}.log`),
    join(runDirectory, `${runId}.md`),
    join(runDirectory, `${runId}.jsonl.telemetry.jsonl`),
  ];
  for (const artifact of artifacts) writeFileSync(artifact, `owned by ${runId}`);
  return { workspace, decisionOsRoot, ledgerPath, runId, cardId, artifacts };
}

test('DELETE session route removes a terminal owned run and rejects stale ownership', async () => {
  const originalCwd = process.cwd();
  const context = fixture();
  const runtime: Record<string, any> = {
    decisionOsRoot: context.decisionOsRoot,
    codexSkillRuns: { [context.runId]: { id: context.runId, ledgerId: 'specs', outputCardId: context.cardId, status: 'complete', settledAt: new Date().toISOString() } }
  };
  process.chdir(context.workspace);
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const address = server.address() as AddressInfo;
  try {
    const mismatch = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/stale-run`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ledgerId: 'specs', cardId: context.cardId })
    });
    assert.equal(mismatch.status, 404);
    assert.equal(context.artifacts.every(existsSync), true);

    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${context.runId}`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ledgerId: 'specs', cardId: context.cardId })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      statusCode: 200,
      ledgerId: 'specs',
      cardId: context.cardId,
      runId: context.runId,
      status: 'deleted',
      artifactsRetained: true,
      executionCount: 0,
    });
    const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexThreadRunId, undefined);
    assert.equal(ledger.cards[0].codexThreadRunOutputFile, undefined);
    assert.equal(ledger.cards[0].codexRunModel, 'gpt-5.5');
    assert.equal(ledger.cards[0].codexRunEffort, 'high');
    assert.equal(context.artifacts.every(existsSync), true);
    assert.equal(runtime.codexSkillRuns[context.runId], undefined);
    const staleStatus = await readCardSkillRunController({ action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.runId }, runtime_state: runtime });
    assert.equal(staleStatus.statusCode, 404);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('deleting the newest retained session promotes the previous run without deleting its artifacts', async () => {
  const context = fixture();
  const previousRunId = `codex-skill-${Date.now() - 2000}-previous`;
  const previousArtifacts = context.artifacts.map((artifact) => artifact.replace(context.runId, previousRunId));
  for (const artifact of previousArtifacts) writeFileSync(artifact, `owned by ${previousRunId}`);
  const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
  ledger.cards[0].codexThreadRunIds = [previousRunId, context.runId];
  writeFileSync(context.ledgerPath, JSON.stringify(ledger, null, 2));
  const runtime: Record<string, any> = {
    decisionOsRoot: context.decisionOsRoot,
    codexSkillRuns: { [context.runId]: { id: context.runId, status: 'complete', settledAt: new Date().toISOString() } },
  };
  try {
    const result = await deleteThreadCodexSessionController({ action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.runId }, runtime_state: runtime });
    assert.equal(result.ok, true);
    const persisted = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.deepEqual(persisted.cards[0].codexThreadRunIds, [previousRunId]);
    assert.equal(persisted.cards[0].codexThreadRunId, previousRunId);
    assert.equal(persisted.cards[0].codexThreadRunOutputFile, `.decision-os/runs/codex-skills/specs/${previousRunId}.md`);
    assert.equal(context.artifacts.every(existsSync), true);
    assert.equal(previousArtifacts.every(existsSync), true);
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('unreadable retained artifacts do not block canonical session metadata deletion', async () => {
  const context = fixture();
  rmSync(context.artifacts[0]);
  mkdirSync(context.artifacts[0]);
  const runtime: Record<string, any> = {};
  try {
    const result = await deleteThreadCodexSessionController({ action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.runId }, runtime_state: { ...runtime, decisionOsRoot: context.decisionOsRoot } });
    assert.equal(result.ok, true);
    assert.equal(result.artifactsRetained, true);
    const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexThreadRunId, undefined);
    assert.equal(ledger.cards[0].codexThreadRunOutputFile, undefined);
    assert.equal(existsSync(context.artifacts[1]), true);
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('canonical session deletion rejects active work then tombstones history before retaining artifacts', async () => {
  const context = fixture();
  const store = createTaskCurrentStateStore({
    decisionOsRoot: context.decisionOsRoot,
    projectId: 'project-a',
    initializeLedger: { cards: [], annotations: [], relationships: [] },
  });
  const executions = createTaskExecutionRepository({ store, writerId: 'workstation', projectId: 'project-a' });
  await executions.admit({
    executorNodeId: 'workstation',
    metadata: {
      executionId: 'execution-canonical-delete',
      requestId: 'request-canonical-delete',
      sessionId: context.runId,
      projectId: 'project-a',
      ledgerId: 'specs',
      taskId: context.cardId,
      sourceCardId: context.cardId,
      ownerCardId: context.cardId,
      kind: 'thread',
      requestedAt: '2026-07-23T11:00:00.000Z',
      model: null,
      effort: null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
  });
  const runtime: Record<string, unknown> = {
    decisionOsRoot: context.decisionOsRoot,
    taskExecutionState: { executions },
  };
  try {
    const active = await deleteThreadCodexSessionController({
      action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.runId },
      runtime_state: runtime,
    });
    assert.equal(active.ok, false);
    assert.equal(active.statusCode, 409);
    assert.equal(context.artifacts.every(existsSync), true);
    assert.ok(executions.find('execution-canonical-delete'));

    await executions.transition('execution-canonical-delete', {
      phase: 'cancelled',
      result: { status: 'cancelled', summary: 'Cancelled before launch.' },
    });
    const deleted = await deleteThreadCodexSessionController({
      action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.runId },
      runtime_state: runtime,
    });

    assert.equal(deleted.ok, true);
    assert.equal(deleted.artifactsRetained, true);
    assert.equal(deleted.executionCount, 1);
    assert.equal(executions.find('execution-canonical-delete'), null);
    assert.equal(context.artifacts.every(existsSync), true);
    const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexThreadRunId, undefined);
  } finally {
    await store.flush();
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

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
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { deleteThreadCodexSessionController } from '@backend/business/codex/controller/delete-thread-codex-session-controller.js';
import { readCardSkillRunController } from '@backend/business/codex/controller/read-card-skill-run-controller.js';

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
    assert.deepEqual(await response.json(), { ok: true, statusCode: 200, ledgerId: 'specs', cardId: context.cardId, runId: context.runId, status: 'deleted' });
    const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexThreadRunId, undefined);
    assert.equal(ledger.cards[0].codexThreadRunOutputFile, undefined);
    assert.equal(ledger.cards[0].codexRunModel, 'gpt-5.5');
    assert.equal(ledger.cards[0].codexRunEffort, 'high');
    assert.equal(context.artifacts.some(existsSync), false);
    assert.equal(runtime.codexSkillRuns[context.runId], undefined);
    const staleStatus = await readCardSkillRunController({ action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.runId }, runtime_state: runtime });
    assert.equal(staleStatus.statusCode, 404);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('active session deletion waits for settlement before removing owned artifacts', async () => {
  const context = fixture();
  const executionId = 'execution-delete-active';
  const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
  ledger.cards[0].codexActiveRunId = context.runId;
  ledger.cards[0].codexActiveExecutionId = executionId;
  writeFileSync(context.ledgerPath, JSON.stringify(ledger, null, 2));
  let settledBeforeReturn = false;
  const run: Record<string, any> = { id: context.runId, executionId, ledgerId: 'specs', outputCardId: context.cardId, status: 'running' };
  Object.defineProperty(run, 'child', {
    enumerable: false,
    value: {
      killed: false,
      kill(signal: string) {
        assert.equal(signal, 'SIGTERM');
        setTimeout(() => {
          settledBeforeReturn = true;
          run.settledAt = new Date().toISOString();
        }, 20);
        return true;
      }
    }
  });
  const runtime: Record<string, any> = { decisionOsRoot: context.decisionOsRoot, codexSkillRuns: { [context.runId]: run } };
  try {
    const result = await deleteThreadCodexSessionController({ action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.runId }, runtime_state: runtime });
    assert.equal(result.ok, true);
    assert.equal(settledBeforeReturn, true);
    assert.equal(context.artifacts.some(existsSync), false);
    assert.equal(runtime.codexSkillRuns[context.runId], undefined);
  } finally {
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
    assert.equal(context.artifacts.some(existsSync), false);
    assert.equal(previousArtifacts.every(existsSync), true);
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

test('artifact read failure preserves session ownership and the ledger projection', async () => {
  const context = fixture();
  rmSync(context.artifacts[0]);
  mkdirSync(context.artifacts[0]);
  const runtime: Record<string, any> = {};
  try {
    const result = await deleteThreadCodexSessionController({ action_payload: { ledgerId: 'specs', cardId: context.cardId, runId: context.runId }, runtime_state: { ...runtime, decisionOsRoot: context.decisionOsRoot } });
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 500);
    const ledger = JSON.parse(readFileSync(context.ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>> };
    assert.equal(ledger.cards[0].codexThreadRunId, context.runId);
    assert.equal(ledger.cards[0].codexThreadRunOutputFile, `.decision-os/runs/codex-skills/specs/${context.runId}.md`);
    assert.equal(existsSync(context.artifacts[1]), true);
  } finally {
    rmSync(context.workspace, { recursive: true, force: true });
  }
});

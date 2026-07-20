import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { enqueueCodexContinuation } from '../../src/business/codex/helper/codex-process-queue.js';
import { reconcileCodexExecutionOwnership } from '../../src/business/codex/helper/reconcile-codex-execution-ownership.js';

test('startup ownership migration clears unmatched leases, maps moved artifacts, and is idempotent', () => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-ownership-migration-'));
  const root = resolve(workspace, '.decision-os');
  const ledgerPath = resolve(root, 'tasks.json');
  const runDirectory = resolve(root, 'runs', 'codex-skills', 'specs');
  try {
    mkdirSync(runDirectory, { recursive: true });
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
    writeFileSync(resolve(runDirectory, 'historical-run.md'), '# Historical run\n');
    writeFileSync(ledgerPath, JSON.stringify({ cards: [
      { id: 'stale', codexActiveRunId: 'stale-run', executionStatus: 'running', executionRunId: 'stale-run' },
      { id: 'active', codexActiveRunId: 'active-run', codexActiveExecutionId: 'active-execution' },
      { id: 'moved', codexThreadRunId: 'historical-run', codexThreadRunIds: ['historical-run'] },
    ] }));
    enqueueCodexContinuation({
      decisionOsRoot: root,
      id: 'queue-active',
      createdAt: '2026-07-19T00:00:00.000Z',
      payload: { ledgerId: 'tasks', cardId: 'active', runId: 'active-run', executionId: 'active-execution' },
    });

    assert.deepEqual(reconcileCodexExecutionOwnership({ decisionOsRoot: root }), { ledgersChanged: 1, leasesCleared: 1, artifactMappingsAdded: 1 });
    const cards = JSON.parse(readFileSync(ledgerPath, 'utf8')).cards as Array<Record<string, unknown>>;
    assert.equal(cards[0].codexActiveRunId, undefined);
    assert.equal(cards[0].executionStatus, undefined);
    assert.equal(cards[1].codexActiveExecutionId, 'active-execution');
    assert.deepEqual(cards[2].codexThreadRunOutputFiles, { 'historical-run': '.decision-os/runs/codex-skills/specs/historical-run.md' });
    assert.deepEqual(reconcileCodexExecutionOwnership({ decisionOsRoot: root }), { ledgersChanged: 0, leasesCleared: 0, artifactMappingsAdded: 0 });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearCardCodexExecution } from '@backend/business/codex/helper/clear-card-codex-execution.js';

test('clears only the execution still owned by the settling run', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-clear-execution-'));
  const ledgerPath = join(root, 'tasks.json');
  try {
    writeFileSync(ledgerPath, JSON.stringify({
      cards: [{
        id: 'master', codexActiveRunId: 'direct-run',
        executionStatus: 'pending', executionRunId: 'newer-pipeline',
      }],
    }));

    assert.equal(clearCardCodexExecution({ ledgerPath, cardId: 'master', runId: 'direct-run' }), true);
    const card = JSON.parse(readFileSync(ledgerPath, 'utf8')).cards[0] as Record<string, unknown>;
    assert.equal(card.codexActiveRunId, undefined);
    assert.equal(card.executionStatus, 'pending');
    assert.equal(card.executionRunId, 'newer-pipeline');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('removes status and ownership when the settling run still owns execution', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-clear-owned-execution-'));
  const ledgerPath = join(root, 'tasks.json');
  try {
    writeFileSync(ledgerPath, JSON.stringify({
      cards: [{
        id: 'master', codexActiveRunId: 'direct-run',
        executionStatus: 'running', executionRunId: 'direct-run',
      }],
    }));

    assert.equal(clearCardCodexExecution({ ledgerPath, cardId: 'master', runId: 'direct-run' }), true);
    const card = JSON.parse(readFileSync(ledgerPath, 'utf8')).cards[0] as Record<string, unknown>;
    assert.equal(card.codexActiveRunId, undefined);
    assert.equal(card.executionStatus, undefined);
    assert.equal(card.executionRunId, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

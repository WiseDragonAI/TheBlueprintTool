import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ledgerNavigationProjection } from '@backend/business/server/helper/ledger-read-models.js';

test('navigation projection preserves canonical master-task relationships and labels', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-navigation-projection-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [
      {
        id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], x: 1, y: 2, w: 3, h: 4,
        codexActiveRunId: 'codex-skill-running', codexThreadRunId: 'codex-skill-running',
        codexRunModel: 'gpt-5.6-sol', codexRunEffort: 'medium', executionStatus: 'running', executionRunId: 'codex-skill-running',
      },
      { id: 'child', title: 'Child', status: 'done', labels: ['subtask'], x: 5, y: 6, w: 7, h: 8 },
    ],
    annotations: [],
    relationships: [{ id: 'rel-a', from: 'master', to: 'child', label: 'subtask' }],
  }));

  try {
    const projection = ledgerNavigationProjection({ decisionOsRoot, ledgerId: 'specs' });
    assert.deepEqual(projection?.relationships, [{ id: 'rel-a', from: 'master', to: 'child', label: 'subtask' }]);
    assert.deepEqual((projection?.cards as Array<Record<string, unknown>>).map((card) => card.labels), [['master-task'], ['subtask']]);
    assert.deepEqual((projection?.cards as Array<Record<string, unknown>>)[0], {
      id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], x: 1, y: 2, w: 3, h: 4,
      codexActiveRunId: 'codex-skill-running', codexActiveExecutionId: null, codexThreadRunId: 'codex-skill-running', codexRunId: null,
      codexRunModel: 'gpt-5.6-sol', codexRunEffort: 'medium', executionStatus: 'running', executionRunId: 'codex-skill-running',
    });
    assert.equal((projection?.cards as Array<Record<string, unknown>>)[1].codexThreadRunId, null);
    assert.equal('comment' in (projection?.cards as Array<Record<string, unknown>>)[0], false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

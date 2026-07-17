import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admitProjectSyncMasterTask } from '../../../src/business/project-sync/effect/admit-project-sync-master-task.js';
import type { DecisionOsProject } from '../../../src/business/server/helper/project-catalog.js';

test('admits one deterministic synchronization-labeled master task', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-task-'));
  const decisionOsRoot = join(root, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  try {
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
    const project: DecisionOsProject = {
      id: 'project-a', name: 'Project A', relativePath: '.', root, decisionOsRoot,
      description: '', color: '#000000', available: true, diagnostic: '',
      ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
    };
    const input = { project, sourceProjectId: 'source-b', sourceProjectName: 'Source B', originFingerprint: 'f'.repeat(64), syncId: 'sync-1' };
    const first = admitProjectSyncMasterTask(input);
    const duplicate = admitProjectSyncMasterTask(input);
    assert.deepEqual(duplicate, first);
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as { cards: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>> };
    assert.equal(ledger.cards.length, 1);
    assert.deepEqual(ledger.cards[0].labels, ['master-task', 'synchronization']);
    assert.equal(ledger.cards[0].status, 'todo');
    assert.equal(ledger.annotations.length, 1);
    assert.equal(existsSync(join(decisionOsRoot, 'cards', 'specs', `${first.masterCardId}.md`)), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

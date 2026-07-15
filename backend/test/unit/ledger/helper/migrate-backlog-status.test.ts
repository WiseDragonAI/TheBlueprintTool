import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateBacklogStatus } from '../../../../src/business/ledger/helper/migrate-backlog-status.js';

test('migrates delayed cards to backlog once across every declared ledger', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-backlog-migration-'));
  try {
    mkdirSync(join(root, 'migrations'), { recursive: true });
    writeFileSync(join(root, 'state.json'), JSON.stringify({ ledgers: [
      { id: 'a', ledgerFile: '.decision-os/a.json' },
      { id: 'b', ledgerFile: '.decision-os/b.json' },
    ] }));
    writeFileSync(join(root, 'a.json'), JSON.stringify({ cards: [{ id: 'a', status: 'delayed' }, { id: 'b', status: 'todo' }] }));
    writeFileSync(join(root, 'b.json'), JSON.stringify({ cards: [{ id: 'c', status: 'delayed' }] }));

    assert.deepEqual(migrateBacklogStatus(root), { ledgersChanged: 2, cardsChanged: 2 });
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'a.json'), 'utf8')).cards.map((card: { status: string }) => card.status), ['backlog', 'todo']);
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'b.json'), 'utf8')).cards.map((card: { status: string }) => card.status), ['backlog']);
    assert.deepEqual(migrateBacklogStatus(root), { ledgersChanged: 0, cardsChanged: 0 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

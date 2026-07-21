/**
 * WHAT: Proves content watcher ownership retains the task identity for exact head capture.
 * WHY: A changed Markdown file must publish its resource head without whole-manifest discovery.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildContentOwnershipIndex } from '../../../../src/business/refresh/helper/resolve-card-content-change.js';

test('content ownership retains the exact card id needed for resource-head capture', (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-content-owner-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(resolve(root, 'cards', 'tasks'), { recursive: true });
  const contentFile = '.decision-os/cards/tasks/card-a.md';
  const file = resolve(root, 'cards', 'tasks', 'card-a.md');
  writeFileSync(file, '# Card A\n');
  writeFileSync(resolve(root, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(resolve(root, 'tasks.json'), JSON.stringify({ cards: [{ id: 'card-a', comment: { contentFile } }] }));

  assert.deepEqual(buildContentOwnershipIndex(root).get(file), {
    cardId: 'card-a',
    contentFile,
    file,
    kind: 'card-content',
    ledgerId: 'tasks',
  });
});

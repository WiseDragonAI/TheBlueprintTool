/**
 * WHAT: Command-level coverage for ledger-cli.
 * WHY: the separated executable path must parse argv and call ledger mutation/overview controllers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dispatchLedgerCliCommandController } from '../../src/index.js';
import { createJsonFile } from '../fixture/scenario.js';

test('ledger-cli command mutates a ledger and emits overview text', async () => {
  const ledgerFile = await createJsonFile({
    cards: [{ id: 'card-a', title: 'Old title' }],
    relationships: [],
  });
  const mutate = await dispatchLedgerCliCommandController([
    'mutate',
    '--ledger',
    ledgerFile,
    '--card-id',
    'card-a',
    '--card-title',
    'New title',
  ]);
  const messages: string[] = [];
  const overview = await dispatchLedgerCliCommandController(['overview', '--ledger', ledgerFile], { emit: (message) => messages.push(message) });

  assert.equal(mutate.ok, true);
  assert.equal(overview.ok, true);
  assert.equal(JSON.parse(await readFile(ledgerFile, 'utf8')).cards[0].title, 'New title');
  assert.match(messages.join('\n'), /card-a :: New title/);
});

test('ledger-cli command lists unanswered threads and posts an answer', async () => {
  const ledgerFile = await createJsonFile({
    cards: [{ id: 'card-a', title: 'Card A' }],
    notes: {
      'thread-card-a': [{ role: 'operator', message: 'Question' }]
    }
  });
  const messages: string[] = [];
  const unanswered = await dispatchLedgerCliCommandController(['unanswered', '--ledger', ledgerFile], { emit: (message) => messages.push(message) });
  const answer = await dispatchLedgerCliCommandController(['answer', '--ledger', ledgerFile, '--thread-id', 'thread-card-a', '--message', 'Answer.']);

  assert.equal(unanswered.ok, true);
  assert.match(messages.join('\n'), /thread-card-a/);
  assert.match(messages.join('\n'), /\.blueprinttool\/threads\/ledger\/thread-card-a\.md/);
  assert.match(messages.join('\n'), /Patch .* directly/);
  assert.match(messages.join('\n'), /# AGENT/);
  assert.match(messages.join('\n'), /Only # OPERATOR and # AGENT/);
  assert.match(messages.join('\n'), /ledger-cli answer/);
  assert.equal(answer.ok, true);
  const persisted = JSON.parse(await readFile(ledgerFile, 'utf8')) as { notes: Record<string, unknown>; threadFiles: Record<string, string> };
  assert.equal(persisted.notes['thread-card-a'], undefined);
  const threadMarkdown = await readFile(join(dirname(dirname(ledgerFile)), persisted.threadFiles['thread-card-a']), 'utf8');
  assert.match(threadMarkdown, /^# AGENT/m);
  assert.match(threadMarkdown, /Answer\./);
});

test('ledger-cli command exports a markdown file', async () => {
  const ledgerFile = await createJsonFile({
    cards: [{ id: 'card-a', title: 'Card A', x: 10, y: 10, w: 80, h: 80, comment: { what: 'Body.' } }],
    annotations: [{ id: 'zone-a', label: 'Zone A', x: 0, y: 0, width: 100, height: 100 }],
  });
  const outputFile = join(ledgerFile, '..', 'export.md');
  const messages: string[] = [];

  const result = await dispatchLedgerCliCommandController(['export', '--ledger', ledgerFile, '--output', outputFile], { emit: (message) => messages.push(message) });

  assert.equal(result.ok, true);
  assert.match(messages.join('\n'), /Exported markdown/);
  assert.match(await readFile(outputFile, 'utf8'), /# Zone A\n\n## Card A/);
});

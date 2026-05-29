/**
 * WHAT: Command-level coverage for ledger-cli.
 * WHY: the separated executable path must parse argv and call ledger mutation/overview controllers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  assert.match(messages.join('\n'), /ledger-cli answer/);
  assert.equal(answer.ok, true);
  assert.equal(JSON.parse(await readFile(ledgerFile, 'utf8')).notes['thread-card-a'].at(-1).role, 'agent');
});

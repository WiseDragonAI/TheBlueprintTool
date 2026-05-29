/**
 * WHAT: Spec a598989d test for committed ledger JSON storage.
 * WHY: ledger commands must read and write durable JSON files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createJsonFile } from '../fixture/scenario.js';
import { manageLedgerJsonController } from '../../src/index.js';

test('ledger-cli JSON storage reads and writes committed ledger files', async () => {
  const file = await createJsonFile({ cards: [] });
  const result = await manageLedgerJsonController({ ledgerCommand: 'mutate', ledgerJsonFile: file, mutation: { cards: [{ id: 'a' }] } });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { cards: [{ id: 'a' }] });
});

test('ledger-cli JSON storage applies targeted card and relationship mutations', async () => {
  const file = await createJsonFile({
    cards: [
      { id: 'note-a', comment: { what: 'old' } },
      { id: 'card-b' },
      { id: 'card-remove' }
    ],
    relationships: [
      { id: 'rel-remove', source: { cardId: 'card-b' }, target: { cardId: 'note-a' } },
      { id: 'rel-keep', source: { cardId: 'note-a' }, target: { cardId: 'card-b' } },
      { id: 'rel-card-remove', from: 'card-remove', to: 'card-b' }
    ]
  });
  const commentFile = join(file, '..', 'comment.md');
  const cardFile = join(file, '..', 'card.json');
  await writeFile(commentFile, 'new comment\n', 'utf8');
  await writeFile(cardFile, JSON.stringify({ id: 'card-added', title: 'Added' }), 'utf8');

  const result = await manageLedgerJsonController({
    ledgerCommand: 'mutate',
    ledgerJsonFile: file,
    mutationOperation: {
      addCardFile: cardFile,
      addRelationships: [
        { id: 'rel-added', from: 'card-b', to: 'note-a', label: 'added link' }
      ],
      cardId: 'note-a',
      cardComment: 'new inline comment\n',
      cardCommentFile: commentFile,
      cardLabels: ['visual', 'validated'],
      cardTitle: 'Renamed note',
      cardX: 100,
      cardY: 200,
      cardW: 300,
      cardH: 400,
      removeCardIds: ['card-remove'],
      removeRelationshipIds: ['rel-remove'],
    },
  });

  assert.equal(result.ok, true);
  const ledger = JSON.parse(await readFile(file, 'utf8')) as {
    cards: Array<{ id: string; title?: string; labels?: string[]; comment?: { what?: string }; x?: number; y?: number; w?: number; h?: number }>;
    relationships: Array<{ id: string }>;
  };
  const noteA = ledger.cards.find((card) => card.id === 'note-a');
  assert.equal(noteA?.title, 'Renamed note');
  assert.equal(noteA?.comment?.what, 'new inline comment');
  assert.equal(noteA?.x, 100);
  assert.equal(noteA?.y, 200);
  assert.equal(noteA?.w, 300);
  assert.equal(noteA?.h, 400);
  assert.deepEqual((ledger.cards.find((card) => card.id === 'note-a') as { labels?: string[] } | undefined)?.labels, ['visual', 'validated']);
  assert.equal(ledger.cards.some((card) => card.id === 'card-added'), true);
  assert.equal(ledger.cards.some((card) => card.id === 'card-remove'), false);
  assert.deepEqual(ledger.relationships.map((relationship) => relationship.id), ['rel-keep', 'rel-added']);
});

test('ledger-cli overview prints cards and relationships without layout noise', async () => {
  const file = await createJsonFile({
    cards: [
      { id: 'card-a', title: 'Card A', cardType: 'table', x: 10, y: 20, comment: { what: 'hidden' } },
      { id: 'card-b', title: 'Card B' }
    ],
    relationships: [
      { id: 'rel-a-b', from: 'card-a', to: 'card-b', label: 'owns' }
    ],
    annotations: [{ id: 'zone-a', label: 'Hidden zone' }]
  });

  const result = await manageLedgerJsonController({ ledgerCommand: 'overview', ledgerJsonFile: file });

  assert.equal(result.ok, true);
  assert.match(String(result.ok ? result.value : ''), /Cards \(2\)/);
  assert.match(String(result.ok ? result.value : ''), /card-a :: Card A \[table\]/);
  assert.match(String(result.ok ? result.value : ''), /rel-a-b: Card A \(card-a\) --owns--> Card B \(card-b\)/);
  assert.equal(String(result.ok ? result.value : '').includes('Hidden zone'), false);
  assert.equal(String(result.ok ? result.value : '').includes('x'), false);
});

test('ledger-cli unanswered lists threads whose latest note is not an agent answer', async () => {
  const file = await createJsonFile({
    cards: [
      { id: 'smith_repair_scaffold', title: 'Smith Repair Scaffold' },
      { id: 'mason_stone_sale', title: 'Mason Stone Sale' },
      { id: 'answered-card', title: 'Answered Card' }
    ],
    notes: {
      'thread-smith_repair_scaffold': [{ role: 'operator', message: 'Need repair details.', timestamp: '2026-05-26T00:00:00.000Z' }],
      'thread-mason_stone_sale': [{ role: 'voice', message: 'Voice uploaded; transcription failed.', status: 'transcription failed', timestamp: '2026-05-26T00:01:00.000Z' }],
      'thread-answered-card': [{ role: 'operator', message: 'Question' }, { role: 'agent', message: 'Answer' }]
    }
  });

  const result = await manageLedgerJsonController({ ledgerCommand: 'unanswered', ledgerJsonFile: file });

  assert.equal(result.ok, true);
  const output = String(result.ok ? result.value : '');
  assert.match(output, /Threads awaiting agent answer \(2\)/);
  assert.match(output, /Smith Repair Scaffold/);
  assert.match(output, /Mason Stone Sale/);
  assert.match(output, /ledger-cli answer --ledger/);
  assert.equal(output.includes('Answered Card'), false);
});

test('ledger-cli unanswered lists every pending note since the last agent answer', async () => {
  const file = await createJsonFile({
    cards: [
      { id: 'mining_success_tuning', title: 'Mining Success Tuning' },
    ],
    notes: {
      'thread-mining_success_tuning': [
        { role: 'operator', message: 'Old question.' },
        { role: 'agent', message: 'Old answer.' },
        { role: 'voice', message: 'Defend the concept.', status: 'transcribed', timestamp: '2026-05-26T00:01:00.000Z' },
        { role: 'operator', message: 'Do not rollback my edits.', timestamp: '2026-05-26T00:02:00.000Z' },
      ]
    }
  });

  const result = await manageLedgerJsonController({ ledgerCommand: 'unanswered', ledgerJsonFile: file });

  assert.equal(result.ok, true);
  const output = String(result.ok ? result.value : '');
  assert.match(output, /Threads awaiting agent answer \(1\)/);
  assert.match(output, /pendingNotes: 2/);
  assert.match(output, /Defend the concept/);
  assert.match(output, /Do not rollback my edits/);
  assert.equal(output.includes('Old question'), false);
});

test('ledger-cli answer appends an agent note to a thread', async () => {
  const file = await createJsonFile({
    cards: [{ id: 'card-a', title: 'Card A' }],
    notes: {
      'thread-card-a': [{ role: 'operator', message: 'Question' }]
    }
  });

  const result = await manageLedgerJsonController({
    answerOperation: { threadId: 'thread-card-a', message: 'Agent answer.' },
    ledgerCommand: 'answer',
    ledgerJsonFile: file,
  });

  assert.equal(result.ok, true);
  const ledger = JSON.parse(await readFile(file, 'utf8')) as { notes: Record<string, Array<{ role: string; message: string }>> };
  assert.equal(ledger.notes['thread-card-a'].at(-1)?.role, 'agent');
  assert.equal(ledger.notes['thread-card-a'].at(-1)?.message, 'Agent answer.');
});

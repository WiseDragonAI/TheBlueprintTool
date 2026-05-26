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
      cardCommentFile: commentFile,
      cardLabels: ['visual', 'validated'],
      cardTitle: 'Renamed note',
      removeCardIds: ['card-remove'],
      removeRelationshipIds: ['rel-remove'],
    },
  });

  assert.equal(result.ok, true);
  const ledger = JSON.parse(await readFile(file, 'utf8')) as {
    cards: Array<{ id: string; title?: string; labels?: string[]; comment?: { what?: string } }>;
    relationships: Array<{ id: string }>;
  };
  assert.equal(ledger.cards.find((card) => card.id === 'note-a')?.title, 'Renamed note');
  assert.equal(ledger.cards.find((card) => card.id === 'note-a')?.comment?.what, 'new comment');
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

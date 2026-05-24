/**
 * WHAT: Spec a598989d test for committed architecture ledger JSON storage.
 * WHY: ledger commands must read and write durable JSON files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createJsonFile } from '../fixture/scenario.js';
import { manageLedgerJsonController } from '../../src/index.js';

test('CLI architecture ledger JSON storage reads and writes committed ledger files', async () => {
  const file = await createJsonFile({ cards: [] });
  const result = await manageLedgerJsonController({ ledgerCommand: 'mutate', ledgerJsonFile: file, mutation: { cards: [{ id: 'a' }] } });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { cards: [{ id: 'a' }] });
});

test('CLI architecture ledger JSON storage applies targeted card and relationship mutations', async () => {
  const file = await createJsonFile({
    cards: [
      { id: 'note-a', comment: { what: 'old' } },
      { id: 'card-b' }
    ],
    relationships: [
      { id: 'rel-remove', source: { cardId: 'card-b' }, target: { cardId: 'note-a' } },
      { id: 'rel-keep', source: { cardId: 'note-a' }, target: { cardId: 'card-b' } }
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
      removeRelationshipIds: ['rel-remove'],
    },
  });

  assert.equal(result.ok, true);
  const ledger = JSON.parse(await readFile(file, 'utf8')) as {
    cards: Array<{ id: string; comment?: { what?: string } }>;
    relationships: Array<{ id: string }>;
  };
  assert.equal(ledger.cards.find((card) => card.id === 'note-a')?.comment?.what, 'new comment');
  assert.equal(ledger.cards.some((card) => card.id === 'card-added'), true);
  assert.deepEqual(ledger.relationships.map((relationship) => relationship.id), ['rel-keep', 'rel-added']);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ledgerCardHasHydratedBody } from '../../../../src/runtime/ledger/helper/ledger-card-body.js';

test('navigation-only cards are not treated as hydrated card content', () => {
  assert.equal(ledgerCardHasHydratedBody({ id: 'card-a', cardType: 'note' }), false);
  assert.equal(ledgerCardHasHydratedBody({ id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }), false);
});

test('locally read Markdown, including an empty file, is a hydrated card body', () => {
  assert.equal(ledgerCardHasHydratedBody({ id: 'card-a', comment: { what: '# Local Markdown' } }), true);
  assert.equal(ledgerCardHasHydratedBody({ id: 'card-a', comment: { what: '' } }), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLedgerCardMarkdown } from '../../../../src/runtime/ledger/helper/parse-ledger-card-markdown.js';

test('parse-ledger-card-markdown parses common card description markdown', () => {
  assert.deepEqual(parseLedgerCardMarkdown('## Heading\n**Props**: `mode`\n- first\n* second'), [
    { kind: 'paragraph', children: [{ kind: 'text', text: 'Heading' }] },
    {
      kind: 'paragraph',
      children: [
        { kind: 'strong', text: 'Props' },
        { kind: 'text', text: ': ' },
        { kind: 'code', text: 'mode' }
      ]
    },
    {
      kind: 'list',
      items: [
        [{ kind: 'text', text: 'first' }],
        [{ kind: 'text', text: 'second' }]
      ]
    }
  ]);
});

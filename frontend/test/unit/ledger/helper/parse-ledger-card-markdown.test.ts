/**
 * WHAT: Unit tests for the shared ledger markdown parser.
 * WHY: Card and thread note markdown must preserve one canonical block model.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLedgerCardMarkdown } from '../../../../src/runtime/ledger/helper/parse-ledger-card-markdown.js';

test('parse-ledger-card-markdown parses common card description markdown', () => {
  assert.deepEqual(parseLedgerCardMarkdown('## Heading\n**Props**: `mode`\n- first\n* second\n\n---\n\n| Name | Use |\n|---|---|\n| `Health` | **Current** value |\n\n```cpp\nUSTRUCT(BlueprintType)\nstruct FCreatureState\n{\n  GENERATED_BODY()\n};\n```'), [
    { kind: 'heading', level: 2, children: [{ kind: 'text', text: 'Heading' }] },
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
    },
    { kind: 'hr' },
    {
      kind: 'table',
      headers: [
        [{ kind: 'text', text: 'Name' }],
        [{ kind: 'text', text: 'Use' }]
      ],
      rows: [
        [
          [{ kind: 'code', text: 'Health' }],
          [
            { kind: 'strong', text: 'Current' },
            { kind: 'text', text: ' value' }
          ]
        ]
      ]
    },
    {
      kind: 'code',
      language: 'cpp',
      text: 'USTRUCT(BlueprintType)\nstruct FCreatureState\n{\n  GENERATED_BODY()\n};'
    }
  ]);
});

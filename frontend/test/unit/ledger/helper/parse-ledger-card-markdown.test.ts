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

test('parse-ledger-card-markdown treats escaped newlines as markdown line breaks', () => {
  assert.deepEqual(parseLedgerCardMarkdown('Intro\\n\\n1. Numbered text stays paragraph.\\n- `Item` detail'), [
    { kind: 'paragraph', children: [{ kind: 'text', text: 'Intro' }] },
    { kind: 'paragraph', children: [{ kind: 'text', text: '1. Numbered text stays paragraph.' }] },
    { kind: 'list', items: [[{ kind: 'code', text: 'Item' }, { kind: 'text', text: ' detail' }]] }
  ]);
});

test('parse-ledger-card-markdown promotes adjacent standalone images into one image block', () => {
  assert.deepEqual(parseLedgerCardMarkdown('![First](/one.png)\n\n![Second](/two.jpg "Second title")\n\nMixed ![Icon](/icon.svg) text'), [
    {
      kind: 'images',
      images: [
        { kind: 'image', alt: 'First', src: '/one.png', title: '' },
        { kind: 'image', alt: 'Second', src: '/two.jpg', title: 'Second title' }
      ]
    },
    {
      kind: 'paragraph',
      children: [
        { kind: 'text', text: 'Mixed ' },
        { kind: 'image', alt: 'Icon', src: '/icon.svg', title: '' },
        { kind: 'text', text: ' text' }
      ]
    }
  ]);
});

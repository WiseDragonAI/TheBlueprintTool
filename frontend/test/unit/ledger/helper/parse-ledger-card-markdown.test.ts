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
      ordered: false,
      start: 1,
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

test('parse-ledger-card-markdown treats escaped newlines as markdown line breaks and preserves list types', () => {
  assert.deepEqual(parseLedgerCardMarkdown('Intro\\n\\n3. Numbered item.\\n4. Next item.\\n- `Item` detail'), [
    { kind: 'paragraph', children: [{ kind: 'text', text: 'Intro' }] },
    {
      kind: 'list',
      ordered: true,
      start: 3,
      items: [
        [{ kind: 'text', text: 'Numbered item.' }],
        [{ kind: 'text', text: 'Next item.' }]
      ]
    },
    { kind: 'list', ordered: false, start: 1, items: [[{ kind: 'code', text: 'Item' }, { kind: 'text', text: ' detail' }]] }
  ]);
});

test('parse-ledger-card-markdown parses markdown links and bare urls', () => {
  assert.deepEqual(parseLedgerCardMarkdown('See [Image #1](https://example.com/mock.png) and (https://example.com/story).'), [
    {
      kind: 'paragraph',
      children: [
        { kind: 'text', text: 'See ' },
        { kind: 'link', text: 'Image #1', href: 'https://example.com/mock.png', title: '' },
        { kind: 'text', text: ' and (' },
        { kind: 'link', text: 'https://example.com/story', href: 'https://example.com/story', title: '' },
        { kind: 'text', text: ').' }
      ]
    }
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

test('parse-ledger-card-markdown promotes adjacent standalone html directives into one embed block', () => {
  assert.deepEqual(parseLedgerCardMarkdown('::html[Preview](.decision-os/cards/specs/assets/preview.html)\n\n::html[](.decision-os/cards/specs/assets/second.html "Second")\n\nText ::html[Inline](.decision-os/cards/specs/assets/inline.html)'), [
    {
      kind: 'htmlEmbeds',
      embeds: [
        { title: 'Preview', src: '.decision-os/cards/specs/assets/preview.html' },
        { title: 'Second', src: '.decision-os/cards/specs/assets/second.html' }
      ]
    },
    {
      kind: 'paragraph',
      children: [
        { kind: 'text', text: 'Text ::html' },
        { kind: 'link', text: 'Inline', href: '.decision-os/cards/specs/assets/inline.html', title: '' }
      ]
    }
  ]);
});

test('parse-ledger-card-markdown ignores html directives inside code fences', () => {
  assert.deepEqual(parseLedgerCardMarkdown('```md\n::html[Preview](.decision-os/cards/specs/assets/preview.html)\n```'), [
    {
      kind: 'code',
      language: 'md',
      text: '::html[Preview](.decision-os/cards/specs/assets/preview.html)'
    }
  ]);
});

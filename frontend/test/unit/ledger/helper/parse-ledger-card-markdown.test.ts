/**
 * WHAT: Unit tests for the shared ledger markdown parser.
 * WHY: Card and thread note markdown must preserve one canonical block model.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLedgerCardMarkdown } from '../../../../src/runtime/ledger/helper/parse-ledger-card-markdown.js';
import { ledgerMarkdownPresentationRecords } from '../../../../src/runtime/content-authoring/helper/create-ledger-markdown-presentation-extension.js';

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

test('parse-ledger-card-markdown parses a configurable repository and repository-relative target', () => {
  assert.deepEqual(parseLedgerCardMarkdown('::git-diff[Review frontend](git-diff:?repo=packages%2Ffrontend&path=src%2Freview.ts)'), [
    { kind: 'gitDiff', title: 'Review frontend', repository: 'packages/frontend', target: 'src/review.ts' }
  ]);
});

test('parse-ledger-card-markdown leaves incomplete git diff directives inert', () => {
  assert.equal(parseLedgerCardMarkdown('::git-diff[Unsafe](git-diff:?repo=.&missing=path)')[0]?.kind, 'paragraph');
});

test('parse-ledger-card-markdown parses a card questionnaire directive', () => {
  assert.deepEqual(parseLedgerCardMarkdown('::questions[Implementation questions](questions:?id=implementation-context)'), [
    { kind: 'questions', title: 'Implementation questions', questionnaireId: 'implementation-context' }
  ]);
});

test('parse-ledger-card-markdown leaves unsafe questionnaire identifiers inert', () => {
  assert.equal(parseLedgerCardMarkdown('::questions[Unsafe](questions:?id=../../outside)')[0]?.kind, 'paragraph');
});

test('parse-ledger-card-markdown groups quote lines and retains their exact outer source span', () => {
  const markdown = '> **First** line\n> second line\n\nAfter quote\n\n> Adjacent quote';
  const blocks = parseLedgerCardMarkdown(markdown);
  assert.deepEqual(blocks, [
    {
      kind: 'blockquote',
      blocks: [
        { kind: 'paragraph', children: [{ kind: 'strong', text: 'First' }, { kind: 'text', text: ' line' }] },
        { kind: 'paragraph', children: [{ kind: 'text', text: 'second line' }] },
      ],
    },
    { kind: 'paragraph', children: [{ kind: 'text', text: 'After quote' }] },
    {
      kind: 'blockquote',
      blocks: [{ kind: 'paragraph', children: [{ kind: 'text', text: 'Adjacent quote' }] }],
    },
  ]);
  assert.deepEqual(
    blocks.map(({ from, to }) => ({ from, to })),
    [
      { from: 0, to: markdown.indexOf('\n\nAfter quote') },
      { from: markdown.indexOf('After quote'), to: markdown.indexOf('After quote') + 'After quote'.length },
      { from: markdown.lastIndexOf('> Adjacent quote'), to: markdown.length },
    ],
  );
});

test('parse-ledger-card-markdown preserves nested block content inside quotes', () => {
  assert.deepEqual(parseLedgerCardMarkdown('> ## Quoted heading\n> - item\n> > nested quote'), [
    {
      kind: 'blockquote',
      blocks: [
        { kind: 'heading', level: 2, children: [{ kind: 'text', text: 'Quoted heading' }] },
        { kind: 'list', ordered: false, start: 1, items: [[{ kind: 'text', text: 'item' }]] },
        {
          kind: 'blockquote',
          blocks: [{ kind: 'paragraph', children: [{ kind: 'text', text: 'nested quote' }] }],
        },
      ],
    },
  ]);
});

test('parse-ledger-card-markdown retains original-byte spans without changing the enumerable render model', () => {
  const markdown = '## Heading\\n\\n- first\n- **second**';
  const blocks = parseLedgerCardMarkdown(markdown);
  assert.deepEqual(blocks, [
    { kind: 'heading', level: 2, children: [{ kind: 'text', text: 'Heading' }] },
    {
      kind: 'list',
      ordered: false,
      start: 1,
      items: [
        [{ kind: 'text', text: 'first' }],
        [{ kind: 'strong', text: 'second' }],
      ],
    },
  ]);
  assert.deepEqual(
    blocks.map(({ from, to }) => ({ from, to })),
    [
      { from: 0, to: 10 },
      { from: 14, to: markdown.length },
    ],
  );
  const list = blocks[1];
  assert.equal(list.kind, 'list');
  const inlineSpans = list.items.flat() as Array<{ from?: number; to?: number }>;
  assert.deepEqual(
    inlineSpans.map(({ from, to }) => ({ from, to })),
    [
      { from: 16, to: 21 },
      { from: 24, to: 34 },
    ],
  );
});

test('inactive editor presentation records come from canonical blocks including Decision OS directives', () => {
  const markdown = [
    '## Heading',
    '',
    '- **exact** item',
    '',
    '::html[Preview](.decision-os/preview.html)',
    '::git-diff[Review](git-diff:?repo=.&path=README.md)',
    '::questions[Decision](questions:?id=gate)',
    '',
    'cursor',
  ].join('\n');
  const cursor = markdown.lastIndexOf('cursor') + 1;
  const ranges = ledgerMarkdownPresentationRecords(markdown, {
    from: cursor,
    to: cursor,
    head: cursor,
    empty: true,
  });
  assert.deepEqual(
    ranges.filter((range) => ['heading', 'list', 'htmlEmbeds', 'gitDiff', 'questions'].includes(range.block.kind))
      .map(({ block, source }) => ({ kind: block.kind, source })),
    [
      { kind: 'heading', source: '## Heading' },
      { kind: 'list', source: '- **exact** item' },
      { kind: 'htmlEmbeds', source: '::html[Preview](.decision-os/preview.html)' },
      { kind: 'gitDiff', source: '::git-diff[Review](git-diff:?repo=.&path=README.md)' },
      { kind: 'questions', source: '::questions[Decision](questions:?id=gate)' },
    ],
  );
  assert.equal(ranges.some((range) => range.source.includes('**exact**')), true);
});

test('editor presentation reveals every canonical block intersecting the main selection', () => {
  const markdown = ['## Heading', '', '- first', '- second', '', '---', '', 'Paragraph'].join('\n');
  const listStart = markdown.indexOf('- first');
  const listEnd = markdown.indexOf('\n\n---');
  const records = ledgerMarkdownPresentationRecords(markdown, {
    from: listStart + 2,
    to: listEnd - 1,
    head: listEnd - 1,
    empty: false,
  });
  assert.deepEqual(
    records.map((record) => ({ kind: record.block.kind, source: record.source })),
    [
      { kind: 'heading', source: '## Heading' },
      { kind: 'hr', source: '---' },
      { kind: 'paragraph', source: 'Paragraph' },
    ],
  );
});

test('editor presentation retains the preceding source block for a cursor in trailing parser whitespace', () => {
  const markdown = '## Heading\n\nParagraph\n';
  const records = ledgerMarkdownPresentationRecords(markdown, {
    from: markdown.length,
    to: markdown.length,
    head: markdown.length,
    empty: true,
  });
  assert.deepEqual(
    records.map((record) => ({ kind: record.block.kind, source: record.source })),
    [{ kind: 'heading', source: '## Heading' }],
  );
});

test('editor presentation chunks oversized canonical lists into exact virtualizable ranges', () => {
  const listMarkdown = Array.from({ length: 66 }, (_, index) => `- item ${index}`).join('\n');
  const markdown = `${listMarkdown}\n\nTrailing paragraph`;
  const records = ledgerMarkdownPresentationRecords(markdown, {
    from: markdown.indexOf('Trailing') + 1,
    to: markdown.indexOf('Trailing') + 1,
    head: markdown.indexOf('Trailing') + 1,
    empty: true,
  });

  assert.deepEqual(records.map((record) => record.block.kind), ['list', 'list', 'list']);
  assert.deepEqual(
    records.map((record) => record.block.kind === 'list' ? record.block.items.length : 0),
    [32, 32, 2],
  );
  assert.equal(records.map((record) => record.source).join(''), listMarkdown);
  assert.deepEqual(records.map(({ from, to }) => ({ from, to })), [
    { from: 0, to: markdown.indexOf('- item 32') },
    { from: markdown.indexOf('- item 32'), to: markdown.indexOf('- item 64') },
    { from: markdown.indexOf('- item 64'), to: listMarkdown.length },
  ]);
});

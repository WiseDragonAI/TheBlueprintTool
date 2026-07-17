/**
 * WHAT: Runtime DOM tests for card markdown, title markdown, labels, and zone color rendering.
 * WHY: The canvas renderer must preserve shared markdown semantics without a browser dependency.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { patchLedgerCard } from '../../src/runtime/ledger/component/patch-ledger-card.js';
import { renderLedgerCardDetailLayer } from '../../src/runtime/ledger/component/render-ledger-card-detail-layer.js';
import { patchLedgerZone } from '../../src/runtime/ledger/component/patch-ledger-zone.js';
import { renderLedgerCardDeleteButton } from '../../src/runtime/ledger/component/render-ledger-card-delete-button.js';
import { state } from '../../src/runtime/state.js';

const root = new URL('../../../', import.meta.url);

class FakeText {
  textContent: string;
  constructor(text: string) {
    this.textContent = text;
  }
}

class FakeElement {
  tagName: string;
  className = '';
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  style: Record<string, string> & { setProperty: (name: string, value: string) => void; removeProperty: (name: string) => void } = Object.assign(Object.create(null), {
    setProperty(name: string, value: string) {
      this[name] = value;
    },
    removeProperty(name: string) {
      delete this[name];
    }
  });
  textContent = '';
  innerHTML = '';
  title = '';
  type = '';
  children: Array<FakeElement | FakeText> = [];
  role = '';

  classList = {
    toggle: (className: string, force?: boolean) => {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      const shouldAdd = force ?? !classes.has(className);
      if (shouldAdd) classes.add(className);
      else classes.delete(className);
      this.className = Array.from(classes).join(' ');
    },
    add: (...classNames: string[]) => {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      for (const className of classNames) classes.add(className);
      this.className = Array.from(classes).join(' ');
    }
  };

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  appendChild<T extends FakeElement | FakeText>(child: T): T {
    this.children.push(child);
    return child;
  }

  append(...children: Array<FakeElement | FakeText>): void {
    this.children.push(...children);
  }

  replaceChildren(...children: Array<FakeElement | FakeText>): void {
    this.children = children;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

}

function findElementByClass(root: FakeElement, className: string): FakeElement | undefined {
  for (const child of root.children) {
    if (!(child instanceof FakeElement)) continue;
    if (child.className.split(/\s+/).includes(className)) return child;
    const nested = findElementByClass(child, className);
    if (nested) return nested;
  }
  return undefined;
}

function renderDetail(card: Record<string, unknown>): FakeElement {
  return renderLedgerCardDetailLayer(card) as unknown as FakeElement;
}

test('ledger cards render markdown descriptions as DOM elements', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-markdown',
      title: 'Markdown card',
      comment: { what: '**Props**: `mode`\n- latestPinned\n- anchoredHistory' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const paragraph = body.children[0] as FakeElement;
    const list = body.children[1] as FakeElement;

    assert.equal(body.className, 'ledger-card-body');
    assert.equal((paragraph.children[0] as FakeElement).tagName, 'strong');
    assert.equal((paragraph.children[0] as FakeElement).textContent, 'Props');
    assert.equal((paragraph.children[2] as FakeElement).tagName, 'code');
    assert.equal((paragraph.children[2] as FakeElement).textContent, 'mode');
    assert.equal(list.tagName, 'ul');
    assert.equal((list.children[0] as FakeElement).tagName, 'li');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards render numbered markdown as semantic ordered lists', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-ordered-list',
      title: 'Ordered list card',
      comment: { what: '3. Third\n4. Fourth' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const list = body.children[0] as FakeElement;

    assert.equal(list.tagName, 'ol');
    assert.equal(list.attributes.start, '3');
    assert.equal((list.children[0] as FakeElement).tagName, 'li');
    assert.equal((list.children[0] as FakeElement).children[0].textContent, 'Third');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('thread command markdown preserves each backtick span as a code element', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-thread-command',
      title: 'Thread command',
      comment: { what: 'Defining `LedgerCli` left `command -v LedgerCli` empty inside `sh -lc`.' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const paragraph = body.children[0] as FakeElement;
    const codeNodes = paragraph.children.filter((child) => child instanceof FakeElement && child.tagName === 'code') as FakeElement[];

    assert.deepEqual(codeNodes.map((node) => node.textContent), ['LedgerCli', 'command -v LedgerCli', 'sh -lc']);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards render markdown tables as table elements', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-table',
      title: 'Table card',
      comment: { what: '| Blueprint asset | Symbol use | Refactor impact |\n|---|---|---|\n| `BP-health-bar` | `UpdateHealth` | Keep as legacy display actor. |' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const scroll = body.children[0] as FakeElement;
    const table = scroll.children[0] as FakeElement;
    const thead = table.children[0] as FakeElement;
    const tbody = table.children[1] as FakeElement;
    const headerRow = thead.children[0] as FakeElement;
    const firstRow = tbody.children[0] as FakeElement;

    assert.equal(scroll.className, 'ledger-card-table-scroll');
    assert.equal(table.tagName, 'table');
    assert.equal(table.className, 'ledger-card-table');
    assert.equal((headerRow.children[0] as FakeElement).tagName, 'th');
    assert.equal((headerRow.children[0] as FakeElement).children[0].textContent, 'Blueprint asset');
    assert.equal((firstRow.children[0] as FakeElement).tagName, 'td');
    assert.equal(((firstRow.children[0] as FakeElement).children[0] as FakeElement).tagName, 'code');
    assert.equal(((firstRow.children[1] as FakeElement).children[0] as FakeElement).tagName, 'code');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards render markdown and bare urls as links', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-links',
      title: 'Link card',
      comment: { what: 'Reference [Image #1](https://example.com/image.png) and (https://example.com/story).' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const paragraph = body.children[0] as FakeElement;
    const markdownLink = paragraph.children[1] as FakeElement;
    const bareUrlLink = paragraph.children[3] as FakeElement;

    assert.equal(markdownLink.tagName, 'a');
    assert.equal(markdownLink.className, 'ledger-card-link');
    assert.equal(markdownLink.textContent, 'Image #1');
    assert.equal(markdownLink.attributes.href, 'https://example.com/image.png');
    assert.equal(markdownLink.attributes.target, '_blank');
    assert.equal(markdownLink.attributes.rel, 'noopener noreferrer');
    assert.equal(bareUrlLink.tagName, 'a');
    assert.equal(bareUrlLink.textContent, 'https://example.com/story');
    assert.equal(bareUrlLink.attributes.href, 'https://example.com/story');
    assert.equal(paragraph.children.map((child) => child.textContent).join(''), 'Reference Image #1 and (https://example.com/story).');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards render markdown headings through the shared markdown renderer', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-heading',
      title: 'Heading card',
      comment: { what: '### Quest tags\n- `mine.quarry.started`' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const heading = body.children[0] as FakeElement;
    const list = body.children[1] as FakeElement;

    assert.equal(heading.tagName, 'h3');
    assert.equal(heading.className, 'ledger-card-heading ledger-card-heading-3');
    assert.equal(heading.children.map((child) => child.textContent).join(''), 'Quest tags');
    assert.equal(list.tagName, 'ul');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards render horizontal rules through the shared markdown renderer', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-rule',
      title: 'Rule card',
      comment: { what: 'Before\n\n---\n\nAfter' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const rule = body.children[1] as FakeElement;

    assert.equal(rule.tagName, 'hr');
    assert.equal(rule.className, 'ledger-card-hr');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards render fenced code blocks with syntax spans', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-code',
      title: 'Code card',
      comment: { what: '```cpp\nUSTRUCT(BlueprintType)\nstruct FCreatureState\n{\n  GENERATED_BODY()\n  float Current = 100.f;\n};\n```' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const pre = body.children[0] as FakeElement;
    const code = pre.children[0] as FakeElement;

    assert.equal(pre.tagName, 'pre');
    assert.equal(pre.className, 'ledger-card-code-block');
    assert.equal(pre.dataset.language, 'cpp');
    assert.equal(code.tagName, 'code');
    assert.equal(code.children.some((child) => child instanceof FakeElement && child.className === 'syntax-macro' && child.textContent === 'USTRUCT'), true);
    assert.equal(code.children.some((child) => child instanceof FakeElement && child.className === 'syntax-keyword' && child.textContent === 'struct'), true);
    assert.equal(code.children.some((child) => child instanceof FakeElement && child.className === 'syntax-type' && child.textContent === 'FCreatureState'), true);
    assert.equal(code.children.some((child) => child instanceof FakeElement && child.className === 'syntax-number' && child.textContent === '100.f'), true);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards use highlight.js for mainstream language fences when available', () => {
  const previousDocument = globalThis.document;
  const previousHighlighter = (globalThis as typeof globalThis & { hljs?: unknown }).hljs;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };
  (globalThis as typeof globalThis & { hljs?: unknown }).hljs = {
    getLanguage: (language: string) => language === 'typescript',
    highlight: (code: string, options: { language: string }) => ({
      value: `<span class="hljs-keyword">${options.language}</span><span class="hljs-title">${code.includes('interface') ? 'interface' : 'code'}</span>`
    })
  };

  try {
    const card = renderDetail({
      id: 'card-ts-code',
      title: 'TypeScript code card',
      comment: { what: '```ts\ninterface User { id: string }\n```' }
    }) as unknown as FakeElement;
    const body = findElementByClass(card, 'ledger-card-body') as FakeElement;
    const pre = body.children[0] as FakeElement;
    const code = pre.children[0] as FakeElement;

    assert.equal(pre.dataset.language, 'ts');
    assert.equal(code.className, 'hljs language-ts');
    assert.match(code.innerHTML, /hljs-keyword/);
    assert.match(code.innerHTML, /typescript/);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as typeof globalThis & { hljs?: unknown }).hljs = previousHighlighter;
  }
});

test('runtime loads vendored highlight.js assets before canvas boot', () => {
  const index = readFileSync(new URL('frontend/index.html', root), 'utf8');
  const highlighter = readFileSync(new URL('frontend/src/runtime/ledger/helper/highlight-ledger-code.ts', root), 'utf8');
  const codeBlockCss = readFileSync(new URL('frontend/assets/canvas/objects.css', root), 'utf8');
  const vendorScript = readFileSync(new URL('frontend/assets/vendor/highlight.min.js', root), 'utf8');
  const vendorContext: { hljs?: { getLanguage?: (language: string) => unknown } } = {};
  assert.match(index, /\/assets\/vendor\/highlight-atom-one-dark\.css/);
  assert.match(index, /\/assets\/vendor\/highlight\.min\.js[\s\S]*\/src\/runtime\/surface-runtime\.ts/);
  assert.equal(existsSync(new URL('frontend/assets/vendor/highlight.min.js', root)), true);
  assert.equal(existsSync(new URL('frontend/assets/vendor/highlight-atom-one-dark.css', root)), true);
  assert.doesNotMatch(codeBlockCss, /\.ledger-card-code-block\s*\{[^}]*--card-zone-color/s);
  assert.match(codeBlockCss, /\.ledger-card-code-block\s*\{[^}]*background:\s*#282c34/s);
  assert.match(highlighter, /\['ts', 'typescript'\]/);
  assert.match(highlighter, /\['js', 'javascript'\]/);
  assert.match(highlighter, /\['rs', 'rust'\]/);
  assert.match(highlighter, /\['html', 'xml'\]/);
  runInNewContext(vendorScript, vendorContext);
  for (const language of ['javascript', 'typescript', 'php', 'java', 'rust', 'python', 'cpp', 'csharp', 'go', 'ruby', 'xml', 'bash', 'json', 'css']) {
    assert.equal(Boolean(vendorContext.hljs?.getLanguage?.(language)), true, `${language} must be included in highlight.js vendor bundle`);
  }
});

test('ledger cards render visual labels as top-right card-colored chips', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const input = {
      id: 'card-labels',
      title: 'Labeled card',
      labels: ['validated', 'runtime'],
      comment: { what: 'Label rendering target.' }
    };
    const card = patchLedgerCard(input) as unknown as FakeElement;
    const detail = renderDetail(input);
    const labels = findElementByClass(detail, 'ledger-card-labels') as FakeElement;
    const firstLabel = labels.children[0] as FakeElement;
    const secondLabel = labels.children[1] as FakeElement;

    assert.equal(card.dataset.cardLabels, 'validated,runtime');
    assert.equal(labels.className, 'ledger-card-labels');
    assert.equal(firstLabel.className, 'ledger-card-label');
    assert.equal(firstLabel.textContent, 'validated');
    assert.equal(secondLabel.textContent, 'runtime');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards receive deterministic zone color before tab controls paint', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const input = {
      id: 'card-zone-color',
      title: 'Zone Colored',
      fields: [{ name: 'id', type: 'hash8' }],
      comment: { what: 'Zone color target.' }
    };
    const card = patchLedgerCard(input, null, { id: 'zone-owner', color: '#eab308' }) as unknown as FakeElement;
    const detail = renderDetail(input);

    assert.equal(card.dataset.cardZoneId, 'zone-owner');
    assert.equal(card.dataset.cardZoneColor, '#eab308');
    assert.equal(card.style['--card-zone-color'], '#eab308');
    assert.equal((findElementByClass(detail, 'ledger-card-tabs') as FakeElement).className, 'ledger-card-tabs');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('explicit card color overrides zone inheritance during hydration', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = patchLedgerCard({
      id: 'project-card:colored',
      cardType: 'project',
      targetProjectId: 'colored',
      title: 'Colored project',
      color: '#a855f7'
    }, null, { id: 'zone-owner', color: '#eab308' }) as unknown as FakeElement;

    assert.equal(card.dataset.cardZoneId, undefined);
    assert.equal(card.dataset.cardZoneColor, '#a855f7');
    assert.equal(card.style['--card-zone-color'], '#a855f7');
    assert.match(card.style['--card-readable-color'], /^#[0-9a-f]{6}$/);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger card titles include PascalCase word break opportunities without changing text', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-pascal',
      title: 'UOptimizedInstancedStaticMeshComponent',
      comment: { what: 'Pascal title wrap target.' }
    });
    const title = findElementByClass(card, 'ledger-card-title') as FakeElement;

    assert.equal(title.className, 'ledger-card-title');
    assert.equal(title.children.some((child) => child instanceof FakeElement && child.tagName === 'wbr'), true);
    assert.equal(title.children.map((child) => child.textContent).join(''), 'UOptimizedInstancedStaticMeshComponent');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger card titles render inline markdown without dropping title wrapping', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-title-markdown',
      title: '### RuneItem `FInventoryItem::Buffs` **Model**',
      comment: { what: 'Title markdown target.' }
    });
    const title = findElementByClass(card, 'ledger-card-title') as FakeElement;

    assert.equal(title.dataset.titleHeading, '3');
    assert.equal(title.children.some((child) => child instanceof FakeElement && child.tagName === 'code' && child.textContent === 'FInventoryItem::Buffs'), true);
    assert.equal(title.children.some((child) => child instanceof FakeElement && child.tagName === 'strong' && child.textContent === 'Model'), true);
    assert.equal(title.children.some((child) => child instanceof FakeElement && child.tagName === 'wbr'), true);
    assert.equal(title.children.map((child) => child.textContent).join(''), 'RuneItem FInventoryItem::Buffs Model');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger card detail title exposes a hover edit action beside the title', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = renderDetail({
      id: 'card-title-edit',
      title: 'Editable title',
      comment: { what: 'Title edit target.' }
    });
    const row = findElementByClass(card, 'ledger-card-title-row') as FakeElement;
    const title = findElementByClass(row, 'ledger-card-title') as FakeElement;
    const button = findElementByClass(row, 'ledger-card-title-edit-button') as FakeElement;
    const ledgerCard = renderDetail({
      id: 'ledger-card:ops',
      targetLedgerId: 'ops',
      cardType: 'ledger',
      title: 'Ops',
      comment: { what: 'Ledger title edit target.' }
    });
    const ledgerButton = findElementByClass(ledgerCard, 'ledger-card-title-edit-button') as FakeElement;
    const projectCard = renderDetail({
      id: 'project-card:decision-os',
      targetProjectId: 'decision-os',
      cardType: 'project',
      title: 'Decision OS',
      description: 'Project settings target.'
    });
    const projectRow = findElementByClass(projectCard, 'ledger-card-title-row') as FakeElement;

    assert.equal(row.children[0], title);
    assert.equal(row.children[1], button);
    assert.equal(button.tagName, 'button');
    assert.equal(button.type, 'button');
    assert.equal(button.dataset.action, 'edit-card-title');
    assert.equal(button.dataset.cardId, 'card-title-edit');
    assert.equal(button.attributes['aria-label'], 'Edit card title');
    assert.equal(button.textContent, '✎');
    assert.equal(ledgerButton.attributes['aria-label'], 'Edit ledger name');
    assert.equal(projectRow.children.length, 1);
    assert.equal(findElementByClass(projectCard, 'card-status-indicator'), undefined);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger card delete action is rendered by overlay controls, not inside card DOM', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = patchLedgerCard({
      id: 'card-delete',
      title: 'Delete target',
      comment: { what: 'Delete control target.' }
    }) as unknown as FakeElement;
    const button = renderLedgerCardDeleteButton('card-delete') as unknown as FakeElement;

    assert.equal(card.children.some((child) => child instanceof FakeElement && child.className.includes('ledger-card-delete')), false);
    assert.equal(button.tagName, 'button');
    assert.equal(button.dataset.action, 'confirm-delete-card');
    assert.equal(button.dataset.cardId, 'card-delete');
    assert.equal(button.textContent, 'X');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger card shell stays overview-only unless detail is already mounted', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const input = {
      id: 'card-hydration',
      title: 'Hydrated card',
      comment: { what: '**Detailed** body.' }
    };
    const shell = patchLedgerCard(input) as unknown as FakeElement;
    const detail = renderLedgerCardDetailLayer(input);
    shell.classList.add('detail-visible');
    shell.children.splice(shell.children.length - 1, 0, detail as unknown as FakeElement);
    const patched = patchLedgerCard({ ...input, title: 'Hydrated card patched' }, shell as unknown as HTMLElement) as unknown as FakeElement;

    assert.equal(findElementByClass(patchLedgerCard(input) as unknown as FakeElement, 'ledger-card-detail-layer'), undefined);
    assert.equal(Boolean(findElementByClass(shell, 'ledger-card-overview-layer')), true);
    assert.equal(patched.className.includes('detail-visible'), true);
    assert.equal(findElementByClass(patched, 'ledger-card-detail-layer'), detail);
    assert.equal((findElementByClass(patched, 'ledger-card-title') as FakeElement).children.map((child) => child.textContent).join(''), 'Hydrated card patched');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('linked ledger overview cards expose target ledger id and omit status chrome', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = patchLedgerCard({
      id: 'ledger-card:ux',
      targetLedgerId: 'ux',
      cardType: 'ledger',
      title: 'UX',
      comment: { what: 'Ledger: UX' }
    }) as unknown as FakeElement;
    const overview = findElementByClass(card, 'ledger-card-overview-layer') as FakeElement;

    assert.equal(card.dataset.cardType, 'ledger');
    assert.equal(card.dataset.targetLedgerId, 'ux');
    assert.equal(overview.className.includes('ledger-card-overview-layer--ledger'), true);
    assert.equal(Boolean(findElementByClass(card, 'ledger-card-overview-status')), false);
    assert.equal(Boolean(findElementByClass(card, 'card-status-indicator')), false);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger groups leave delete action to overlay controls', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const group = patchLedgerZone({
      id: 'group-delete',
      label: 'Delete group target',
      variant: 'group'
    }) as unknown as FakeElement;

    assert.equal(group.children.some((child) => child instanceof FakeElement && child.className.includes('ledger-group-delete')), false);
    assert.equal(group.children.some((child) => child instanceof FakeElement && child.className.includes('zone-actions')), false);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards with fields render description and fields tab panels', () => {
  const previousDocument = globalThis.document;
  const previousCardUi = state.cardUi;
  state.cardUi = { openCardIds: [], activeTabByCardId: { 'card-fields': 'fields' } };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const input = {
      id: 'card-fields',
      title: 'Field card',
      comment: { what: 'Description body.' },
      fields: [
        { name: 'Health', type: 'FCreatureState' },
        { name: 'Stamina', type: 'FCreatureState' }
      ]
    };
    const card = patchLedgerCard(input) as unknown as FakeElement;
    const detail = renderDetail(input);
    const tabs = findElementByClass(detail, 'ledger-card-tabs') as FakeElement;
    const frame = findElementByClass(detail, 'ledger-card-tab-frame') as FakeElement;
    const description = frame.children[0] as FakeElement;
    const fields = frame.children[1] as FakeElement;
    const list = fields.children[0] as FakeElement;

    assert.equal(card.dataset.activeCardTab, 'fields');
    assert.equal(tabs.className, 'ledger-card-tabs');
    assert.equal((tabs.children[0] as FakeElement).dataset.action, 'switch-card-tab');
    assert.equal((tabs.children[1] as FakeElement).className.includes('is-active'), true);
    assert.equal(frame.className, 'ledger-card-tab-frame');
    assert.equal(frame.dataset.wheelCapture, 'true');
    assert.equal(description.dataset.cardPanel, 'description');
    assert.equal(fields.dataset.cardPanel, 'fields');
    assert.equal(fields.className.includes('is-active'), true);
    assert.equal(list.className, 'ledger-card-fields');
    assert.equal((list.children[0] as FakeElement).textContent, 'Health');
    assert.equal((list.children[1] as FakeElement).textContent, 'FCreatureState');
  } finally {
    state.cardUi = previousCardUi;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

/**
 * WHAT: Runtime DOM tests for card markdown, title markdown, labels, and zone color rendering.
 * WHY: The canvas renderer must preserve shared markdown semantics without a browser dependency.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { patchLedgerCard } from '../../src/runtime/ledger/component/patch-ledger-card.js';
import { state } from '../../src/runtime/state.js';

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

test('ledger cards render markdown descriptions as DOM elements', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = patchLedgerCard({
      id: 'card-markdown',
      title: 'Markdown card',
      comment: { what: '**Props**: `mode`\n- latestPinned\n- anchoredHistory' }
    }) as unknown as FakeElement;
    const body = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-body') as FakeElement;
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

test('ledger cards render markdown tables as table elements', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = patchLedgerCard({
      id: 'card-table',
      title: 'Table card',
      comment: { what: '| Blueprint asset | Symbol use | Refactor impact |\n|---|---|---|\n| `BP-health-bar` | `UpdateHealth` | Keep as legacy display actor. |' }
    }) as unknown as FakeElement;
    const body = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-body') as FakeElement;
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

test('ledger cards render markdown headings through the shared markdown renderer', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = patchLedgerCard({
      id: 'card-heading',
      title: 'Heading card',
      comment: { what: '### Quest tags\n- `mine.quarry.started`' }
    }) as unknown as FakeElement;
    const body = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-body') as FakeElement;
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
    const card = patchLedgerCard({
      id: 'card-rule',
      title: 'Rule card',
      comment: { what: 'Before\n\n---\n\nAfter' }
    }) as unknown as FakeElement;
    const body = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-body') as FakeElement;
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
    const card = patchLedgerCard({
      id: 'card-code',
      title: 'Code card',
      comment: { what: '```cpp\nUSTRUCT(BlueprintType)\nstruct FCreatureState\n{\n  GENERATED_BODY()\n  float Current = 100.f;\n};\n```' }
    }) as unknown as FakeElement;
    const body = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-body') as FakeElement;
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

test('ledger cards render visual labels as top-right card-colored chips', () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const card = patchLedgerCard({
      id: 'card-labels',
      title: 'Labeled card',
      labels: ['validated', 'runtime'],
      comment: { what: 'Label rendering target.' }
    }) as unknown as FakeElement;
    const labels = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-labels') as FakeElement;
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
    const card = patchLedgerCard({
      id: 'card-zone-color',
      title: 'Zone Colored',
      fields: [{ name: 'id', type: 'hash8' }],
      comment: { what: 'Zone color target.' }
    }, null, { id: 'zone-owner', color: '#eab308' }) as unknown as FakeElement;

    assert.equal(card.dataset.cardZoneId, 'zone-owner');
    assert.equal(card.dataset.cardZoneColor, '#eab308');
    assert.equal(card.style['--card-zone-color'], '#eab308');
    assert.equal((card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-tabs') as FakeElement).className, 'ledger-card-tabs');
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
    const card = patchLedgerCard({
      id: 'card-pascal',
      title: 'UOptimizedInstancedStaticMeshComponent',
      comment: { what: 'Pascal title wrap target.' }
    }) as unknown as FakeElement;
    const title = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-title') as FakeElement;

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
    const card = patchLedgerCard({
      id: 'card-title-markdown',
      title: '### RuneItem `FInventoryItem::Buffs` **Model**',
      comment: { what: 'Title markdown target.' }
    }) as unknown as FakeElement;
    const title = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-title') as FakeElement;

    assert.equal(title.dataset.titleHeading, '3');
    assert.equal(title.children.some((child) => child instanceof FakeElement && child.tagName === 'code' && child.textContent === 'FInventoryItem::Buffs'), true);
    assert.equal(title.children.some((child) => child instanceof FakeElement && child.tagName === 'strong' && child.textContent === 'Model'), true);
    assert.equal(title.children.some((child) => child instanceof FakeElement && child.tagName === 'wbr'), true);
    assert.equal(title.children.map((child) => child.textContent).join(''), 'RuneItem FInventoryItem::Buffs Model');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('ledger cards render a top-right confirmed delete action', () => {
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
    const button = card.children.find((child) => child instanceof FakeElement && child.className.includes('ledger-card-delete')) as FakeElement;

    assert.equal(button.tagName, 'button');
    assert.equal(button.dataset.action, 'confirm-delete-card');
    assert.equal(button.dataset.cardId, 'card-delete');
    assert.equal(button.textContent, 'X');
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
    const card = patchLedgerCard({
      id: 'card-fields',
      title: 'Field card',
      comment: { what: 'Description body.' },
      fields: [
        { name: 'Health', type: 'FCreatureState' },
        { name: 'Stamina', type: 'FCreatureState' }
      ]
    }) as unknown as FakeElement;
    const tabs = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-tabs') as FakeElement;
    const frame = card.children.find((child) => child instanceof FakeElement && child.className === 'ledger-card-tab-frame') as FakeElement;
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

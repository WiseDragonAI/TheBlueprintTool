import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  disabled = false;

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

test('ledger card chrome renders todo processing and done workflow statuses', async () => {
  const previousDocument = globalThis.document;
  (globalThis as unknown as { document: unknown }).document = {
    querySelector: () => new FakeElement('div'),
    createElement: (tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text)
  };

  try {
    const { patchLedgerCard } = await import('../../src/runtime/ledger/component/patch-ledger-card.js');
    const { renderLedgerCardStatusButton } = await import('../../src/runtime/ledger/component/render-ledger-card-status-button.js');
    const { state } = await import('../../src/runtime/state.js');
    state.activeLedger = {
      notes: {
        'thread-card-processing': [{ role: 'operator', message: 'Operator sent work.' }],
        'thread-card-done': [{ role: 'agent', message: 'Fresh answer.' }]
      }
    };

    const todo = patchLedgerCard({ id: 'card-todo', title: 'Todo', comment: { what: 'Todo.' } }) as unknown as FakeElement;
    const processing = patchLedgerCard({ id: 'card-processing', title: 'Processing', comment: { what: 'Processing.' } }) as unknown as FakeElement;
    const done = patchLedgerCard({ id: 'card-done', status: 'done', title: 'Done', comment: { what: 'Done.' } }) as unknown as FakeElement;

    const todoIndicator = findElementByClass(todo, 'card-status-indicator') as FakeElement;
    const processingIndicator = findElementByClass(processing, 'card-status-indicator') as FakeElement;
    const processingButton = renderLedgerCardStatusButton('card-processing', 'todo', 'processing') as unknown as FakeElement;
    const doneButton = renderLedgerCardStatusButton('card-done', 'done', 'done') as unknown as FakeElement;

    assert.equal(todo.dataset.cardStatus, 'todo');
    assert.equal(todo.dataset.cardWorkStatus, 'todo');
    assert.equal(todoIndicator.textContent, 'todo');
    assert.equal(processing.dataset.cardStatus, 'todo');
    assert.equal(processing.dataset.cardWorkStatus, 'processing');
    assert.equal(processingIndicator.textContent, 'processing');
    assert.equal(processingButton.disabled, true);
    assert.equal(processingButton.dataset.cardCurrentStatus, 'processing');
    assert.equal(processingButton.attributes['aria-label'], 'Current status: processing. Waiting for agent response');
    assert.equal(processing.children.some((child) => child instanceof FakeElement && child.className.includes('ledger-card-status-toggle')), false);
    assert.equal(done.dataset.cardStatus, 'done');
    assert.equal(done.dataset.cardWorkStatus, 'done');
    assert.equal(doneButton.dataset.cardCurrentStatus, 'done');
    assert.equal(doneButton.dataset.nextStatus, 'todo');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('card status chip stays in the header flow instead of overlaying the title', () => {
  const css = readFileSync(new URL('../../assets/canvas/objects.css', import.meta.url), 'utf8');
  assert.match(css, /\.card-status-indicator\s*{[^}]*float:\s*left;[^}]*margin:\s*2px 6px 2px 2px;/s);
  assert.doesNotMatch(css, /\.card-status-indicator\s*{[^}]*position:\s*absolute;/s);
});

test('card status toggle color follows the visible next status action', () => {
  const css = readFileSync(new URL('../../assets/canvas/objects.css', import.meta.url), 'utf8');
  const controlOverlay = readFileSync(new URL('../../src/runtime/canvas/effect/render-canvas-control-overlay.ts', import.meta.url), 'utf8');
  assert.match(css, /\.ledger-card-status-toggle\[data-next-status\]/);
  assert.match(css, /--card-status-toggle-accent:\s*var\(--card-zone-color,\s*#55b8ff\);/);
  assert.match(css, /\.ledger-card-status-toggle\[data-next-status="done"\]\s*{[^}]*--card-status-toggle-accent:\s*#74d680;/s);
  assert.doesNotMatch(css, /\.ledger-card-status-toggle\[data-card-current-status="done"\]\s*{[^}]*--card-status-toggle-accent:\s*#74d680;/s);
  assert.match(controlOverlay, /group\.style\.setProperty\('--card-zone-color', cardZoneColor\);/);
});

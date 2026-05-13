import test from 'node:test';
import assert from 'node:assert/strict';
import { patchLedgerCard } from '../../src/runtime/ledger/component/patch-ledger-card.js';

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
  style: Record<string, string> = {};
  textContent = '';
  children: Array<FakeElement | FakeText> = [];

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  appendChild<T extends FakeElement | FakeText>(child: T): T {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children: Array<FakeElement | FakeText>): void {
    this.children = children;
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
    const body = card.children[2] as FakeElement;
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

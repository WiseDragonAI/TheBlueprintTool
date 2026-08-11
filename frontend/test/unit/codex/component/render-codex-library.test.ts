/** WHAT: Proves the shared Codex catalog selection contract. WHY: Every surface must filter and order identical records identically. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderCodexLibrary, visibleCodexLibraryRecords } from '../../../../src/runtime/codex/component/render-codex-library.js';

const alpha = { id: 'alpha', name: 'Alpha', description: 'Analyze interfaces', favorite: false, tags: ['Interface'], projects: [{ id: 'one', name: 'One' }] };
const beta = { id: 'beta', name: 'Beta', description: 'Build reports', favorite: true, tags: ['Reporting'], projects: [{ id: 'two', name: 'Two' }] };
const gamma = { id: 'gamma', name: 'Gamma', description: 'Build interfaces', favorite: true, tags: ['Interface'], projects: [{ id: 'one', name: 'One' }] };

test('shared catalog combines query, project, and tag filters', () => {
  assert.deepEqual(
    visibleCodexLibraryRecords([alpha, beta, gamma], { query: 'build', projectId: 'one', tag: 'Interface' }, true).map((record) => record.id),
    ['gamma'],
  );
});

test('shared skill ordering keeps favorites first and names deterministic', () => {
  assert.deepEqual(
    visibleCodexLibraryRecords([gamma, alpha, beta], { query: '', projectId: 'All', tag: 'All' }, true).map((record) => record.id),
    ['beta', 'gamma', 'alpha'],
  );
});

test('shared pipeline ordering ignores favorite state when disabled', () => {
  assert.deepEqual(
    visibleCodexLibraryRecords([gamma, alpha, beta], { query: '', projectId: 'All', tag: 'All' }).map((record) => record.id),
    ['alpha', 'beta', 'gamma'],
  );
});

class FakeStyle {
  setProperty(): void {}
}

class FakeClassList {
  constructor(private readonly element: FakeElement) {}

  add(...classNames: string[]): void {
    this.element.className = [...new Set([...this.element.className.split(/\s+/).filter(Boolean), ...classNames])].join(' ');
  }

  contains(className: string): boolean {
    return this.element.className.split(/\s+/).includes(className);
  }
}

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  oninput: (() => void) | null = null;
  parentElement: FakeElement | null = null;
  placeholder = '';
  style = new FakeStyle();
  textContent = '';
  type = '';
  value = '';
  children: FakeElement[] = [];
  readonly classList = new FakeClassList(this);
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Array<() => void>>();

  constructor(readonly tagName: string, private readonly owner: FakeDocument) {}

  get nextSibling(): FakeElement | null {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return this.parentElement.children[index + 1] ?? null;
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      const previousParent = child.parentElement;
      const previousIndex = previousParent?.children.indexOf(child) ?? -1;
      // WHAT: Detach an already-mounted child without clearing its active focus state.
      // WHY: Native DOM append moves a focused element and preserves focus across rerenders.
      if (previousParent && previousIndex >= 0) previousParent.children.splice(previousIndex, 1);
      child.parentElement = this;
      this.children.push(child);
    }
  }

  focus(): void {
    this.owner.activeElement = this;
  }

  querySelector(selector: string): FakeElement | null {
    const className = selector.startsWith('.') ? selector.slice(1) : '';
    for (const child of this.children) {
      if (className && child.classList.contains(className)) return child;
      const descendant = child.querySelector(selector);
      if (descendant) return descendant;
    }
    return null;
  }

  remove(): void {
    if (!this.parentElement) return;
    if (this.contains(this.owner.activeElement)) this.owner.activeElement = null;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  replaceChildren(...children: FakeElement[]): void {
    for (const child of [...this.children]) child.remove();
    this.append(...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  private contains(candidate: FakeElement | null): boolean {
    return candidate === this || this.children.some((child) => child.contains(candidate));
  }
}

class FakeDocument {
  activeElement: FakeElement | null = null;

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }
}

test('shared catalog keeps its search input mounted while query filtering rerenders', () => {
  const previousDocument = globalThis.document;
  const fakeDocument = new FakeDocument();
  globalThis.document = fakeDocument as unknown as Document;
  try {
    const controls = fakeDocument.createElement('div');
    const results = fakeDocument.createElement('div');
    let filters = { query: '', projectId: 'All', tag: 'All' };
    const render = (): void => {
      renderCodexLibrary({
        records: [alpha, beta, gamma],
        projects: [],
        filters,
        controlsHost: controls as unknown as HTMLElement,
        resultsHost: results as unknown as HTMLElement,
        emptyMessage: 'No matches.',
        resultCountLabel: 'records',
        onFiltersChanged: (next) => {
          filters = next;
          render();
        },
        renderRecord: (record) => {
          const row = fakeDocument.createElement('article');
          row.dataset.recordId = record.id;
          return row as unknown as HTMLElement;
        },
      });
    };

    render();
    const search = controls.querySelector('.codex-library-query');
    assert.ok(search);
    search.focus();
    search.value = 'build';
    search.oninput?.();

    assert.equal(controls.querySelector('.codex-library-query'), search);
    assert.equal(fakeDocument.activeElement, search);
    assert.equal(results.dataset.resultCount, '2');
  } finally {
    globalThis.document = previousDocument;
  }
});

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

  remove(...classNames: string[]): void {
    this.element.className = this.element.className.split(/\s+/).filter((className) => className && !classNames.includes(className)).join(' ');
  }

  toggle(className: string, force?: boolean): boolean {
    const shouldAdd = force ?? !this.contains(className);
    // WHAT: Apply the requested fake-DOM class state to mirror the browser toggle contract.
    // WHY: The mobile filter regression must observe the same open-state transition as the renderer.
    if (shouldAdd) this.add(className);
    else this.remove(className);
    return shouldAdd;
  }
}

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  onclick: (() => void) | null = null;
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

  click(): void {
    this.onclick?.();
    for (const listener of this.listeners.get('click') ?? []) listener();
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

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
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

function descendantsWithClass(element: FakeElement, className: string): FakeElement[] {
  return element.children.flatMap((child) => [
    ...(child.classList.contains(className) ? [child] : []),
    ...descendantsWithClass(child, className),
  ]);
}

function controlByText(element: FakeElement, className: string, text: string): FakeElement {
  const control = descendantsWithClass(element, className).find((candidate) => candidate.textContent === text);
  assert.ok(control, `expected ${className} control with text ${text}`);
  return control;
}

function assertSingleLibraryShell(controls: FakeElement, expectedActions: readonly string[]): void {
  for (const className of [
    'codex-mobile-filter-toggle',
    'codex-library-filter-backdrop',
    'codex-library-filter-panel',
    'codex-library-search',
    'codex-library-query',
    'codex-library-project-filters',
    'codex-library-tag-filters',
    'codex-library-control-actions',
  ]) assert.equal(descendantsWithClass(controls, className).length, 1, `expected one ${className}`);
  for (const className of expectedActions) assert.equal(descendantsWithClass(controls, className).length, 1, `expected one ${className}`);
}

test('shared catalog retains one complete focused shell across repeated Skills, Pipelines, and picker transitions', () => {
  const previousDocument = globalThis.document;
  const fakeDocument = new FakeDocument();
  globalThis.document = fakeDocument as unknown as Document;
  try {
    for (const surface of [
      { name: 'Skills', create: true, synchronize: true },
      { name: 'Pipelines', create: false, synchronize: true },
      { name: 'skill picker', create: false, synchronize: false },
    ]) {
      const controls = fakeDocument.createElement('div');
      const results = fakeDocument.createElement('div');
      let filters = { query: '', projectId: 'All', tag: 'All' };
      let createEnabled = surface.create;
      let synchronizeEnabled = surface.synchronize;
      const render = (): void => {
        renderCodexLibrary({
          records: [alpha, beta, gamma],
          projects: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }],
          filters,
          controlsHost: controls as unknown as HTMLElement,
          resultsHost: results as unknown as HTMLElement,
          showProjects: true,
          emptyMessage: 'No matches.',
          resultCountLabel: `${surface.name} records`,
          onCreate: createEnabled ? () => {} : undefined,
          onSynchronize: synchronizeEnabled ? () => {} : undefined,
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
      assert.ok(search, `expected a mounted search for ${surface.name}`);
      search.focus();
      search.value = 'build';
      search.oninput?.();
      assertSingleLibraryShell(controls, ['codex-filter-clear', ...(createEnabled ? ['codex-library-create'] : []), ...(synchronizeEnabled ? ['codex-library-synchronize'] : [])]);
      assert.equal(controls.querySelector('.codex-library-query'), search);
      assert.equal(fakeDocument.activeElement, search);
      assert.equal(results.dataset.resultCount, '2');

      controlByText(controls, 'project-filter-chip', 'One').click();
      assert.equal(filters.projectId, 'one');
      assert.equal(results.dataset.resultCount, '1');
      controlByText(controls, 'skill-category-filter', 'Interface').click();
      assert.equal(filters.tag, 'Interface');
      assert.equal(results.dataset.resultCount, '1');
      controlByText(controls, 'codex-filter-clear', 'Clear filters').click();
      assert.deepEqual(filters, { query: '', projectId: 'All', tag: 'All' });

      const toggle = controls.querySelector('.codex-mobile-filter-toggle');
      assert.ok(toggle);
      toggle.click();
      assert.equal(controls.dataset.mobileFiltersOpen, 'true');
      assert.equal(controls.classList.contains('mobile-filters-open'), true);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      controlByText(controls, 'codex-library-filter-close', '×').click();
      assert.equal(controls.dataset.mobileFiltersOpen, 'false');
      controls.querySelector('.codex-library-filter-backdrop')?.click();
      assert.equal(controls.classList.contains('mobile-filters-open'), false);

      createEnabled = false;
      synchronizeEnabled = false;
      render();
      assertSingleLibraryShell(controls, ['codex-filter-clear']);
      assert.equal(descendantsWithClass(controls, 'codex-library-create').length, 0);
      assert.equal(descendantsWithClass(controls, 'codex-library-synchronize').length, 0);
    }
  } finally {
    globalThis.document = previousDocument;
  }
});

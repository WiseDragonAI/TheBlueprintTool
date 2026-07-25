/**
 * WHAT: Verifies typed execution todos render as the dedicated Codex Log overlay.
 * WHY: Removing raw tool results must not remove todo state or demote it into the scrolling event stream.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTaskExecutionTodoOverlay } from '../../../../src/runtime/thread/component/render-task-execution-todo-overlay.js';

class FakeElement {
  children: FakeElement[] = [];
  className = '';
  textContent = '';
  attributes: Record<string, string> = {};
  constructor(public tagName: string) {}
  append(...nodes: FakeElement[]): void { this.children.push(...nodes); }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
}

test('renders pending and completed todo items in a labeled overlay', () => {
  const previousDocument = globalThis.document;
  try {
    globalThis.document = { createElement: (tag: string) => new FakeElement(tag) } as unknown as Document;
    const overlay = renderTaskExecutionTodoOverlay({
      id: 'todo:current',
      kind: 'todo_list',
      title: 'Todo list',
      status: 'in_progress',
      severity: 'info',
      items: [
        { text: 'Inspect', completed: true },
        { text: 'Render', completed: false },
      ],
    }) as unknown as FakeElement;

    assert.equal(overlay.className, 'codex-todo-overlay');
    assert.equal(overlay.attributes['aria-label'], 'Codex todo list');
    assert.equal(overlay.children[0].children[0].textContent, '1/2');
    assert.deepEqual(overlay.children[1].children.map((row) => row.className), ['is-completed', 'is-pending']);
    assert.deepEqual(overlay.children[1].children.map((row) => row.children[1].textContent), ['Inspect', 'Render']);
  } finally {
    globalThis.document = previousDocument;
  }
});

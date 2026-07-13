import test from 'node:test';
import assert from 'node:assert/strict';
import { renderThreadCodexLogEvent } from '../../../../src/runtime/thread/component/render-thread-codex-log-event.js';
import type { ThreadRunLogEvent } from '../../../../src/runtime/codex/helper/thread-run-log.js';

class FakeElement {
  children: FakeElement[] = [];
  className = '';
  dataset: Record<string, string> = {};
  hidden = false;
  textContent = '';
  attributes: Record<string, string> = {};
  classList = { add: (...names: string[]) => { this.className = [this.className, ...names].filter(Boolean).join(' '); } };
  constructor(public tagName: string) {}
  append(...nodes: FakeElement[]): void { this.children.push(...nodes); }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
}

function descendants(root: FakeElement): FakeElement[] {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

test('renders native todo-list rows with distinct pending and completed state', () => {
  const previousDocument = globalThis.document;
  try {
    globalThis.document = { createElement: (tag: string) => new FakeElement(tag) } as unknown as Document;
    const event = {
      runId: 'run-1', line: 1, source: 'jsonl', sourceLine: 1, type: 'item.updated', kind: 'todo_list',
      title: 'Todo list', text: '- [x] Inspect\n- [ ] Render', status: 'in_progress', itemId: 'todo-1',
      tool: 'TodoList', output: '[{"text":"Inspect","completed":true},{"text":"Render","completed":false}]',
      exitCode: '', severity: 'info', persist: true, eventKey: 'run-1:item:todo-1', toolKey: '',
    } satisfies ThreadRunLogEvent;
    const rendered = renderThreadCodexLogEvent(event) as unknown as FakeElement;
    const nodes = descendants(rendered);
    const list = nodes.find((node) => node.className.includes('codex-todo-list'));
    assert.ok(list);
    assert.deepEqual(list.children.map((row) => row.className), ['is-completed', 'is-pending']);
    assert.deepEqual(list.children.map((row) => row.children[1].textContent), ['Inspect', 'Render']);
    assert.deepEqual(list.children.map((row) => row.children[0].textContent), ['✓', '○']);
  } finally {
    globalThis.document = previousDocument;
  }
});

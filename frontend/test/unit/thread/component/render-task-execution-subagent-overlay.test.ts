/**
 * WHAT: Verifies queued dynamic skills render as a lifecycle-aware subagent inventory.
 * WHY: The gate log must expose the real child execution state without parsing commands in the browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTaskExecutionSubagentOverlay } from '../../../../src/runtime/thread/component/render-task-execution-subagent-overlay.js';

class FakeElement {
  children: FakeElement[] = [];
  className = '';
  textContent = '';
  attributes: Record<string, string> = {};
  dataset: Record<string, string> = {};
  constructor(public tagName: string) {}
  append(...nodes: FakeElement[]): void { this.children.push(...nodes); }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
}

test('renders skill configuration and correlated child execution phase', () => {
  const previousDocument = globalThis.document;
  try {
    globalThis.document = { createElement: (tag: string) => new FakeElement(tag) } as unknown as Document;
    const overlay = renderTaskExecutionSubagentOverlay([{
      event: {
        id: 'subagent:item-1',
        kind: 'subagent',
        title: 'Subagent · product-analysis',
        status: 'completed',
        severity: 'info',
        skillName: 'product-analysis',
        model: 'gpt-5.6-luna',
        effort: 'low',
      },
      execution: {
        executionId: 'execution-child',
        sessionId: 'session-child',
        sourceCardId: 'card-a',
        kind: 'pipeline-skill',
        phase: 'running',
        requestedAt: '2026-07-29T00:00:00.000Z',
        startedAt: '2026-07-29T00:00:01.000Z',
        finishedAt: null,
        model: 'gpt-5.6-luna',
        effort: 'low',
        predecessorExecutionId: 'execution-gate',
        executorNodeId: 'workstation',
        revision: 2,
        queuePosition: null,
        error: null,
        artifacts: { jsonl: true, stderr: true, telemetry: false, result: false },
      },
    }]) as unknown as FakeElement;

    assert.equal(overlay.className, 'codex-subagent-overlay');
    assert.equal(overlay.attributes['aria-label'], 'Codex subagents');
    assert.equal(overlay.children[0].children[0].textContent, '0/1 settled');
    const row = overlay.children[1].children[0];
    assert.equal(row.dataset.runStatus, 'running');
    assert.deepEqual(row.children.map((child) => child.textContent), [
      'product-analysis',
      'gpt-5.6-luna · low',
      'running',
    ]);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('renders a native subagent without an invented model or effort', () => {
  const previousDocument = globalThis.document;
  try {
    globalThis.document = { createElement: (tag: string) => new FakeElement(tag) } as unknown as Document;
    const overlay = renderTaskExecutionSubagentOverlay([{
      event: {
        id: 'subagent:019fbcde-775b-7fe0-891e-f79dcb51f6de',
        kind: 'subagent',
        title: 'Subagent · native · 019fbcde',
        status: 'running',
        severity: 'info',
        skillName: 'native · 019fbcde',
        model: '',
        effort: '',
      },
      execution: null,
    }]) as unknown as FakeElement;

    assert.equal(overlay.children[0].children[0].textContent, '0/1 settled');
    const row = overlay.children[1].children[0];
    assert.equal(row.dataset.runStatus, 'running');
    assert.deepEqual(row.children.map((child) => child.textContent), [
      'native · 019fbcde',
      '',
      'running',
    ]);
  } finally {
    globalThis.document = previousDocument;
  }
});

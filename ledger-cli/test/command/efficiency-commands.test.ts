import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manageLedgerJsonController } from '../../src/business/ledger/controller/manage-ledger-json.js';
import { applyMasterTaskPlan } from '../../src/business/ledger/helper/apply-master-task-plan.js';
import { applyMasterTaskProgress } from '../../src/business/ledger/helper/apply-master-task-progress.js';
import { auditCodexRuns } from '../../src/business/ledger/helper/audit-codex-runs.js';
import { resolveCodexRunEvents } from '../../src/business/ledger/helper/resolve-codex-run-events.js';

function fixture(): { root: string; decisionOs: string; ledger: string } {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-efficiency-'));
  const decisionOs = join(root, '.decision-os');
  mkdirSync(join(decisionOs, 'cards', 'specs'), { recursive: true });
  mkdirSync(join(decisionOs, 'threads', 'specs'), { recursive: true });
  const ledger = join(decisionOs, 'specs.json');
  writeFileSync(join(decisionOs, 'cards', 'specs', 'master.md'), '#master-task #task-active\n\nLedger: Specs\nWaiting since: 2026-01-01T00:00:00.000Z\nActive since: 2026-01-01T00:00:00.000Z\n\n## A. Current Finding\n\n1. **State:** Ready for the operator.\n\n---\n\n## B. Subtasks\n');
  writeFileSync(join(decisionOs, 'threads', 'specs', 'thread-master.md'), '# OPERATOR\n<!-- decision-os:note {"id":"n","timestamp":"2026-01-01T00:00:00.000Z"} -->\n\nDo it.\n');
  writeFileSync(ledger, JSON.stringify({
    cards: [{ id: 'master', title: 'Master', status: 'todo', labels: ['master-task'], domainId: 'specs', x: 10, y: 10, w: 100, h: 100, comment: { contentFile: '.decision-os/cards/specs/master.md' } }],
    annotations: [{ id: 'zone-a', variant: 'zone', label: 'Zone', x: 0, y: 0, width: 800, height: 800 }],
    relationships: [], notes: {}, threadFiles: { 'thread-master': '.decision-os/threads/specs/thread-master.md' },
  }, null, 2));
  return { root, decisionOs, ledger };
}

test('session context and gate return one bounded project-scoped response', async () => {
  const { decisionOs, ledger } = fixture();
  const previousRoot = process.env.DECISION_OS_LEDGER_ROOT;
  const previousProject = process.env.DECISION_OS_PROJECT_ID;
  process.env.DECISION_OS_LEDGER_ROOT = decisionOs;
  process.env.DECISION_OS_PROJECT_ID = 'project-a';
  try {
    const context = await manageLedgerJsonController({ ledgerCommand: 'session-context', ledgerJsonFile: ledger, cardOperation: { cardId: 'master' } });
    assert.equal(context.ok, true);
    if (context.ok) {
      const value = JSON.parse(String(context.value));
      assert.equal(value.projectId, 'project-a');
      assert.equal(value.thread.contentFile, '.decision-os/threads/specs/thread-master.md');
      assert.equal(value.thread.markdown, undefined);
      assert.equal(value.actions.masterTaskApply.input.sections[0].title, 'string');
    }
    const gate = await manageLedgerJsonController({ ledgerCommand: 'master-task-gate', ledgerJsonFile: ledger, cardOperation: { cardId: 'master' } });
    assert.equal(gate.ok, true);
    if (gate.ok) {
      const value = JSON.parse(String(gate.value));
      assert.equal(value.ready, true);
      assert.equal('acceptanceCriteria' in value, false);
    }
  } finally {
    if (previousRoot === undefined) delete process.env.DECISION_OS_LEDGER_ROOT; else process.env.DECISION_OS_LEDGER_ROOT = previousRoot;
    if (previousProject === undefined) delete process.env.DECISION_OS_PROJECT_ID; else process.env.DECISION_OS_PROJECT_ID = previousProject;
  }
});

test('master-task apply writes narrative content and positioned structural subtasks', () => {
  const { decisionOs, ledger } = fixture();
  const previousRoot = process.env.DECISION_OS_LEDGER_ROOT;
  process.env.DECISION_OS_LEDGER_ROOT = decisionOs;
  try {
    const result = applyMasterTaskPlan({ ledgerJsonFile: ledger, planJson: JSON.stringify({
      masterCardId: 'master', title: 'Renamed', zoneTitle: 'Renamed',
      sections: [{ title: 'H. Decision', markdown: '1. **Choice:** Build it.' }],
      subtasks: [{ title: 'Child', sections: [{ title: 'A. Implementation Detail', markdown: '1. **Objective:** Implement it.' }] }],
    }) });
    assert.equal(result.ok, true, result.ok ? undefined : result.error);
    const persisted = JSON.parse(readFileSync(ledger, 'utf8')) as { cards: Array<{ id: string; title: string; labels: string[]; createdAt?: string }>; relationships: Array<{ position?: number }> };
    assert.equal(persisted.cards.length, 2);
    assert.match(persisted.cards[1].id, /^card-[0-9a-f-]{36}$/);
    assert.equal(persisted.relationships.length, 1);
    assert.deepEqual(persisted.cards.map((card) => card.labels), [['master-task'], []]);
    assert.equal(typeof persisted.cards[0].createdAt, 'string');
    assert.equal(typeof persisted.cards[1].createdAt, 'string');
    assert.equal(persisted.relationships[0].position, 0);
    const masterMarkdown = readFileSync(join(decisionOs, 'cards', 'specs', 'master.md'), 'utf8');
    assert.match(masterMarkdown, /## A\. Decision/);
    assert.doesNotMatch(masterMarkdown, /## A\. H\./);
    assert.doesNotMatch(masterMarkdown, /#master-task|#task-active|Status:|Waiting since:|Subtasks/);
    const subtaskMarkdown = readFileSync(join(ledger, '../..', `.decision-os/cards/specs/${persisted.cards[1].id}.md`), 'utf8');
    assert.match(subtaskMarkdown, /## A\. Implementation Detail/);
    assert.doesNotMatch(subtaskMarkdown, /## A\. A\./);
  } finally {
    if (previousRoot === undefined) delete process.env.DECISION_OS_LEDGER_ROOT; else process.env.DECISION_OS_LEDGER_ROOT = previousRoot;
  }
});

test('master-task progress writes narrative content after scoped lifecycle completion', () => {
  const { decisionOs, ledger } = fixture();
  const previousRoot = process.env.DECISION_OS_LEDGER_ROOT;
  process.env.DECISION_OS_LEDGER_ROOT = decisionOs;
  try {
  const applied = applyMasterTaskPlan({ ledgerJsonFile: ledger, planJson: JSON.stringify({
    masterCardId: 'master', title: 'Master', sections: [{ title: 'Decision', markdown: '1. **Choice:** Build it.' }],
    subtasks: [{ title: 'Child', sections: [{ title: 'Scope', markdown: '1. **Objective:** Build it.' }] }],
  }) });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const childId = JSON.parse(applied.value).subtasks[0].cardId as string;
  const lifecycleLedger = JSON.parse(readFileSync(ledger, 'utf8')) as { cards: Array<{ id: string; status: string }> };
  lifecycleLedger.cards.find((card) => card.id === childId)!.status = 'done';
  writeFileSync(ledger, JSON.stringify(lifecycleLedger, null, 2));
  const progress = applyMasterTaskProgress({ ledgerJsonFile: ledger, planJson: JSON.stringify({
    masterCardId: 'master',
    updates: [
      { cardId: 'master', markdown: '#master-task #task-active\n\nLedger: Specs\nWaiting since: 2026-01-01T00:00:00.000Z\n\n## A. Result\n\n1. **State:** Implemented.\n\n## B. Subtasks\n\n1. [Stale title](card:' + childId + ') — Status: pending' },
      { cardId: childId, sections: [{ title: 'B. Result', markdown: '1. **State:** Verified.' }] },
    ],
    verifiedSubtaskIds: [childId],
    reply: 'Implementation verified.',
  }) });
  assert.equal(progress.ok, true, progress.ok ? undefined : progress.error);
  if (!progress.ok) return;
  const value = JSON.parse(progress.value);
  assert.deepEqual(value.gate, { ready: true, discrepancies: [] });
  const persisted = JSON.parse(readFileSync(ledger, 'utf8')) as { cards: Array<{ id: string; status: string; labels: string[] }> };
  assert.equal(persisted.cards.find((card) => card.id === 'master')?.status, 'todo');
  assert.equal(persisted.cards.find((card) => card.id === childId)?.status, 'done');
  assert.deepEqual(persisted.cards.find((card) => card.id === childId)?.labels, []);
  const masterMarkdown = readFileSync(join(decisionOs, 'cards', 'specs', 'master.md'), 'utf8');
  assert.doesNotMatch(masterMarkdown, /#master-task|#task-active|Status:|Stale title/);
  assert.doesNotMatch(masterMarkdown, /Subtasks|card:/);
  const childMarkdown = readFileSync(join(ledger, '../..', `.decision-os/cards/specs/${childId}.md`), 'utf8');
  assert.match(childMarkdown, /## A\. Result/);
  assert.doesNotMatch(childMarkdown, /## A\. B\./);
  assert.match(readFileSync(join(decisionOs, 'threads', 'specs', 'thread-master.md'), 'utf8'), /# AGENT[\s\S]*Implementation verified\./);
  } finally {
    if (previousRoot === undefined) delete process.env.DECISION_OS_LEDGER_ROOT; else process.env.DECISION_OS_LEDGER_ROOT = previousRoot;
  }
});

test('master-task progress rejects an invalid update without changing any file', () => {
  const { decisionOs, ledger } = fixture();
  const previousRoot = process.env.DECISION_OS_LEDGER_ROOT;
  process.env.DECISION_OS_LEDGER_ROOT = decisionOs;
  try {
  const before = [ledger, join(decisionOs, 'cards', 'specs', 'master.md'), join(decisionOs, 'threads', 'specs', 'thread-master.md')].map((file) => readFileSync(file, 'utf8'));
  const result = applyMasterTaskProgress({ ledgerJsonFile: ledger, planJson: JSON.stringify({
    masterCardId: 'master', updates: [{ cardId: 'outside', markdown: 'Changed.' }], verifiedSubtaskIds: [], reply: 'Reply.',
  }) });
  assert.equal(result.ok, false);
  assert.deepEqual([ledger, join(decisionOs, 'cards', 'specs', 'master.md'), join(decisionOs, 'threads', 'specs', 'thread-master.md')].map((file) => readFileSync(file, 'utf8')), before);
  } finally {
    if (previousRoot === undefined) delete process.env.DECISION_OS_LEDGER_ROOT; else process.env.DECISION_OS_LEDGER_ROOT = previousRoot;
  }
});

test('execution profile puts verification behind the lease without a concurrency override', async () => {
  const { decisionOs, ledger } = fixture();
  const workspace = join(decisionOs, '..');
  const backendModules = join(workspace, 'backend', 'node_modules');
  mkdirSync(join(backendModules, 'tsx', 'dist', 'esm'), { recursive: true });
  mkdirSync(join(backendModules, '.bin'), { recursive: true });
  writeFileSync(join(backendModules, 'tsx', 'dist', 'esm', 'index.mjs'), '');
  writeFileSync(join(backendModules, '.bin', 'tsc'), '');
  const previousRoot = process.env.DECISION_OS_LEDGER_ROOT;
  process.env.DECISION_OS_LEDGER_ROOT = decisionOs;
  try {
    const result = await manageLedgerJsonController({ ledgerCommand: 'execution-profile', ledgerJsonFile: ledger });
    assert.equal(result.ok, true);
    if (result.ok) {
      const profile = JSON.parse(String(result.value));
      assert.equal(profile.commands.verificationLease, 'node bin/decision-os-verify.mjs -- <command> [args...]');
      assert.ok(profile.commands.typechecks.every((command: string) => command.includes('decision-os-verify.mjs')));
      assert.ok(profile.commands.focusedTests.every((command: string) => command.includes('decision-os-verify.mjs')));
      assert.ok(profile.commands.focusedTests.every((command: string) => !command.includes('test-concurrency')));
    }
  } finally {
    if (previousRoot === undefined) delete process.env.DECISION_OS_LEDGER_ROOT; else process.env.DECISION_OS_LEDGER_ROOT = previousRoot;
  }
});

test('bounded run events returns only the requested event type from one catalog run', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-events-'));
  const decisionOs = join(root, 'project', '.decision-os');
  const runs = join(decisionOs, 'runs', 'codex-skills', 'specs');
  mkdirSync(runs, { recursive: true });
  writeFileSync(join(decisionOs, 'state.json'), '{}');
  writeFileSync(join(decisionOs, 'project.json'), JSON.stringify({ id: 'project-a' }));
  const runId = 'codex-skill-300-abcd';
  writeFileSync(join(runs, `${runId}.jsonl`), [
    JSON.stringify({ type: 'item.completed', item: { id: 'todo-1', type: 'todo_list', items: [{ text: 'One', completed: false }] } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'tool-1', type: 'command_execution', aggregated_output: 'large output' } }),
  ].join('\n'));
  const result = resolveCodexRunEvents({ root, runId, itemType: 'todo_list' });
  assert.equal(result.ok, true);
  if (result.ok) {
    const value = JSON.parse(result.value);
    assert.equal(value.projectId, 'project-a');
    assert.equal(value.events.length, 1);
    assert.equal(value.events[0].itemId, 'todo-1');
    assert.doesNotMatch(result.value, /large output/);
  }
});

test('run audit selects newest runs across projects and calculates telemetry percentiles', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-audit-'));
  for (const [project, epoch] of [['a', 100], ['b', 200]] as const) {
    const runs = join(root, project, '.decision-os', 'runs', 'codex-skills', 'specs');
    mkdirSync(runs, { recursive: true });
    writeFileSync(join(root, project, '.decision-os', 'state.json'), '{}');
    const run = `codex-skill-${epoch}-abcd`;
    writeFileSync(join(runs, `${run}.jsonl`), '{}\n');
    writeFileSync(join(runs, `${run}.jsonl.telemetry.jsonl`), `${JSON.stringify({ durationMs: epoch, tool: 'shell rg', success: true, outputBytes: 2, runId: run })}\n`);
  }
  const result = auditCodexRuns({ root, count: 2, exclusions: [] });
  assert.equal(result.ok, true);
  if (result.ok) {
    const report = JSON.parse(result.value);
    assert.deepEqual(report.selection.map((run: { startedEpoch: number }) => run.startedEpoch), [200, 100]);
    assert.equal(report.aggregate.medianLatencyMs, 100);
    assert.equal(report.aggregate.p95LatencyMs, 200);
  }
});

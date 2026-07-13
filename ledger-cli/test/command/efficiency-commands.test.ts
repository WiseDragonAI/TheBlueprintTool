import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manageLedgerJsonController } from '../../src/business/ledger/controller/manage-ledger-json.js';
import { applyMasterTaskPlan } from '../../src/business/ledger/helper/apply-master-task-plan.js';
import { auditCodexRuns } from '../../src/business/ledger/helper/audit-codex-runs.js';

function fixture(): { root: string; decisionOs: string; ledger: string } {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-efficiency-'));
  const decisionOs = join(root, '.decision-os');
  mkdirSync(join(decisionOs, 'cards', 'specs'), { recursive: true });
  mkdirSync(join(decisionOs, 'threads', 'specs'), { recursive: true });
  const ledger = join(decisionOs, 'specs.json');
  writeFileSync(join(decisionOs, 'cards', 'specs', 'master.md'), '#master-task #task-active\n\nLedger: Specs\nWaiting since: 2026-01-01T00:00:00.000Z\nActive since: 2026-01-01T00:00:00.000Z\n\n## A. Subtasks\n');
  writeFileSync(join(decisionOs, 'threads', 'specs', 'thread-master.md'), '# OPERATOR\n<!-- decision-os:note {"id":"n","timestamp":"2026-01-01T00:00:00.000Z"} -->\n\nDo it.\n');
  writeFileSync(ledger, JSON.stringify({
    cards: [{ id: 'master', title: 'Master', status: 'todo', domainId: 'specs', x: 10, y: 10, w: 100, h: 100, comment: { contentFile: '.decision-os/cards/specs/master.md' } }],
    annotations: [{ id: 'zone-a', variant: 'zone', label: 'Zone', x: 0, y: 0, width: 800, height: 800 }],
    relationships: [], notes: {}, threadFiles: { 'thread-master': '.decision-os/threads/specs/thread-master.md' },
  }, null, 2));
  return { root, decisionOs, ledger };
}

test('session context and gate return one bounded project-scoped response', async () => {
  const { decisionOs, ledger } = fixture();
  const previousRoot = process.env.DECISION_OS_ROOT;
  const previousProject = process.env.DECISION_OS_PROJECT_ID;
  process.env.DECISION_OS_ROOT = decisionOs;
  process.env.DECISION_OS_PROJECT_ID = 'project-a';
  try {
    const context = await manageLedgerJsonController({ ledgerCommand: 'session-context', ledgerJsonFile: ledger, cardOperation: { cardId: 'master' } });
    assert.equal(context.ok, true);
    if (context.ok) {
      const value = JSON.parse(String(context.value));
      assert.equal(value.projectId, 'project-a');
      assert.match(value.thread.markdown, /Do it\./);
    }
    const gate = await manageLedgerJsonController({ ledgerCommand: 'master-task-gate', ledgerJsonFile: ledger, cardOperation: { cardId: 'master' } });
    assert.equal(gate.ok, true);
    if (gate.ok) assert.equal(JSON.parse(String(gate.value)).ready, true);
  } finally {
    if (previousRoot === undefined) delete process.env.DECISION_OS_ROOT; else process.env.DECISION_OS_ROOT = previousRoot;
    if (previousProject === undefined) delete process.env.DECISION_OS_PROJECT_ID; else process.env.DECISION_OS_PROJECT_ID = previousProject;
  }
});

test('master-task apply generates ids and persists the complete projection in one call', () => {
  const { ledger } = fixture();
  const result = applyMasterTaskPlan({ ledgerJsonFile: ledger, planJson: JSON.stringify({
    masterCardId: 'master', title: 'Renamed', zoneTitle: 'Renamed',
    masterMarkdown: '#master-task #task-active\n\nLedger: Specs\nWaiting since: 2026-01-01T00:00:00.000Z\nActive since: 2026-01-01T00:00:00.000Z\n\n## A. Subtasks\n',
    subtasks: [{ title: 'Child', markdown: '## A. Scope\n\n1. **Objective:** Implement it.\n' }],
  }) });
  assert.equal(result.ok, true);
  const persisted = JSON.parse(readFileSync(ledger, 'utf8')) as { cards: Array<{ id: string; title: string }>; relationships: unknown[] };
  assert.equal(persisted.cards.length, 2);
  assert.match(persisted.cards[1].id, /^card-[0-9a-f-]{36}$/);
  assert.equal(persisted.relationships.length, 1);
  assert.match(readFileSync(join(ledger, '../..', `.decision-os/cards/specs/${persisted.cards[1].id}.md`), 'utf8'), /Implement it/);
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

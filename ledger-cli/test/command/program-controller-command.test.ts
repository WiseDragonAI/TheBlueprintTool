/**
 * WHAT: Verifies approved-Plan parsing and compact Program Controller command admission.
 * WHY: long-running orchestration must reject malformed or drifting phase matrices before durable mutation.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLedgerCliArgv } from '../../src/business/command/helper/parse-ledger-cli-argv.js';
import { parseApprovedPlan } from '../../src/business/program/program-controller.js';

const plan = `# Program

## Execution Plan

| PHASE | TITLE | INTENT | DEPENDS_ON | ACCEPTANCE | CONSTRAINTS | EXCLUDED |
|---|---|---|---|---|---|---|
| P01 | Baseline | Establish the baseline | None | Evidence exists | Read only | Production mutation |
| P02 | Owner | Introduce the owner | P01 | Consumers use it | Preserve behavior | Cleanup |
`;

test('approved Plan parser preserves ordered phase contracts and dependencies', () => {
  const parsed = parseApprovedPlan(plan);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.title, 'Program');
  assert.deepEqual(parsed.value.phases.map((phase) => ({ id: phase.phaseId, dependencies: phase.dependsOn })), [
    { id: 'P01', dependencies: [] },
    { id: 'P02', dependencies: ['P01'] },
  ]);
});

test('approved Plan parser rejects unknown and cyclic dependencies', () => {
  const unknown = parseApprovedPlan(plan.replace('| P01 | Baseline', '| P01 | Baseline').replace('| P02 | Owner | Introduce the owner | P01 |', '| P02 | Owner | Introduce the owner | P99 |'));
  assert.deepEqual(unknown, { ok: false, error: 'Plan phase P02 has an unknown dependency.' });
  const cyclic = parseApprovedPlan(plan.replace('| P01 | Baseline | Establish the baseline | None |', '| P01 | Baseline | Establish the baseline | P02 |'));
  assert.deepEqual(cyclic, { ok: false, error: 'Plan phase dependencies must be acyclic.' });
});

test('program commands parse only their bounded identities', () => {
  assert.deepEqual(parseLedgerCliArgv(['program-create', '--plan-file', '/workspace/plan.md']).programOperation, {
    attemptId: undefined, phaseId: undefined, planFile: '/workspace/plan.md', programId: undefined, summaryStdin: false,
  });
  assert.deepEqual(parseLedgerCliArgv(['iteration-finish', '--program-id', 'program-a', '--phase-id', 'P02', '--attempt-id', 'attempt-a', '--summary-stdin']).programOperation, {
    attemptId: 'attempt-a', phaseId: 'P02', planFile: undefined, programId: 'program-a', summaryStdin: true,
  });
});

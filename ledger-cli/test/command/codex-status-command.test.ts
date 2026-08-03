/**
 * WHAT: Verifies codex-status parsing, injected identity, filtering, JSON, and admission failures.
 * WHY: Self-query must remain deterministic for agents and explicit operator queries.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLedgerCliArgv } from '../../src/business/command/helper/parse-ledger-cli-argv.js';
import { queryCodexStatus } from '../../src/business/codex/effect/query-codex-status.js';

test('parses explicit codex status selection flags', () => {
  const command = parseLedgerCliArgv(['codex-status', '--execution-id', 'execution-a', '--context', '--limits', '--json']);
  assert.equal(command.mode, 'codex-status');
  assert.deepEqual(command.codexStatusOperation, { executionId: 'execution-a', elapsed: false, context: true, limits: true });
  assert.equal(command.json, true);
});

test('self-queries injected execution and filters status groups', async () => {
  const previous = { execution: process.env.DECISION_OS_EXECUTION_ID, project: process.env.DECISION_OS_PROJECT_ID, server: process.env.DECISION_OS_SERVER_URL };
  process.env.DECISION_OS_EXECUTION_ID = 'execution/current';
  process.env.DECISION_OS_PROJECT_ID = 'project/current';
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150/';
  try {
    let requested = '';
    const result = await queryCodexStatus({ elapsed: true, context: false, limits: false, json: true }, async (url) => {
      requested = url;
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: { executionId: 'execution/current', phase: 'running', providerSession: { available: true, id: 'provider-a' }, elapsed: { milliseconds: 10 }, context: { available: true }, limits: [] } }) };
    });
    assert.equal(result.ok, true);
    assert.equal(requested, 'http://127.0.0.1:50150/p/project%2Fcurrent/api/task-executions/execution%2Fcurrent/codex-status');
    const payload = JSON.parse(result.ok ? result.value : '{}');
    assert.deepEqual(Object.keys(payload), ['executionId', 'phase', 'providerSession', 'elapsed']);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      const name = key === 'execution' ? 'DECISION_OS_EXECUTION_ID' : key === 'project' ? 'DECISION_OS_PROJECT_ID' : 'DECISION_OS_SERVER_URL';
      // WHAT: Restore the exact process environment after the command test.
      // WHY: Node test files share one process and must not leak self-query identity.
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('rejects codex status without self-query identity before requesting', async () => {
  const previous = process.env.DECISION_OS_EXECUTION_ID;
  delete process.env.DECISION_OS_EXECUTION_ID;
  try {
    let calls = 0;
    const result = await queryCodexStatus({ elapsed: false, context: false, limits: false, json: false }, async () => { calls += 1; throw new Error('unexpected'); });
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
  } finally {
    // WHAT: Restore the caller's execution identity after the negative test.
    // WHY: Other command tests may rely on the injected process environment.
    if (previous === undefined) delete process.env.DECISION_OS_EXECUTION_ID; else process.env.DECISION_OS_EXECUTION_ID = previous;
  }
});

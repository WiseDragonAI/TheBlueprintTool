/**
 * WHAT: Command coverage for server-owned pipeline prompt inspection.
 * WHY: chained prompt reads must preserve byte content, request order, and atomic stdout.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';

function response(value: unknown, status = 200): Response {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status });
}

test('prompt query prints named server prompts verbatim in argument order', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  globalThis.fetch = (async (url: string | URL | Request) => {
    const name = decodeURIComponent(String(url).split('/').at(-1) ?? '');
    // WHAT: supply prompt bytes containing their own Markdown code fence.
    // WHY: prompt query must emit the bytes without adding a wrapper fence.
    if (name === 'CLI_TOOLS') return response({ ok: true, skill: { markdown: '# Tools\n\n```sh\nledger-cli help\n```\n' } });
    // WHAT: supply a distinct prompt for ordering proof.
    // WHY: chained output follows CLI argument order rather than server response order.
    if (name === 'SYSTEM_PROMPT') return response({ ok: true, skill: { markdown: 'System bytes\n' } });
    return response({ ok: false, error: 'Skill not found.' }, 404);
  }) as typeof fetch;
  const messages: string[] = [];

  try {
    const result = await dispatchLedgerCliCommandController(
      ['prompt', 'query', '--name', 'CLI_TOOLS', '--name', 'SYSTEM_PROMPT'],
      { emit: (message) => messages.push(message) },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(messages, [
      '---\n# CLI_TOOLS\n# Tools\n\n```sh\nledger-cli help\n```\n\n---\n# SYSTEM_PROMPT\nSystem bytes\n',
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    // WHAT: restore the caller-owned server address after the test.
    // WHY: command tests must not leak runtime configuration into later cases.
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

test('prompt query withholds output when any requested prompt fails', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  globalThis.fetch = (async (url: string | URL | Request) => {
    const name = decodeURIComponent(String(url).split('/').at(-1) ?? '');
    return name === 'SYSTEM_PROMPT'
      ? response({ ok: true, skill: { markdown: 'System bytes\n' } })
      : response({ ok: false, error: 'Skill not found.' }, 404);
  }) as typeof fetch;
  const messages: string[] = [];

  try {
    const result = await dispatchLedgerCliCommandController(
      ['prompt', 'query', '--name', 'SYSTEM_PROMPT', '--name', 'UNKNOWN'],
      { emit: (message) => messages.push(message) },
    );

    assert.equal(result.ok, false);
    assert.deepEqual(messages, []);
  } finally {
    globalThis.fetch = previousFetch;
    // WHAT: restore the caller-owned server address after the test.
    // WHY: command tests must not leak runtime configuration into later cases.
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

test('prompt query requires its operation and at least one name', async () => {
  const operation = await dispatchLedgerCliCommandController(['prompt', 'save', '--name', 'SYSTEM_PROMPT']);
  const name = await dispatchLedgerCliCommandController(['prompt', 'query']);

  assert.deepEqual(operation, { ok: false, error: 'prompt requires the query operation.' });
  assert.deepEqual(name, { ok: false, error: 'prompt query requires --name.' });
});

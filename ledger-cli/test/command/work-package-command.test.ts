/**
 * WHAT: Covers the bounded prompt-plus-card work package command.
 * WHY: a subagent should receive its complete assignment through one exact CLI call.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';

function response(value: unknown, status = 200): Response {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status });
}

test('work-package emits one prompt, explicit body-only input, and output contract', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  const requested: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const requestUrl = String(url);
    requested.push(requestUrl);
    if (requestUrl.includes('/api/codex/server-skills/SoftwareIteration-Awareness')) {
      return response({ skill: { markdown: 'Follow {{ exact_variable }}.' } });
    }
    if (requestUrl.endsWith('/api/control-room?localOnly=1')) {
      return response({ projects: [{ id: 'project-a', name: 'Alpha', ledgers: [{ id: 'tasks', title: 'Tasks' }] }] });
    }
    if (requestUrl.endsWith('/api/ledgers/tasks/navigation')) return response({ cards: [{ id: 'input-a' }] });
    if (requestUrl.endsWith('/api/ledgers/tasks/cards/input-a')) {
      return response({ id: 'input-a', title: 'Input', comment: { what: 'Bounded context.' } });
    }
    return response('unexpected', 500);
  }) as typeof fetch;
  const messages: string[] = [];

  try {
    const result = await dispatchLedgerCliCommandController([
      'work-package',
      '--prompt', 'SoftwareIteration-Awareness',
      '--input-card-id', 'input-a',
      '--output-card-id', 'output-a',
      '--output-path', '/workspace/result.md',
    ], { emit: (message) => messages.push(message) });

    assert.equal(result.ok, true);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /Follow \{\{ exact_variable \}\}\./);
    assert.match(messages[0], /Bounded context\./);
    assert.match(messages[0], /Output card ID: `output-a`/);
    assert.match(messages[0], /Output path: `\/workspace\/result\.md`/);
    assert.doesNotMatch(messages[0], /## Full thread/);
    assert.equal(requested.some((url) => url.includes('/threads/')), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

test('work-package validates its complete assignment contract before network access', async () => {
  assert.deepEqual(await dispatchLedgerCliCommandController(['work-package']), {
    ok: false,
    error: 'work-package requires --prompt.',
  });
  assert.deepEqual(await dispatchLedgerCliCommandController(['work-package', '--prompt', 'Awareness']), {
    ok: false,
    error: 'work-package requires --input-card-id.',
  });
});

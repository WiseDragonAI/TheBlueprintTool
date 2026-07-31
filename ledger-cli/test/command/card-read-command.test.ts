/**
 * WHAT: Command coverage for automatic card owner discovery and Markdown rendering.
 * WHY: card-read must accept one to 30 ids while preserving complete card and thread content.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';

function response(value: unknown, status = 200): Response {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status });
}

test('card-read discovers multiple owners once and prints cards in argument order', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  const requested: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const requestUrl = String(url);
    requested.push(requestUrl);
    // WHAT: provide the local project and ledger catalog to the batch discovery request.
    // WHY: card-read resolves every ID without requiring project or ledger flags.
    if (requestUrl.endsWith('/api/control-room?localOnly=1')) {
      return response({ projects: [
        {
          id: 'project-a',
          name: 'Alpha',
          ledgers: [
            { id: 'broken', title: 'Broken' },
            { id: 'tasks', title: 'Tasks' },
            { id: 'specs', title: 'Specs' },
          ],
        },
      ] });
    }
    // WHAT: inject one unrelated ledger navigation failure.
    // WHY: cards resolved in healthy ledgers must remain readable.
    if (requestUrl.endsWith('/api/ledgers/broken/navigation')) return response('unavailable', 503);
    // WHAT: expose the first requested card from the Tasks ledger.
    // WHY: discovery must retain distinct ownership for every requested ID.
    if (requestUrl.endsWith('/api/ledgers/tasks/navigation')) {
      return response({ cards: [{ id: 'card-a', title: 'Target card' }] });
    }
    // WHAT: expose the second requested card from the Specs ledger.
    // WHY: one batch may span multiple local ledgers.
    if (requestUrl.endsWith('/api/ledgers/specs/navigation')) {
      return response({ cards: [{ id: 'card-b', title: 'Second card' }] });
    }
    // WHAT: return the first requested card body.
    // WHY: batch rendering must preserve existing Markdown hydration.
    if (requestUrl.endsWith('/api/ledgers/tasks/cards/card-a')) {
      return response({ id: 'card-a', title: 'Target card', comment: { what: 'Body **Markdown**.' } });
    }
    // WHAT: return the first requested card thread.
    // WHY: each batch document includes its complete thread.
    if (requestUrl.endsWith('/api/ledgers/tasks/threads/thread-card-a')) {
      return response({
        notes: {
          'thread-card-a': [
            { role: 'operator', message: 'First request.' },
            { role: 'agent', message: 'First answer.\n\n- Evidence' },
          ],
        },
      });
    }
    // WHAT: return the second requested card body.
    // WHY: output order must follow argv rather than ledger discovery order.
    if (requestUrl.endsWith('/api/ledgers/specs/cards/card-b')) {
      return response({ id: 'card-b', title: 'Second card', comment: { what: 'Second body.' } });
    }
    // WHAT: return an empty second thread response.
    // WHY: batch output must retain the established no-thread Markdown fallback.
    if (requestUrl.endsWith('/api/ledgers/specs/threads/thread-card-b')) return response('', 404);
    return response('unexpected', 500);
  }) as typeof fetch;
  const messages: string[] = [];

  try {
    const result = await dispatchLedgerCliCommandController(
      ['card-read', '--card-id', 'card-b', '--card-id', 'card-a'],
      { emit: (message) => messages.push(message) },
    );

    assert.equal(result.ok, true);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /^# Card: Second card\n/);
    assert.ok(messages[0].indexOf('# Card: Second card') < messages[0].indexOf('# Card: Target card'));
    assert.match(messages[0], /## Body\n\nBody \*\*Markdown\*\*\./);
    assert.match(messages[0], /## Full thread\n\n### OPERATOR\n\nFirst request\./);
    assert.match(messages[0], /### AGENT\n\nFirst answer\.\n\n- Evidence/);
    assert.doesNotMatch(messages[0], /^\s*\{/);
    assert.equal(requested.filter((url) => url.endsWith('/api/control-room?localOnly=1')).length, 1);
    assert.equal(requested.filter((url) => url.endsWith('/navigation')).length, 3);
  } finally {
    globalThis.fetch = previousFetch;
    // WHAT: remove a test-owned server variable when the process started without one.
    // WHY: command tests must not leak runtime configuration into later cases.
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

test('card-read rejects an id owned by multiple ledgers', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  globalThis.fetch = (async (url: string | URL | Request) => {
    const requestUrl = String(url);
    // WHAT: expose two ledgers that both claim the requested card ID.
    // WHY: ID-only discovery must reject ambiguous ownership.
    if (requestUrl.endsWith('/api/control-room?localOnly=1')) {
      return response({ projects: [{
        id: 'project-a',
        name: 'Alpha',
        ledgers: [
          { id: 'tasks', title: 'Tasks' },
          { id: 'specs', title: 'Specs' },
        ],
      }] });
    }
    return response({ cards: [{ id: 'card-a' }] });
  }) as typeof fetch;

  try {
    const result = await dispatchLedgerCliCommandController(['card-read', '--card-id', 'card-a']);

    assert.equal(result.ok, false);
    // WHAT: inspect the error only after the result narrows to failure.
    // WHY: the ambiguity text is part of the command contract.
    if (!result.ok) assert.equal(
      result.error,
      'Card id card-a is ambiguous across project-a/tasks, project-a/specs.',
    );
  } finally {
    globalThis.fetch = previousFetch;
    // WHAT: remove a test-owned server variable when the process started without one.
    // WHY: command tests must not leak runtime configuration into later cases.
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

test('card-read rejects more than 30 card ids before discovery', async () => {
  const cardArgs = Array.from({ length: 31 }, (_, index) => ['--card-id', `card-${index}`]).flat();
  const result = await dispatchLedgerCliCommandController(['card-read', ...cardArgs]);

  assert.deepEqual(result, { ok: false, error: 'card-read accepts at most 30 --card-id values.' });
});

test('card-read requires one card id and the running server URL', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  delete process.env.DECISION_OS_SERVER_URL;
  try {
    const missingId = await dispatchLedgerCliCommandController(['card-read']);
    const missingServer = await dispatchLedgerCliCommandController(['card-read', '--card-id', 'card-a']);

    assert.deepEqual(missingId, { ok: false, error: 'card-read requires --card-id.' });
    assert.deepEqual(missingServer, { ok: false, error: 'card-read requires DECISION_OS_SERVER_URL.' });
  } finally {
    // WHAT: restore a server variable that existed before this test.
    // WHY: command tests must preserve their caller's runtime configuration.
    if (previousServer !== undefined) process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

/**
 * WHAT: Command coverage for automatic card owner discovery and Markdown rendering.
 * WHY: card-read must require only an id while preserving the complete card and thread content.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchLedgerCliCommandController } from '../../src/business/command/controller/dispatch-ledger-cli-command.js';

function response(value: unknown, status = 200): Response {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status });
}

test('card-read discovers project and ledger and prints body plus full thread as Markdown', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousFetch = globalThis.fetch;
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  const requested: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const requestUrl = String(url);
    requested.push(requestUrl);
    if (requestUrl.endsWith('/api/control-room?localOnly=1')) {
      return response({ projects: [
        {
          id: 'project-a',
          name: 'Alpha',
          ledgers: [
            { id: 'broken', title: 'Broken' },
            { id: 'tasks', title: 'Tasks' },
          ],
        },
      ] });
    }
    if (requestUrl.endsWith('/api/ledgers/broken/navigation')) return response('unavailable', 503);
    if (requestUrl.endsWith('/api/ledgers/tasks/navigation')) {
      return response({ cards: [{ id: 'card-a', title: 'Target card' }] });
    }
    if (requestUrl.endsWith('/api/ledgers/tasks/cards/card-a')) {
      return response({ id: 'card-a', title: 'Target card', comment: { what: 'Body **Markdown**.' } });
    }
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
    return response('unexpected', 500);
  }) as typeof fetch;
  const messages: string[] = [];

  try {
    const result = await dispatchLedgerCliCommandController(
      ['card-read', '--card-id', 'card-a'],
      { emit: (message) => messages.push(message) },
    );

    assert.equal(result.ok, true);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /^# Card: Target card\n/);
    assert.match(messages[0], /## Body\n\nBody \*\*Markdown\*\*\./);
    assert.match(messages[0], /## Full thread\n\n### OPERATOR\n\nFirst request\./);
    assert.match(messages[0], /### AGENT\n\nFirst answer\.\n\n- Evidence/);
    assert.doesNotMatch(messages[0], /^\s*\{/);
    assert.ok(requested.some((url) => url.endsWith('/api/control-room?localOnly=1')));
    assert.ok(requested.some((url) => url.endsWith('/p/project-a/api/ledgers/tasks/navigation')));
  } finally {
    globalThis.fetch = previousFetch;
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
    if (!result.ok) assert.equal(
      result.error,
      'Card id card-a is ambiguous across project-a/tasks, project-a/specs.',
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
  }
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
    if (previousServer !== undefined) process.env.DECISION_OS_SERVER_URL = previousServer;
  }
});

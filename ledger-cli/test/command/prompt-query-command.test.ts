/**
 * WHAT: Command coverage for server-owned pipeline prompt inspection.
 * WHY: chained prompt reads must preserve byte content, request order, and atomic stdout.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('prompt create and direct working-copy update use global server-owned transactions', async () => {
  const previousServer = process.env.DECISION_OS_SERVER_URL;
  const previousProject = process.env.DECISION_OS_PROJECT_ID;
  const previousFetch = globalThis.fetch;
  const root = mkdtempSync(join(tmpdir(), 'ledger-cli-prompt-'));
  const markdownFile = join(root, 'ResearchPrompt.md');
  writeFileSync(markdownFile, '## A. objective\n');
  process.env.DECISION_OS_SERVER_URL = 'http://127.0.0.1:50150';
  delete process.env.DECISION_OS_PROJECT_ID;
  const requests: Array<{ body: Record<string, unknown> | null; method: string; url: string }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
    requests.push({ body, method, url: String(url) });
    // WHAT: return a committed direct-edit receipt for the working-copy endpoint.
    // WHY: update must expose the focused Git commit without transmitting Markdown.
    if (method === 'POST' && String(url).endsWith('/revisions/commit')) {
      return response({ skill: { revision: 'updated-revision', gitRevision: { commit: 'updated-commit' } } });
    }
    // WHAT: return a committed creation receipt for the collection endpoint.
    // WHY: the CLI must expose authored content and Git revisions from prompt creation.
    if (method === 'POST') {
      return response({ skill: { revision: 'created-revision', gitRevision: { commit: 'created-commit' } } }, 201);
    }
    // WHAT: provide the current directly edited working-copy revision before commit.
    // WHY: update must load unseen server state instead of accepting a caller revision.
    if (method === 'GET') return response({ skill: { revision: 'current-revision' } });
    return response({ error: 'unexpected method' }, 500);
  }) as typeof fetch;
  const messages: string[] = [];

  try {
    const created = await dispatchLedgerCliCommandController([
      'prompt', 'create', '--name', 'ResearchPrompt', '--description', 'Research one source', '--markdown-file', markdownFile,
    ], { emit: (message) => messages.push(message) });
    const updated = await dispatchLedgerCliCommandController([
      'prompt', 'update', '--name', 'ResearchPrompt',
    ], { emit: (message) => messages.push(message) });

    assert.equal(created.ok, true);
    assert.equal(updated.ok, true);
    assert.deepEqual(requests, [
      {
        method: 'POST',
        url: 'http://127.0.0.1:50150/api/codex/skill-library',
        body: { name: 'ResearchPrompt', description: 'Research one source', markdown: '## A. objective\n', contentKind: 'pipeline-prompt' },
      },
      {
        method: 'GET',
        url: 'http://127.0.0.1:50150/api/codex/server-skills/ResearchPrompt',
        body: null,
      },
      {
        method: 'POST',
        url: 'http://127.0.0.1:50150/api/codex/server-skills/ResearchPrompt/revisions/commit',
        body: { revision: 'current-revision' },
      },
    ]);
    assert.deepEqual(messages.map((message) => JSON.parse(message)), [
      { version: 1, operation: 'create', name: 'ResearchPrompt', revision: 'created-revision', commit: 'created-commit' },
      { version: 1, operation: 'update', name: 'ResearchPrompt', revision: 'updated-revision', commit: 'updated-commit' },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    rmSync(root, { recursive: true, force: true });
    // WHAT: restore the caller-owned server address after the mutation test.
    // WHY: later command tests must not inherit the mocked server.
    if (previousServer === undefined) delete process.env.DECISION_OS_SERVER_URL;
    else process.env.DECISION_OS_SERVER_URL = previousServer;
    // WHAT: restore the caller-owned project identity after proving prompt mutations do not consume it.
    // WHY: command tests must not leak their project-independent routing setup into later cases.
    if (previousProject === undefined) delete process.env.DECISION_OS_PROJECT_ID;
    else process.env.DECISION_OS_PROJECT_ID = previousProject;
  }
});

test('prompt commands require a supported operation and required inputs', async () => {
  const operation = await dispatchLedgerCliCommandController(['prompt', 'save', '--name', 'SYSTEM_PROMPT']);
  const name = await dispatchLedgerCliCommandController(['prompt', 'query']);
  const replacementFile = await dispatchLedgerCliCommandController(['prompt', 'update', '--name', 'SYSTEM_PROMPT', '--markdown-file', '/tmp/SYSTEM_PROMPT.md']);

  assert.deepEqual(operation, { ok: false, error: 'prompt requires query, create, or update.' });
  assert.deepEqual(name, { ok: false, error: 'prompt query requires --name.' });
  assert.deepEqual(replacementFile, { ok: false, error: 'prompt update requires direct editing and does not accept --markdown-file.' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('card skill run route derives JSONL progress and persists thread notes', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-'));
  const runId = `codex-skill-${Date.now()}-feed1234`;
  const outputCardId = `card-${runId}`;
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: outputCardId,
      title: 'Skill Result',
      cardType: 'codex-skill-run',
      comment: { what: '# Finished Skill Result\n\nThe final card body replaced the initial run metadata.' },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`), [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'msg-1', type: 'agent_message', text: 'Thinking text persisted.' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'cmd-1', type: 'command_execution', command: 'rg TODO', aggregated_output: 'found TODO', exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'file-1', type: 'file_change', changes: [{ path: 'result.md', kind: 'updated' }], status: 'completed' } }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`), '');

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}&since=2`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      ok: boolean;
      status: string;
      lineCount: number;
      toolCallCount: number;
      agentMessageCount: number;
      fileChangeCount: number;
      events: Array<{ line: number }>;
    };
    assert.equal(body.ok, true);
    assert.equal(body.status, 'complete');
    assert.equal(body.lineCount, 5);
    assert.equal(body.toolCallCount, 1);
    assert.equal(body.agentMessageCount, 1);
    assert.equal(body.fileChangeCount, 1);
    assert.deepEqual(body.events.map((event) => event.line), [3, 4, 5]);

    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { threadFiles?: Record<string, string> };
    assert.equal(ledger.threadFiles?.[`thread-${outputCardId}`], `.decision-os/threads/specs/thread-${outputCardId}.md`);
    const thread = readFileSync(join(workspace, '.decision-os', 'threads', 'specs', `thread-${outputCardId}.md`), 'utf8');
    assert.match(thread, /"codexKind":"agent_message"/);
    assert.match(thread, /"codexKind":"tool_call"/);
    assert.match(thread, /Tool call/);
    assert.match(thread, /found TODO/);
    assert.match(thread, /"codexKind":"file_change"/);
    assert.match(thread, /Codex turn completed\./);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

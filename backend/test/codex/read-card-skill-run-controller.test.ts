import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('card skill run route derives JSONL progress and persists thread notes', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-'));
  const startedAt = Date.now() - 600000;
  const completedAt = new Date(startedAt + 90000);
  const runId = `codex-skill-${startedAt}-feed1234`;
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
  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
  writeFileSync(jsonlPath, [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'msg-1', type: 'agent_message', text: 'Thinking text persisted.' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'cmd-1', type: 'command_execution', command: 'rg TODO', aggregated_output: 'found TODO', exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'file-1', type: 'file_change', changes: [{ path: 'result.md', kind: 'updated' }], status: 'completed' } }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(logPath, '');
  utimesSync(jsonlPath, completedAt, completedAt);
  utimesSync(logPath, completedAt, completedAt);

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
      elapsedMs: number;
      toolCallCount: number;
      agentMessageCount: number;
      fileChangeCount: number;
      events: Array<{ line: number }>;
    };
    assert.equal(body.ok, true);
    assert.equal(body.status, 'complete');
    assert.equal(body.lineCount, 5);
    assert.ok(body.elapsedMs >= 89000 && body.elapsedMs <= 91000);
    assert.equal(body.toolCallCount, 1);
    assert.equal(body.agentMessageCount, 1);
    assert.equal(body.fileChangeCount, 1);
    assert.deepEqual(body.events.map((event) => event.line), [3, 4, 5]);

    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { threadFiles?: Record<string, string> };
    assert.equal(ledger.threadFiles?.[`thread-${outputCardId}`], `.decision-os/threads/specs/thread-${outputCardId}.md`);
    const thread = readFileSync(join(workspace, '.decision-os', 'threads', 'specs', `thread-${outputCardId}.md`), 'utf8');
    assert.match(thread, /"codexEventType":"thread.started"/);
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

test('card skill run route infers status from the latest continued JSONL segment', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-continued-'));
  const startedAt = Date.now() - 600000;
  const runId = `codex-skill-${startedAt}-feed9876`;
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
      comment: { what: `Codex run: ${runId}` },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
  writeFileSync(jsonlPath, [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'turn.completed' }),
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'turn.started' }),
  ].join('\n'));
  writeFileSync(logPath, '');
  const fresh = new Date();
  utimesSync(jsonlPath, fresh, fresh);
  utimesSync(logPath, new Date(startedAt), new Date(startedAt));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const runningResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(runningResponse.status, 200);
    const running = await runningResponse.json() as { ok: boolean; status: string; lineCount: number };
    assert.equal(running.ok, true);
    assert.equal(running.status, 'running');
    assert.equal(running.lineCount, 4);
    const thread = readFileSync(join(workspace, '.decision-os', 'threads', 'specs', `thread-${outputCardId}.md`), 'utf8');
    assert.match(thread, /"codexEventType":"turn.started"/);
    assert.match(thread, /Codex turn started\./);

    writeFileSync(logPath, 'Codex run cancelled: terminated by operator\n');
    const cancelledAt = new Date();
    utimesSync(logPath, cancelledAt, cancelledAt);
    const cancelledResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(cancelledResponse.status, 200);
    const cancelled = await cancelledResponse.json() as { ok: boolean; status: string; lineCount: number };
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.lineCount, 4);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('card skill run route measures active resumed segment from the latest persisted segment marker', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-resume-clock-'));
  const firstStartedAt = Date.now() - 8 * 60 * 60 * 1000;
  const resumedAt = Date.now() - 30000;
  const resumedAtIso = new Date(resumedAt).toISOString();
  const runId = `codex-skill-${firstStartedAt}-feedclock`;
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
      comment: { what: `Codex run: ${runId}` },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
  writeFileSync(jsonlPath, [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'turn.completed' }),
    JSON.stringify({ type: 'turn.started' }),
  ].join('\n'));
  writeFileSync(logPath, `decision-os:codex-run-segment ${JSON.stringify({ runId, startedAt: resumedAtIso, segment: 'continue' })}\n`);
  const fresh = new Date();
  utimesSync(jsonlPath, fresh, fresh);
  utimesSync(logPath, fresh, fresh);

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(response.status, 200);
    const body = await response.json() as { ok: boolean; status: string; startedAt: string; elapsedMs: number };
    assert.equal(body.ok, true);
    assert.equal(body.status, 'running');
    assert.equal(body.startedAt, resumedAtIso);
    assert.ok(body.elapsedMs >= 29000 && body.elapsedMs < 45000);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

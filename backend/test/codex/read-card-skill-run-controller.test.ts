import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { parseThreadMarkdown } from '@backend/business/ledger/helper/thread-content-file.js';

async function waitForText(file: string, text: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (existsSync(file) && readFileSync(file, 'utf8').includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${text} in ${file}`);
}

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

test('card skill run route keeps command output containing thread markdown as one artifact note', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-fenced-output-'));
  const startedAt = Date.now() - 600000;
  const runId = `codex-skill-${startedAt}-fenced1`;
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
  const capturedThread = [
    '# OPERATOR',
    '<!-- decision-os:note {"id":"embedded-operator","timestamp":"2026-07-08T00:00:00.000Z"} -->',
    '',
    'Embedded operator text.',
    '',
    '```markdown',
    '# AGENT',
    'Nested fenced heading.',
    '```',
  ].join('\n');
  writeFileSync(jsonlPath, [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'item.completed', item: { id: 'cmd-1', type: 'command_execution', command: 'sed thread.md', aggregated_output: capturedThread, exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(logPath, '');

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}`);
    assert.equal(response.status, 200);
    const threadPath = join(workspace, '.decision-os', 'threads', 'specs', `thread-${outputCardId}.md`);
    const thread = readFileSync(threadPath, 'utf8');
    assert.match(thread, /````text\n# OPERATOR/);
    assert.match(thread, /```markdown\n# AGENT/);

    const notes = parseThreadMarkdown(thread);
    assert.equal(notes.length, 3);
    assert.equal(notes[1]?.id, `codex-${runId}-line-2`);
    assert.equal(notes[1]?.codexKind, 'tool_call');
    assert.match(String(notes[1]?.message ?? ''), /# OPERATOR/);
    assert.match(String(notes[1]?.message ?? ''), /# AGENT/);
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

test('card skill continue route excludes codex artifact notes from resumed prompt', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-continue-filter-'));
  const runStartedAt = Date.now() - 600000;
  const runId = `codex-skill-${runStartedAt}-contflt`;
  const cardId = 'card-a';
  const fakeCodex = join(workspace, 'fake-codex-resume.mjs');
  const inputFile = join(workspace, 'resume-input.txt');
  const runSummaryRef = `.decision-os/runs/codex-skills/specs/${runId}.md`;
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: cardId,
      title: 'Thread Card',
      codexThreadRunId: runId,
      codexThreadRunOutputFile: runSummaryRef,
      comment: { what: 'Card body' },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {
      'thread-card-a': [
        {
          id: `codex-${runId}-line-1`,
          role: 'agent',
          message: 'Codex thread started.',
          timestamp: '2026-07-08T00:00:00.000Z',
          codexRunId: runId,
          codexLine: '1',
          codexKind: 'run_status',
          codexEventType: 'thread.started'
        },
        {
          id: `codex-${runId}-line-2`,
          role: 'agent',
          message: 'Codex turn completed.',
          timestamp: '2026-07-08T00:01:00.000Z',
          codexRunId: runId,
          codexLine: '2',
          codexKind: 'run_status',
          codexEventType: 'turn.completed'
        },
        {
          id: 'codex-old-artifact-line-x',
          role: 'agent',
          message: 'Artifact after boundary must not resume.',
          timestamp: '2026-07-08T00:02:00.000Z'
        },
        {
          id: 'note-operator-new',
          role: 'operator',
          message: 'Continue with this real operator message.',
          timestamp: '2026-07-08T00:03:00.000Z'
        }
      ]
    }
  }, null, 2));
  writeFileSync(join(workspace, runSummaryRef.replace(/^\.decision-os\//, '.decision-os/')), '# Run Summary\n');
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`), [
    JSON.stringify({ type: 'thread.started', thread_id: 'session-resume-filter' }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`), '');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let input = "";',
    'process.stdin.on("data", (chunk) => { input += chunk; });',
    'process.stdin.on("end", () => {',
    `  writeFileSync(${JSON.stringify(inputFile)}, input);`,
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);

  process.chdir(workspace);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}/continue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId })
    });
    assert.equal(response.status, 202);
    await waitForText(inputFile, 'Continue with this real operator message.');
    const prompt = readFileSync(inputFile, 'utf8');
    assert.match(prompt, /Continue with this real operator message\./);
    assert.doesNotMatch(prompt, /Artifact after boundary must not resume\./);
    assert.doesNotMatch(prompt, /Codex turn completed\./);
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
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

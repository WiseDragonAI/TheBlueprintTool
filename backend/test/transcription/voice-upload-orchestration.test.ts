import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

async function waitForText(file: string, text: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (existsSync(file) && readFileSync(file, 'utf8').includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${text} in ${file}`);
}

function voiceUploadForm(input: { transcript: string; queueCodex?: boolean; noteId?: string }): FormData {
  const form = new FormData();
  form.append('audio', new Blob(['voice-bytes'], { type: 'audio/webm' }), 'voice.webm');
  form.append('ledgerId', 'specs');
  form.append('threadId', 'thread-card-a');
  form.append('cardId', 'card-a');
  form.append('noteId', input.noteId ?? 'note-voice-1');
  form.append('queueCodex', input.queueCodex ? 'true' : 'false');
  form.append('transcriptionText', input.transcript);
  form.append('awaitCompletion', 'true');
  return form;
}

test('voice upload transcribes on the backend and starts Codex when the card has no session', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-voice-start-codex-'));
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const inputFile = join(workspace, 'codex-input.txt');
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{ id: 'card-a', title: 'Voice Card', comment: { what: 'Existing body' }, facts: [], fields: [] }],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let input = "";',
    'process.stdin.on("data", (chunk) => { input += chunk; });',
    'process.stdin.on("end", () => {',
    `  writeFileSync(${JSON.stringify(inputFile)}, input);`,
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-started" }));',
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/voice-upload`, {
      method: 'POST',
      body: voiceUploadForm({ transcript: 'Backend-owned transcript.', queueCodex: true })
    });
    assert.equal(response.status, 202);
    const body = await response.json() as { body: { ok: boolean; noteId: string; queueCodex: boolean } };
    assert.equal(body.body.ok, true);
    assert.equal(body.body.noteId, 'note-voice-1');
    assert.equal(body.body.queueCodex, true);

    await waitForText(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'Backend-owned transcript.');
    await waitForText(inputFile, 'Backend-owned transcript.');
    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<{ id: string; codexThreadRunId?: string }> };
    assert.match(ledger.cards.find((card) => card.id === 'card-a')?.codexThreadRunId ?? '', /^codex-skill-/);
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('voice upload continues the existing Codex session when the card has a run id', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-voice-continue-codex-'));
  const fakeCodex = join(workspace, 'fake-codex-resume.mjs');
  const inputFile = join(workspace, 'codex-resume-input.txt');
  const runId = 'codex-skill-1783587000000-existing';
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: 'card-a',
      title: 'Voice Card',
      comment: { what: 'Existing body' },
      facts: [],
      fields: [],
      codexThreadRunId: runId,
      codexThreadRunOutputFile: `.decision-os/runs/codex-skills/specs/${runId}.md`
    }],
    annotations: [],
    relationships: [],
    notes: {
      'thread-card-a': [
        { id: `codex-${runId}-line-1`, role: 'agent', message: 'Codex thread started.', codexRunId: runId, codexLine: '1', codexKind: 'run_status', codexEventType: 'thread.started', status: 'running' },
        { id: `codex-${runId}-line-2`, role: 'agent', message: 'Codex turn completed.', codexRunId: runId, codexLine: '2', codexKind: 'run_status', codexEventType: 'turn.completed', status: 'complete' }
      ]
    }
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`), [
    JSON.stringify({ type: 'thread.started', thread_id: 'session-existing' }),
    JSON.stringify({ type: 'turn.completed' }),
    ''
  ].join('\n'));
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`), '');
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.md`), '# Existing Run\n');
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/voice-upload`, {
      method: 'POST',
      body: voiceUploadForm({ transcript: 'Existing-session transcript.', queueCodex: true, noteId: 'note-voice-continue' })
    });
    assert.equal(response.status, 202);

    await waitForText(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'Existing-session transcript.');
    await waitForText(inputFile, 'Existing-session transcript.');
    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<{ id: string; codexThreadRunId?: string }> };
    assert.equal(ledger.cards.find((card) => card.id === 'card-a')?.codexThreadRunId, runId);
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

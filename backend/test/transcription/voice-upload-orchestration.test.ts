import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { codexExecutionCoordinator } from '@backend/business/codex/helper/codex-execution-runtime.js';

async function waitForText(file: string, text: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (existsSync(file) && readFileSync(file, 'utf8').includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${text} in ${file}`);
}

async function waitForPipelineComplete(decisionOsRoot: string, pipelineId: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    const run = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.pipelineId === pipelineId);
    if (run?.status === 'complete') return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  assert.fail(`Timed out waiting for pipeline ${pipelineId} to complete`);
}

async function waitForExecutionPhase(runtime: Record<string, unknown>, executionId: string, phase: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (codexExecutionCoordinator(runtime)?.store.find(executionId)?.phase === phase) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  assert.fail(`Timed out waiting for execution ${executionId} phase ${phase}`);
}

function voiceUploadForm(input: { transcript?: string; queueCodex?: boolean; launchMode?: 'send' | 'run' | 'pipeline'; noteId?: string; ledgerId?: string | null; threadId?: string | null; cardId?: string | null; awaitCompletion?: boolean }): FormData {
  const form = new FormData();
  const ledgerId = input.ledgerId === undefined ? 'specs' : input.ledgerId;
  const threadId = input.threadId === undefined ? 'thread-card-a' : input.threadId;
  const cardId = input.cardId === undefined ? 'card-a' : input.cardId;
  form.append('audio', new Blob(['voice-bytes'], { type: 'audio/webm' }), 'voice.webm');
  if (ledgerId !== null) form.append('ledgerId', ledgerId);
  if (threadId !== null) form.append('threadId', threadId);
  if (cardId !== null) form.append('cardId', cardId);
  form.append('noteId', input.noteId ?? 'note-voice-1');
  form.append('queueCodex', input.queueCodex ? 'true' : 'false');
  if (input.launchMode) form.append('launchMode', input.launchMode);
  if (input.transcript !== undefined) form.append('transcriptionText', input.transcript);
  if (input.awaitCompletion !== false) form.append('awaitCompletion', 'true');
  return form;
}

test('queued voice acceptance moves the card to transcribing-before-launch during transcription and clears it on failure', async () => {
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.OPENAI_API_KEY;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-voice-pending-execution-'));
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

  let settleTranscription: ((response: Response) => void) | undefined;
  const transcriptionResponse = new Promise<Response>((resolve) => { settleTranscription = resolve; });
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === 'https://api.openai.com/v1/audio/transcriptions') return transcriptionResponse;
    return originalFetch(input, init);
  }) as typeof fetch;
  process.env.OPENAI_API_KEY = 'test-key';
  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/voice-upload`, {
      method: 'POST',
      body: voiceUploadForm({ queueCodex: true, awaitCompletion: false })
    });
    assert.equal(response.status, 202);
    const responseBody = await response.json() as { body: { queueCodex?: boolean; executionId: string } };
    assert.equal(responseBody.body.queueCodex, true);
    await waitForText(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), '"status":"transcribing"');
    let ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<{ executionStatus?: string; executionRunId?: string }> };
    assert.equal(ledger.cards[0].executionStatus, undefined);
    assert.equal(ledger.cards[0].executionRunId, undefined);
    assert.equal(codexExecutionCoordinator(runtime)?.store.find(responseBody.body.executionId)?.phase, 'preparing');

    ledger.cards = [];
    writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify(ledger, null, 2));
    settleTranscription?.(new Response(JSON.stringify({ error: { message: 'provider unavailable' } }), { status: 503, headers: { 'content-type': 'application/json' } }));
    await waitForText(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), '"status":"transcription failed"');
    ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<{ executionStatus?: string }> };
    assert.equal(ledger.cards.length, 0);
    assert.equal(codexExecutionCoordinator(runtime)?.store.find(responseBody.body.executionId)?.phase, 'failed');
    assert.equal(runtime.voiceCodexExecutionObservations, undefined);
  } finally {
    settleTranscription?.(new Response(JSON.stringify({ error: { message: 'test cleanup' } }), { status: 503, headers: { 'content-type': 'application/json' } }));
    server.close();
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('normal voice transcription never marks the card as pending execution', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-voice-normal-transcription-'));
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

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/voice-upload`, {
      method: 'POST',
      body: voiceUploadForm({ transcript: 'Normal voice transcript.', queueCodex: false })
    });
    assert.equal(response.status, 202);
    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<{ executionStatus?: string }> };
    assert.equal(ledger.cards[0].executionStatus, undefined);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('voice upload transcribes on the backend without requiring a card id', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-voice-no-card-'));
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [],
    annotations: [],
    relationships: [],
    notes: {}
  }, null, 2));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/voice-upload`, {
      method: 'POST',
      body: voiceUploadForm({ transcript: 'No-card transcript.', cardId: null, noteId: 'note-no-card' })
    });
    assert.equal(response.status, 202);
    const body = await response.json() as { body: { ok: boolean; voiceFileRef: string } };
    assert.equal(body.body.ok, true);
    assert.ok(body.body.voiceFileRef);
    await waitForText(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'No-card transcript.');
    const statusResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/voice-transcription-status?ledgerId=specs&threadId=thread-card-a&noteId=note-no-card`
    );
    assert.equal(statusResponse.status, 200);
    const statusBody = await statusResponse.json() as {
      ok: boolean;
      statusCode: number;
      note: { id: string; status: string; message: string; voiceFileRef: string; revision: number };
    };
    assert.equal(statusBody.ok, true);
    assert.equal(statusBody.statusCode, 200);
    assert.equal(statusBody.note.id, 'note-no-card');
    assert.equal(statusBody.note.message, 'No-card transcript.');
    assert.equal(statusBody.note.voiceFileRef, body.body.voiceFileRef);
    assert.equal(statusBody.note.status, 'transcribed');
    assert.equal(statusBody.note.revision, 4);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('voice upload preserves audio when ledger metadata is missing', async () => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-voice-preserve-metadata-fail-'));
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({ ledgers: [] }, null, 2));

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/voice-upload`, {
      method: 'POST',
      body: voiceUploadForm({ transcript: 'Preserved transcript.', ledgerId: null, cardId: null, noteId: 'note-preserved' })
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { body: { ok: boolean; uploaded: boolean; noteId: string; voiceFileRef: string; error: string } };
    assert.equal(body.body.ok, false);
    assert.equal(body.body.uploaded, true);
    assert.equal(body.body.noteId, 'note-preserved');
    assert.equal(body.body.error, 'Missing ledgerId or threadId.');
    assert.ok(body.body.voiceFileRef);
    assert.equal(existsSync(body.body.voiceFileRef), true);
  } finally {
    server.close();
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  }
});

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
    const body = await response.json() as { body: { ok: boolean; noteId: string; queueCodex: boolean; executionId: string } };
    assert.equal(body.body.ok, true);
    assert.equal(body.body.noteId, 'note-voice-1');
    assert.equal(body.body.queueCodex, true);

    await waitForText(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'Backend-owned transcript.');
    await waitForText(inputFile, 'Backend-owned transcript.');
    await waitForExecutionPhase(runtime, body.body.executionId, 'succeeded');
    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<{ id: string; codexThreadRunId?: string }> };
    assert.match(ledger.cards.find((card) => card.id === 'card-a')?.codexThreadRunId ?? '', /^codex-skill-/);
    assert.equal(codexExecutionCoordinator(runtime)?.store.find(body.body.executionId)?.kind, 'voice');
    assert.equal(runtime.voiceCodexExecutionObservations, undefined);
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('voice Pipeline mode starts the pipeline configured in Settings', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-voice-pipeline-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  mkdirSync(join(workspace, '.skills', 'alpha'), { recursive: true });
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(workspace, '.skills', 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: Pipeline test skill\n---\n');
  writeFileSync(join(decisionOsRoot, '.settings.json'), JSON.stringify({ voicePipelineId: 'voice-pipeline' }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }] }, null, 2));
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [{ id: 'card-a', title: 'Voice Card', comment: { what: 'Existing body' }, facts: [], fields: [] }],
    annotations: [], relationships: [], notes: {}
  }, null, 2));
  const now = '2026-07-17T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['alpha'],
    store: {
      pipelines: [{ id: 'voice-pipeline', name: 'Voice pipeline', purpose: 'Voice action', stepIds: ['voice-step'], createdAt: now, updatedAt: now }],
      steps: [{ id: 'voice-step', name: 'Voice step', purpose: '', createdAt: now, updatedAt: now, skills: [{ id: 'alpha-config', skillName: 'alpha', codexModel: null, codexEffort: null }] }],
      runs: [], skillLibrary: [], activeWorkspaceRun: null
    }
  });
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let input = "";',
    'process.stdin.on("data", (chunk) => { input += chunk; });',
    'process.stdin.on("end", () => {',
    '  const output = (input.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    '  if (output.trim()) writeFileSync(output.trim(), "# Pipeline result\\n");',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '});'
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.chdir(workspace);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/voice-upload`, {
      method: 'POST',
      body: voiceUploadForm({ transcript: 'Pipeline transcript.', launchMode: 'pipeline', noteId: 'note-voice-pipeline' })
    });
    assert.equal(response.status, 202);
    const body = await response.json() as { body: { ok: boolean; launchMode: string; executionId: string } };
    assert.equal(body.body.ok, true);
    assert.equal(body.body.launchMode, 'pipeline');
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.runs.some((run) => run.pipelineId === 'voice-pipeline'), true);
    await waitForPipelineComplete(decisionOsRoot, 'voice-pipeline');
    assert.equal(codexExecutionCoordinator(runtime)?.store.find(body.body.executionId)?.phase, 'succeeded');
    assert.equal(runtime.voiceCodexExecutionObservations, undefined);
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
  const argvFile = join(workspace, 'codex-resume-argv.json');
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
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`), `decision-os:codex-run-segment ${JSON.stringify({ runId, startedAt: new Date().toISOString(), segment: 'start', startLine: 0, metadata: { codexModel: 'gpt-5.4', codexEffort: 'medium' } })}\n`);
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.md`), '# Existing Run\n');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let input = "";',
    'process.stdin.on("data", (chunk) => { input += chunk; });',
    'process.stdin.on("end", () => {',
    `  writeFileSync(${JSON.stringify(inputFile)}, input);`,
    `  writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(process.argv.slice(2)));`,
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
    const body = await response.json() as { body: { executionId: string } };

    await waitForText(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'Existing-session transcript.');
    await waitForText(inputFile, 'Existing-session transcript.');
    await waitForText(argvFile, 'gpt-5.4');
    await waitForExecutionPhase(runtime, body.body.executionId, 'succeeded');
    const argv = JSON.parse(readFileSync(argvFile, 'utf8')) as string[];
    assert.equal(argv.includes('gpt-5.4'), true);
    assert.equal(argv.includes('model_reasoning_effort="medium"'), true);
    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<{ id: string; codexThreadRunId?: string; codexRunModel?: string; codexRunEffort?: string }> };
    assert.equal(ledger.cards.find((card) => card.id === 'card-a')?.codexThreadRunId, runId);
    assert.equal(ledger.cards.find((card) => card.id === 'card-a')?.codexRunModel, 'gpt-5.4');
    assert.equal(ledger.cards.find((card) => card.id === 'card-a')?.codexRunEffort, 'medium');
    assert.equal(codexExecutionCoordinator(runtime)?.store.find(body.body.executionId)?.sessionId, runId);
    assert.equal(runtime.voiceCodexExecutionObservations, undefined);
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

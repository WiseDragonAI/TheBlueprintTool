/**
 * WHAT: Process-route coverage for live Codex lifecycle ingestion and scoped thread publication.
 * WHY: Each JSONL event must persist exactly once before status polling observes the run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { parseThreadMarkdown } from '@backend/business/ledger/helper/thread-content-file.js';

type ContentChangeEvent = {
  contentFile: string;
  kind: 'card-content' | 'thread-content';
  ledgerId: string;
  threadId?: string;
};

async function startContentEventCollector(endpoint: string): Promise<{ events: ContentChangeEvent[]; close(): Promise<void> }> {
  const controller = new AbortController();
  const response = await fetch(endpoint, { signal: controller.signal });
  assert.equal(response.ok, true);
  const reader = response.body?.getReader();
  assert.ok(reader);
  const events: ContentChangeEvent[] = [];
  const done = (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n?/g, '\n');
      for (;;) {
        const boundary = buffer.indexOf('\n\n');
        if (boundary < 0) break;
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = frame.split('\n');
        if (!lines.includes('event: card-content-change')) continue;
        const data = lines.filter((line) => line.startsWith('data: ')).map((line) => line.slice(6)).join('\n');
        events.push(JSON.parse(data) as ContentChangeEvent);
      }
    }
  })().catch((error: unknown) => {
    if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
  });
  return {
    events,
    async close() {
      controller.abort();
      await done;
    },
  };
}

async function waitForCondition(predicate: () => boolean, description: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${description}`);
}

async function waitForStableEventCount(events: ContentChangeEvent[]): Promise<void> {
  const started = Date.now();
  let lastCount = events.length;
  let unchangedSince = Date.now();
  while (Date.now() - started < 3000) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (events.length !== lastCount) {
      lastCount = events.length;
      unchangedSince = Date.now();
      continue;
    }
    if (Date.now() - unchangedSince >= 120) return;
  }
  assert.fail('Timed out waiting for the content-event stream to settle.');
}

async function waitForText(file: string, text: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    if (existsSync(file) && readFileSync(file, 'utf8').includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${text} in ${file}`);
}

test('card skill process route creates a linked output card and launches codex', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-'));
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  mkdirSync(join(workspace, '.skills', 'test-skill'), { recursive: true });
  writeFileSync(join(workspace, '.skills', 'test-skill', 'SKILL.md'), [
    '---',
    'name: test-skill',
    'description: Test skill description',
    '---',
    '',
  ].join('\n'));
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: 'source-card',
      title: 'Source Card',
      x: 100,
      y: 120,
      w: 320,
      h: 180,
      comment: { what: 'Incoming card body' },
      facts: [],
      fields: []
    }],
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
    '  const match = input.match(/Write the final result to this Markdown file: (.+)/);',
    '  if (!match) process.exit(2);',
    '  const args = process.argv.slice(2);',
    '  const model = args[args.indexOf("--model") + 1] || "";',
    '  const effort = args[args.indexOf("-c") + 1] || "";',
    '  const ledgerFile = (input.match(/Ledger file: (.+)/) || [])[1] || "";',
    '  writeFileSync(match[1].trim(), "# Fake Result\\n\\n" + (input.includes("$test-skill") ? "skill seen" : "skill missing") + "\\nmodel=" + model + "\\neffort=" + effort + "\\nledgerFile=" + ledgerFile + "\\n");',
    '  console.log(JSON.stringify({ type: "fake-codex-done" }));',
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'test-skill', codexModel: 'gpt-5.4', codexEffort: 'xhigh' })
    });
    assert.equal(response.status, 202);
    const body = await response.json() as { ok: boolean; run: { id: string; outputCardId: string; outputFile: string; codexModel: string; codexEffort: string } };
    assert.equal(body.ok, true);
    assert.ok(body.run.outputCardId);
    assert.ok(body.run.outputFile.endsWith(`${body.run.outputCardId}.md`));
    assert.equal(body.run.codexModel, 'gpt-5.4');
    assert.equal(body.run.codexEffort, 'xhigh');

    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as {
      cards: Array<{ id: string; x: number; comment?: { contentFile?: string } }>;
      relationships: Array<{ from: string; to: string; label: string }>;
    };
    assert.equal(ledger.cards.some((card) => card.id === body.run.outputCardId && card.x > 420), true);
    assert.equal(ledger.relationships.some((relationship) => relationship.from === 'source-card' && relationship.to === body.run.outputCardId && relationship.label === 'test-skill'), true);
    assert.equal(ledger.cards.find((card) => card.id === body.run.outputCardId)?.comment?.contentFile?.endsWith(`${body.run.outputCardId}.md`), true);

    const statusResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${body.run.id}?ledgerId=specs&cardId=${body.run.outputCardId}&since=0`);
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as { ok: boolean; metadata: { sourceCardTitle: string; sourceThreadId: string; codexModel: string; codexEffort: string } };
    assert.equal(status.ok, true);
    assert.deepEqual(status.metadata, { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.4', codexEffort: 'xhigh' });

    await waitForText(body.run.outputFile, 'skill seen');
    await waitForText(body.run.outputFile, 'model=gpt-5.4');
    await waitForText(body.run.outputFile, 'effort=model_reasoning_effort="xhigh"');
    await waitForText(body.run.outputFile, 'ledgerFile=');
    const output = readFileSync(body.run.outputFile, 'utf8');
    assert.match(output, /ledgerFile=.*\.decision-os\/specs\.json/);
    assert.doesNotMatch(output, /^Status: processing$/m);
    assert.doesNotMatch(output, /^Source card:/m);
    assert.doesNotMatch(output, /^Codex run:/m);
    assert.doesNotMatch(output, /^Codex model:/m);
    assert.doesNotMatch(output, /^Codex effort:/m);
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('thread codex process route anchors the run widget on the source card and scopes the prompt', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-thread-codex-'));
  const fakeCodex = join(workspace, 'fake-codex-thread.mjs');
  const inputFile = join(workspace, 'thread-input.txt');
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: 'card-a',
      title: 'Thread Card',
      x: 100,
      y: 120,
      w: 320,
      h: 180,
      comment: { what: 'Existing card body' },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {
      'thread-card-a': [
        { id: 'note-operator-1', role: 'operator', message: 'Please update this exact card from the thread.', timestamp: '2026-07-08T01:00:00.000Z' },
        {
          id: 'codex-old-run-line-2',
          role: 'agent',
          message: 'Codex internal output should not be prompt context.',
          timestamp: '2026-07-08T01:01:00.000Z',
          codexRunId: 'codex-skill-old-run',
          codexKind: 'tool_call',
          codexEventType: 'item.completed'
        }
      ]
    }
  }, null, 2));
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let input = "";',
    'process.stdin.on("data", (chunk) => { input += chunk; });',
    'process.stdin.on("end", () => {',
    `  writeFileSync(${JSON.stringify(inputFile)}, input);`,
    '  const match = input.match(/Run summary file: (.+)/);',
    '  if (!match) process.exit(2);',
    '  writeFileSync(match[1].trim(), "# Fake Thread Run\\n\\nscoped\\n");',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-thread-a" }));',
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
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let eventCollector: Awaited<ReturnType<typeof startContentEventCollector>> | undefined;

  try {
    eventCollector = await startContentEventCollector(`${baseUrl}/api/ledger-content-events`);
    const response = await fetch(`${baseUrl}/api/codex/threads/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a', codexModel: 'gpt-5.4', codexEffort: 'medium' })
    });
    assert.equal(response.status, 202);
    const body = await response.json() as { ok: boolean; run: { id: string; outputCardId: string; sourceThreadId: string; outputFile: string; codexModel: string; codexEffort: string } };
    assert.equal(body.ok, true);
    assert.equal(body.run.outputCardId, 'card-a');
    assert.equal(body.run.sourceThreadId, 'thread-card-a');
    assert.equal(body.run.codexModel, 'gpt-5.4');
    assert.equal(body.run.codexEffort, 'medium');

    await waitForText(inputFile, 'You are treating one decision-os thread, not scanning all open notes.');
    const input = readFileSync(inputFile, 'utf8');
    assert.match(input, /Card markdown file: .*\.decision-os\/cards\/specs\/card-a\.md/);
    assert.match(input, /Thread markdown file: .*\.decision-os\/threads\/specs\/thread-card-a\.md/);
    assert.match(input, /Please update this exact card from the thread\./);
    assert.doesNotMatch(input, /Codex internal output should not be prompt context\./);
    assert.match(input, /Existing card body/);
    assert.match(input, /Do not query or treat unrelated open notes\./);
    assert.doesNotMatch(input, /ledger-cli unanswered|Query Open Notes|For every pending operator note/);

    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as {
      cards: Array<{ id: string; codexThreadRunId?: string; codexThreadRunOutputFile?: string; comment?: { contentFile?: string } }>;
      threadFiles: Record<string, string>;
    };
    const card = ledger.cards.find((entry) => entry.id === 'card-a');
    assert.equal(ledger.cards.length, 1);
    assert.equal(card?.codexThreadRunId, body.run.id);
    assert.equal(card?.codexThreadRunOutputFile?.includes(body.run.id), true);
    assert.equal(card?.comment?.contentFile, '.decision-os/cards/specs/card-a.md');
    assert.equal(ledger.threadFiles['thread-card-a'], '.decision-os/threads/specs/thread-card-a.md');

    await waitForText(body.run.outputFile, 'scoped');
    await waitForText(body.run.outputFile, 'Codex run completed');
    const ledgerPath = join(workspace, '.decision-os', 'specs.json');
    const threadPath = join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md');
    await waitForText(threadPath, `codex-${body.run.id}-line-2`);
    await waitForCondition(
      () => eventCollector?.events.some((event) => event.kind === 'thread-content' && event.ledgerId === 'specs' && event.threadId === 'thread-card-a') === true,
      'the scoped lifecycle thread-content event',
    );
    await waitForStableEventCount(eventCollector.events);

    const lifecycleEvent = eventCollector.events.find((event) => event.kind === 'thread-content' && event.ledgerId === 'specs' && event.threadId === 'thread-card-a');
    assert.equal(lifecycleEvent?.contentFile, '.decision-os/threads/specs/thread-card-a.md');
    const threadBeforePolling = readFileSync(threadPath, 'utf8');
    const lifecycleNotes = parseThreadMarkdown(threadBeforePolling).filter((note) => note.codexRunId === body.run.id);
    assert.deepEqual(lifecycleNotes.map((note) => note.codexLine), ['1', '2']);
    assert.equal(new Set(lifecycleNotes.map((note) => note.id)).size, 2);
    assert.equal(lifecycleNotes.filter((note) => note.codexEventType === 'thread.started').length, 1);
    assert.equal(lifecycleNotes.filter((note) => note.codexEventType === 'turn.completed').length, 1);

    const ledgerMtimeBeforePolling = statSync(ledgerPath).mtimeMs;
    const threadMtimeBeforePolling = statSync(threadPath).mtimeMs;
    const eventCountBeforePolling = eventCollector.events.length;
    for (let requestIndex = 0; requestIndex < 3; requestIndex += 1) {
      const statusResponse = await fetch(`${baseUrl}/api/codex/skills/runs/${body.run.id}?ledgerId=specs&cardId=card-a&since=0`);
      assert.equal(statusResponse.status, 200);
      const status = await statusResponse.json() as { ok: boolean; status: string; persistedEventCount: number };
      assert.equal(status.ok, true);
      assert.equal(status.status, 'complete');
      assert.equal(status.persistedEventCount, 0);
    }
    await waitForStableEventCount(eventCollector.events);
    assert.equal(readFileSync(threadPath, 'utf8'), threadBeforePolling);
    assert.equal(statSync(ledgerPath).mtimeMs, ledgerMtimeBeforePolling);
    assert.equal(statSync(threadPath).mtimeMs, threadMtimeBeforePolling);
    assert.equal(eventCollector.events.length, eventCountBeforePolling);
  } finally {
    await eventCollector?.close();
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('card skill run cancel route terminates the active codex process', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-cancel-'));
  const fakeCodex = join(workspace, 'fake-codex-slow.mjs');
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  mkdirSync(join(workspace, '.skills', 'slow-skill'), { recursive: true });
  writeFileSync(join(workspace, '.skills', 'slow-skill', 'SKILL.md'), [
    '---',
    'name: slow-skill',
    'description: Slow skill description',
    '---',
    '',
  ].join('\n'));
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: 'source-card',
      title: 'Source Card',
      x: 100,
      y: 120,
      w: 320,
      h: 180,
      comment: { what: 'Incoming card body' },
      facts: [],
      fields: []
    }],
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
    '  const match = input.match(/Write the final result to this Markdown file: (.+)/);',
    '  if (!match) process.exit(2);',
    '  writeFileSync(match[1].trim(), "# Slow Result\\n\\nstarted\\n");',
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '});',
    'process.on("SIGTERM", () => {',
    '  console.log(JSON.stringify({ type: "operator.cancelled" }));',
    '  process.exit(0);',
    '});',
    'setInterval(() => undefined, 1000);',
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
    const startResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'slow-skill' })
    });
    assert.equal(startResponse.status, 202);
    const started = await startResponse.json() as { ok: boolean; run: { id: string; outputCardId: string; outputFile: string } };
    assert.equal(started.ok, true);
    await waitForText(started.run.outputFile, 'started');

    const cancelResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${started.run.id}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: started.run.outputCardId })
    });
    assert.equal(cancelResponse.status, 202);
    const cancelled = await cancelResponse.json() as { ok: boolean; status: string };
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.status, 'cancelled');

    await waitForText(started.run.outputFile, 'Codex run cancelled: terminated by operator');
    const statusResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${started.run.id}?ledgerId=specs&cardId=${started.run.outputCardId}&since=0`);
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as { ok: boolean; status: string };
    assert.equal(status.ok, true);
    assert.equal(status.status, 'cancelled');
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('card skill run continue route resumes the captured session with post-end thread messages', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-continue-'));
  const fakeCodex = join(workspace, 'fake-codex-resume.mjs');
  const inputFile = join(workspace, 'resume-input.txt');
  const argvFile = join(workspace, 'resume-argv.json');
  const runId = 'codex-skill-1783425215516-e1916f75';
  const sessionId = '019f3c6d-38a5-7e23-a238-904176322f0c';
  const freshSessionId = '019f3c6d-38a5-7e23-a238-904176322f0d';
  const outputCardId = `card-${runId}`;
  const threadId = `thread-${outputCardId}`;
  const threadFile = join(workspace, '.decision-os', 'threads', 'specs', `${threadId}.md`);
  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os', 'cards', 'specs'), { recursive: true });
  mkdirSync(join(workspace, '.decision-os', 'threads', 'specs'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: outputCardId,
      title: 'Skill Result',
      cardType: 'codex-skill-run',
      comment: { contentFile: `.decision-os/cards/specs/${outputCardId}.md` },
      facts: [],
      fields: []
    }],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: { [threadId]: `.decision-os/threads/specs/${threadId}.md` }
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', `${outputCardId}.md`), [
    '# Finished Skill Result',
    '',
    `Codex run: ${runId}`,
  ].join('\n'));
  writeFileSync(threadFile, [
    '# AGENT',
    `<!-- decision-os:note {"id":"codex-${runId}-line-2","timestamp":"2026-07-07T17:13:35.518Z","status":"complete","codexRunId":"${runId}","codexLine":"2","codexKind":"run_status","codexEventType":"turn.completed"} -->`,
    '',
    'Codex turn completed.',
    '',
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-after-1","timestamp":"2026-07-07T17:14:00.000Z"} -->',
    '',
    'First follow-up message.',
    '',
    '# OPERATOR',
    '<!-- decision-os:note {"id":"note-after-2","timestamp":"2026-07-07T17:15:00.000Z"} -->',
    '',
    'Second follow-up message.',
  ].join('\n'));
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`), [
    JSON.stringify({ type: 'thread.started', thread_id: sessionId }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));
  writeFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`), '');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let input = "";',
    'process.stdin.on("data", (chunk) => { input += chunk; });',
    'process.stdin.on("end", () => {',
    '  const args = process.argv.slice(2);',
    '  const fresh = !args.includes("resume");',
    `  writeFileSync(${JSON.stringify(inputFile)}, input);`,
    `  writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(args));`,
    `  if (fresh) console.log(JSON.stringify({ type: "thread.started", thread_id: ${JSON.stringify(freshSessionId)} }));`,
    `  const responseText = fresh ? "fresh response" : args.includes(${JSON.stringify(freshSessionId)}) ? "latest session response" : "resumed response";`,
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "resume-msg", type: "agent_message", text: responseText } }));',
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
      body: JSON.stringify({ ledgerId: 'specs', cardId: outputCardId, codexModel: 'gpt-5.4', codexEffort: 'medium' })
    });
    assert.equal(response.status, 202);
    const body = await response.json() as { ok: boolean; run: { id: string; continuedMessageCount: number; resumeSessionId: string; startedAt: string; continuedAt: string } };
    assert.equal(body.ok, true);
    assert.equal(body.run.id, runId);
    assert.equal(body.run.continuedMessageCount, 2);
    assert.equal(body.run.resumeSessionId, sessionId);
    assert.match(body.run.startedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(body.run.startedAt, body.run.continuedAt);

    await waitForText(inputFile, 'Continue the session with the additional information:');
    const input = readFileSync(inputFile, 'utf8');
    assert.match(input, /--- Message 1 of 2 ---[\s\S]*First follow-up message\./);
    assert.match(input, /--- Message 2 of 2 ---[\s\S]*Second follow-up message\./);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8')) as string[];
    assert.deepEqual(argv.slice(0, 4), ['exec', 'resume', '--dangerously-bypass-approvals-and-sandbox', '--json']);
    assert.equal(argv.includes(sessionId), true);
    assert.equal(argv.at(-1), '-');
    await waitForText(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`), 'resumed response');

    await waitForText(threadFile, 'resumed response');
    writeFileSync(threadFile, `${readFileSync(threadFile, 'utf8').trimEnd()}\n\n# OPERATOR\n<!-- decision-os:note {"id":"note-fresh","timestamp":"2026-07-07T17:16:00.000Z"} -->\n\nStart without the previous session context.\n`);
    const freshResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}/continue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: outputCardId, codexModel: 'gpt-5.5', codexEffort: 'high', newSession: true })
    });
    assert.equal(freshResponse.status, 202);
    const freshBody = await freshResponse.json() as { ok: boolean; run: { newSession: boolean; resumeSessionId: string } };
    assert.equal(freshBody.ok, true);
    assert.equal(freshBody.run.newSession, true);
    assert.equal(freshBody.run.resumeSessionId, '');
    await waitForText(inputFile, 'Start a new Codex session for an existing decision-os run.');
    const freshInput = readFileSync(inputFile, 'utf8');
    assert.match(freshInput, /The previous Codex session is intentionally unavailable/);
    assert.match(freshInput, /Start without the previous session context\./);
    assert.match(freshInput, /# Finished Skill Result/);
    const freshArgs = JSON.parse(readFileSync(argvFile, 'utf8')) as string[];
    assert.deepEqual(freshArgs.slice(0, 4), ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json', '-C']);
    assert.equal(freshArgs.includes('resume'), false);
    assert.equal(freshArgs.includes(sessionId), false);

    await waitForText(threadFile, 'fresh response');
    writeFileSync(threadFile, `${readFileSync(threadFile, 'utf8').trimEnd()}\n\n# OPERATOR\n<!-- decision-os:note {"id":"note-after-fresh","timestamp":"2026-07-07T17:17:00.000Z"} -->\n\nContinue the fresh session.\n`);
    const resumedFreshResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}/continue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: outputCardId, codexModel: 'gpt-5.5', codexEffort: 'high' })
    });
    assert.equal(resumedFreshResponse.status, 202);
    await waitForText(inputFile, 'Continue the fresh session.');
    const resumedFreshArgs = JSON.parse(readFileSync(argvFile, 'utf8')) as string[];
    assert.deepEqual(resumedFreshArgs.slice(0, 4), ['exec', 'resume', '--dangerously-bypass-approvals-and-sandbox', '--json']);
    assert.equal(resumedFreshArgs.includes(freshSessionId), true);
    await waitForText(threadFile, 'latest session response');
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

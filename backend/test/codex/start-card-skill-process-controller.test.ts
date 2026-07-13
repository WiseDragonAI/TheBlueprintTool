/**
 * WHAT: Process-route coverage for card-owned lifecycle log isolation.
 * WHY: Codex diagnostics belong in run artifacts while conversation threads retain only human-facing messages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { parseThreadMarkdown } from '@backend/business/ledger/helper/thread-content-file.js';
import { persistCardSkillRunEvents } from '@backend/business/codex/effect/persist-card-skill-run-events.js';
import { normalizeCardSkillRunEvent } from '@backend/business/codex/helper/normalize-card-skill-run-event.js';

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
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "ordinary-card-skill" }));',
    '  console.log(JSON.stringify({ type: "item.started", item: { id: "ordinary-tool", type: "command_execution", command: "rg TODO", status: "in_progress" } }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "ordinary-tool", type: "command_execution", command: "rg TODO", aggregated_output: "done", exit_code: 0, status: "completed" } }));',
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'test-skill', codexModel: 'gpt-5.4', codexEffort: 'xhigh' })
    });
    assert.equal(response.status, 202);
    const body = await response.json() as { ok: boolean; run: { id: string; outputCardId: string; outputFile: string; stdoutFile: string; codexModel: string; codexEffort: string } };
    assert.equal(body.ok, true);
    assert.ok(body.run.outputCardId);
    assert.ok(body.run.outputFile.endsWith(`${body.run.outputCardId}.md`));
    assert.equal(body.run.codexModel, 'gpt-5.4');
    assert.equal(body.run.codexEffort, 'xhigh');

    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as {
      cards: Array<{ id: string; x: number; codexRunModel?: string; codexRunEffort?: string; comment?: { contentFile?: string } }>;
      relationships: Array<{ from: string; to: string; label: string }>;
    };
    assert.equal(ledger.cards.some((card) => card.id === body.run.outputCardId && card.x > 420), true);
    assert.equal(ledger.relationships.some((relationship) => relationship.from === 'source-card' && relationship.to === body.run.outputCardId && relationship.label === 'test-skill'), true);
    const outputCard = ledger.cards.find((card) => card.id === body.run.outputCardId);
    assert.equal(outputCard?.comment?.contentFile?.endsWith(`${body.run.outputCardId}.md`), true);
    assert.equal(outputCard?.codexRunModel, 'gpt-5.4');
    assert.equal(outputCard?.codexRunEffort, 'xhigh');

    const statusResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${body.run.id}?ledgerId=specs&cardId=${body.run.outputCardId}&since=0`);
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as { ok: boolean; metadata: { sourceCardTitle: string; sourceThreadId: string; codexModel: string; codexEffort: string } };
    assert.equal(status.ok, true);
    assert.deepEqual(status.metadata, { sourceCardTitle: 'Source Card', sourceThreadId: '', codexModel: 'gpt-5.4', codexEffort: 'xhigh' });

    await waitForText(body.run.outputFile, 'skill seen');
    await waitForText(body.run.outputFile, 'model=gpt-5.4');
    await waitForText(body.run.outputFile, 'effort=model_reasoning_effort="xhigh"');
    await waitForText(body.run.outputFile, 'ledgerFile=');
    await waitForText(body.run.stdoutFile, '"type":"turn.completed"');
    await waitForCondition(() => {
      const runs = runtime.codexSkillRuns as Record<string, { status?: string }> | undefined;
      return runs?.[body.run.id]?.status === 'complete';
    }, 'the generated card-skill run to complete');
    const output = readFileSync(body.run.outputFile, 'utf8');
    assert.match(output, /ledgerFile=.*\.decision-os\/specs\.json/);
    assert.doesNotMatch(output, /^Status: processing$/m);
    assert.doesNotMatch(output, /^Source card:/m);
    assert.doesNotMatch(output, /^Codex run:/m);
    assert.doesNotMatch(output, /^Codex model:/m);
    assert.doesNotMatch(output, /^Codex effort:/m);

    const completedResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${body.run.id}?ledgerId=specs&cardId=${body.run.outputCardId}&since=0`);
    assert.equal(completedResponse.status, 200);
    const completed = await completedResponse.json() as {
      runKind: string;
      status: string;
      lineCount: number;
      persistedEventCount: number;
      toolCallCount: number;
      events: Array<{ line: number; type: string; kind: string; itemId: string }>;
    };
    assert.equal(completed.runKind, 'card');
    assert.equal(completed.status, 'complete');
    assert.equal(completed.lineCount, 4);
    assert.equal(completed.persistedEventCount, 0);
    assert.equal(completed.toolCallCount, 1);
    assert.deepEqual(completed.events.map((event) => event.type), ['thread.started', 'item.started', 'item.completed', 'turn.completed']);
    assert.deepEqual(completed.events.filter((event) => event.itemId === 'ordinary-tool').map((event) => event.line), [2, 3]);

    const threadFile = join(workspace, '.decision-os', 'threads', 'specs', `thread-${body.run.outputCardId}.md`);
    const thread = existsSync(threadFile) ? readFileSync(threadFile, 'utf8') : '';
    assert.deepEqual(parseThreadMarkdown(thread).filter((note) => note.codexRunId === body.run.id), []);
    assert.doesNotMatch(thread, new RegExp(`codex-${body.run.id}-line-`));
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
  const argsFile = join(workspace, 'thread-args.json');
  const launchesFile = join(workspace, 'thread-launches.txt');
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
    'import { appendFileSync, writeFileSync } from "node:fs";',
    'let input = "";',
    'process.stdin.on("data", (chunk) => { input += chunk; });',
    'process.stdin.on("end", () => {',
    `  writeFileSync(${JSON.stringify(inputFile)}, input);`,
    `  writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));`,
    `  appendFileSync(${JSON.stringify(launchesFile)}, "launch\\n");`,
    '  const args = process.argv.slice(2);',
    '  const developerArgument = args.find((argument) => argument.startsWith("developer_instructions=")) || "";',
    '  const developerInstructions = JSON.parse(developerArgument.slice("developer_instructions=".length));',
    '  const match = input.match(/Run summary: (.+)/);',
    '  const threadMatch = input.match(/Thread: [^ ]+ \\(([^)]+)\\)/);',
    '  if (!match || !threadMatch) process.exit(2);',
    '  writeFileSync(match[1], "# Fake Thread Run\\n\\nscoped\\n");',
    '  appendFileSync(threadMatch[1], "\\n\\n# AGENT\\n<!-- decision-os:note {\\"id\\":\\"note-agent-scoped-final\\",\\"timestamp\\":\\"2026-07-10T01:02:00.000Z\\"} -->\\n\\nScoped final answer.\\n");',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-thread-a" }));',
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "thinking-1", type: "reasoning", text: "Thinking remains in the run log." } }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "message-1", type: "agent_message", text: "Interim progress remains in the run log." } }));',
    '  console.log(JSON.stringify({ type: "item.started", item: { id: "tool-1", type: "command_execution", command: "rg TODO", status: "in_progress" } }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "tool-1", type: "command_execution", command: "rg TODO", aggregated_output: "done", exit_code: 0, status: "completed" } }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "file-1", type: "file_change", changes: [{ path: "card-a.md", kind: "updated" }], status: "completed" } }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "warning-1", type: "warning", message: "Recoverable warning." } }));',
    '  console.log(JSON.stringify({ type: "error", message: "Reconnecting... 2/5 (request timed out)" }));',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '  console.error("WARNING stderr retry budget is low");',
    '  console.error("Reconnecting transport after request timed out");',
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
    const body = await response.json() as { ok: boolean; run: { id: string; outputCardId: string; sourceThreadId: string; outputFile: string; stdoutFile: string; codexModel: string; codexEffort: string } };
    assert.equal(body.ok, true);
    assert.equal(body.run.outputCardId, 'card-a');
    assert.equal(body.run.sourceThreadId, 'thread-card-a');
    assert.equal(body.run.codexModel, 'gpt-5.4');
    assert.equal(body.run.codexEffort, 'medium');

    await waitForText(inputFile, 'Execute the operator request from this Decision OS thread.');
    const input = readFileSync(inputFile, 'utf8');
    assert.match(input, /Please update this exact card from the thread\./);
    assert.doesNotMatch(input, /Codex internal output should not be prompt context\./);
    assert.match(input, /Existing card body/);
    assert.doesNotMatch(input, /^## A\. Scope/m);
    assert.doesNotMatch(input, /Run summary file:/);
    assert.doesNotMatch(input, /treat-open-notes|open notes|ledger-cli unanswered|Query Open Notes|For every pending operator note/i);

    await waitForText(argsFile, 'developer_instructions=');
    const args = JSON.parse(readFileSync(argsFile, 'utf8')) as string[];
    const developerArgument = args.find((argument) => argument.startsWith('developer_instructions='));
    assert.ok(developerArgument);
    const developerInstructions = JSON.parse(developerArgument.slice('developer_instructions='.length)) as string;
    assert.match(developerInstructions, /^Decision OS run:/);
    assert.match(developerInstructions, /ledger-cli is on PATH/);
    assert.match(developerInstructions, /session-context/);
    assert.match(developerInstructions, /--message-stdin/);
    assert.ok(developerInstructions.length < 800);
    assert.doesNotMatch(developerInstructions, /Please update this exact card|Codex internal output|Existing card body/);
    assert.doesNotMatch(developerInstructions, /<(?:workspaceRoot|ledgerFile|cardId|cardTitle|cardMarkdownFile|threadId|threadMarkdownFile|runSummaryFile|operatorNoteTimestamp)>/);

    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as {
      cards: Array<{ id: string; codexThreadRunId?: string; codexThreadRunOutputFile?: string; codexRunModel?: string; codexRunEffort?: string; comment?: { contentFile?: string } }>;
      threadFiles: Record<string, string>;
    };
    const card = ledger.cards.find((entry) => entry.id === 'card-a');
    assert.equal(ledger.cards.length, 1);
    assert.equal(card?.codexThreadRunId, body.run.id);
    assert.equal(card?.codexThreadRunOutputFile?.includes(body.run.id), true);
    assert.equal(card?.codexRunModel, 'gpt-5.4');
    assert.equal(card?.codexRunEffort, 'medium');
    assert.equal(card?.comment?.contentFile, '.decision-os/cards/specs/card-a.md');
    assert.equal(ledger.threadFiles['thread-card-a'], '.decision-os/threads/specs/thread-card-a.md');

    await waitForText(body.run.outputFile, 'scoped');
    await waitForText(body.run.outputFile, 'Codex run completed');
    await waitForText(`${body.run.stdoutFile}.telemetry.jsonl`, '"callId":"tool-1"');
    const telemetryRow = JSON.parse(readFileSync(`${body.run.stdoutFile}.telemetry.jsonl`, 'utf8').trim().split('\n')[0]);
    assert.equal(typeof telemetryRow.startedAt, 'string');
    assert.equal(typeof telemetryRow.completedAt, 'string');
    assert.equal(typeof telemetryRow.durationMs, 'number');
    assert.equal(telemetryRow.success, true);
    assert.equal(telemetryRow.runId, body.run.id);
    const ledgerPath = join(workspace, '.decision-os', 'specs.json');
    const threadPath = join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md');
    await waitForText(threadPath, 'Scoped final answer.');
    await waitForCondition(
      () => eventCollector?.events.some((event) => event.kind === 'thread-content' && event.ledgerId === 'specs' && event.threadId === 'thread-card-a') === true,
      'the scoped final-answer thread-content event',
    );
    await waitForStableEventCount(eventCollector.events);

    const lifecycleEvent = eventCollector.events.find((event) => event.kind === 'thread-content' && event.ledgerId === 'specs' && event.threadId === 'thread-card-a');
    assert.equal(lifecycleEvent?.contentFile, '.decision-os/threads/specs/thread-card-a.md');
    const threadBeforePolling = readFileSync(threadPath, 'utf8');
    const lifecycleNotes = parseThreadMarkdown(threadBeforePolling).filter((note) => note.codexRunId === body.run.id);
    assert.deepEqual(lifecycleNotes, []);
    const notes = parseThreadMarkdown(threadBeforePolling);
    assert.equal(notes.at(-1)?.id, 'note-agent-scoped-final');
    assert.equal(notes.at(-1)?.role, 'agent');
    assert.equal(notes.at(-1)?.message, 'Scoped final answer.');
    assert.equal(notes.filter((note) => note.id === 'note-agent-scoped-final').length, 1);
    assert.match(threadBeforePolling, /Please update this exact card from the thread\.[\s\S]*Scoped final answer\./);
    assert.doesNotMatch(threadBeforePolling, new RegExp(`codex-${body.run.id}-line-`));

    const ledgerMtimeBeforePolling = statSync(ledgerPath).mtimeMs;
    const threadMtimeBeforePolling = statSync(threadPath).mtimeMs;
    const eventCountBeforePolling = eventCollector.events.length;
    for (let requestIndex = 0; requestIndex < 3; requestIndex += 1) {
      const statusResponse = await fetch(`${baseUrl}/api/codex/skills/runs/${body.run.id}?ledgerId=specs&cardId=card-a&since=0`);
      assert.equal(statusResponse.status, 200);
      const status = await statusResponse.json() as { ok: boolean; runKind: string; status: string; persistedEventCount: number; toolCallCount: number; thinkingCount: number; warningCount: number; transportStatus: string; events: Array<{ kind: string }>; diagnostics: Array<{ kind: string }>; metadata: { codexModel: string; codexEffort: string } };
      assert.equal(status.ok, true);
      assert.equal(status.runKind, 'thread');
      assert.equal(status.status, 'complete');
      assert.equal(status.persistedEventCount, 0);
      assert.equal(status.toolCallCount, 2);
      assert.equal(status.thinkingCount, 1);
      assert.equal(status.warningCount, 2);
      assert.equal(status.transportStatus, 'degraded');
      assert.deepEqual(status.events.map((event) => event.kind), ['run_status', 'run_status', 'thinking', 'agent_message', 'tool_call', 'tool_call', 'tool_call', 'warning', 'transport', 'run_status']);
      assert.deepEqual(status.diagnostics.map((event) => event.kind), ['warning', 'transport']);
      assert.equal(status.metadata.codexModel, 'gpt-5.4');
      assert.equal(status.metadata.codexEffort, 'medium');
    }
    await waitForStableEventCount(eventCollector.events);
    assert.equal(readFileSync(threadPath, 'utf8'), threadBeforePolling);
    assert.equal(statSync(ledgerPath).mtimeMs, ledgerMtimeBeforePolling);
    assert.equal(statSync(threadPath).mtimeMs, threadMtimeBeforePolling);
    assert.equal(eventCollector.events.length, eventCountBeforePolling);

    appendFileSync(threadPath, '\n# OPERATOR\n<!-- decision-os:note {"id":"note-operator-missing-timestamp"} -->\n\nThis request has no timestamp.\n', 'utf8');
    const launchCountBeforeRejection = readFileSync(launchesFile, 'utf8').trim().split('\n').length;
    const runCountBeforeRejection = Object.keys(runtime.codexSkillRuns as Record<string, unknown>).length;
    const rejectedResponse = await fetch(`${baseUrl}/api/codex/threads/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a' })
    });
    assert.equal(rejectedResponse.status, 400);
    const rejected = await rejectedResponse.json() as { ok: boolean; error: string };
    assert.equal(rejected.ok, false);
    assert.match(rejected.error, /latest operator note must have an exact ISO timestamp/i);
    assert.equal(readFileSync(launchesFile, 'utf8').trim().split('\n').length, launchCountBeforeRejection);
    assert.equal(Object.keys(runtime.codexSkillRuns as Record<string, unknown>).length, runCountBeforeRejection);

    appendFileSync(threadPath, '\n# OPERATOR\n<!-- decision-os:note {"id":"note-operator-duplicate","timestamp":"2026-07-08T01:05:00.000Z"} -->\n\nContinue the existing session.\n', 'utf8');
    const duplicateResponse = await fetch(`${baseUrl}/api/codex/threads/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', threadId: 'thread-card-a', cardId: 'card-a' })
    });
    assert.equal(duplicateResponse.status, 409);
    const duplicate = await duplicateResponse.json() as { ok: boolean; error: string; runId: string };
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.runId, body.run.id);
    assert.match(duplicate.error, /continue the existing run/i);
    assert.equal(readFileSync(launchesFile, 'utf8').trim().split('\n').length, launchCountBeforeRejection);
  } finally {
    await eventCollector?.close();
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('thread codex process resumes a capacity-interrupted session after five seconds with the same model and effort', async () => {
  const originalCwd = process.cwd();
  const previousCodexBin = process.env.CODEX_BIN;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-thread-capacity-resume-'));
  const fakeCodex = join(workspace, 'fake-codex-capacity.mjs');
  const launchesFile = join(workspace, 'launches.jsonl');
  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
  }, null, 2));
  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    cards: [{
      id: 'card-capacity', title: 'Capacity run', x: 100, y: 120, w: 320, h: 180,
      comment: { what: 'Resume this headless run.' }, facts: [], fields: []
    }],
    annotations: [], relationships: [],
    notes: { 'thread-card-capacity': [{
      id: 'note-operator', role: 'operator', message: 'Run the task.', timestamp: '2026-07-13T10:11:20.500Z'
    }] }
  }, null, 2));
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync } from "node:fs";',
    'const args = process.argv.slice(2);',
    `appendFileSync(${JSON.stringify(launchesFile)}, JSON.stringify({ at: Date.now(), args }) + "\\n");`,
    'process.stdin.on("data", () => undefined);',
    'process.stdin.on("end", () => {',
    '  if (!args.includes("resume")) {',
    '    console.log(JSON.stringify({ type: "thread.started", thread_id: "session-capacity" }));',
    '    console.log(JSON.stringify({ type: "error", message: "Selected model is at capacity. Please try a different model." }));',
    '    process.exitCode = 1;',
    '    return;',
    '  }',
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/threads/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ledgerId: 'specs', threadId: 'thread-card-capacity', cardId: 'card-capacity',
        codexModel: 'gpt-5.4', codexEffort: 'high'
      })
    });
    assert.equal(response.status, 202);
    const body = await response.json() as { run: { id: string; outputFile: string } };
    const startedWaitingAt = Date.now();
    while ((!existsSync(launchesFile) || readFileSync(launchesFile, 'utf8').trim().split('\n').length < 2) && Date.now() - startedWaitingAt < 8_000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const launches = readFileSync(launchesFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { at: number; args: string[] });
    assert.equal(launches.length, 2);
    assert.ok(launches[1].at - launches[0].at >= 4_900);
    assert.deepEqual(launches[1].args.slice(0, 4), ['exec', 'resume', '--dangerously-bypass-approvals-and-sandbox', '--json']);
    assert.equal(launches[1].args.includes('session-capacity'), true);
    for (const launch of launches) {
      assert.equal(launch.args[launch.args.indexOf('--model') + 1], 'gpt-5.4');
      assert.equal(launch.args.includes('model_reasoning_effort="high"'), true);
    }
    await waitForText(body.run.outputFile, 'Codex run completed');
    const runtimeRun = (runtime.codexSkillRuns as Record<string, { status: string }>)[body.run.id];
    assert.equal(runtimeRun.status, 'complete');
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('all card-owned terminal lifecycle batches leave ledger and conversation bytes unchanged', () => {
  for (const terminal of [
    { type: 'turn.completed' },
    { type: 'turn.failed', message: 'Codex process failed.' },
    { type: 'operator.cancelled', message: 'Codex process cancelled.' },
  ]) {
    for (const ownershipKind of ['thread-run-id', 'run-id', 'generated-card-id', 'body-marker'] as const) {
      const workspace = mkdtempSync(join(tmpdir(), `decision-os-owned-${ownershipKind}-`));
      const decisionOsRoot = join(workspace, '.decision-os');
      const ledgerPath = join(decisionOsRoot, 'specs.json');
      const runId = `codex-skill-1783670000000-${ownershipKind}-${terminal.type.replace(/\W+/g, '').slice(0, 8)}`;
      const cardId = ownershipKind === 'generated-card-id' ? `card-${runId}` : `card-${ownershipKind}`;
      const threadId = `thread-${cardId}`;
      const threadPath = join(decisionOsRoot, 'threads', 'specs', `${threadId}.md`);
      const card: Record<string, unknown> = { id: cardId, comment: { what: 'Card body.' }, facts: [], fields: [] };
      if (ownershipKind === 'thread-run-id') card.codexThreadRunId = runId;
      if (ownershipKind === 'run-id') card.codexRunId = runId;
      if (ownershipKind === 'body-marker') {
        const contentFile = `.decision-os/cards/specs/${cardId}.md`;
        card.comment = { contentFile };
        mkdirSync(join(decisionOsRoot, 'cards', 'specs'), { recursive: true });
        writeFileSync(join(workspace, contentFile), `# Historical run\n\nCodex run: ${runId}\n`);
      }
      mkdirSync(join(decisionOsRoot, 'threads', 'specs'), { recursive: true });
      writeFileSync(ledgerPath, JSON.stringify({
        cards: [card],
        annotations: [],
        relationships: [],
        notes: {},
        threadFiles: { [threadId]: `.decision-os/threads/specs/${threadId}.md` },
      }, null, 2));
      writeFileSync(threadPath, [
        '# OPERATOR',
        '<!-- decision-os:note {"id":"note-operator","timestamp":"2026-07-10T00:00:00.000Z"} -->',
        '',
        'Run Codex for this thread.',
        '',
        '# AGENT',
        '<!-- decision-os:note {"id":"note-agent-final","timestamp":"2026-07-10T00:01:00.000Z"} -->',
        '',
        'The direct scoped answer.',
      ].join('\n'));
      const ledgerBefore = readFileSync(ledgerPath, 'utf8');
      const threadBefore = readFileSync(threadPath, 'utf8');
      const ledgerMtimeBefore = statSync(ledgerPath).mtimeMs;
      const threadMtimeBefore = statSync(threadPath).mtimeMs;

      try {
        const events = [
          normalizeCardSkillRunEvent({ line: 1, event: { type: 'thread.started' } }),
          normalizeCardSkillRunEvent({ line: 2, event: { type: 'item.started', item: { id: 'tool-1', type: 'command_execution', command: 'rg TODO', status: 'in_progress' } } }),
          normalizeCardSkillRunEvent({ line: 3, event: { type: 'item.completed', item: { id: 'tool-1', type: 'command_execution', command: 'rg TODO', status: 'completed' } } }),
          normalizeCardSkillRunEvent({ line: 4, event: terminal }),
        ];
        const persisted = persistCardSkillRunEvents({ decisionOsRoot, ledgerPath, cardId, runId, events });
        const assertionLabel = `${ownershipKind}: ${terminal.type}`;
        assert.equal(persisted, 0, assertionLabel);
        assert.equal(readFileSync(ledgerPath, 'utf8'), ledgerBefore, assertionLabel);
        assert.equal(readFileSync(threadPath, 'utf8'), threadBefore, assertionLabel);
        assert.equal(statSync(ledgerPath).mtimeMs, ledgerMtimeBefore, assertionLabel);
        assert.equal(statSync(threadPath).mtimeMs, threadMtimeBefore, assertionLabel);
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    }
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
  const jsonlFile = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
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
  writeFileSync(jsonlFile, [
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
    const threadBeforeResume = readFileSync(threadFile, 'utf8');
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
    await waitForText(jsonlFile, 'resumed response');
    await waitForCondition(() => {
      const runs = runtime.codexSkillRuns as Record<string, { status?: string }> | undefined;
      return runs?.[runId]?.status === 'complete';
    }, 'the resumed card-skill run to complete');
    const resumedStatusResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}&since=0`);
    assert.equal(resumedStatusResponse.status, 200);
    const resumedStatus = await resumedStatusResponse.json() as { persistedEventCount: number; events: Array<{ type: string }> };
    assert.equal(resumedStatus.persistedEventCount, 0);
    assert.deepEqual(resumedStatus.events.map((event) => event.type), ['turn.started', 'item.completed', 'turn.completed']);
    assert.equal(readFileSync(threadFile, 'utf8'), threadBeforeResume);

    const threadBeforeFresh = `${threadBeforeResume.trimEnd()}\n\n# OPERATOR\n<!-- decision-os:note {"id":"note-fresh","timestamp":"2026-07-07T17:16:00.000Z"} -->\n\nStart without the previous session context.\n`;
    writeFileSync(threadFile, threadBeforeFresh);
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

    await waitForText(jsonlFile, 'fresh response');
    await waitForCondition(() => {
      const runs = runtime.codexSkillRuns as Record<string, { status?: string }> | undefined;
      return runs?.[runId]?.status === 'complete';
    }, 'the fresh card-skill session to complete');
    const freshStatusResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}&since=0`);
    assert.equal(freshStatusResponse.status, 200);
    const freshStatus = await freshStatusResponse.json() as { persistedEventCount: number; events: Array<{ type: string }> };
    assert.equal(freshStatus.persistedEventCount, 0);
    assert.deepEqual(freshStatus.events.map((event) => event.type), ['thread.started', 'turn.started', 'item.completed', 'turn.completed']);
    assert.equal(readFileSync(threadFile, 'utf8'), threadBeforeFresh);

    const threadBeforeLatestResume = `${threadBeforeFresh.trimEnd()}\n\n# OPERATOR\n<!-- decision-os:note {"id":"note-after-fresh","timestamp":"2026-07-07T17:17:00.000Z"} -->\n\nContinue the fresh session.\n`;
    writeFileSync(threadFile, threadBeforeLatestResume);
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
    await waitForText(jsonlFile, 'latest session response');
    await waitForCondition(() => {
      const runs = runtime.codexSkillRuns as Record<string, { status?: string }> | undefined;
      return runs?.[runId]?.status === 'complete';
    }, 'the latest resumed card-skill session to complete');
    const latestStatusResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}&since=0`);
    assert.equal(latestStatusResponse.status, 200);
    const latestStatus = await latestStatusResponse.json() as { persistedEventCount: number; events: Array<{ type: string }> };
    assert.equal(latestStatus.persistedEventCount, 0);
    assert.deepEqual(latestStatus.events.map((event) => event.type), ['turn.started', 'item.completed', 'turn.completed']);
    assert.equal(readFileSync(threadFile, 'utf8'), threadBeforeLatestResume);

    const interruptedThread = `${threadBeforeLatestResume.trimEnd()}\n\n# AGENT\n<!-- decision-os:note {"id":"codex-${runId}-line-13","timestamp":"2026-07-07T17:18:00.000Z","status":"running","codexRunId":"${runId}","codexLine":"13","codexKind":"run_status","codexEventType":"turn.started"} -->\n\nCodex turn started.\n`;
    writeFileSync(threadFile, interruptedThread);
    appendFileSync(jsonlFile, `${JSON.stringify({ type: 'turn.started' })}\n`);
    appendFileSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`), `decision-os:codex-run-segment ${JSON.stringify({ runId, startedAt: new Date().toISOString(), segment: 'continue', startLine: 12 })}\n`);
    delete (runtime.codexSkillRuns as Record<string, unknown>)[runId];

    const orphanedStatusResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}&since=0`);
    const orphanedStatus = await orphanedStatusResponse.json() as { status: string; active: boolean };
    assert.equal(orphanedStatus.status, 'running');
    assert.equal(orphanedStatus.active, false);
    const interruptedResumeResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}/continue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: outputCardId, codexModel: 'gpt-5.5', codexEffort: 'high' })
    });
    assert.equal(interruptedResumeResponse.status, 202);
    await waitForText(inputFile, 'Continue the interrupted task from the durable session context.');
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

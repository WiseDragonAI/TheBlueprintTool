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
    '  writeFileSync(match[1].trim(), "# Fake Result\\n\\n" + (input.includes("$test-skill") ? "skill seen" : "skill missing") + "\\nmodel=" + model + "\\neffort=" + effort + "\\n");',
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
    const body = await response.json() as { ok: boolean; run: { outputCardId: string; outputFile: string; codexModel: string; codexEffort: string } };
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

    await waitForText(body.run.outputFile, 'skill seen');
    await waitForText(body.run.outputFile, 'model=gpt-5.4');
    await waitForText(body.run.outputFile, 'effort=model_reasoning_effort="xhigh"');
  } finally {
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
  const outputCardId = `card-${runId}`;
  const threadId = `thread-${outputCardId}`;
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
  writeFileSync(join(workspace, '.decision-os', 'threads', 'specs', `${threadId}.md`), [
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
    `  writeFileSync(${JSON.stringify(inputFile)}, input);`,
    `  writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(process.argv.slice(2)));`,
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '  console.log(JSON.stringify({ type: "item.completed", item: { id: "resume-msg", type: "agent_message", text: "resumed response" } }));',
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
    const body = await response.json() as { ok: boolean; run: { id: string; continuedMessageCount: number; resumeSessionId: string } };
    assert.equal(body.ok, true);
    assert.equal(body.run.id, runId);
    assert.equal(body.run.continuedMessageCount, 2);
    assert.equal(body.run.resumeSessionId, sessionId);

    await waitForText(inputFile, 'Continue the session with the additional information:');
    const input = readFileSync(inputFile, 'utf8');
    assert.match(input, /--- Message 1 of 2 ---[\s\S]*First follow-up message\./);
    assert.match(input, /--- Message 2 of 2 ---[\s\S]*Second follow-up message\./);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8')) as string[];
    assert.deepEqual(argv.slice(0, 4), ['exec', 'resume', '--dangerously-bypass-approvals-and-sandbox', '--json']);
    assert.equal(argv.includes(sessionId), true);
    assert.equal(argv.at(-1), '-');
    await waitForText(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`), 'resumed response');
  } finally {
    server.close();
    process.chdir(originalCwd);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

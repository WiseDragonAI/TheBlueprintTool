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

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

async function waitFor<T>(read: () => T | null, label: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const value = read();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${label}`);
}

function skill(workspace: string, name: string): void {
  const directory = join(workspace, '.skills', name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} test skill\n---\n`);
}

function baseWorkspace(prefix: string): { workspace: string; decisionOsRoot: string; ledgerPath: string } {
  const workspace = mkdtempSync(join(tmpdir(), prefix));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }, null, 2));
  writeFileSync(ledgerPath, JSON.stringify({
    cards: [{ id: 'source', title: 'Source', x: 0, y: 0, w: 320, h: 180, comment: { what: 'source body' }, facts: [], fields: [] }],
    annotations: [], relationships: [], notes: {},
  }, null, 2));
  return { workspace, decisionOsRoot, ledgerPath };
}

test('cancellation stops downstream work and restart clears generated card and thread content before relaunch', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot, ledgerPath } = baseWorkspace('decision-os-pipeline-cancel-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const invocations = join(workspace, 'invocations.txt');
  const countFile = join(workspace, 'count.txt');
  skill(workspace, 'slow');
  skill(workspace, 'fast');
  writeFileSync(countFile, '0');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync, readFileSync, writeFileSync } from "node:fs";',
    'let prompt = "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const skill = (prompt.match(/Current skill: (.+)/) || [])[1] || "missing";',
    `  const count = Number(readFileSync(${JSON.stringify(countFile)}, "utf8")) + 1;`,
    `  writeFileSync(${JSON.stringify(countFile)}, String(count));`,
    `  appendFileSync(${JSON.stringify(invocations)}, skill + ":" + count + "\\n");`,
    '  const output = (prompt.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    '  writeFileSync(output.trim(), "# new " + skill + " result\\n");',
    '  console.log(JSON.stringify({ type: "turn.started" }));',
    '  if (count === 1) setTimeout(() => console.log(JSON.stringify({ type: "turn.completed" })), 2000);',
    '  else setTimeout(() => console.log(JSON.stringify({ type: "turn.completed" })), 20);',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const now = '2026-07-10T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['slow', 'fast'],
    store: {
      pipelines: [{ id: 'cancel-pipeline', name: 'Cancel pipeline', purpose: '', stepIds: ['step'], createdAt: now, updatedAt: now }],
      steps: [{ id: 'step', name: 'Step', purpose: '', createdAt: now, updatedAt: now, skills: [
        { id: 'slow-config', skillName: 'slow', codexModel: null, codexEffort: null },
        { id: 'fast-config', skillName: 'fast', codexModel: null, codexEffort: null },
      ] }],
      runs: [], skillLibrary: [], activeWorkspaceRun: null,
    },
  });
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const startResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source', pipelineId: 'cancel-pipeline' }),
    });
    assert.equal(startResponse.status, 202);
    const started = await startResponse.json() as Record<string, any>;
    const runId = started.run.id as string;
    const outputCardId = started.run.steps[0].outputCardId as string;
    await waitFor(() => existsSync(invocations) && readFileSync(invocations, 'utf8').includes('slow:1') ? true : null, 'first slow invocation');

    const cancelResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs/${runId}/cancel`, { method: 'POST' });
    assert.equal(cancelResponse.status, 202);
    const cancelled = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((run) => run.id === runId);
    assert.equal(cancelled?.status, 'cancelled');
    assert.equal(cancelled?.steps[0].skills[1].status, 'pending');
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.activeWorkspaceRun, null);
    assert.deepEqual(readFileSync(invocations, 'utf8').trim().split('\n'), ['slow:1']);

    const outputFile = join(decisionOsRoot, 'cards', 'specs', `${outputCardId}.md`);
    const threadDirectory = join(decisionOsRoot, 'threads', 'specs');
    const threadFile = join(threadDirectory, `thread-${outputCardId}.md`);
    writeFileSync(outputFile, '# old generated body\n');
    mkdirSync(threadDirectory, { recursive: true });
    writeFileSync(threadFile, '# OPERATOR\n<!-- decision-os:note {"id":"old-note"} -->\n\nold thread note\n');
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<string, any>;
    ledger.threadFiles = { ...(ledger.threadFiles ?? {}), [`thread-${outputCardId}`]: `.decision-os/threads/specs/thread-${outputCardId}.md` };
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));

    const restartResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs/${runId}/restart`, { method: 'POST' });
    assert.equal(restartResponse.status, 202);
    await waitFor(() => readCodexPipelineStore({ decisionOsRoot }).store.runs.find((run) => run.id === runId)?.status === 'complete' ? true : null, 'restarted completion');
    assert.deepEqual(readFileSync(invocations, 'utf8').trim().split('\n'), ['slow:1', 'slow:2', 'fast:3']);
    assert.doesNotMatch(readFileSync(outputFile, 'utf8'), /old generated body/);
    assert.doesNotMatch(readFileSync(threadFile, 'utf8'), /old thread note/);
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.activeWorkspaceRun, null);

    const detailResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs/${runId}`);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json() as Record<string, any>;
    assert.equal(detail.run.status, 'complete');
    assert.equal(detail.run.steps[0].skills[0].logAvailable, true);
    assert.equal(detail.run.steps[0].skills[0].codexModel, cancelled?.steps[0].skills[0].codexModel);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});
test('server startup resumes after a persisted completed skill without duplicating its files', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot, ledgerPath } = baseWorkspace('decision-os-pipeline-resume-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const invocations = join(workspace, 'invocations.txt');
  skill(workspace, 'first');
  skill(workspace, 'second');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync, writeFileSync } from "node:fs";',
    'let prompt = "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const skill = (prompt.match(/Current skill: (.+)/) || [])[1] || "missing";',
    `  appendFileSync(${JSON.stringify(invocations)}, skill + "\\n");`,
    '  const output = (prompt.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    '  writeFileSync(output.trim(), "# resumed " + skill + "\\n");',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const runDirectory = join(decisionOsRoot, 'runs', 'codex-skills', 'specs');
  const cardDirectory = join(decisionOsRoot, 'cards', 'specs');
  mkdirSync(runDirectory, { recursive: true });
  mkdirSync(cardDirectory, { recursive: true });
  const firstStdout = join(runDirectory, 'first-run.jsonl');
  const firstStderr = join(runDirectory, 'first-run.log');
  const secondStdout = join(runDirectory, 'second-run.jsonl');
  const secondStderr = join(runDirectory, 'second-run.log');
  writeFileSync(firstStdout, '{"type":"thread.started"}\n{"type":"turn.completed"}\n');
  writeFileSync(firstStderr, '');
  const firstBytes = readFileSync(firstStdout, 'utf8');
  const firstMtime = statSync(firstStdout).mtimeMs;
  const outputCardId = 'card-resume-step';
  const outputRef = `.decision-os/cards/specs/${outputCardId}.md`;
  writeFileSync(join(cardDirectory, `${outputCardId}.md`), '# first result\n');
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<string, any>;
  ledger.cards.push({
    id: outputCardId, title: 'Resume Step', cardType: 'codex-skill-run', x: 400, y: 0, w: 700, h: 260,
    codexPipelineRunId: 'pipeline-resume', codexRunId: 'first-run', comment: { contentFile: outputRef }, facts: [], fields: [],
  });
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  const now = '2026-07-10T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['first', 'second'],
    store: {
      pipelines: [{ id: 'resume-definition', name: 'Resume', purpose: '', stepIds: ['step'], createdAt: now, updatedAt: now }],
      steps: [{ id: 'step', name: 'Resume Step', purpose: '', createdAt: now, updatedAt: now, skills: [
        { id: 'first-config', skillName: 'first', codexModel: null, codexEffort: null },
        { id: 'second-config', skillName: 'second', codexModel: null, codexEffort: null },
      ] }],
      runs: [{
        id: 'pipeline-resume', pipelineId: 'resume-definition', pipelineName: 'Resume', temporary: false,
        ledgerId: 'specs', sourceCardId: 'source', sourceCardTitle: 'Source', status: 'running',
        steps: [{
          id: 'pipeline-resume-step-1', stepId: 'step', name: 'Resume Step', purpose: '', outputCardId, status: 'running',
          skills: [
            { id: 'run-first', pipelineSkillId: 'first-config', skillName: 'first', runId: 'first-run', status: 'running', codexModel: 'gpt-5.4', codexEffort: 'high', stdoutFile: firstStdout, stderrFile: firstStderr, startedAt: now, finishedAt: null, error: '' },
            { id: 'run-second', pipelineSkillId: 'second-config', skillName: 'second', runId: 'second-run', status: 'pending', codexModel: 'gpt-5.5', codexEffort: 'low', stdoutFile: secondStdout, stderrFile: secondStderr, startedAt: null, finishedAt: null, error: '' },
          ],
          startedAt: now, finishedAt: null, error: '',
        }],
        createdAt: now, updatedAt: now, startedAt: now, finishedAt: null, resumedAt: null, error: '',
      }],
      skillLibrary: [], activeWorkspaceRun: 'pipeline-resume',
    },
  });
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  try {
    const completed = await waitFor(() => {
      const run = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.id === 'pipeline-resume');
      return run?.status === 'complete' ? run : null;
    }, 'resumed pipeline completion');
    assert.equal(completed.steps[0].skills[0].status, 'complete');
    assert.equal(completed.steps[0].skills[1].status, 'complete');
    assert.deepEqual(readFileSync(invocations, 'utf8').trim().split('\n'), ['second']);
    assert.equal(readFileSync(firstStdout, 'utf8'), firstBytes);
    assert.equal(statSync(firstStdout).mtimeMs, firstMtime);
    assert.equal(existsSync(secondStdout), true);
    assert.ok(completed.resumedAt);
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.activeWorkspaceRun, null);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

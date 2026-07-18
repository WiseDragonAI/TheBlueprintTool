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
import { discoverDecisionOsProjects } from '@backend/business/server/helper/project-catalog.js';

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

async function waitFor<T>(read: () => T | null, label: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const value = read();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out waiting for ${label}`);
}

function createSkill(workspace: string, name: string): void {
  const directory = join(workspace, '.skills', name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} test skill\n---\n`);
}

function createWorkspace(prefix: string): { workspace: string; decisionOsRoot: string } {
  const workspace = mkdtempSync(join(tmpdir(), prefix));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }],
  }, null, 2));
  writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
    cards: [{
      id: 'source-card', title: 'Source Card', x: 20, y: 40, w: 320, h: 180,
      comment: { what: 'Original source body' }, facts: [], fields: [],
    }],
    annotations: [], relationships: [], notes: {},
  }, null, 2));
  return { workspace, decisionOsRoot };
}

test('saved pipeline creates all step cards and runs five isolated skills strictly in order', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot } = createWorkspace('decision-os-pipeline-run-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const lifecycleFile = join(workspace, 'lifecycle.txt');
  for (const name of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) createSkill(workspace, name);
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync, writeFileSync } from "node:fs";',
    'let prompt = "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const skill = (prompt.match(/Current skill: (.+)/) || [])[1] || "missing";',
    '  const output = (prompt.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    `  appendFileSync(${JSON.stringify(lifecycleFile)}, "start:" + skill + "\\n");`,
    '  writeFileSync(output.trim(), "# " + skill + " result\\n\\nproduced-by=" + skill + "\\n");',
    '  writeFileSync(output.trim() + ".input", prompt);',
    '  console.log(JSON.stringify({ type: "thread.started", thread_id: "session-" + skill }));',
    '  setTimeout(() => {',
    '    console.log(JSON.stringify({ type: "turn.completed" }));',
    `    appendFileSync(${JSON.stringify(lifecycleFile)}, "end:" + skill + "\\n");`,
    '  }, 35);',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const now = '2026-07-10T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
    store: {
      pipelines: [{ id: 'pipeline-five', name: 'Five skills', purpose: 'Order proof', stepIds: ['one', 'two', 'three'], createdAt: now, updatedAt: now }],
      steps: [
        { id: 'one', name: 'One', purpose: '', createdAt: now, updatedAt: now, skills: [
          { id: 'alpha-config', skillName: 'alpha', codexModel: null, codexEffort: null },
          { id: 'beta-config', skillName: 'beta', codexModel: 'gpt-5.5', codexEffort: 'low' },
        ] },
        { id: 'two', name: 'Two', purpose: '', createdAt: now, updatedAt: now, skills: [
          { id: 'gamma-config', skillName: 'gamma', codexModel: null, codexEffort: null },
        ] },
        { id: 'three', name: 'Three', purpose: '', createdAt: now, updatedAt: now, skills: [
          { id: 'delta-config', skillName: 'delta', codexModel: null, codexEffort: null },
          { id: 'epsilon-config', skillName: 'epsilon', codexModel: null, codexEffort: null },
        ] },
      ],
      runs: [],
      skillLibrary: [{ skillName: 'alpha', favorite: false, tags: [], defaultCodexModel: 'gpt-5.4', defaultCodexEffort: 'high', updatedAt: now }],
      activeWorkspaceRun: null,
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
      body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source-card', pipelineId: 'pipeline-five' }),
    });
    assert.equal(startResponse.status, 202);
    const started = await startResponse.json() as Record<string, any>;
    const pipelineRunId = started.run.id as string;
    assert.equal(started.run.steps.length, 3);
    assert.equal(started.run.steps.flatMap((step: Record<string, any>) => step.skills).length, 5);
    assert.equal(started.run.steps[0].skills[0].codexModel, 'gpt-5.4');
    assert.equal(started.run.steps[0].skills[0].codexEffort, 'high');
    assert.equal(started.run.steps[0].skills[1].codexModel, 'gpt-5.5');
    assert.equal(started.run.steps[0].skills[1].codexEffort, 'low');

    const queuedResponse = await fetch(`${baseUrl}/api/codex/pipelines/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source-card', pipelineId: 'pipeline-five' }),
    });
    assert.equal(queuedResponse.status, 202);
    const queuedBody = await queuedResponse.json() as Record<string, any>;
    assert.equal(queuedBody.run.status, 'pending');
    assert.equal(queuedBody.queuePosition, 1);
    const queuedPipelineRunId = queuedBody.run.id as string;
    const pendingLedger = JSON.parse(readFileSync(join(decisionOsRoot, 'specs.json'), 'utf8')) as Record<string, any>;
    const pendingSourceCard = pendingLedger.cards.find((card: Record<string, any>) => card.id === 'source-card');
    assert.equal(pendingSourceCard.executionStatus, undefined);
    assert.equal(pendingSourceCard.executionRunId, undefined);
    assert.equal(pendingSourceCard.codexQueuedPipelineRunId, queuedPipelineRunId);

    const completed = await waitFor(() => {
      const run = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.id === pipelineRunId);
      return run?.status === 'complete' ? run : null;
    }, 'pipeline completion');
    assert.equal(completed.steps.every((step) => step.status === 'complete'), true);
    await waitFor(() => {
      const run = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((entry) => entry.id === queuedPipelineRunId);
      return run?.status === 'complete' ? run : null;
    }, 'queued pipeline completion');
    assert.equal(readCodexPipelineStore({ decisionOsRoot }).store.activeWorkspaceRun, null);
    const allSkills = completed.steps.flatMap((step) => step.skills);
    assert.equal(new Set(allSkills.map((skill) => skill.runId)).size, 5);
    assert.equal(allSkills.every((skill) => existsSync(skill.stdoutFile) && existsSync(skill.stderrFile)), true);
    assert.deepEqual(readFileSync(lifecycleFile, 'utf8').trim().split('\n').slice(0, 10), [
      'start:alpha', 'end:alpha', 'start:beta', 'end:beta', 'start:gamma', 'end:gamma',
      'start:delta', 'end:delta', 'start:epsilon', 'end:epsilon',
    ]);
    const betaInput = `${join(decisionOsRoot, 'cards', 'specs', completed.steps[0].outputCardId + '.md')}.input`;
    const gammaInput = `${join(decisionOsRoot, 'cards', 'specs', completed.steps[1].outputCardId + '.md')}.input`;
    assert.match(readFileSync(betaInput, 'utf8'), /produced-by=alpha/);
    assert.match(readFileSync(gammaInput, 'utf8'), /produced-by=beta/);
    const ledger = JSON.parse(readFileSync(join(decisionOsRoot, 'specs.json'), 'utf8')) as Record<string, any>;
    const generated = ledger.cards.filter((card: Record<string, any>) => card.codexPipelineRunId === completed.id);
    assert.equal(generated.length, 3);
    const sourceCard = ledger.cards.find((card: Record<string, any>) => card.id === 'source-card');
    assert.equal(sourceCard.executionStatus, undefined);
    assert.equal(sourceCard.executionRunId, undefined);
    assert.equal(sourceCard.codexActiveRunId, undefined);
    assert.equal(sourceCard.codexQueuedPipelineRunId, undefined);
    assert.equal(sourceCard.codexQueuedRunId, undefined);
    assert.equal(generated.every((card: Record<string, any>) => card.w === 700), true);
    assert.deepEqual(ledger.relationships.slice(-3).map((relationship: Record<string, any>) => relationship.label), ['One', 'Two', 'Three']);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('direct temporary runs inherit skill defaults, preserve snapshots, and honor explicit overrides', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot } = createWorkspace('decision-os-direct-default-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  createSkill(workspace, 'alpha');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { writeFileSync } from "node:fs";',
    'let prompt = "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const output = (prompt.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    '  const args = process.argv.slice(2);',
    '  writeFileSync(output.trim(), "model=" + args[args.indexOf("--model") + 1] + "\\neffort=" + args[args.indexOf("-c") + 1] + "\\n");',
    '  console.log(JSON.stringify({ type: "turn.completed" }));',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  const now = '2026-07-10T00:00:00.000Z';
  writeCodexPipelineStore({
    decisionOsRoot,
    availableSkillNames: ['alpha'],
    store: {
      pipelines: [], steps: [], runs: [], activeWorkspaceRun: null,
      skillLibrary: [{ skillName: 'alpha', favorite: false, tags: [], defaultCodexModel: 'gpt-5.4', defaultCodexEffort: 'high', updatedAt: now }],
    },
  });
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const inheritedResponse = await fetch(`${baseUrl}/api/codex/skills/process`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'alpha' }),
    });
    assert.equal(inheritedResponse.status, 202);
    const inherited = await inheritedResponse.json() as Record<string, any>;
    assert.equal(inherited.run.codexModel, 'gpt-5.4');
    assert.equal(inherited.run.codexEffort, 'high');
    await waitFor(() => readCodexPipelineStore({ decisionOsRoot }).store.runs.find((run) => run.id === inherited.pipelineRun.id)?.status === 'complete' ? true : null, 'inherited direct run');
    const afterFirst = readCodexPipelineStore({ decisionOsRoot }).store;
    writeCodexPipelineStore({
      decisionOsRoot,
      availableSkillNames: ['alpha'],
      store: {
        ...afterFirst,
        skillLibrary: [{ skillName: 'alpha', favorite: false, tags: [], defaultCodexModel: 'gpt-5.5', defaultCodexEffort: 'low', updatedAt: new Date().toISOString() }],
      },
    });
    const stable = readCodexPipelineStore({ decisionOsRoot }).store.runs.find((run) => run.id === inherited.pipelineRun.id);
    assert.equal(stable?.steps[0].skills[0].codexModel, 'gpt-5.4');
    assert.equal(stable?.steps[0].skills[0].codexEffort, 'high');

    const explicitResponse = await fetch(`${baseUrl}/api/codex/skills/process`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'alpha', codexModel: 'gpt-5.6-sol', codexEffort: 'ultra' }),
    });
    assert.equal(explicitResponse.status, 202);
    const explicit = await explicitResponse.json() as Record<string, any>;
    assert.equal(explicit.run.codexModel, 'gpt-5.6-sol');
    assert.equal(explicit.run.codexEffort, 'ultra');
    await waitFor(() => readCodexPipelineStore({ decisionOsRoot }).store.runs.find((run) => run.id === explicit.pipelineRun.id)?.status === 'complete' ? true : null, 'explicit direct run');
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('workspace capacity runs two pipelines concurrently and promotes the FIFO queue', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const { workspace, decisionOsRoot } = createWorkspace('decision-os-capacity-');
  const fakeCodex = join(workspace, 'fake-codex.mjs');
  const lifecycleFile = join(workspace, 'lifecycle.txt');
  createSkill(workspace, 'alpha');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node',
    'import { appendFileSync, writeFileSync } from "node:fs";',
    'let prompt = "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });',
    'process.stdin.on("end", () => {',
    '  const output = (prompt.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    `  appendFileSync(${JSON.stringify(lifecycleFile)}, "start" + String.fromCharCode(10));`,
    '  writeFileSync(output.trim(), "# result\\n");',
    '  setTimeout(() => {',
    '    console.log(JSON.stringify({ type: "turn.completed" }));',
    `    appendFileSync(${JSON.stringify(lifecycleFile)}, "end" + String.fromCharCode(10));`,
    '  }, 500);',
    '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    decisionOsSettings: { maxConcurrentCodexProcesses: 2 },
  };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const starts: Record<string, any>[] = [];
    for (let index = 0; index < 3; index += 1) {
      const response = await fetch(`${baseUrl}/api/codex/skills/process`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'alpha' }),
      });
      assert.equal(response.status, 202);
      starts.push(await response.json() as Record<string, any>);
    }
    assert.deepEqual(starts.map((entry) => entry.pipelineRun.status), ['running', 'running', 'pending']);
    assert.deepEqual(starts.map((entry) => entry.queuePosition), [null, null, 1]);
    let lastStatuses: string[] = [];
    try {
      await waitFor(() => {
        const runs = readCodexPipelineStore({ decisionOsRoot }).store.runs;
        lastStatuses = runs.map((run) => run.status);
        return runs.length === 3 && runs.every((run) => run.status === 'complete') ? runs : null;
      }, 'capacity queue completion');
    } catch {
      assert.fail(`Capacity queue did not settle: ${lastStatuses.join(',')}`);
    }
    const lifecycle = readFileSync(lifecycleFile, 'utf8').trim().split('\n');
    assert.deepEqual(lifecycle.slice(0, 2), ['start', 'start']);
    assert.equal(lifecycle.filter((line) => line === 'start').length, 3);
    assert.equal(lifecycle.filter((line) => line === 'end').length, 3);
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('one catalog-level server skill executes directly and in saved pipelines from two managed projects', async () => {
  const previousCodexBin = process.env.CODEX_BIN;
  const masterRoot = mkdtempSync(join(tmpdir(), 'decision-os-shared-server-skill-'));
  const masterDecisionOsRoot = join(masterRoot, '.decision-os');
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  writeFileSync(join(masterDecisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  const projects = [join(masterRoot, 'repos', 'one'), join(masterRoot, 'repos', 'two')];
  for (const [projectIndex, workspace] of projects.entries()) {
    const decisionOsRoot = join(workspace, '.decision-os');
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }] }));
    writeFileSync(join(decisionOsRoot, 'specs.json'), JSON.stringify({
      cards: [{ id: 'source-card', title: 'Source', x: 0, y: 0, w: 300, h: 180, comment: { what: 'Input' } }],
      annotations: [], relationships: [], notes: {},
    }));
    const now = '2026-07-13T00:00:00.000Z';
    if (projectIndex === 0) writeCodexPipelineStore({
      decisionOsRoot, availableSkillNames: ['shared-catalog-skill'],
      store: {
        pipelines: [{ id: 'shared-pipeline', name: 'Shared pipeline', purpose: '', stepIds: ['shared-step'], createdAt: now, updatedAt: now }],
        steps: [{ id: 'shared-step', name: 'Shared step', purpose: '', createdAt: now, updatedAt: now, skills: [{ id: 'shared-config', skillName: 'shared-catalog-skill', codexModel: null, codexEffort: null }] }],
        runs: [], skillLibrary: [], activeWorkspaceRun: null,
      },
    });
  }
  const skillDirectory = join(masterRoot, '.skills', 'shared-catalog-skill');
  mkdirSync(skillDirectory, { recursive: true });
  writeFileSync(join(skillDirectory, 'SKILL.md'), '---\nname: shared-catalog-skill\ndescription: Shared catalog workflow\n---\n\n# Server-only instruction\n');
  const fakeCodex = join(masterRoot, 'fake-codex.mjs');
  writeFileSync(fakeCodex, [
    '#!/usr/bin/env node', 'import { writeFileSync } from "node:fs";', 'let prompt = "";',
    'process.stdin.on("data", (chunk) => { prompt += chunk; });', 'process.stdin.on("end", () => {',
    ' const output = (prompt.match(/Write the final result to this Markdown file: (.+)/) || [])[1] || "";',
    ' writeFileSync(output.trim(), "# shared result\\n");', ' writeFileSync(output.trim() + ".input", prompt);',
    ' console.log(JSON.stringify({ type: "turn.completed" }));', '});',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  process.env.CODEX_BIN = fakeCodex;
  const runtime: Record<string, unknown> = { decisionOsRoot: masterDecisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const catalog = discoverDecisionOsProjects({ masterRoot, masterDecisionOsRoot }).filter((project) => projects.includes(project.root));
  try {
    assert.equal(catalog.length, 2);
    assert.equal(readCodexPipelineStore({ decisionOsRoot: masterDecisionOsRoot }).store.pipelines[0].id, 'shared-pipeline');
    assert.equal(catalog.every((project) => readCodexPipelineStore({ decisionOsRoot: project.decisionOsRoot }).store.pipelines.length === 0), true);
    for (const project of catalog) {
      const scoped = `${baseUrl}/p/${encodeURIComponent(project.id)}`;
      const libraryResponse = await fetch(`${scoped}/api/codex/skills`);
      const library = await libraryResponse.json() as Record<string, any>;
      assert.equal(library.skills.some((skill: Record<string, unknown>) => skill.name === 'shared-catalog-skill'), true);
      const pipelineLibrary = await fetch(`${scoped}/api/codex/pipelines`).then((response) => response.json()) as Record<string, any>;
      assert.deepEqual(pipelineLibrary.pipelines.map((pipeline: Record<string, unknown>) => [pipeline.id, pipeline.scope]), [['shared-pipeline', 'server']]);
      const directResponse = await fetch(`${scoped}/api/codex/skills/process`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'shared-catalog-skill' }),
      });
      assert.equal(directResponse.status, 202);
      const direct = await directResponse.json() as Record<string, any>;
      await waitFor(() => readCodexPipelineStore({ decisionOsRoot: project.decisionOsRoot }).store.runs.find((run) => run.id === direct.pipelineRun.id)?.status === 'complete' ? true : null, 'shared direct run');
      const directInput = join(project.decisionOsRoot, 'cards', 'specs', `${direct.run.outputCardId}.md.input`);
      assert.match(readFileSync(directInput, 'utf8'), /# Server-only instruction/);
      const pipelineResponse = await fetch(`${scoped}/api/codex/pipelines/runs`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ledgerId: 'specs', sourceCardId: 'source-card', pipelineId: 'shared-pipeline' }),
      });
      assert.equal(pipelineResponse.status, 202);
      const pipeline = await pipelineResponse.json() as Record<string, any>;
      const completed = await waitFor(() => {
        const run = readCodexPipelineStore({ decisionOsRoot: project.decisionOsRoot }).store.runs.find((entry) => entry.id === pipeline.run.id);
        return run?.status === 'complete' ? run : null;
      }, 'shared saved pipeline');
      const pipelineInput = join(project.decisionOsRoot, 'cards', 'specs', `${completed.steps[0].outputCardId}.md.input`);
      assert.match(readFileSync(pipelineInput, 'utf8'), /Decision OS server skill package:/);
    }
  } finally {
    await closeServer(server);
    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousCodexBin;
    rmSync(masterRoot, { recursive: true, force: true });
  }
});

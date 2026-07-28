import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

test('pipeline library routes expose empty, create, invalid-reference, conflict, and update states', async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-routes-'));
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-routes-home-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const skillDirectory = join(workspace, '.skills', 'analysis');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(skillDirectory, { recursive: true });
  writeFileSync(join(skillDirectory, 'SKILL.md'), [
    '---',
    'name: analysis',
    'description: Analyze a codebase',
    '---',
    '',
    '# Instructions',
    '',
    'Analyze the source.',
    '',
  ].join('\n'));
  process.env.CODEX_HOME = codexHome;
  const runtime: Record<string, any> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const emptyResponse = await fetch(`${baseUrl}/api/codex/pipelines`);
    const empty = await emptyResponse.json() as Record<string, any>;
    const diagnostics = emptyResponse.status === 200 ? null : await fetch(`${baseUrl}/api/diagnostics/incidents`).then((response) => response.json());
    assert.equal(emptyResponse.status, 200, JSON.stringify({ empty, diagnostics }));
    assert.equal(empty.ok, true);
    assert.equal(empty.empty, false);
    assert.equal(empty.pipelines.some((pipeline: Record<string, unknown>) => pipeline.id === 'project-synchronization' && pipeline.scope === 'server'), true);
    assert.equal(empty.steps.length > 0, true);

    const saveBody = {
      pipeline: {
        id: 'pipeline-a',
        name: 'Pipeline A',
        purpose: 'Route proof',
        stepIds: ['step-a', 'missing-step'],
      },
      steps: [{
        id: 'step-a',
        name: 'Analyze',
        purpose: '',
        skills: [
          { id: 'skill-a', skillName: 'analysis', contentKind: 'federated-skill', codexModel: null, codexEffort: null },
          { id: 'skill-missing', skillName: 'deleted-skill', contentKind: 'federated-skill', codexModel: 'gpt-5.5', codexEffort: 'xhigh' },
        ],
      }],
    };
    const createResponse = await fetch(`${baseUrl}/api/codex/pipelines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(saveBody),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as Record<string, any>;
    assert.equal(created.ok, true);
    assert.equal(created.pipeline.id, 'pipeline-a');
    assert.equal(created.hasInvalidReferences, true);
    assert.deepEqual(created.invalidReferences.map((entry: Record<string, string>) => entry.kind), ['skill', 'step']);

    const conflictResponse = await fetch(`${baseUrl}/api/codex/pipelines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(saveBody),
    });
    assert.equal(conflictResponse.status, 409);

    const updateResponse = await fetch(`${baseUrl}/api/codex/pipelines/pipeline-a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pipeline: { ...saveBody.pipeline, name: 'Pipeline A updated', stepIds: ['step-a'] },
        steps: saveBody.steps.slice(0, 1).map((step) => ({ ...step, skills: step.skills.slice(0, 1) })),
      }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json() as Record<string, any>;
    assert.equal(updated.pipeline.name, 'Pipeline A updated');
    assert.equal(updated.hasInvalidReferences, false);

    const mismatchResponse = await fetch(`${baseUrl}/api/codex/pipelines/not-pipeline-a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pipeline: saveBody.pipeline, steps: [] }),
    });
    assert.equal(mismatchResponse.status, 400);

    const invalidResponse = await fetch(`${baseUrl}/api/codex/pipelines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pipeline: { id: 'invalid', name: 'Invalid', stepIds: ['step-invalid'] },
        steps: [{
          id: 'step-invalid',
          name: 'Invalid',
          skills: [{ id: 'skill-invalid', skillName: 'analysis', codexModel: 'unsupported', codexEffort: null }],
        }],
      }),
    });
    assert.equal(invalidResponse.status, 400);

    const persisted = JSON.parse(readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    const persistedPipeline = persisted.pipelines.find((pipeline: Record<string, unknown>) => pipeline.id === 'pipeline-a');
    assert.equal(persistedPipeline.name, 'Pipeline A updated');
    assert.deepEqual(persistedPipeline.stepIds, ['step-a']);

    const skillsResponse = await fetch(`${baseUrl}/api/codex/skills`);
    assert.equal(skillsResponse.status, 200);
    const skillsText = await skillsResponse.text();
    const skills = JSON.parse(skillsText) as Record<string, any>;
    const analysis = skills.skills.find((skill: Record<string, any>) => skill.name === 'analysis');
    assert.equal(analysis.source, 'server');
    assert.equal(analysis.editable, true);
    assert.equal(analysis.defaultCodexModel, null);
    assert.equal(typeof analysis.effectiveCodexModel, 'string');
    assert.equal('skillFile' in analysis, false);
    assert.equal(skillsText.includes(workspace), false);
  } finally {
    await closeServer(server);
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  }
});

test('server pipeline routes persist explicit server provenance', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-server-pipeline-routes-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  const runtime: Record<string, any> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const response = await fetch(`${baseUrl}/api/codex/server-pipelines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pipeline: { id: 'server-pipeline', name: 'Server pipeline', purpose: '', stepIds: ['server-step'] },
        steps: [{ id: 'server-step', name: 'Server step', purpose: '', skills: [] }],
      }),
    });
    assert.equal(response.status, 201, await response.clone().text());
    const created = await response.json() as Record<string, any>;
    assert.equal(created.pipeline.scope, 'server');
    const listed = await fetch(`${baseUrl}/api/codex/server-pipelines`).then((result) => result.json()) as Record<string, any>;
    assert.deepEqual(
      listed.pipelines.filter((pipeline: Record<string, any>) => pipeline.id === 'server-pipeline').map((pipeline: Record<string, any>) => [pipeline.id, pipeline.scope]),
      [['server-pipeline', 'server']],
    );
    assert.equal(JSON.parse(readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8')).pipelines.some((pipeline: Record<string, unknown>) => pipeline.id === 'server-pipeline'), true);
  } finally {
    await closeServer(server);
    rmSync(workspace, { recursive: true, force: true });
  }
});

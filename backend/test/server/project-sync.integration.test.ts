import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHttpServer } from '../../src/business/server/application/create-decision-os-server.js';
import { installPipelinePromptFixture } from '../support/pipeline-prompt-fixture.js';

function git(root: string, ...args: string[]): void {
  execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
}

async function waitFor<T>(read: () => Promise<T | null>, timeoutMs = 5_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for project synchronization state.');
}

test('exposes origin identity and fixed repository status while protecting federation role execution', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-route-'));
  const remote = join(home, 'origin.git');
  const project = join(home, 'project-a');
  execFileSync('git', ['init', '--bare', remote]);
  execFileSync('git', ['clone', remote, project]);
  git(project, 'config', 'user.name', 'Decision OS Test');
  git(project, 'config', 'user.email', 'test@decision-os.invalid');
  mkdirSync(join(project, '.decision-os'));
  writeFileSync(join(project, '.decision-os', 'state.json'), '{"ledgers":[{"id":"specs","title":"Specs","ledgerFile":".decision-os/specs.json"}]}\n');
  writeFileSync(join(project, '.decision-os', 'specs.json'), '{"cards":[],"annotations":[],"relationships":[]}\n');
  writeFileSync(join(project, '.gitignore'), [
    '.decision-os-codex-execution-rollback/',
    '.decision-os/codex-executions.json',
    '.decision-os/codex-pipeline-runs/',
    '.decision-os/runs/',
    '.decision-os/task-state/',
    '',
  ].join('\n'));
  for (const skillName of ['project-sync-source-publisher', 'project-sync-initiator-reconciler', 'project-sync-source-finalizer']) {
    const skillRoot = join(home, '.skills', skillName);
    mkdirSync(skillRoot, { recursive: true });
    writeFileSync(join(skillRoot, 'SKILL.md'), `---\nname: ${skillName}\ndescription: test\n---\n\nReturn JSON evidence.\n`);
  }
  installPipelinePromptFixture({
    workspace: home,
    decisionOsRoot: join(home, '.decision-os'),
  });
  const fakeCodex = join(home, 'fake-codex');
  writeFileSync(fakeCodex, [
    '#!/bin/sh',
    'cat >/dev/null',
    'git add -A',
    'if ! git diff --cached --quiet; then git commit -m "synchronize decision os state" >/dev/null && git push >/dev/null; fi',
    'sha=$(git rev-parse HEAD)',
    'printf \'{"status":"complete","headSha":"%s","originSha":"%s","requiredSha":"%s"}\\n\' "$sha" "$sha" "$sha"',
    '',
  ].join('\n'));
  chmodSync(fakeCodex, 0o755);
  writeFileSync(join(project, '.decision-os', '.settings.json'), `${JSON.stringify({ codexBin: fakeCodex })}\n`);
  git(project, 'add', '.gitignore', '.decision-os/state.json', '.decision-os/specs.json', '.decision-os/.settings.json');
  git(project, 'commit', '-m', 'initialize project');
  git(project, 'push', '-u', 'origin', 'HEAD');
  const runtime: Record<string, unknown> = { decisionOsSettings: { codexBin: fakeCodex } };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: resolve(process.cwd(), 'frontend') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const catalog = await fetch(`${base}/decision-os/projects`).then((response) => response.json()) as { projects: Array<{ id: string; color: string; originFingerprint: string }> };
    assert.equal(catalog.projects.length, 1);
    assert.match(catalog.projects[0].originFingerprint, /^[0-9a-f]{64}$/);
    const statusResponse = await fetch(`${base}/api/project-sync/repository-status?projectId=${encodeURIComponent(catalog.projects[0].id)}`);
    const status = await statusResponse.json() as { snapshot: { headSha: string; originSha: string; porcelain: string; worktrees: unknown[] } };
    assert.equal(statusResponse.status, 200);
    assert.equal(status.snapshot.headSha, status.snapshot.originSha);
    assert.match(status.snapshot.porcelain, /\.decision-os\/project\.json/);
    assert.equal(status.snapshot.worktrees.length, 1);
    const unauthorized = await fetch(`${base}/api/project-sync/role`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(unauthorized.status, 409);
    assert.match(JSON.stringify(await unauthorized.json()), /authentication failed/);
    const runs = await fetch(`${base}/api/project-sync`).then((response) => response.json()) as { runs: unknown[] };
    assert.deepEqual(runs.runs, []);
    const request = () => fetch(`${base}/api/project-sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'sync-request-1' },
      body: JSON.stringify({ sourceProjectId: catalog.projects[0].id, idempotencyKey: 'sync-request-1' }),
    });
    const [firstResponse, secondResponse] = await Promise.all([request(), request()]);
    const [first, second] = await Promise.all([firstResponse.json(), secondResponse.json()]) as Array<Record<string, any>>;
    const admissionResponse = first.duplicate ? secondResponse : firstResponse;
    const admission = first.duplicate ? second : first;
    const duplicate = first.duplicate ? first : second;
    assert.equal(admissionResponse.status, 202);
    assert.equal(admission.duplicate, false);
    assert.equal(admission.run.phase, 'requested');
    assert.equal(admission.masterCardId, '');
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.run.syncId, admission.run.syncId);
    const attached = await waitFor(async () => {
      const body = await fetch(`${base}/api/project-sync/${encodeURIComponent(admission.run.syncId)}`).then((response) => response.json()) as Record<string, any>;
      if (body.run?.phase === 'failed') throw new Error(`Project synchronization failed during admission: ${JSON.stringify(body.run.error ?? {})}`);
      return body.run?.masterCardId && body.run?.pipelineRunId ? body.run : null;
    });
    assert.equal(attached.ledgerId, 'tasks');
    assert.match(attached.masterCardId, /^card-project-sync-/);
    assert.match(attached.pipelineRunId, /^codex-pipeline-/);
    const ledgerResponse = await fetch(`${base}/p/${encodeURIComponent(catalog.projects[0].id)}/decision-os/tasks`);
    assert.equal(ledgerResponse.status, 200);
    const ledger = await ledgerResponse.json() as Record<string, any>;
    const master = ledger.cards.find((card: Record<string, unknown>) => card.id === attached.masterCardId);
    assert.deepEqual(master.labels, ['master-task', 'synchronization']);
    const synchronizationZone = ledger.annotations.find((annotation: Record<string, unknown>) => annotation.id === `zone-project-sync-${attached.syncId}`);
    assert.ok(synchronizationZone, `missing synchronization zone: ${JSON.stringify(ledger.annotations)}`);
    assert.equal(synchronizationZone.color, catalog.projects[0].color);
    assert.equal(ledger.relationships.length, 3);
    assert.ok(ledger.relationships.every((relationship: Record<string, unknown>) => relationship.from === attached.masterCardId && relationship.label === 'subtask'));
    assert.deepEqual(ledger.relationships.map((relationship: Record<string, unknown>) => relationship.position), [0, 1, 2]);
    assert.ok(ledger.cards.filter((card: Record<string, unknown>) => card.id !== attached.masterCardId).every((card: Record<string, any>) => !card.labels.includes('subtask')));
    const pipelineStore = JSON.parse(readFileSync(join(project, '.decision-os', 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    assert.equal(pipelineStore.runs.length, 1);
    assert.equal(pipelineStore.runs[0].sourceCardId, attached.masterCardId);
    const completed = await waitFor(async () => {
      const body = await fetch(`${base}/api/project-sync/${encodeURIComponent(admission.run.syncId)}`).then((response) => response.json()) as Record<string, any>;
      if (body.run?.phase === 'failed') throw new Error(`Project synchronization failed during execution: ${JSON.stringify(body.run.error ?? {})}`);
      return body.run?.phase === 'complete' ? body.run : null;
    }, 15_000);
    assert.equal(completed.pipelineRunId, attached.pipelineRunId);
    const pipelineDetail = await fetch(
      `${base}/p/${encodeURIComponent(catalog.projects[0].id)}/api/codex/pipelines/runs/${encodeURIComponent(attached.pipelineRunId)}`,
    ).then((response) => response.json()) as Record<string, any>;
    assert.equal(pipelineDetail.run.status, 'complete');
    assert.deepEqual(
      pipelineDetail.run.steps.map((step: Record<string, any>) => step.skills[0].status),
      ['complete', 'complete', 'complete'],
    );
    const immutablePipelineStore = JSON.parse(readFileSync(join(project, '.decision-os', 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    assert.equal(immutablePipelineStore.runs[0].status, 'pending');
    assert.deepEqual(
      immutablePipelineStore.runs[0].steps.map((step: Record<string, any>) => step.skills[0].executor.nodeId),
      ['local', 'local', 'local'],
    );
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});

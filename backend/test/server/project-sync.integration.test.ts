import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHttpServer } from '../../src/business/server/helper/create-http-server.js';

function git(root: string, ...args: string[]): void {
  execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
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
  for (const skillName of ['project-sync-source-publisher', 'project-sync-initiator-reconciler', 'project-sync-source-finalizer']) {
    const skillRoot = join(home, '.skills', skillName);
    mkdirSync(skillRoot, { recursive: true });
    writeFileSync(join(skillRoot, 'SKILL.md'), `---\nname: ${skillName}\ndescription: test\n---\n\nReturn JSON evidence.\n`);
  }
  const fakeCodex = join(home, 'fake-codex');
  writeFileSync(fakeCodex, '#!/bin/sh\nsha=$(git rev-parse HEAD)\nprintf \'{"status":"complete","headSha":"%s","originSha":"%s"}\\n\' "$sha" "$sha"\n');
  chmodSync(fakeCodex, 0o755);
  git(project, 'add', '.decision-os/state.json', '.decision-os/specs.json');
  git(project, 'commit', '-m', 'initialize project');
  git(project, 'push', '-u', 'origin', 'HEAD');
  const runtime: Record<string, unknown> = { decisionOsSettings: { codexBin: fakeCodex } };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: resolve(process.cwd(), 'frontend') }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const catalog = await fetch(`${base}/decision-os/projects`).then((response) => response.json()) as { projects: Array<{ id: string; originFingerprint: string }> };
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
    const admissionResponse = await fetch(`${base}/api/project-sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'sync-request-1' },
      body: JSON.stringify({ sourceProjectId: catalog.projects[0].id, idempotencyKey: 'sync-request-1' }),
    });
    const admission = await admissionResponse.json() as Record<string, any>;
    assert.equal(admissionResponse.status, 202);
    assert.equal(admission.duplicate, false);
    assert.equal(admission.ledgerId, 'specs');
    assert.match(admission.masterCardId, /^card-project-sync-/);
    assert.match(admission.pipelineRunId, /^codex-pipeline-/);
    const duplicate = await fetch(`${base}/api/project-sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'sync-request-1' },
      body: JSON.stringify({ sourceProjectId: catalog.projects[0].id, idempotencyKey: 'sync-request-1' }),
    }).then((response) => response.json()) as Record<string, any>;
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.masterCardId, admission.masterCardId);
    assert.equal(duplicate.pipelineRunId, admission.pipelineRunId);
    const ledger = JSON.parse(readFileSync(join(project, '.decision-os', 'specs.json'), 'utf8')) as Record<string, any>;
    const master = ledger.cards.find((card: Record<string, unknown>) => card.id === admission.masterCardId);
    assert.deepEqual(master.labels, ['master-task', 'synchronization']);
    assert.equal(ledger.relationships.length, 3);
    assert.ok(ledger.relationships.every((relationship: Record<string, unknown>) => relationship.from === admission.masterCardId && relationship.label === 'subtask'));
    assert.ok(ledger.cards.filter((card: Record<string, unknown>) => card.id !== admission.masterCardId).every((card: Record<string, any>) => card.labels.includes('subtask')));
    const pipelineStore = JSON.parse(readFileSync(join(project, '.decision-os', 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    assert.equal(pipelineStore.runs.length, 1);
    assert.equal(pipelineStore.runs[0].sourceCardId, admission.masterCardId);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});

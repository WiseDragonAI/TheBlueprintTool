import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  writeFileSync(join(project, '.decision-os', 'state.json'), '{"ledgers":[]}\n');
  git(project, 'add', '.decision-os/state.json');
  git(project, 'commit', '-m', 'initialize project');
  git(project, 'push', '-u', 'origin', 'HEAD');
  const runtime: Record<string, unknown> = { decisionOsSettings: {} };
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
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});

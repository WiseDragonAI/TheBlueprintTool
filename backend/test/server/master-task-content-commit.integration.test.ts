import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';

function git(workspace: string, args: string[]): string {
  return execFileSync('git', ['-C', workspace, ...args], { encoding: 'utf8' }).trim();
}

test('master-task content commit discovers the canonical graph and preserves unrelated staged bytes', async (context) => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-graph-commit-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const cardsRoot = join(decisionOsRoot, 'cards', 'tasks');
  mkdirSync(cardsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ tabs: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], threadFiles: {} }));
  git(workspace, ['init', '-q']);
  git(workspace, ['add', '.decision-os']);
  execFileSync('git', ['-C', workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Initialize task workspace']);

  process.chdir(workspace);
  const runtime: Record<string, unknown> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  context.after(async () => {
    server.close();
    await once(server, 'close');
    process.chdir(originalCwd);
    rmSync(workspace, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const catalog = await fetch(`${baseUrl}/api/control-room?localOnly=1`).then((response) => response.json()) as { projects: Array<{ id: string }> };
  const projectId = catalog.projects[0].id;
  const creationResponse = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'create-master-task',
      assignedNodeId: 'workstation',
      annotation: { id: 'zone-master', x: 0, y: 0, width: 1200, height: 900, color: '#123456', label: 'Master', comments: [] },
      card: { id: 'card-master', title: 'Master', labels: ['master-task'], status: 'todo', comment: { what: 'Initial master.\n', contentFile: '.decision-os/cards/tasks/card-master.md' } },
      cards: [{ id: 'card-subtask', title: 'Subtask', labels: ['subtask'], status: 'todo', comment: { what: 'Initial subtask.\n', contentFile: '.decision-os/cards/tasks/card-subtask.md' } }],
      relationships: [{ id: 'rel-subtask', from: 'card-master', to: 'card-subtask', label: 'subtask', position: 0 }],
    }),
  });
  assert.equal(creationResponse.status, 200, await creationResponse.clone().text());
  git(decisionOsRoot, ['add', 'cards/tasks/card-master.md', 'cards/tasks/card-subtask.md']);
  execFileSync('git', ['-C', decisionOsRoot, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Add initial task graph']);
  writeFileSync(join(decisionOsRoot, 'operator.md'), 'protected staged bytes\n');
  git(decisionOsRoot, ['add', 'operator.md']);
  const stagedBefore = git(decisionOsRoot, ['diff', '--cached', '--binary']);
  writeFileSync(join(cardsRoot, 'card-master.md'), 'Edited master.\n');
  writeFileSync(join(cardsRoot, 'card-subtask.md'), 'Edited subtask.\n');

  const response = await fetch(`${baseUrl}/p/${projectId}/api/task-content/master-task-commit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ masterCardId: 'card-master', ledgerId: 'tasks' }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const receipt = await response.json() as { commit: string; files: string[] };
  assert.match(receipt.commit, /^[a-f0-9]{40,64}$/);
  assert.deepEqual(receipt.files, ['cards/tasks/card-master.md', 'cards/tasks/card-subtask.md']);
  assert.deepEqual(
    git(decisionOsRoot, ['show', '--format=', '--name-only', receipt.commit]).split('\n').filter(Boolean).sort(),
    ['cards/tasks/card-master.md', 'cards/tasks/card-subtask.md'],
  );
  assert.equal(readFileSync(join(cardsRoot, 'card-master.md'), 'utf8'), 'Edited master.\n');
  assert.equal(git(decisionOsRoot, ['diff', '--cached', '--binary']), stagedBefore);
});

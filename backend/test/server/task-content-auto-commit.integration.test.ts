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

test('canary task creation and thread append each produce a focused authored commit', async (context) => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-task-auto-commit-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, '.settings.json'), JSON.stringify({ taskContentAutoCommit: true }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ tabs: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], threadFiles: {} }));
  git(workspace, ['init', '-q']);
  git(workspace, ['add', '.decision-os/state.json', '.decision-os/tasks.json']);
  execFileSync('git', ['-C', workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Initialize test workspace']);

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
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const catalog = await fetch(`${baseUrl}/api/control-room?localOnly=1`).then((response) => response.json()) as { projects: Array<{ id: string }> };
  const projectId = catalog.projects[0].id;
  const cardId = 'card-auto-commit';
  const threadId = `thread-${cardId}`;

  const creationResponse = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'create-task-intake',
      assignedNodeId: 'workstation',
      annotation: { id: 'zone-auto-commit', x: 0, y: 0, width: 1200, height: 900, color: '#123456', label: 'Auto commit', comments: [] },
      card: {
        id: cardId,
        title: 'Auto commit',
        cardType: 'note',
        domainId: 'tasks',
        status: 'todo',
        labels: ['master-task'],
        x: 60,
        y: 60,
        w: 360,
        h: 240,
        comment: { what: '## A. Intake\n\nCommit this task.\n' },
        facts: [],
        fields: [],
      },
    }),
  });
  assert.equal(creationResponse.status, 200, await creationResponse.clone().text());
  const creation = await creationResponse.json() as { gitRevision?: { commit: string; subject: string } };
  assert.match(creation.gitRevision?.commit ?? '', /^[a-f0-9]{40,64}$/);
  assert.equal(creation.gitRevision?.subject, `Create Decision OS task ${cardId}`);
  assert.equal(git(workspace, ['status', '--short', '--', `.decision-os/cards/tasks/${cardId}.md`, `.decision-os/threads/tasks/${threadId}.md`]), '');
  assert.deepEqual(
    git(workspace, ['show', '--format=', '--name-only', creation.gitRevision!.commit]).split('\n').filter(Boolean).sort(),
    [`.decision-os/cards/tasks/${cardId}.md`, `.decision-os/threads/tasks/${threadId}.md`],
  );
  assert.equal(git(workspace, ['ls-files', '.decision-os/task-state/**']), '');

  const noteResponse = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'append-note', note: { id: 'note-auto-commit', threadId, role: 'operator', body: 'Persist this message.' } }),
  });
  assert.equal(noteResponse.status, 200, await noteResponse.clone().text());
  const note = await noteResponse.json() as { gitRevision?: { commit: string; subject: string } };
  assert.match(note.gitRevision?.commit ?? '', /^[a-f0-9]{40,64}$/);
  assert.notEqual(note.gitRevision?.commit, creation.gitRevision?.commit);
  assert.equal(note.gitRevision?.subject, `Record thread message ${threadId}`);
  assert.equal(git(workspace, ['status', '--short', '--', `.decision-os/cards/tasks/${cardId}.md`, `.decision-os/threads/tasks/${threadId}.md`]), '');
  assert.deepEqual(
    git(workspace, ['show', '--format=', '--name-only', note.gitRevision!.commit]).split('\n').filter(Boolean),
    [`.decision-os/threads/tasks/${threadId}.md`],
  );
  assert.match(readFileSync(join(decisionOsRoot, 'threads', 'tasks', `${threadId}.md`), 'utf8'), /Persist this message\./);
  assert.deepEqual(
    git(workspace, ['log', '-2', '--format=%s']).split('\n'),
    [`Record thread message ${threadId}`, `Create Decision OS task ${cardId}`],
  );
});

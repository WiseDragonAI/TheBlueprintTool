import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('master-task creation persists the complete graph and returns absolute Markdown paths', async (context) => {
  const originalCwd = process.cwd();
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-master-task-create-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ tabs: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], threadFiles: {} }));
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
  const master = { id: 'card-master', title: 'Context metrics', cardType: 'note', domainId: 'tasks', status: 'todo', labels: ['master-task'], x: 60, y: 60, w: 360, h: 240, comment: { what: 'Ledger: Tasks\nWaiting since: now\n', contentFile: '.decision-os/cards/tasks/card-master.md' }, facts: [], fields: [] };
  const subtask = { id: 'card-subtask', title: 'Collect metrics', cardType: 'note', domainId: 'tasks', status: 'todo', labels: ['subtask'], x: 450, y: 60, w: 310, h: 180, comment: { what: '', contentFile: '.decision-os/cards/tasks/card-subtask.md' }, facts: [], fields: [] };
  const response = await fetch(`${baseUrl}/p/${projectId}/decision-os/tasks`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      action: 'create-master-task',
      annotation: { id: 'zone-master', x: 0, y: 0, width: 1200, height: 900, color: '#123456', label: 'Context metrics', comments: [] },
      card: master,
      cards: [subtask],
      relationships: [{ id: 'rel-subtask', from: 'card-master', to: 'card-subtask', label: 'subtask' }],
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { createdFiles: Array<{ kind: string; cardId: string; path: string }> };
  assert.deepEqual(body.createdFiles.map((entry) => [entry.kind, entry.cardId]), [['master-task', 'card-master'], ['subtask', 'card-subtask']]);
  assert.ok(body.createdFiles.every((entry) => entry.path.startsWith(workspace)));
  assert.ok(body.createdFiles.every((entry) => existsSync(entry.path)));
  assert.match(readFileSync(body.createdFiles[0].path, 'utf8'), /Ledger: Tasks/);
  const lifecycleResponse = await fetch(`${baseUrl}/api/task-state/transition-card-lifecycle`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, cardId: 'card-master', lifecycleStatus: 'done' }),
  });
  assert.equal(lifecycleResponse.status, 200);
  assert.deepEqual(await lifecycleResponse.json(), { ok: true, cardId: 'card-master', lifecycleStatus: 'done', changedBatchCount: 1 });
  const aggregateResponse = await fetch(`${baseUrl}/api/task-state/commit`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, ledger: { cards: [] } }),
  });
  assert.equal(aggregateResponse.status, 410);
  assert.deepEqual(await aggregateResponse.json(), { ok: false, error: 'aggregate_task_state_commit_removed' });
  const projection = await fetch(`${baseUrl}/api/task-state/projection?projectId=${encodeURIComponent(projectId)}`).then((result) => result.json()) as { ledger: { cards: Array<{ id: string; status: string }>; relationships: Array<{ id: string }>; annotations: Array<{ id: string }> } };
  assert.deepEqual(projection.ledger.cards.map((card) => card.id).sort(), ['card-master', 'card-subtask']);
  assert.equal(projection.ledger.cards.find((card) => card.id === 'card-master')?.status, 'done');
  assert.deepEqual(projection.ledger.relationships.map((relationship) => relationship.id), ['rel-subtask']);
  assert.deepEqual(projection.ledger.annotations.map((annotation) => annotation.id), ['zone-master']);
});

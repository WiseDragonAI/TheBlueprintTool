import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { createHttpServer } from '../../src/business/server/helper/create-http-server.js';
import { migrateTaskCurrentState } from '../../src/business/task-state/helper/task-current-state-migration.js';
import { createTaskCurrentStateStore } from '../../src/business/task-state/helper/task-current-state-store.js';

test('hosted project card read demands a phone-owned migrated object by exact hash', async (context) => {
  const catalogRoot = mkdtempSync(join(tmpdir(), 'decision-os-hosted-content-catalog-'));
  const phoneRoot = mkdtempSync(join(tmpdir(), 'decision-os-hosted-content-phone-'));
  const workstationProject = join(catalogRoot, 'shared');
  const workstationDos = join(workstationProject, '.decision-os');
  const phoneDos = join(phoneRoot, '.decision-os');
  const projectId = 'shared-project';
  const phoneRef = '.decision-os/cards/tasks/phone-only.md';
  const phoneBody = Buffer.from('Phone-owned migrated body.\n');
  mkdirSync(workstationDos, { recursive: true });
  mkdirSync(join(phoneDos, 'cards', 'tasks'), { recursive: true });
  for (const decisionOsRoot of [workstationDos, phoneDos]) {
    writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  }
  writeFileSync(join(workstationDos, 'tasks.json'), JSON.stringify({ cards: [{ id: 'workstation-only', title: 'Workstation only' }], annotations: [], relationships: [] }));
  writeFileSync(join(phoneDos, 'tasks.json'), JSON.stringify({ cards: [{ id: 'phone-only', title: 'Phone only', comment: { contentFile: phoneRef } }], annotations: [], relationships: [] }));
  writeFileSync(join(phoneDos, 'cards', 'tasks', 'phone-only.md'), phoneBody);
  const workstationBackup = `${catalogRoot}-workstation-rollback`;
  const phoneBackup = `${phoneRoot}-phone-rollback`;
  await migrateTaskCurrentState({ decisionOsRoot: workstationDos, projectId, nodeId: 'workstation', tasksLedgerFile: join(workstationDos, 'tasks.json'), backupRoot: workstationBackup });
  await migrateTaskCurrentState({ decisionOsRoot: phoneDos, projectId, nodeId: 'phone', tasksLedgerFile: join(phoneDos, 'tasks.json'), backupRoot: phoneBackup });
  const workstationStore = createTaskCurrentStateStore({ decisionOsRoot: workstationDos, projectId });
  const phoneStore = createTaskCurrentStateStore({ decisionOsRoot: phoneDos, projectId });
  await workstationStore.merge(phoneStore.activeDelta());
  await workstationStore.flush();
  const phoneHash = createHash('sha256').update(phoneBody).digest('hex');

  const relayHttp = createServer();
  const relay = new WebSocketServer({ noServer: true });
  let requestedPath = '';
  relayHttp.on('upgrade', (request, socket, head) => relay.handleUpgrade(request, socket, head, (webSocket) => {
    webSocket.on('message', (data) => {
      const frame = JSON.parse(data.toString()) as Record<string, any>;
      if (frame.type === 'manifest') {
        const project = { id: projectId, name: 'Shared', description: '', color: '#38d9e8', ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] };
        webSocket.send(JSON.stringify({ version: 1, type: 'catalog', nodes: [
          { nodeId: 'workstation', nodeLabel: 'Workstation', online: true, projects: [project] },
          { nodeId: 'phone', nodeLabel: 'Phone', online: true, projects: [project] },
        ] }));
      }
      if (frame.type === 'state-bucket-summary') webSocket.send(JSON.stringify({ ...frame, from: 'relay' }));
      if (frame.type === 'request-open' && frame.to === 'phone') {
        requestedPath = String(frame.path ?? '');
        webSocket.send(JSON.stringify({ version: 1, type: 'response-open', requestId: frame.requestId, status: 200, headers: { 'content-type': 'application/octet-stream' } }));
        webSocket.send(JSON.stringify({ version: 1, type: 'response-chunk', requestId: frame.requestId, data: phoneBody.toString('base64') }));
        webSocket.send(JSON.stringify({ version: 1, type: 'response-end', requestId: frame.requestId }));
      }
    });
  }));
  relayHttp.listen(0, '127.0.0.1');
  await once(relayHttp, 'listening');
  const relayUrl = `http://127.0.0.1:${(relayHttp.address() as AddressInfo).port}`;
  const runtime: Record<string, unknown> = { decisionOsSettings: { federationRelayUrl: relayUrl, federationId: 'proof', federationNodeId: 'workstation', federationNodeCredential: 'credential' } };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: catalogRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  context.after(async () => {
    if (server.listening) { server.close(); await once(server, 'close'); }
    relay.close();
    relayHttp.close();
    await once(relayHttp, 'close');
    [catalogRoot, phoneRoot, workstationBackup, phoneBackup].forEach((entry) => rmSync(entry, { recursive: true, force: true }));
  });

  const deadline = Date.now() + 2_000;
  while (!(runtime.federationNodeConnector as { status(): { peers: Array<{ nodeId: string; online: boolean }> } }).status().peers.some((peer) => peer.nodeId === 'phone' && peer.online)) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for the phone relay catalog entry.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/p/${projectId}/api/ledgers/tasks/cards/phone-only`);
  assert.equal(response.status, 200);
  const card = await response.json() as { comment: { what: string }; state: { content: { status: string; candidates: Array<{ ownerNodeId: string; hash: string }> } } };
  assert.equal(card.comment.what, phoneBody.toString());
  assert.equal(card.state.content.status, 'available');
  assert.ok(card.state.content.candidates.some((candidate) => candidate.ownerNodeId === 'phone' && candidate.hash === phoneHash));
  assert.equal(requestedPath, `/api/federation/content-object?projectId=${projectId}&hash=${phoneHash}`);
});

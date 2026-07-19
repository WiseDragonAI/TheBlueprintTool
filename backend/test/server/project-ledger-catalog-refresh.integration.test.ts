import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';

test('refreshes catalog ledgers after a registered project state change', async () => {
  const home = mkdtempSync(join(tmpdir(), 'decision-os-project-ledger-refresh-'));
  const projectId = 'project-id';
  const decisionOsRoot = join(home, 'project', '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  const runtime: Record<string, unknown> = {};
  const repositoryRoot = basename(process.cwd()) === 'backend' ? join(process.cwd(), '..') : process.cwd();
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', cwd: home, decisionOsFrontendRoot: join(repositoryRoot, 'frontend') },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const initial = await fetch(`${baseUrl}/decision-os/projects`).then((response) => response.json()) as {
      projects: Array<{ id: string; ledgers: Array<{ id: string }> }>;
    };
    assert.deepEqual(initial.projects.find((project) => project.id === projectId)?.ledgers, [
      { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' },
    ]);

    const creation = await fetch(`${baseUrl}/p/${projectId}/decision-os/ledgers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Roadmap' }),
    });
    assert.equal(creation.status, 201);

    const refreshedLedgers = await (async () => {
      const deadline = Date.now() + 2_000;
      while (Date.now() < deadline) {
        const snapshot = await fetch(`${baseUrl}/decision-os/projects`).then((response) => response.json()) as {
          projects: Array<{ id: string; ledgers: Array<{ id: string }> }>;
        };
        const ledgers = snapshot.projects.find((project) => project.id === projectId)?.ledgers ?? [];
        if (ledgers.length === 2) return ledgers;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return [];
    })();

    assert.deepEqual(refreshedLedgers.map((ledger) => ledger.id), ['tasks', 'roadmap']);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(home, { recursive: true, force: true });
  }
});

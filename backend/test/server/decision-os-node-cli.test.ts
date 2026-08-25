import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('decision-os-node lists targets and prints the answer returned by a node message', async () => {
  let received: Record<string, unknown> | null = null;
  const server = createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/api/federation/nodes' && request.method === 'GET') {
      response.end(JSON.stringify({
        ok: true,
        nodes: [{ nodeId: 'node-b', nodeLabel: 'Phone', online: true, local: false, projects: [{ projectId: 'beta', name: 'Beta', available: true }] }],
      }));
      return;
    }
    if (request.url === '/api/federation/nodes/node-b/messages' && request.method === 'POST') {
      let body = '';
      request.setEncoding('utf8');
      for await (const chunk of request) body += chunk;
      received = JSON.parse(body) as Record<string, unknown>;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 75));
      response.end(JSON.stringify({ ok: true, answer: 'Remote evidence.', runId: 'node-message-1' }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ ok: false, error: 'missing' }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  await (server as unknown as { runtimeReady: Promise<void> }).runtimeReady;
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const cli = resolve(process.cwd(), '..', 'bin', 'decision-os-node.mjs');
  try {
    const listed = await execFileAsync(process.execPath, [cli, 'nodes', '--server', base, '--json']);
    const catalog = JSON.parse(listed.stdout) as { nodes: Array<{ nodeId: string; projects: Array<{ projectId: string }> }> };
    assert.equal(catalog.nodes[0].nodeId, 'node-b');
    assert.equal(catalog.nodes[0].projects[0].projectId, 'beta');

    const startedAt = Date.now();
    const asked = await execFileAsync(process.execPath, [
      cli, 'ask', '--server', base, '--node', 'node-b', '--project', 'beta', '--message', 'Inspect federation.', '--model', 'gpt-5.4', '--effort', 'high',
    ]);
    assert.ok(Date.now() - startedAt >= 50);
    assert.equal(asked.stdout, 'Remote evidence.\n');
    assert.deepEqual(received, { projectId: 'beta', message: 'Inspect federation.', codexModel: 'gpt-5.4', codexEffort: 'high' });
  } finally {
    server.close();
    await once(server, 'close');
  }
});

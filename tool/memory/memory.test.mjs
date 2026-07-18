import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addMemory, memoryServiceConfig, readMemories } from './memory-store.mjs';

async function service(handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('environment configuration overrides shared Cloudflare settings', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-memory-config-'));
  const beforeUrl = process.env.DECISION_OS_MEMORY_URL;
  const beforeToken = process.env.DECISION_OS_MEMORY_TOKEN;
  try {
    process.env.DECISION_OS_MEMORY_URL = 'https://memory.example/';
    process.env.DECISION_OS_MEMORY_TOKEN = 'override';
    assert.deepEqual(memoryServiceConfig(root), { url: 'https://memory.example', token: 'override' });
  } finally {
    if (beforeUrl === undefined) delete process.env.DECISION_OS_MEMORY_URL; else process.env.DECISION_OS_MEMORY_URL = beforeUrl;
    if (beforeToken === undefined) delete process.env.DECISION_OS_MEMORY_TOKEN; else process.env.DECISION_OS_MEMORY_TOKEN = beforeToken;
    rmSync(root, { recursive: true, force: true });
  }
});

test('client authenticates reads and writes with Cloudflare', async () => {
  const requests = [];
  const { server, url } = await service((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body });
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify([{ id: 1, title: 'Rule' }]));
    });
  });
  const root = mkdtempSync(join(tmpdir(), 'decision-os-memory-client-'));
  process.env.DECISION_OS_MEMORY_URL = url;
  process.env.DECISION_OS_MEMORY_TOKEN = 'secret';
  try {
    await addMemory(root, { title: 'Rule', body: 'Evidence', tag: 'engineering', subtag: 'bug', projectId: 'p', type: 'code' });
    await readMemories(root, { projectId: 'p', type: 'code', query: 'Rule', limit: 5 });
    assert.deepEqual(requests.map((entry) => entry.method), ['POST', 'GET']);
    assert.equal(requests[0].authorization, 'Bearer secret');
    assert.match(requests[1].url, /project=p/);
    assert.match(requests[1].url, /limit=5/);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(root, { recursive: true, force: true });
    delete process.env.DECISION_OS_MEMORY_URL;
    delete process.env.DECISION_OS_MEMORY_TOKEN;
  }
});

test('client retries a transient non-JSON Cloudflare gateway response', async () => {
  let attempts = 0;
  const { server, url } = await service((request, response) => {
    attempts += 1;
    if (attempts === 1) {
      response.statusCode = 502;
      response.setHeader('content-type', 'text/html');
      response.end('<!doctype html><title>gateway</title>');
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify([{ id: 1, title: 'Recovered' }]));
  });
  const root = mkdtempSync(join(tmpdir(), 'decision-os-memory-retry-'));
  process.env.DECISION_OS_MEMORY_URL = url;
  process.env.DECISION_OS_MEMORY_TOKEN = 'secret';
  try {
    const rows = await readMemories(root, { projectId: 'p' });
    assert.equal(rows[0].title, 'Recovered');
    assert.equal(attempts, 2);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(root, { recursive: true, force: true });
    delete process.env.DECISION_OS_MEMORY_URL;
    delete process.env.DECISION_OS_MEMORY_TOKEN;
  }
});

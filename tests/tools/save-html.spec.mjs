/**
 * WHAT: Verifies the save-html CLI writes a full URL response body to disk.
 * WHY: The capture tool must be dependable for local operator automation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function listen(server) {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen(server.address()));
  });
}

test('save-html downloads the complete response body into the requested file', async () => {
  const body = '<!doctype html><html><head><title>Saved</title></head><body><main>Complete HTML</main></body></html>';
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', connection: 'close' });
    response.end(body);
  });
  const tempDir = mkdtempSync(join(tmpdir(), 'decision-os-save-html-'));
  try {
    const address = await listen(server);
    const outputPath = join(tempDir, 'nested', 'page.html');
    const { stdout } = await execFileAsync(process.execPath, [resolve('bin/save-html.mjs'), `http://127.0.0.1:${address.port}/page`, outputPath], { encoding: 'utf8' });

    assert.equal(readFileSync(outputPath, 'utf8'), body);
    assert.match(stdout, /Saved \d+ bytes from http:\/\/127\.0\.0\.1:\d+\/page to /);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('save-html reports usage when url or filename is missing', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [resolve('bin/save-html.mjs'), 'http://127.0.0.1/'], { encoding: 'utf8' }),
    /Usage: save-html <url> <filename>/
  );
});

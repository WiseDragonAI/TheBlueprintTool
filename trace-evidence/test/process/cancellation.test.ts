import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runTestProcess } from '../../src/business/test/effect/run-test-process.js';

test('cancellation terminates the selected child process group', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-cancel-'));
  const pidFile = join(root, 'descendant.pid');
  const script = `const{spawn}=require('node:child_process');const fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)']);fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setInterval(()=>{},1000)`;
  const controller = new AbortController();
  const running = runTestProcess({ command: { testId: 'cancel', executable: process.execPath, args: ['-e', script], cwd: root, env: {} }, stdout: createWriteStream(join(root, 'out.log')), stderr: createWriteStream(join(root, 'err.log')), timeoutMs: 5_000, signal: controller.signal });
  while (!await readFile(pidFile, 'utf8').catch(() => '')) await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  const descendantPid = Number(await readFile(pidFile, 'utf8'));
  controller.abort();
  const result = await running;
  assert.equal(result.signal, 'SIGTERM');
  await new Promise((resolveWait) => setTimeout(resolveWait, 30));
  assert.throws(() => process.kill(descendantPid, 0));
});

test('test deadline terminates a non-settling process with explicit timeout result', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-timeout-'));
  const result = await runTestProcess({ command: { testId: 'timeout', executable: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: root, env: {} }, stdout: createWriteStream(join(root, 'out.log')), stderr: createWriteStream(join(root, 'err.log')), timeoutMs: 20 });
  assert.equal(result.timedOut, true);
  assert.equal(result.signal, 'SIGTERM');
});

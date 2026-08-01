import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatVerificationWait, verificationCommand, verificationOwner } from '../../bin/decision-os-verify.mjs';

const wrapper = fileURLToPath(new URL('../../bin/decision-os-verify.mjs', import.meta.url));

function run(lockFile, delay) {
  const startedAt = Date.now();
  const child = spawn(process.execPath, [wrapper, '--', process.execPath, '-e', `setTimeout(() => {}, ${delay})`], {
    env: { ...process.env, DECISION_OS_VERIFICATION_LOCK: lockFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return new Promise((resolve) => child.once('close', (code) => resolve({ code, stdout, stderr, elapsed: Date.now() - startedAt })));
}

test('verification command rejects compound shell admission', () => {
  assert.throws(() => verificationCommand(['--', 'sh', '-lc', 'npm test & npm test']), /one direct command/);
});

test('verification command owns the default Node test concurrency', () => {
  assert.deepEqual(
    verificationCommand(['--', process.execPath, '--test', '--import', 'tsx', 'test/example.test.ts']),
    [process.execPath, '--test-concurrency=3', '--test', '--import', 'tsx', 'test/example.test.ts'],
  );
});

test('verification command caps explicit Node test concurrency at three', () => {
  assert.deepEqual(
    verificationCommand(['--', process.execPath, '--test', '--test-concurrency=8', 'test/example.test.ts']),
    [process.execPath, '--test', '--test-concurrency=3', 'test/example.test.ts'],
  );
  assert.deepEqual(
    verificationCommand(['--', process.execPath, '--test', '--test-concurrency', '8', 'test/example.test.ts']),
    [process.execPath, '--test', '--test-concurrency', '3', 'test/example.test.ts'],
  );
});

test('verification command preserves lower Node test concurrency and non-test commands', () => {
  assert.deepEqual(
    verificationCommand(['--', process.execPath, '--test', '--test-concurrency=1', 'test/example.test.ts']),
    [process.execPath, '--test', '--test-concurrency=1', 'test/example.test.ts'],
  );
  assert.deepEqual(
    verificationCommand(['--', process.execPath, '--check', 'bin/example.mjs']),
    [process.execPath, '--check', 'bin/example.mjs'],
  );
});

test('verification wait reports the active lease owner', () => {
  const directory = mkdtempSync(join(tmpdir(), 'decision-os-verification-owner-'));
  const lockFile = join(directory, 'verification.lock');
  try {
    const owner = { pid: 42, cwd: '/repo/.worktrees/dev/backend', command: 'node --test test/example.test.ts' };
    writeFileSync(lockFile, JSON.stringify(owner));
    assert.deepEqual(verificationOwner(lockFile), owner);
    assert.equal(
      formatVerificationWait(lockFile, owner),
      `WAIT verification=${lockFile} owner_pid=42 owner_cwd=/repo/.worktrees/dev/backend owner_command=node --test test/example.test.ts`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('verification lease serializes simultaneous commands', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'decision-os-verification-'));
  const lockFile = join(directory, 'verification.lock');
  try {
    const first = run(lockFile, 350);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = await run(lockFile, 0);
    const firstResult = await first;
    assert.equal(firstResult.code, 0, firstResult.stderr);
    assert.equal(second.code, 0, second.stderr);
    assert.match(firstResult.stdout, /GO verification=/);
    assert.match(second.stdout, /WAIT verification=.* owner_pid=\d+ owner_cwd=.* owner_command=.*setTimeout/);
    assert.match(second.stdout, /GO verification=/);
    assert.ok(second.elapsed >= 250, `second command elapsed ${second.elapsed}ms`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

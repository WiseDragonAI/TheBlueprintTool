import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verificationCommand } from '../../bin/decision-os-verify.mjs';

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
    assert.match(second.stdout, /WAIT verification=/);
    assert.match(second.stdout, /GO verification=/);
    assert.ok(second.elapsed >= 250, `second command elapsed ${second.elapsed}ms`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

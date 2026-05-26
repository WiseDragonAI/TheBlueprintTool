/**
 * WHAT: Verifies the workspace server launcher emits the canonical backend command.
 * WHY: Running CoreV2 from external workspaces must not depend on copy-pasted env and loader flags.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('blueprinttool-server launcher resolves loader, server, frontend root, and tsconfig from any cwd', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'corev2-launcher-'));
  try {
    const output = execFileSync(process.execPath, [resolve('bin/blueprinttool-server.mjs'), '--print-command'], { cwd: workspace, encoding: 'utf8' });
    const command = JSON.parse(output);
    assert.equal(command.cwd, workspace);
    assert.deepEqual(command.args, ['--import', resolve('backend/node_modules/tsx/dist/loader.mjs'), resolve('backend/src/server.ts')]);
    assert.equal(command.env.COREV2_FRONTEND_ROOT, resolve('frontend'));
    assert.equal(command.env.TSX_TSCONFIG_PATH, resolve('backend/tsconfig.json'));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

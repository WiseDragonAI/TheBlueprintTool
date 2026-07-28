/**
 * WHAT: Verifies the workspace server launcher emits the canonical backend command.
 * WHY: Running decision-os from external workspaces must not depend on copy-pasted env and loader flags.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('decision-os-server launcher resolves loader, server, frontend root, and tsconfig from any cwd', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-launcher-'));
  try {
    const output = execFileSync(process.execPath, [resolve('bin/decision-os-server.mjs'), '--print-command'], {
      cwd: workspace,
      encoding: 'utf8',
      env: {
        ...process.env,
        DECISION_OS_FRONTEND_ROOT: '/tmp/poisoned-production-frontend',
        DECISION_OS_LEDGER_ROOT: '/tmp/unrelated-ledger-root',
        DECISION_OS_LEDGER_FILE: '/tmp/unrelated-ledger.json',
        DECISION_OS_PROJECT_ID: 'unrelated-project',
        DECISION_OS_SERVER_URL: 'http://127.0.0.1:9999',
        TSX_TSCONFIG_PATH: '/tmp/unrelated-backend-tsconfig.json',
      },
    });
    const command = JSON.parse(output);
    assert.equal(command.cwd, workspace);
    assert.deepEqual(command.args, ['--import', resolve('backend/node_modules/tsx/dist/loader.mjs'), resolve('backend/src/server.ts')]);
    assert.equal(command.env.DECISION_OS_FRONTEND_ROOT, resolve('frontend'));
    assert.equal(existsSync(resolve(command.env.DECISION_OS_FRONTEND_ROOT, 'src/runtime/content-authoring/controller/ledger-card-editor.ts')), true);
    assert.equal(existsSync(resolve(command.env.DECISION_OS_FRONTEND_ROOT, 'assets/application.css')), true);
    assert.equal(command.env.DECISION_OS_REPOSITORY_SETTINGS_FILE, resolve('.decision-os/.settings.json'));
    assert.equal(command.env.TSX_TSCONFIG_PATH, resolve('backend/tsconfig.json'));
    assert.deepEqual(command.scopedDecisionOsKeys.sort(), [
      'DECISION_OS_ACTIVE_RELEASE_POINTER',
      'DECISION_OS_DELIVERY_PROTOCOL',
      'DECISION_OS_PROCESS_STARTED_AT',
      'DECISION_OS_RELEASE_SHA',
    ]);
    assert.deepEqual(Object.keys(command.releaseIdentity).sort(), [
      'activeReleasePointer',
      'deliveryProtocol',
      'processStartedAt',
      'releaseSha',
    ]);
    assert.equal(command.releaseIdentity.releaseSha, '');
    assert.equal(command.releaseIdentity.activeReleasePointer, 'unbootstrapped');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('decision-os-server launcher forwards supervisor termination signals to its backend child', () => {
  const source = readFileSync(resolve('bin/decision-os-server.mjs'), 'utf8');
  assert.match(source, /for \(const signal of \['SIGTERM', 'SIGINT', 'SIGHUP'\]\)/);
  assert.match(source, /process\.once\(signal, \(\) => \{/);
  assert.match(source, /child\.kill\(signal\)/);
  assert.match(source, /child\.once\('exit', \(code, signal\) => \{/);
});

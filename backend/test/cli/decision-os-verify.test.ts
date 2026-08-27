/**
 * WHAT: Verifies canonical tsx configuration ownership at the repository verification boundary.
 * WHY: Relative and cross-checkout paths fail after fixtures change cwd or silently load aliases from another branch.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import {
  normalizeVerificationEnvironment,
  verificationCommand,
} from '../../../bin/decision-os-verify.mjs';

function repositoryFixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-verify-tsconfig-'));
  mkdirSync(join(root, 'backend'), { recursive: true });
  mkdirSync(join(root, 'frontend'), { recursive: true });
  writeFileSync(join(root, 'backend', 'tsconfig.json'), '{}\n');
  writeFileSync(join(root, 'frontend', 'tsconfig.json'), '{}\n');
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('canonicalizes root-relative backend tsconfig for temporary-workspace descendants', (t) => {
  const root = repositoryFixture(t);
  const command = verificationCommand([
    '--', 'env', 'TSX_TSCONFIG_PATH=backend/tsconfig.json', 'node', '--test', 'backend/test/example.test.ts',
  ], root, root);
  assert.equal(command[1], `TSX_TSCONFIG_PATH=${join(root, 'backend', 'tsconfig.json')}`);
});

test('canonicalizes env chdir-relative backend tsconfig', (t) => {
  const root = repositoryFixture(t);
  const command = verificationCommand([
    '--', 'env', '--chdir=backend', 'TSX_TSCONFIG_PATH=tsconfig.json', 'node', '--test', 'test/example.test.ts',
  ], root, root);
  assert.equal(command[2], `TSX_TSCONFIG_PATH=${join(root, 'backend', 'tsconfig.json')}`);
});

test('canonicalizes an inherited tsconfig before descendants change cwd', (t) => {
  const root = repositoryFixture(t);
  const environment = normalizeVerificationEnvironment({ TSX_TSCONFIG_PATH: 'backend/tsconfig.json' }, root, root);
  assert.equal(environment.TSX_TSCONFIG_PATH, join(root, 'backend', 'tsconfig.json'));
});

test('rejects missing and cross-checkout tsconfig paths before verification admission', (t) => {
  const root = repositoryFixture(t);
  assert.throws(
    () => normalizeVerificationEnvironment({ TSX_TSCONFIG_PATH: 'backend/missing.json' }, root, root),
    /TSX_TSCONFIG_PATH does not exist/,
  );
  assert.throws(
    () => normalizeVerificationEnvironment({ TSX_TSCONFIG_PATH: resolve(root, '..', 'other', 'tsconfig.json') }, root, root),
    /TSX_TSCONFIG_PATH must belong to the current checkout/,
  );
});

/**
 * WHAT: Unit test for resolving the active .blueprinttool root from arbitrary cwd.
 * WHY: External workspaces launch CoreV2 backend from directories outside the CoreV2 repo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { resolveBlueprinttoolRoot } from '@backend/business/server/helper/resolve-blueprinttool-root.js';

test('resolve-blueprinttool-root walks upward from an arbitrary workspace cwd', () => {
  traces.length = 0;
  const workspace = mkdtempSync(join(tmpdir(), 'corev2-workspace-'));
  const nested = join(workspace, 'nested', 'child');
  try {
    mkdirSync(join(workspace, '.blueprinttool'), { recursive: true });
    mkdirSync(nested, { recursive: true });
    const root = resolveBlueprinttoolRoot({ action_payload: { cwd: nested }, runtime_state: {} });
    assert.equal(root, join(workspace, '.blueprinttool'));
    assert.ok(traces.some((trace) => trace.name === 'resolve-blueprinttool-root'));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

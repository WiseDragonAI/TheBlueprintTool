/**
 * WHAT: Unit test for resolving the active .decision-os root from arbitrary cwd.
 * WHY: External workspaces launch decision-os backend from directories outside the decision-os repo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { traces } from '@backend/telemetry/harness.js';
import { resolveDecisionOsRoot } from '@backend/business/server/helper/resolve-decision-os-root.js';

test('resolve-decision-os-root walks upward from an arbitrary workspace cwd', () => {
  traces.length = 0;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-workspace-'));
  const nested = join(workspace, 'nested', 'child');
  try {
    mkdirSync(join(workspace, '.decision-os'), { recursive: true });
    mkdirSync(nested, { recursive: true });
    const root = resolveDecisionOsRoot({ action_payload: { cwd: nested }, runtime_state: {} });
    assert.equal(root, join(workspace, '.decision-os'));
    assert.ok(traces.some((trace) => trace.name === 'resolve-decision-os-root'));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

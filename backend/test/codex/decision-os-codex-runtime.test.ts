import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { decisionOsCodexEnvironment, ensureLedgerCliShim } from '@backend/business/codex/helper/decision-os-codex-runtime.js';

test('Codex runtime exposes one project-scoped ledger-cli command', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-'));
  const launcher = join(root, 'ledger-cli.mjs');
  writeFileSync(launcher, 'console.log(JSON.stringify({argv:process.argv.slice(2)}))\n');
  chmodSync(launcher, 0o600);
  const shimDirectory = ensureLedgerCliShim({ masterDecisionOsRoot: join(root, '.decision-os'), launcher });
  const runtime = { ledgerCliShimDirectory: shimDirectory, projectId: 'project-a', decisionOsServerUrl: 'http://127.0.0.1:50150' };
  const env = decisionOsCodexEnvironment({ runtime, decisionOsRoot: join(root, 'child', '.decision-os'), ledgerFile: join(root, 'child', '.decision-os', 'specs.json') });
  assert.equal(env.PATH?.split(delimiter)[0], shimDirectory);
  assert.equal(env.DECISION_OS_PROJECT_ID, 'project-a');
  assert.equal(env.DECISION_OS_LEDGER_ROOT, join(root, 'child', '.decision-os'));
  assert.equal(env.DECISION_OS_SERVER_URL, 'http://127.0.0.1:50150');
  assert.match(readFileSync(join(shimDirectory, 'ledger-cli'), 'utf8'), /exec .*node.*ledger-cli\.mjs' "\$@"/);
});

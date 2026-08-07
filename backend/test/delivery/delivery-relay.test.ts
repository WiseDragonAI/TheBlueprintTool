/**
 * WHAT: Verifies fixed pinned-Wrangler list, upload, deploy, rollback, redaction, and relay-health contracts.
 * WHY: Relay delivery tests must never contact Cloudflare or expose credentials.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  deployCanaryDevRelayVersion,
  deployRelayVersion,
  DeliveryRelayError,
  readCurrentCanaryDevRelayDeployment,
  readCurrentRelayDeployment,
  rollbackCanaryDevRelayVersion,
  rollbackRelayVersion,
  uploadCanaryDevRelayVersion,
  uploadRelayVersion,
  verifyRelayReleaseHealth,
  type DeliveryRelayRunner,
} from '../../src/business/delivery/helper/delivery-relay.js';
import type { BoundedProcessResult, RunBoundedProcessInput } from '../../src/business/process/helper/run-bounded-process.js';
import { admittedSha } from './delivery-test-fixtures.js';
import { taskCurrentBaselineEpoch, taskCurrentStateVersion, taskStateProtocol } from '../../src/business/task-state/helper/task-current-state-types.js';

const token = 'cloudflare-secret-token';
const priorVersionId = '11111111-1111-4111-8111-111111111111';
const uploadedVersionId = '22222222-2222-4222-8222-222222222222';

test('source-defines distinct production and dev Worker state identities with pinned Wrangler', () => {
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const config = readFileSync(resolve(repositoryRoot, 'federation-relay/wrangler.toml'), 'utf8');
  const packageDocument = JSON.parse(readFileSync(resolve(repositoryRoot, 'federation-relay/package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>;
  };
  assert.match(config, /^name = "decision-os-federation-relay"$/m);
  assert.match(config, /^\[env\.dev\]$/m);
  assert.match(config, /^name = "decision-os-federation-relay-dev"$/m);
  assert.match(config, /^FEDERATIONS_NAMESPACE = "decision-os-federations-production"$/m);
  assert.match(config, /^FEDERATIONS_NAMESPACE = "decision-os-federations-dev"$/m);
  assert.equal(config.match(/name = "FEDERATIONS"/g)?.length, 2);
  assert.equal(packageDocument.devDependencies?.wrangler, '4.111.0');
});

function result(input: RunBoundedProcessInput, stdout: string, overrides: Partial<BoundedProcessResult> = {}): BoundedProcessResult {
  return {
    ok: true,
    command: input.command,
    args: [...(input.args ?? [])],
    pid: 123,
    startedAt: '2026-07-28T00:00:00.000Z',
    finishedAt: '2026-07-28T00:00:01.000Z',
    durationMs: 1_000,
    exitCode: 0,
    signal: null,
    termination: null,
    stdout,
    stderr: '',
    stdoutTruncatedBytes: 0,
    stderrTruncatedBytes: 0,
    spawnError: null,
    context: input.context ?? {},
    ...overrides,
  };
}

test('uses fixed argv for deployment listing, exact-release upload, 100-percent deploy, and rollback', async () => {
  const calls: RunBoundedProcessInput[] = [];
  const runner: DeliveryRelayRunner = async (input) => {
    calls.push(input);
    const args = input.args ?? [];
    if (args.includes('list')) {
      return result(input, JSON.stringify([{
        id: 'deployment-1',
        created_on: '2026-07-28T00:00:00.000Z',
        versions: [{ version_id: priorVersionId, percentage: 100 }],
      }]));
    }
    if (args.includes('upload')) return result(input, `Worker Version ID: ${uploadedVersionId}\n`);
    return result(input, 'ok\n');
  };
  const common = {
    releaseWorktree: resolve(import.meta.dirname, '../../..'),
    runner,
    environment: { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: 'fixture-account' },
  };
  const current = await readCurrentRelayDeployment(common);
  assert.equal(current.deployment.versionId, priorVersionId);
  const uploaded = await uploadRelayVersion({ ...common, mainSha: admittedSha });
  assert.equal(uploaded.versionId, uploadedVersionId);
  await deployRelayVersion({ ...common, mainSha: admittedSha, versionId: uploadedVersionId });
  await rollbackRelayVersion({ ...common, failedMainSha: admittedSha, priorVersionId });

  const config = resolve(common.releaseWorktree, 'federation-relay', 'wrangler.toml');
  const wrangler = resolve(common.releaseWorktree, 'federation-relay', 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  assert.deepEqual(calls.map((call) => call.args), [
    [wrangler, 'deployments', 'list', '--json', '--config', config, '--name', 'decision-os-federation-relay'],
    [
      wrangler,
      'versions', 'upload',
      '--strict',
      '--var', `DECISION_OS_RELEASE_SHA:${admittedSha}`,
      '--tag', `decision-os-${admittedSha}`,
      '--message', `Decision OS relay ${admittedSha}`,
      '--config', config,
      '--name', 'decision-os-federation-relay',
    ],
    [
      wrangler,
      'versions', 'deploy',
      `${uploadedVersionId}@100%`,
      '--yes',
      '--message', `Activate Decision OS relay ${admittedSha}`,
      '--config', config,
      '--name', 'decision-os-federation-relay',
    ],
    [
      wrangler,
      'rollback',
      priorVersionId,
      '--yes',
      '--message', `Rollback Decision OS relay ${admittedSha}`,
      '--config', config,
      '--name', 'decision-os-federation-relay',
    ],
  ]);
  assert.equal(calls.every((call) => call.env?.CLOUDFLARE_API_TOKEN === token), true);
  assert.equal(JSON.stringify([
    current.receipt,
    uploaded.receipt,
  ]).includes(token), false);
});

test('canary wrappers select only the source-owned env.dev Worker while production argv stays fixed', async () => {
  const calls: RunBoundedProcessInput[] = [];
  const runner: DeliveryRelayRunner = async (input) => {
    calls.push(input);
    const args = input.args ?? [];
    // WHAT: Return the exact fixture shape required by the invoked Wrangler query.
    // WHY: The test must observe argv without contacting Cloudflare.
    if (args.includes('list')) {
      return result(input, JSON.stringify([{
        id: 'deployment-dev-1',
        created_on: '2026-08-07T00:00:00.000Z',
        versions: [{ version_id: priorVersionId, percentage: 100 }],
      }]));
    }
    // WHAT: Supply a stable version identity only for upload.
    // WHY: The canary upload parser requires real Wrangler-shaped evidence.
    if (args.includes('upload')) return result(input, `Worker Version ID: ${uploadedVersionId}\n`);
    return result(input, 'ok\n');
  };
  const common = {
    releaseWorktree: resolve(import.meta.dirname, '../../..'),
    runner,
    environment: { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: 'fixture-account' },
  };
  await readCurrentCanaryDevRelayDeployment(common);
  await uploadCanaryDevRelayVersion({ ...common, mainSha: admittedSha });
  await deployCanaryDevRelayVersion({ ...common, mainSha: admittedSha, versionId: uploadedVersionId });
  await rollbackCanaryDevRelayVersion({ ...common, failedMainSha: admittedSha, priorVersionId });

  assert.equal(calls.length, 4);
  assert.equal(calls.every((call) => {
    const args = call.args ?? [];
    return args.includes('--env')
      && args[args.indexOf('--env') + 1] === 'dev'
      && args[args.indexOf('--name') + 1] === 'decision-os-federation-relay-dev';
  }), true);
});

test('redacts token and bearer material from bounded Wrangler failures', async () => {
  const runner: DeliveryRelayRunner = async (input) => result(input, '', {
    ok: false,
    exitCode: 1,
    stderr: `CLOUDFLARE_API_TOKEN=${token} Authorization: Bearer ${token}`,
  });
  await assert.rejects(readCurrentRelayDeployment({
    releaseWorktree: resolve(import.meta.dirname, '../../..'),
    runner,
    environment: { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: 'fixture-account' },
  }), (error: unknown) => {
    assert.equal(error instanceof DeliveryRelayError, true);
    assert.equal(String(error).includes(token), false);
    assert.match(String(error), /\[REDACTED\]/);
    return true;
  });
});

test('verifies exact deployed relay release and backward-compatible protocols through an injected reader', async () => {
  const health = await verifyRelayReleaseHealth({
    expectedReleaseSha: admittedSha,
    readHealth: async (signal) => {
      assert.equal(signal.aborted, false);
      return {
        ok: true,
        status: 'ready',
        releaseSha: admittedSha,
        deliveryProtocol: 1,
        protocolVersion: 1,
        stateProtocol: taskStateProtocol,
        stateSchema: taskCurrentStateVersion,
        baselineEpoch: taskCurrentBaselineEpoch,
      };
    },
  });
  assert.equal(health.releaseSha, admittedSha);
  await assert.rejects(verifyRelayReleaseHealth({
    expectedReleaseSha: admittedSha,
    readHealth: async () => ({ ok: true, status: 'ready', releaseSha: 'f'.repeat(40) }),
  }), (error: unknown) => error instanceof DeliveryRelayError && error.code === 'delivery_relay_health_mismatch');
  await assert.rejects(verifyRelayReleaseHealth({
    expectedReleaseSha: admittedSha,
    deadlineMs: 100,
    readHealth: async () => await new Promise<never>(() => undefined),
  }), (error: unknown) => error instanceof DeliveryRelayError && error.code === 'delivery_relay_health_timeout');
});

/**
 * WHAT: Verifies canonical release-tag parsing and a complete injected production relay deployment.
 * WHY: The deployment command must prove tag authority and fixed Wrangler behavior without contacting Git remotes or Cloudflare.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  DeployRelayCliError,
  deployRelayFromTag,
  parseDeployRelayArguments,
} from '../../src/cli/decision-os-deploy-relay.js';
import type { DeliveryRelayRunner } from '../../src/business/delivery/helper/delivery-relay.js';
import type { BoundedProcessResult, RunBoundedProcessInput } from '../../src/business/process/helper/run-bounded-process.js';
import { taskCurrentBaselineEpoch, taskCurrentStateVersion, taskStateProtocol } from '../../src/business/task-state/helper/task-current-state-types.js';
import { decisionOsDeliveryProtocol } from '../../../shared/schemas/decision-os-delivery-types.js';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const releaseTag = 'rel-0.4.0';
const releaseCommit = 'a'.repeat(40);
const currentMain = 'b'.repeat(40);
const priorVersionId = '11111111-1111-4111-8111-111111111111';
const uploadedVersionId = '22222222-2222-4222-8222-222222222222';

function result(input: RunBoundedProcessInput, stdout = '', exitCode = 0): BoundedProcessResult {
  return {
    ok: exitCode === 0,
    command: input.command,
    args: [...(input.args ?? [])],
    pid: 123,
    startedAt: '2026-08-08T00:00:00.000Z',
    finishedAt: '2026-08-08T00:00:01.000Z',
    durationMs: 1_000,
    exitCode,
    signal: null,
    termination: null,
    stdout,
    stderr: '',
    stdoutTruncatedBytes: 0,
    stderrTruncatedBytes: 0,
    spawnError: null,
    context: input.context ?? {},
  };
}

test('accepts only one canonical annotated release tag plus JSON output', () => {
  assert.deepEqual(parseDeployRelayArguments([releaseTag, '--json']), { releaseTag, json: true });
  assert.throws(
    () => parseDeployRelayArguments([releaseCommit, '--json']),
    (error: unknown) => error instanceof DeployRelayCliError && error.code === 'deploy_relay_tag_invalid',
  );
  assert.throws(
    () => parseDeployRelayArguments([releaseTag]),
    (error: unknown) => error instanceof DeployRelayCliError && error.code === 'deploy_relay_usage',
  );
});

test('deploys relay bytes from canonical main using the published release tag', async () => {
  const calls: RunBoundedProcessInput[] = [];
  const runner: DeliveryRelayRunner = async (input) => {
    calls.push(input);
    const args = input.args ?? [];
    // WHAT: Return exact fixture evidence for each fixed Git admission command.
    // WHY: The test must exercise production admission without reading mutable repository or remote state.
    if (input.command === 'git') {
      // WHAT: Identify the canonical branch.
      // WHY: Main is the only admitted production source checkout.
      if (args[0] === 'symbolic-ref') return result(input, 'main\n');
      // WHAT: Identify an annotated tag object.
      // WHY: The release tag cannot be a lightweight alias.
      if (args[0] === 'cat-file') return result(input, 'tag\n');
      // WHAT: Resolve the release tag to its compatibility fingerprint.
      // WHY: Relay health retains commit-level protocol identity.
      if (args[0] === 'rev-list') return result(input, `${releaseCommit}\n`);
      // WHAT: Identify the published current main tool revision.
      // WHY: The deployment tool itself must be available at origin/main.
      if (args[0] === 'rev-parse') return result(input, `${currentMain}\n`);
      // WHAT: Return exact remote main plus annotated and peeled tag refs.
      // WHY: Local-only release authority must fail closed.
      if (args[0] === 'ls-remote') {
        return result(input, [
          `${currentMain}\trefs/heads/main`,
          `${'c'.repeat(40)}\trefs/tags/${releaseTag}`,
          `${releaseCommit}\trefs/tags/${releaseTag}^{}`,
        ].join('\n'));
      }
      return result(input);
    }
    // WHAT: Return the exact predecessor deployment.
    // WHY: The command must capture rollback authority before upload and activation.
    if (args.includes('deployments')) {
      return result(input, JSON.stringify([{
        id: 'deployment-1',
        created_on: '2026-08-08T00:00:00.000Z',
        versions: [{ version_id: priorVersionId, percentage: 100 }],
      }]));
    }
    // WHAT: Return the immutable uploaded Worker version identity.
    // WHY: Activation must select the version produced by this exact upload.
    if (args.includes('upload')) return result(input, `Worker Version ID: ${uploadedVersionId}\n`);
    return result(input, 'ok\n');
  };
  const priorToken = process.env.CLOUDFLARE_API_TOKEN;
  const priorAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  process.env.CLOUDFLARE_API_TOKEN = 'fixture-token';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'fixture-account';
  let healthReads = 0;
  try {
    const receipt = await deployRelayFromTag({
      releaseTag,
      cwd: repositoryRoot,
      runner,
      fetchImplementation: async () => {
        healthReads += 1;
        const observedRelease = healthReads === 1 ? 'd'.repeat(40) : releaseCommit;
        return new Response(JSON.stringify({
          ok: true,
          status: 'ready',
          releaseSha: observedRelease,
          deliveryProtocol: decisionOsDeliveryProtocol,
          protocolVersion: 1,
          stateProtocol: taskStateProtocol,
          stateSchema: taskCurrentStateVersion,
          baselineEpoch: taskCurrentBaselineEpoch,
          environment: 'production',
          workerName: 'decision-os-federation-relay',
          durableObjectNamespace: 'decision-os-federations-production',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });
    assert.equal(receipt.releaseTag, releaseTag);
    assert.equal(receipt.releaseCommit, releaseCommit);
    assert.equal(receipt.priorVersionId, priorVersionId);
    assert.equal(receipt.versionId, uploadedVersionId);
    const upload = calls.find((call) => call.args?.includes('upload'));
    const activation = calls.find((call) => call.args?.includes('deploy'));
    assert.equal(upload?.args?.includes(releaseTag), true);
    assert.equal(upload?.args?.includes(`DECISION_OS_RELEASE_SHA:${releaseCommit}`), true);
    assert.equal(activation?.args?.includes(`Activate Decision OS relay ${releaseTag}`), true);
  } finally {
    // WHAT: Restore the test process credential environment.
    // WHY: Independent tests must not inherit fixture Cloudflare authority.
    if (priorToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = priorToken;
    // WHAT: Restore the test process account environment.
    // WHY: Independent tests must not inherit fixture Cloudflare authority.
    if (priorAccount === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = priorAccount;
  }
});

/**
 * WHAT: Uploads, activates, observes, and restores only the source-owned Wrangler env.dev Worker.
 * WHY: The canary needs the real Cloudflare delivery path while production relay argv and identity remain inaccessible.
 */
import {
  deployCanaryDevRelayVersion,
  readCurrentCanaryDevRelayDeployment,
  rollbackCanaryDevRelayVersion,
  uploadCanaryDevRelayVersion,
  verifyRelayReleaseHealth,
  type DeliveryRelayRunner,
  type RelayCommandReceipt,
} from './delivery-relay.js';
import {
  recordReleaseCanaryExternalWorker,
  recordReleaseCanaryExternalWorkerRestored,
  ReleaseCanaryHarnessError,
} from './release-canary-harness.js';

export type ReleaseCanaryDevWorkerReceipt = {
  priorVersionId: string;
  ownedVersionId: string;
  readBefore: RelayCommandReceipt;
  upload: RelayCommandReceipt;
  activation: RelayCommandReceipt;
  readAfter: RelayCommandReceipt;
  health: Record<string, unknown>;
};

export async function deployReleaseCanaryDevWorker(input: {
  repositoryRoot: string;
  runId: string;
  releaseWorktree: string;
  mainSha: string;
  environment: NodeJS.ProcessEnv;
  runner?: DeliveryRelayRunner;
  readHealth: (signal: AbortSignal) => Promise<unknown>;
  signal?: AbortSignal;
}): Promise<ReleaseCanaryDevWorkerReceipt> {
  const common = {
    releaseWorktree: input.releaseWorktree,
    environment: input.environment,
    runner: input.runner,
    signal: input.signal,
  };
  const before = await readCurrentCanaryDevRelayDeployment(common);
  const uploaded = await uploadCanaryDevRelayVersion({ ...common, mainSha: input.mainSha });
  recordReleaseCanaryExternalWorker({
    repositoryRoot: input.repositoryRoot,
    runId: input.runId,
    priorVersionId: before.deployment.versionId,
    ownedVersionId: uploaded.versionId,
  });
  const activation = await deployCanaryDevRelayVersion({
    ...common,
    mainSha: input.mainSha,
    versionId: uploaded.versionId,
  });
  const after = await readCurrentCanaryDevRelayDeployment(common);
  // WHAT: Require the exact uploaded version at 100 percent after activation.
  // WHY: A successful Wrangler exit without matching external authority is not deployment proof.
  if (after.deployment.versionId !== uploaded.versionId) {
    throw new ReleaseCanaryHarnessError('release_canary_worker_activation_mismatch', 'Wrangler env.dev did not activate the uploaded canary version.');
  }
  const health = await verifyRelayReleaseHealth({
    expectedReleaseSha: input.mainSha,
    readHealth: input.readHealth,
    signal: input.signal,
  });
  return {
    priorVersionId: before.deployment.versionId,
    ownedVersionId: uploaded.versionId,
    readBefore: before.receipt,
    upload: uploaded.receipt,
    activation,
    readAfter: after.receipt,
    health,
  };
}

export async function restoreReleaseCanaryDevWorker(input: {
  repositoryRoot: string;
  runId: string;
  releaseWorktree: string;
  failedMainSha: string;
  priorVersionId: string;
  ownedVersionId: string;
  environment: NodeJS.ProcessEnv;
  runner?: DeliveryRelayRunner;
  signal?: AbortSignal;
}): Promise<{ restored: boolean; status: 'restored' | 'external-worker-drift'; receipt: RelayCommandReceipt | null }> {
  const common = {
    releaseWorktree: input.releaseWorktree,
    environment: input.environment,
    runner: input.runner,
    signal: input.signal,
  };
  const current = await readCurrentCanaryDevRelayDeployment(common);
  // WHAT: Accept the recorded predecessor as an already-restored external authority.
  // WHY: Upload can succeed and activation can fail before the harness-owned version ever becomes active.
  if (current.deployment.versionId === input.priorVersionId) {
    recordReleaseCanaryExternalWorkerRestored({
      repositoryRoot: input.repositoryRoot,
      runId: input.runId,
      priorVersionId: input.priorVersionId,
      ownedVersionId: input.ownedVersionId,
    });
    return { restored: true, status: 'restored', receipt: null };
  }
  // WHAT: Refuse rollback when env.dev no longer runs the harness-owned version.
  // WHY: A concurrent actor's deployment must never be overwritten by canary cleanup.
  if (current.deployment.versionId !== input.ownedVersionId) {
    return { restored: false, status: 'external-worker-drift', receipt: null };
  }
  const receipt = await rollbackCanaryDevRelayVersion({
    ...common,
    failedMainSha: input.failedMainSha,
    priorVersionId: input.priorVersionId,
  });
  const restored = await readCurrentCanaryDevRelayDeployment(common);
  // WHAT: Require the recorded predecessor to be active after rollback.
  // WHY: Cleanup is incomplete until external authority confirms restoration.
  if (restored.deployment.versionId !== input.priorVersionId) {
    throw new ReleaseCanaryHarnessError('release_canary_worker_restore_mismatch', 'Wrangler env.dev did not restore the recorded predecessor.');
  }
  recordReleaseCanaryExternalWorkerRestored({
    repositoryRoot: input.repositoryRoot,
    runId: input.runId,
    priorVersionId: input.priorVersionId,
    ownedVersionId: input.ownedVersionId,
  });
  return { restored: true, status: 'restored', receipt };
}

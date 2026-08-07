/**
 * WHAT: Runs the complete local and env.dev release-canary proof behind fixed repository-owned authorities.
 * WHY: The CLI must not report success from preparation receipts while runtime, restoration, and cleanup remain unproven.
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { acquireRepositoryMutationLock } from '../../content-authoring/helper/repository-mutation-lock.js';
import { readProjectRegistry } from '../../server/helper/project-registry.js';
import {
  cleanupReleaseCanaryRun,
  inventoryReleaseCanarySource,
  readReleaseCanaryManifest,
  ReleaseCanaryHarnessError,
  type ReleaseCanaryInventory,
  type ReleaseCanaryManifest,
} from './release-canary-harness.js';
import {
  readCurrentCanaryDevRelayDeployment,
  rollbackCanaryDevRelayVersion,
} from './delivery-relay.js';
import type { ReleaseCanaryGitReceipt } from './release-canary-git-sandbox.js';
import {
  deployReleaseCanaryDevWorker,
  restoreReleaseCanaryDevWorker,
  type ReleaseCanaryDevWorkerReceipt,
} from './release-canary-dev-worker.js';
import {
  proveReleaseCanaryDevWorkerRuntime,
  proveReleaseCanaryRuntime,
  type ReleaseCanaryRuntimeReceipt,
  type ReleaseCanaryWorkerRuntimeEvidence,
} from './release-canary-runtime-proof.js';
import { proveReleaseCanaryRuntimeRecovery } from './release-canary-runtime-recovery-proof.js';

const fixedDevWorkerHealthUrl = 'https://decision-os-federation-relay-dev.ardaria.workers.dev/health';

export type ReleaseCanaryCompletedPhase = { receiptFile: string; receiptId: string };

export type ReleaseCanaryCompletedPhases = {
  'watcher-recovery': ReleaseCanaryCompletedPhase;
  'worker-runtime': ReleaseCanaryCompletedPhase;
  'termux-runtime': ReleaseCanaryCompletedPhase;
  'reconnect-quiescence': ReleaseCanaryCompletedPhase;
  'incident-recovery': ReleaseCanaryCompletedPhase;
  'cleanup-readiness': ReleaseCanaryCompletedPhase;
};

export type ReleaseCanaryProofOrchestratorEffects = {
  proveRuntimeRecovery: typeof proveReleaseCanaryRuntimeRecovery;
  proveTermuxRuntime: typeof proveReleaseCanaryRuntime;
  deployDevWorker: typeof deployReleaseCanaryDevWorker;
  proveWorkerRuntime: typeof proveReleaseCanaryDevWorkerRuntime;
  restoreDevWorker: typeof restoreReleaseCanaryDevWorker;
  readHealth: (signal: AbortSignal) => Promise<unknown>;
};

const defaultEffects: ReleaseCanaryProofOrchestratorEffects = {
  proveRuntimeRecovery: proveReleaseCanaryRuntimeRecovery,
  proveTermuxRuntime: proveReleaseCanaryRuntime,
  deployDevWorker: deployReleaseCanaryDevWorker,
  proveWorkerRuntime: proveReleaseCanaryDevWorkerRuntime,
  restoreDevWorker: restoreReleaseCanaryDevWorker,
  readHealth: readFixedDevWorkerHealth,
};

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function inside(root: string, candidate: string): boolean {
  const relation = relative(resolve(root), resolve(candidate));
  return relation === '' || (relation !== '..' && !relation.startsWith('../') && !isAbsolute(relation));
}

function phaseArtifact(input: {
  runRoot: string;
  phase: 'worker-runtime' | 'reconnect-quiescence' | 'cleanup-readiness';
  evidence: Record<string, unknown>;
}): ReleaseCanaryCompletedPhase {
  const document = { phase: input.phase, status: 'passed', evidence: input.evidence };
  const bytes = `${JSON.stringify(document, null, 2)}\n`;
  const receiptFile = resolve(input.runRoot, `${input.phase}-phase-receipt.json`);
  writeFileSync(receiptFile, bytes, { mode: 0o600 });
  return { receiptFile, receiptId: `sha256:${sha256(bytes)}` };
}

function loadFixedCanaryEnvironment(primaryRepositoryRootInput: string): NodeJS.ProcessEnv {
  const primaryRepositoryRoot = resolve(primaryRepositoryRootInput);
  const file = resolve(primaryRepositoryRoot, '.env');
  // WHAT: Require one ignored owner-only credential file in the settings-owned primary repository.
  // WHY: Cloudflare and relay administration must never fall back to browser authentication or copied secrets.
  if (!existsSync(file) || !statSync(file).isFile() || (statSync(file).mode & 0o077) !== 0) {
    throw new ReleaseCanaryHarnessError('release_canary_credentials_invalid', 'Primary repository .env is absent or not owner-only.');
  }
  const ignored = spawnSync('git', ['check-ignore', '-q', '--', '.env'], {
    cwd: primaryRepositoryRoot,
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  // WHAT: Reject a credential file that Git does not prove ignored.
  // WHY: Release proof must not make a commit-eligible secret part of its authority.
  if (ignored.status !== 0) throw new ReleaseCanaryHarnessError('release_canary_credentials_not_ignored', 'Primary repository .env is not Git-ignored.');
  const environment = { ...process.env };
  const admitted = new Set(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'ADMIN_SECRET']);
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    // WHAT: Ignore every setting outside the three fixed noninteractive authorities.
    // WHY: The canary must not copy or expose unrelated repository secrets.
    if (!match || !admitted.has(match[1]!)) continue;
    // WHAT: Preserve an already-injected process credential over the ignored-file fallback.
    // WHY: Supervised noninteractive execution may own fresher short-lived authority.
    if (environment[match[1]!]) continue;
    environment[match[1]!] = String(match[2] ?? '').replace(/^(['"])(.*)\1$/, '$2');
  }
  // WHAT: Require all fixed credentials without printing or returning their values in evidence.
  // WHY: Missing authority is a configuration failure, never a reason to open a browser.
  if (!String(environment.CLOUDFLARE_API_TOKEN ?? '').trim()
    || !String(environment.CLOUDFLARE_ACCOUNT_ID ?? '').trim()
    || String(environment.ADMIN_SECRET ?? '').trim().length < 32) {
    throw new ReleaseCanaryHarnessError('release_canary_credentials_missing', 'Noninteractive Cloudflare or relay credentials are unavailable.');
  }
  return environment;
}

function requireMatchingFile(left: string, right: string, code: string): void {
  // WHAT: Require dependency lock bytes to match the release checkout exactly.
  // WHY: Reusing installed tooling is safe only for the same pinned dependency graph.
  if (!existsSync(left) || !existsSync(right) || sha256(readFileSync(left)) !== sha256(readFileSync(right))) {
    throw new ReleaseCanaryHarnessError(code, 'Release and installed dependency locks differ.');
  }
}

function installFixedReleaseDependencies(input: {
  primaryRepositoryRoot: string;
  releaseWorktree: string;
  runRoot: string;
}): void {
  const releaseWorktree = resolve(input.releaseWorktree);
  // WHAT: Require the immutable release checkout beneath the manifest-owned run root.
  // WHY: Dependency admission must never write a source or shared worktree.
  if (!inside(input.runRoot, releaseWorktree)) throw new ReleaseCanaryHarnessError('release_canary_release_worktree_invalid', 'Release worktree leaves the canary run.');
  const sourceModules = resolve(input.primaryRepositoryRoot, 'federation-relay', 'node_modules');
  const destinationModules = resolve(releaseWorktree, 'federation-relay', 'node_modules');
  requireMatchingFile(
    resolve(input.primaryRepositoryRoot, 'federation-relay', 'package-lock.json'),
    resolve(releaseWorktree, 'federation-relay', 'package-lock.json'),
    'release_canary_relay_lock_mismatch',
  );
  // WHAT: Require one real installed dependency directory before linking it into the owned checkout.
  // WHY: The harness must not invoke package installation, arbitrary scripts, or network resolution during deployment proof.
  if (!existsSync(sourceModules) || !statSync(sourceModules).isDirectory() || lstatSync(sourceModules).isSymbolicLink()) {
    throw new ReleaseCanaryHarnessError('release_canary_relay_dependencies_missing', 'Primary relay dependencies are unavailable.');
  }
  // WHAT: Install the exact dependency link only when the release checkout has no existing node_modules entry.
  // WHY: Existing bytes or links could substitute another Wrangler runtime.
  if (existsSync(destinationModules) || lstatExists(destinationModules)) {
    throw new ReleaseCanaryHarnessError('release_canary_release_dependencies_present', 'Release checkout already contains dependency state.');
  }
  symlinkSync(sourceModules, destinationModules, 'dir');
}

function lstatExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

async function readFixedDevWorkerHealth(signal: AbortSignal): Promise<unknown> {
  const response = await fetch(fixedDevWorkerHealthUrl, { signal, headers: { accept: 'application/json' } });
  // WHAT: Require the fixed env.dev health route to answer successfully.
  // WHY: Wrangler activation alone is not runtime release authority.
  if (!response.ok) throw new ReleaseCanaryHarnessError('release_canary_worker_health_failed', `env.dev health returned HTTP ${response.status}.`);
  return await response.json();
}

function sameInventory(left: ReleaseCanaryInventory, right: ReleaseCanaryInventory): boolean {
  return left.digest === right.digest && left.fileCount === right.fileCount && left.byteCount === right.byteCount;
}

async function teardownFailedDevWorkerFederation(input: {
  manifest: ReleaseCanaryManifest;
  release: Pick<ReleaseCanaryGitReceipt, 'candidateSha'>;
  environment: NodeJS.ProcessEnv;
}): Promise<void> {
  const registry = readProjectRegistry(resolve(input.manifest.runtimeFixtures.candidate.canaryA, '.decision-os'));
  // WHAT: Require the exact copied catalog before tearing down a failed Worker canary runtime.
  // WHY: Ephemeral teardown must never discover or widen its project scope from the relay.
  if (!registry) throw new ReleaseCanaryHarnessError('release_canary_worker_cleanup_catalog_missing', 'Copied project catalog is unavailable for env.dev cleanup.');
  const federationId = `release_canary_${sha256(`${input.manifest.runId}:${input.release.candidateSha}`).slice(0, 24)}`;
  const administratorSecret = String(input.environment.ADMIN_SECRET ?? '');
  const deadline = Date.now() + 10_000;
  while (true) {
    const response = await fetch(`${fixedDevWorkerHealthUrl.replace(/\/health$/, '')}/admin/federations/${federationId}/canary-state`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${administratorSecret}` },
      signal: AbortSignal.timeout(5_000),
    });
    // WHAT: Settle external teardown only after the restricted route deletes the complete owned federation.
    // WHY: Partial resource deletion would leave temporary node credentials and Durable Object authority behind.
    if (response.status === 200) {
      const result = await response.json() as { ok?: unknown; deleted?: unknown; federationId?: unknown };
      // WHAT: Require the response to correlate deletion to the exact deterministic canary federation.
      // WHY: An unrelated successful administration response cannot discharge cleanup ownership.
      if (result.ok === true && result.deleted === true && result.federationId === federationId) return;
      throw new ReleaseCanaryHarnessError('release_canary_worker_cleanup_invalid', 'env.dev returned invalid federation cleanup evidence.');
    }
    // WHAT: Retry only the bounded node-disconnect admission window.
    // WHY: Closed child sockets may remain observable briefly, while every other failure must remain explicit.
    if (response.status !== 409 || Date.now() >= deadline) {
      throw new ReleaseCanaryHarnessError('release_canary_worker_cleanup_failed', `env.dev federation cleanup failed with HTTP ${response.status}.`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
}

function workerPhase(input: {
  manifest: ReleaseCanaryManifest;
  release: ReleaseCanaryGitReceipt;
  deployment: ReleaseCanaryDevWorkerReceipt;
  runtime: { evidence: ReleaseCanaryWorkerRuntimeEvidence };
  restoration: Awaited<ReturnType<typeof restoreReleaseCanaryDevWorker>>;
}): ReleaseCanaryCompletedPhase {
  return phaseArtifact({
    runRoot: input.manifest.runRoot,
    phase: 'worker-runtime',
    evidence: {
      release: {
        candidateSha: input.release.candidateSha,
        mainSha: input.release.mainSha,
        releaseSha: input.release.releaseSha,
        releaseTag: input.release.releaseTag,
      },
      deployment: input.deployment,
      runtime: input.runtime.evidence.evidence,
      restoration: input.restoration,
    },
  });
}

function reconnectPhase(input: {
  manifest: ReleaseCanaryManifest;
  runtime: ReleaseCanaryRuntimeReceipt;
}): ReleaseCanaryCompletedPhase {
  return phaseArtifact({
    runRoot: input.manifest.runRoot,
    phase: 'reconnect-quiescence',
    evidence: {
      baseline: input.runtime.evidence.evidence.baseline,
      candidate: {
        candidateSha: input.runtime.evidence.evidence.candidate.candidateSha,
        reconnectCount: input.runtime.evidence.evidence.candidate.reconnectCount,
        reconnectRepairFrames: input.runtime.evidence.evidence.candidate.reconnectRepairFrames,
      },
      termuxRuntimeReceiptId: input.runtime.receiptId,
    },
  });
}

export async function proveReleaseCanaryCompletedPhases(input: {
  repositoryRoot: string;
  primaryRepositoryRoot: string;
  manifest: ReleaseCanaryManifest;
  release: ReleaseCanaryGitReceipt;
  effects?: Partial<ReleaseCanaryProofOrchestratorEffects>;
}): Promise<ReleaseCanaryCompletedPhases> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const primaryRepositoryRoot = resolve(input.primaryRepositoryRoot);
  const effects = { ...defaultEffects, ...(input.effects ?? {}) };
  const currentManifest = readReleaseCanaryManifest({ repositoryRoot, runId: input.manifest.runId });
  // WHAT: Bind orchestration to the exact manifest and release proof already returned by earlier phases.
  // WHY: A caller cannot redirect runtime or external cleanup to another canary run.
  if (currentManifest.manifestFile !== input.manifest.manifestFile
    || currentManifest.release?.receiptId !== input.release.receiptId) {
    throw new ReleaseCanaryHarnessError('release_canary_orchestration_identity_invalid', 'Canary manifest and release proof do not match.');
  }
  const runtimeRecovery = await effects.proveRuntimeRecovery({ manifest: currentManifest });
  const termuxRuntime = await effects.proveTermuxRuntime({
    repositoryRoot,
    runId: currentManifest.runId,
    candidateSha: input.release.candidateSha,
  });
  const releaseWorktree = resolve(input.release.sandboxRoot, 'release-checkout');
  installFixedReleaseDependencies({ primaryRepositoryRoot, releaseWorktree, runRoot: currentManifest.runRoot });
  const environment = loadFixedCanaryEnvironment(primaryRepositoryRoot);
  const lock = await acquireRepositoryMutationLock({
    repositoryRoot: primaryRepositoryRoot,
    purpose: `decision-os-release-canary:env-dev:${currentManifest.runId}`,
  });
  let deployment: ReleaseCanaryDevWorkerReceipt | null = null;
  let workerRuntime: Awaited<ReturnType<typeof proveReleaseCanaryDevWorkerRuntime>> | null = null;
  let restoration: Awaited<ReturnType<typeof restoreReleaseCanaryDevWorker>> | null = null;
  let operationError: unknown = null;
  let externalTeardownFailed = false;
  try {
    deployment = await effects.deployDevWorker({
      repositoryRoot,
      runId: currentManifest.runId,
      releaseWorktree,
      mainSha: input.release.mainSha,
      environment,
      readHealth: effects.readHealth,
    });
    workerRuntime = await effects.proveWorkerRuntime({
      repositoryRoot,
      runId: currentManifest.runId,
      candidateSha: input.release.candidateSha,
      environment,
    });
  } catch (error) {
    operationError = error;
  } finally {
    try {
      // WHAT: Tear down the unique ephemeral canary federation when activated Worker runtime proof fails.
      // WHY: A terminated test process may not reach its after-hook, but its isolated test resources remain harness-owned.
      if (operationError && deployment) {
        try {
          await teardownFailedDevWorkerFederation({ manifest: currentManifest, release: input.release, environment });
        } catch (cleanupError) {
          externalTeardownFailed = true;
          operationError = new AggregateError([operationError, cleanupError], 'env.dev runtime and cleanup failed.');
        }
      }
      const retainedWorker = readReleaseCanaryManifest({ repositoryRoot, runId: currentManifest.runId }).externalWorker;
      // WHAT: Restore recorded Worker authority after success or after failed runtime state was removed.
      // WHY: A cleanup failure must retain the harness-owned version so explicit cleanup can still reach its restricted teardown route.
      if (retainedWorker && !externalTeardownFailed) {
        restoration = await effects.restoreDevWorker({
          repositoryRoot,
          runId: currentManifest.runId,
          releaseWorktree,
          failedMainSha: input.release.mainSha,
          priorVersionId: retainedWorker.priorVersionId,
          ownedVersionId: retainedWorker.ownedVersionId,
          environment,
        });
      }
    } finally {
      // WHAT: Release the shared repository mutation lock after every external outcome.
      // WHY: A failed restoration must retain evidence without blocking unrelated future repository recovery.
      lock.release();
    }
  }
  // WHAT: Report the original failed operation only after external restoration settles.
  // WHY: The retained run must preserve its causal failure without skipping shared Worker cleanup.
  if (operationError) throw operationError;
  // WHAT: Reject incomplete runtime or predecessor restoration before writing passed Worker evidence.
  // WHY: Shared env.dev authority and destination reload are inseparable release gates.
  if (!deployment || !workerRuntime || !restoration?.restored || restoration.status !== 'restored') {
    throw new ReleaseCanaryHarnessError('release_canary_worker_proof_incomplete', 'env.dev runtime or restoration proof is incomplete.');
  }
  const finalSourceInventory = inventoryReleaseCanarySource(currentManifest.sourceMasterRoot);
  // WHAT: Require the live source inventory to remain byte-identical to the accepted snapshot authority.
  // WHY: The harness must not prove state preservation from its own copied lanes alone.
  if (!sameInventory(currentManifest.sourceInventory, finalSourceInventory)) {
    throw new ReleaseCanaryHarnessError('release_canary_source_changed_after_proof', 'Source state changed after the canary snapshot.');
  }
  const worker = workerPhase({ manifest: currentManifest, release: input.release, deployment, runtime: workerRuntime, restoration });
  const reconnect = reconnectPhase({ manifest: currentManifest, runtime: termuxRuntime });
  const cleanupReadiness = phaseArtifact({
    runRoot: currentManifest.runRoot,
    phase: 'cleanup-readiness',
    evidence: {
      runId: currentManifest.runId,
      sourceInventory: {
        digest: finalSourceInventory.digest,
        fileCount: finalSourceInventory.fileCount,
        byteCount: finalSourceInventory.byteCount,
      },
      sourceUnchanged: true,
      devWorkerRestored: true,
      manifestOwnedResourceCount: currentManifest.resources.length,
      productionMutationPerformed: false,
    },
  });
  return {
    'watcher-recovery': runtimeRecovery['watcher-recovery'],
    'worker-runtime': worker,
    'termux-runtime': { receiptFile: termuxRuntime.receiptFile, receiptId: termuxRuntime.receiptId },
    'reconnect-quiescence': reconnect,
    'incident-recovery': runtimeRecovery['incident-recovery'],
    'cleanup-readiness': cleanupReadiness,
  };
}

export async function cleanupReleaseCanaryCompletedRun(input: {
  repositoryRoot: string;
  primaryRepositoryRoot: string;
  runId: string;
}): Promise<{ cleaned: boolean; runId: string; status: 'cleaned' | 'external-worker-drift' }> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const primaryRepositoryRoot = resolve(input.primaryRepositoryRoot);
  const manifest = readReleaseCanaryManifest({ repositoryRoot, runId: input.runId });
  // WHAT: Clean a run with no recorded external Worker through the manifest-only path.
  // WHY: Snapshot and local proof failures never acquired shared Cloudflare authority.
  if (!manifest.externalWorker) return await cleanupReleaseCanaryRun({ repositoryRoot, runId: manifest.runId });
  // WHAT: Require the canonical release receipt retained by the same manifest-owned run.
  // WHY: Worker inspection and restoration need the exact release checkout and failed main SHA.
  if (!manifest.release || !inside(manifest.runRoot, manifest.release.receiptFile)) {
    throw new ReleaseCanaryHarnessError('release_canary_cleanup_release_missing', 'Canary release evidence is unavailable for Worker cleanup.');
  }
  const releaseBytes = readFileSync(manifest.release.receiptFile);
  // WHAT: Require the exact regular release artifact recorded before external mutation.
  // WHY: Cleanup authority cannot be reconstructed from substituted or edited evidence.
  if (!lstatSync(manifest.release.receiptFile).isFile()
    || lstatSync(manifest.release.receiptFile).isSymbolicLink()
    || `sha256:${sha256(releaseBytes)}` !== manifest.release.receiptId) {
    throw new ReleaseCanaryHarnessError('release_canary_cleanup_release_tampered', 'Canary release evidence failed integrity validation.');
  }
  const releaseDocument = JSON.parse(releaseBytes.toString('utf8')) as {
    evidence?: { sandboxRoot?: unknown; mainSha?: unknown };
  };
  const sandboxRoot = String(releaseDocument.evidence?.sandboxRoot ?? '');
  const mainSha = String(releaseDocument.evidence?.mainSha ?? '');
  const releaseWorktree = resolve(sandboxRoot, 'release-checkout');
  // WHAT: Reject release evidence that does not resolve inside the owned run or bind the recorded SHA.
  // WHY: Cleanup cannot use editable evidence to redirect Wrangler to another checkout or release.
  if (!inside(manifest.runRoot, releaseWorktree) || mainSha !== manifest.release.mainSha || !/^[a-f0-9]{40}$/.test(mainSha)) {
    throw new ReleaseCanaryHarnessError('release_canary_cleanup_release_invalid', 'Canary release evidence is invalid for Worker cleanup.');
  }
  const environment = loadFixedCanaryEnvironment(primaryRepositoryRoot);
  const lock = await acquireRepositoryMutationLock({
    repositoryRoot: primaryRepositoryRoot,
    purpose: `decision-os-release-canary:cleanup-env-dev:${manifest.runId}`,
  });
  try {
    return await cleanupReleaseCanaryRun({
      repositoryRoot,
      runId: manifest.runId,
      readActiveDevWorkerVersion: async () => {
        const current = await readCurrentCanaryDevRelayDeployment({ releaseWorktree, environment });
        return current.deployment.versionId;
      },
      restoreDevWorkerVersion: async (versionId) => {
        await teardownFailedDevWorkerFederation({
          manifest,
          release: { candidateSha: manifest.release!.candidateSha },
          environment,
        });
        await rollbackCanaryDevRelayVersion({
          releaseWorktree,
          failedMainSha: mainSha,
          priorVersionId: versionId,
          environment,
        });
      },
    });
  } finally {
    // WHAT: Release the shared repository lock after every cleanup outcome.
    // WHY: External drift and restoration failures must retain evidence without deadlocking later recovery.
    lock.release();
  }
}

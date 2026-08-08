/**
 * WHAT: Deploys the production federation relay from one published canonical release tag.
 * WHY: Relay release authority must be a human-readable immutable release tag while runtime compatibility keeps the resolved commit fingerprint.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  deployRelayVersion,
  readCurrentRelayDeployment,
  rollbackRelayVersion,
  uploadRelayVersion,
  verifyRelayReleaseHealth,
  type DeliveryRelayRunner,
} from '../business/delivery/helper/delivery-relay.js';
import {
  runBoundedProcess,
  type BoundedProcessResult,
  type RunBoundedProcessInput,
} from '../business/process/helper/run-bounded-process.js';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const relayHealthEndpoint = 'https://decision-os-federation-relay.ardaria.workers.dev/health';
const productionWorkerName = 'decision-os-federation-relay';
const productionNamespace = 'decision-os-federations-production';

type DeployRelayCommand = { releaseTag: string; json: true };

type DeployRelayReceipt = {
  ok: true;
  releaseTag: string;
  releaseCommit: string;
  priorDeploymentId: string;
  priorVersionId: string;
  versionId: string;
  health: Record<string, unknown>;
};

export class DeployRelayCliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode: 2 | 3 = 3,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DeployRelayCliError';
  }
}

function canonicalTag(value: unknown): string {
  const candidate = String(value ?? '');
  // WHAT: Reject every input except one canonical release tag.
  // WHY: A raw SHA, branch, lightweight alias, and arbitrary ref must never become production release authority.
  if (!/^rel-(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(candidate)) {
    throw new DeployRelayCliError('deploy_relay_tag_invalid', 'Release must be a canonical rel-X.Y.Z tag.', 2);
  }
  return candidate;
}

export function parseDeployRelayArguments(argv: readonly string[]): DeployRelayCommand {
  const releaseTag = canonicalTag(argv[0]);
  // WHAT: Require the fixed machine-readable invocation shape.
  // WHY: Deployment must not accept hidden topology, source, environment, credential, and Wrangler overrides.
  if (argv.length !== 2 || argv[1] !== '--json') {
    throw new DeployRelayCliError('deploy_relay_usage', 'Usage: decision-os-deploy-relay rel-X.Y.Z --json', 2);
  }
  return { releaseTag, json: true };
}

async function processResult(input: RunBoundedProcessInput, runner: DeliveryRelayRunner): Promise<BoundedProcessResult> {
  return await runner(input);
}

async function git(
  args: readonly string[],
  runner: DeliveryRelayRunner,
  acceptedExitCodes: readonly number[] = [0],
): Promise<BoundedProcessResult> {
  const result = await processResult({
    command: 'git',
    args,
    cwd: repositoryRoot,
    deadlineMs: 30_000,
    killGraceMs: 1_000,
    maximumOutputBytes: 1024 * 1024,
    context: { component: 'deploy-relay-admission', operation: args[0] ?? '' },
  }, runner);
  // WHAT: Fail admission when Git did not settle with the exact accepted status.
  // WHY: Missing refs, dirty release paths, and unreachable remote authority must stop before Cloudflare mutation.
  if (!result.ok && !acceptedExitCodes.includes(result.exitCode ?? -1)) {
    throw new DeployRelayCliError('deploy_relay_git_failed', `Git ${args[0] ?? 'command'} failed.`, 3, {
      exitCode: result.exitCode,
      stderr: result.stderr.trim(),
    });
  }
  return result;
}

function output(result: BoundedProcessResult): string {
  return result.stdout.trim();
}

function parseRemoteRefs(value: string): Map<string, string> {
  const refs = new Map<string, string>();
  for (const line of value.split(/\r?\n/)) {
    const [sha, ref] = line.trim().split(/\s+/, 2);
    // WHAT: Retain only structurally valid remote ref evidence.
    // WHY: Malformed or diagnostic output cannot authorize a production deployment.
    if (/^[a-f0-9]{40}$/.test(sha ?? '') && ref) refs.set(ref, sha);
  }
  return refs;
}

async function admitReleaseTag(input: {
  releaseTag: string;
  cwd: string;
  runner: DeliveryRelayRunner;
}): Promise<string> {
  // WHAT: Restrict the command to the canonical primary checkout.
  // WHY: Deployment source must be the operator-owned main checkout, never a detached release worktree.
  if (resolve(input.cwd) !== repositoryRoot) {
    throw new DeployRelayCliError('deploy_relay_checkout_invalid', `Run from ${repositoryRoot}.`, 2);
  }
  const branch = output(await git(['symbolic-ref', '--quiet', '--short', 'HEAD'], input.runner));
  // WHAT: Admit only the main branch.
  // WHY: The complementary merge and deployment commands share one canonical production checkout boundary.
  if (branch !== 'main') throw new DeployRelayCliError('deploy_relay_branch_invalid', 'Relay deployment requires branch main.', 2);

  const tagType = output(await git(['cat-file', '-t', `refs/tags/${input.releaseTag}`], input.runner));
  // WHAT: Require an annotated tag object.
  // WHY: Lightweight tags do not carry the release boundary created by the merge tool.
  if (tagType !== 'tag') throw new DeployRelayCliError('deploy_relay_tag_not_annotated', 'Release tag must be annotated.', 2);
  const releaseCommit = output(await git(['rev-list', '-n', '1', `refs/tags/${input.releaseTag}`], input.runner));
  // WHAT: Require the tag to resolve to one exact commit fingerprint.
  // WHY: Runtime federation compatibility still compares the source commit while the operator selects the tag.
  if (!/^[a-f0-9]{40}$/.test(releaseCommit)) {
    throw new DeployRelayCliError('deploy_relay_tag_target_invalid', 'Release tag does not resolve to a commit.', 2);
  }

  const head = output(await git(['rev-parse', 'HEAD'], input.runner));
  const remoteResult = await git([
    'ls-remote', '--exit-code', 'origin',
    'refs/heads/main',
    `refs/tags/${input.releaseTag}`,
    `refs/tags/${input.releaseTag}^{}`,
  ], input.runner);
  const remoteRefs = parseRemoteRefs(remoteResult.stdout);
  // WHAT: Require the canonical checkout itself to be published.
  // WHY: The deployment tool must be reproducible from origin before it mutates production.
  if (remoteRefs.get('refs/heads/main') !== head) {
    throw new DeployRelayCliError('deploy_relay_main_unpublished', 'Current main HEAD is not published at origin/main.', 2);
  }
  // WHAT: Require the exact annotated tag target to be published.
  // WHY: A local-only or moved release tag cannot authorize production.
  if (remoteRefs.get(`refs/tags/${input.releaseTag}^{}`) !== releaseCommit) {
    throw new DeployRelayCliError('deploy_relay_tag_unpublished', 'Release tag target is not published on origin.', 2);
  }

  const ancestry = await git(['merge-base', '--is-ancestor', releaseCommit, head], input.runner, [0, 1]);
  // WHAT: Require the release tag to be an ancestor of current main.
  // WHY: A tag from another release line cannot select bytes from the canonical production checkout.
  if (ancestry.exitCode !== 0) {
    throw new DeployRelayCliError('deploy_relay_tag_not_on_main', 'Release tag is not an ancestor of current main.', 2);
  }
  const changedReleasePaths = output(await git([
    'diff', '--name-only', releaseCommit, '--', 'federation-relay', 'shared',
  ], input.runner));
  // WHAT: Require the canonical checkout relay inputs to match the selected release tag exactly.
  // WHY: The script may be added after the tag, but deployed Worker bytes must still be tag-owned.
  if (changedReleasePaths) {
    throw new DeployRelayCliError('deploy_relay_tag_tree_mismatch', 'Relay inputs differ from the selected release tag.', 2, {
      paths: changedReleasePaths.split(/\r?\n/),
    });
  }
  const dirtyReleasePaths = output(await git([
    'status', '--porcelain=v1', '--untracked-files=all', '--', 'federation-relay', 'shared',
  ], input.runner));
  // WHAT: Reject local relay input dirt.
  // WHY: Uncommitted bytes have no release tag authority.
  if (dirtyReleasePaths) {
    throw new DeployRelayCliError('deploy_relay_tree_dirty', 'Relay inputs contain uncommitted changes.', 2, {
      status: dirtyReleasePaths.split(/\r?\n/),
    });
  }
  return releaseCommit;
}

async function relayEnvironment(runner: DeliveryRelayRunner): Promise<NodeJS.ProcessEnv> {
  const environment = { ...process.env };
  const credentialFile = resolve(repositoryRoot, '.env');
  // WHAT: Use explicit process credentials without reading a local file when both values already exist.
  // WHY: Existing non-interactive credentials are the narrowest credential source.
  if (environment.CLOUDFLARE_API_TOKEN && environment.CLOUDFLARE_ACCOUNT_ID) return environment;
  // WHAT: Stop when the canonical ignored credential file is absent.
  // WHY: The deploy command never accepts credentials or alternate credential paths as arguments.
  if (!existsSync(credentialFile)) {
    throw new DeployRelayCliError('deploy_relay_credentials_missing', 'Cloudflare deployment credentials are not configured.', 2);
  }
  const ignored = await git(['check-ignore', '--quiet', '.env'], runner, [0, 1]);
  // WHAT: Read the credential file only when Git proves it ignored.
  // WHY: Production tokens must never be eligible for commit.
  if (ignored.exitCode !== 0) {
    throw new DeployRelayCliError('deploy_relay_credentials_not_ignored', 'Repository .env is not Git-ignored.', 2);
  }
  for (const line of readFileSync(credentialFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)\s*=\s*(.*?)\s*$/);
    // WHAT: Ignore unrelated and malformed environment lines.
    // WHY: Relay deployment owns only the two fixed Cloudflare credential names.
    if (!match) continue;
    const key = match[1];
    // WHAT: Preserve a credential already provided by the process environment.
    // WHY: The explicit process environment has precedence over the ignored file.
    if (environment[key]) continue;
    environment[key] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  // WHAT: Reject incomplete Cloudflare authority.
  // WHY: Wrangler requires both a token and account identity for deterministic non-interactive deployment.
  if (!environment.CLOUDFLARE_API_TOKEN || !environment.CLOUDFLARE_ACCOUNT_ID) {
    throw new DeployRelayCliError('deploy_relay_credentials_missing', 'Cloudflare deployment credentials are incomplete.', 2);
  }
  return environment;
}

async function readHealth(signal: AbortSignal, fetchImplementation: typeof fetch): Promise<Record<string, unknown>> {
  const response = await fetchImplementation(relayHealthEndpoint, {
    headers: { accept: 'application/json' },
    signal,
  });
  // WHAT: Reject non-success relay health responses.
  // WHY: HTTP failure is not production readiness evidence.
  if (!response.ok) throw new Error(`Relay health returned HTTP ${response.status}.`);
  const value = await response.json() as unknown;
  // WHAT: Require a JSON object health document.
  // WHY: Text, arrays, and null cannot prove exact release identity.
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Relay health response is invalid.');
  return value as Record<string, unknown>;
}

async function waitForReleaseHealth(input: {
  expectedReleaseSha: string;
  fetchImplementation: typeof fetch;
}): Promise<Record<string, unknown>> {
  const health = await verifyRelayReleaseHealth({
    expectedReleaseSha: input.expectedReleaseSha,
    deadlineMs: 45_000,
    readHealth: async (signal) => {
      let last: Record<string, unknown> = {};
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          last = await readHealth(signal, input.fetchImplementation);
          // WHAT: Return as soon as the activated commit fingerprint is visible.
          // WHY: Cloudflare health may briefly expose the predecessor during global activation propagation.
          if (last.releaseSha === input.expectedReleaseSha) return last;
        } catch (error) {
          // WHAT: Stop retrying when the owning verification deadline cancels the request.
          // WHY: Cancellation must propagate through health polling.
          if (signal.aborted) throw error;
        }
        await new Promise<void>((resolveDelay, rejectDelay) => {
          const cancel = (): void => {
            clearTimeout(timer);
            rejectDelay(new Error('delivery_relay_health_cancelled'));
          };
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', cancel);
            resolveDelay();
          }, 1_000);
          signal.addEventListener('abort', cancel, { once: true });
        });
      }
      return last;
    },
  });
  // WHAT: Require the production Worker and Durable Object namespace identities.
  // WHY: Compatible health from dev or another Worker is not production deployment proof.
  if (
    health.environment !== 'production'
    || health.workerName !== productionWorkerName
    || health.durableObjectNamespace !== productionNamespace
  ) {
    throw new DeployRelayCliError('deploy_relay_health_identity_mismatch', 'Relay health reports the wrong production identity.');
  }
  return health;
}

async function verifyObservedProductionHealth(health: Record<string, unknown>): Promise<string> {
  const releaseSha = String(health.releaseSha ?? '');
  // WHAT: Require one exact predecessor compatibility fingerprint before mutation.
  // WHY: Automatic rollback cannot be verified without the active predecessor release identity.
  if (!/^[a-f0-9]{40}$/.test(releaseSha)) {
    throw new DeployRelayCliError('deploy_relay_prior_health_invalid', 'Current relay health has no valid release fingerprint.', 2);
  }
  await verifyRelayReleaseHealth({
    expectedReleaseSha: releaseSha,
    readHealth: async () => health,
  });
  // WHAT: Require the observed predecessor to be the production relay identity.
  // WHY: Deployment must not capture rollback authority from dev or another Worker.
  if (
    health.environment !== 'production'
    || health.workerName !== productionWorkerName
    || health.durableObjectNamespace !== productionNamespace
  ) {
    throw new DeployRelayCliError('deploy_relay_prior_health_identity_mismatch', 'Current relay health reports the wrong production identity.', 2);
  }
  return releaseSha;
}

export async function deployRelayFromTag(input: {
  releaseTag: string;
  cwd?: string;
  runner?: DeliveryRelayRunner;
  fetchImplementation?: typeof fetch;
}): Promise<DeployRelayReceipt> {
  const releaseTag = canonicalTag(input.releaseTag);
  const runner = input.runner ?? runBoundedProcess;
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const releaseCommit = await admitReleaseTag({
    releaseTag,
    cwd: input.cwd ?? process.cwd(),
    runner,
  });
  const environment = await relayEnvironment(runner);
  const prior = await readCurrentRelayDeployment({ releaseWorktree: repositoryRoot, environment, runner });
  const priorHealth = await readHealth(AbortSignal.timeout(10_000), fetchImplementation);
  const priorReleaseSha = await verifyObservedProductionHealth(priorHealth);
  const uploaded = await uploadRelayVersion({
    releaseWorktree: repositoryRoot,
    mainSha: releaseCommit,
    releaseTag,
    environment,
    runner,
  });
  let activated = false;
  try {
    await deployRelayVersion({
      releaseWorktree: repositoryRoot,
      mainSha: releaseCommit,
      releaseTag,
      versionId: uploaded.versionId,
      environment,
      runner,
    });
    activated = true;
    const health = await waitForReleaseHealth({ expectedReleaseSha: releaseCommit, fetchImplementation });
    return {
      ok: true,
      releaseTag,
      releaseCommit,
      priorDeploymentId: prior.deployment.deploymentId,
      priorVersionId: prior.deployment.versionId,
      versionId: uploaded.versionId,
      health,
    };
  } catch (error) {
    // WHAT: Restore the captured predecessor after a completed activation fails verification.
    // WHY: A newly active relay without exact healthy release evidence must not remain in production.
    if (activated) {
      await rollbackRelayVersion({
        releaseWorktree: repositoryRoot,
        failedMainSha: releaseCommit,
        releaseTag,
        priorVersionId: prior.deployment.versionId,
        environment,
        runner,
      });
      await waitForReleaseHealth({ expectedReleaseSha: priorReleaseSha, fetchImplementation });
    }
    throw error;
  }
}

export async function runDeployRelayCli(input: {
  argv: readonly string[];
  cwd?: string;
  runner?: DeliveryRelayRunner;
  fetchImplementation?: typeof fetch;
  write?: (value: string) => void;
}): Promise<number> {
  const write = input.write ?? ((value) => process.stdout.write(value));
  try {
    const command = parseDeployRelayArguments(input.argv);
    const receipt = await deployRelayFromTag({
      releaseTag: command.releaseTag,
      cwd: input.cwd,
      runner: input.runner,
      fetchImplementation: input.fetchImplementation,
    });
    write(`${JSON.stringify(receipt)}\n`);
    return 0;
  } catch (error) {
    const failure = error instanceof DeployRelayCliError
      ? error
      : new DeployRelayCliError('deploy_relay_failed', error instanceof Error ? error.message : String(error));
    write(`${JSON.stringify({ ok: false, code: failure.code, message: failure.message, context: failure.context })}\n`);
    return failure.exitCode;
  }
}

// WHAT: Execute only when this module is the direct CLI entry point.
// WHY: Tests import the command with injected Git, Wrangler, and health boundaries.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runDeployRelayCli({ argv: process.argv.slice(2) });
}

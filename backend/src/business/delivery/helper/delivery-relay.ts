/**
 * WHAT: Runs pinned Wrangler relay list, upload, activation, rollback, and release-health verification commands.
 * WHY: Delivery must use deterministic argv, bounded children, exact release worktrees, and redacted evidence.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runBoundedProcess,
  type BoundedProcessResult,
  type RunBoundedProcessInput,
} from '../../process/helper/run-bounded-process.js';
import {
  taskCurrentBaselineEpoch,
  taskCurrentStateVersion,
  taskStateProtocol,
} from '../../task-state/helper/task-current-state-types.js';
import { decisionOsDeliveryProtocol } from '../../../../../shared/schemas/decision-os-delivery-types.js';
import {
  redactDeliverySecret,
  redactDeliveryText,
} from './delivery-redactor.js';
import { runDeliveryOperationBoundary } from './run-delivery-operation-boundary.js';

const pinnedWranglerVersion = '4.111.0';
const productionWorkerName = 'decision-os-federation-relay';

export type DeliveryRelayRunner = (input: RunBoundedProcessInput) => Promise<BoundedProcessResult>;

export type RelayDeployment = {
  deploymentId: string;
  versionId: string;
  createdAt: string;
};

export type RelayVersionAuthority = {
  versionId: string;
  releaseSha: string | null;
  tag: string;
  createdAt: string;
};

export type RelayCommandReceipt = {
  operation: 'list' | 'upload' | 'deploy' | 'rollback';
  redactedArguments: string[];
  workerName: string;
  releaseSha: string | null;
  deploymentId: string | null;
  versionId: string | null;
};

export class DeliveryRelayError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DeliveryRelayError';
  }
}

type WranglerContext = {
  relayRoot: string;
  configFile: string;
  command: string;
  commonArguments: string[];
  environment: NodeJS.ProcessEnv;
  token: string;
};

function sha(value: unknown, field: string): string {
  const candidate = String(value ?? '');
  if (!/^[a-f0-9]{40}$/.test(candidate)) {
    throw new DeliveryRelayError('delivery_relay_release_sha_invalid', `${field} must be a lowercase 40-character Git SHA.`);
  }
  return candidate;
}

function identifier(value: unknown, field: string): string {
  const candidate = String(value ?? '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(candidate)) {
    throw new DeliveryRelayError('delivery_relay_identity_invalid', `${field} is not a stable identity.`);
  }
  return candidate;
}

function wranglerContext(input: {
  releaseWorktree: string;
  environment?: NodeJS.ProcessEnv;
}): WranglerContext {
  const releaseWorktree = resolve(input.releaseWorktree);
  const relayRoot = resolve(releaseWorktree, 'federation-relay');
  const packageFile = resolve(relayRoot, 'package.json');
  const packageDocument = JSON.parse(readFileSync(packageFile, 'utf8')) as {
    devDependencies?: Record<string, string>;
  };
  if (packageDocument.devDependencies?.wrangler !== pinnedWranglerVersion) {
    throw new DeliveryRelayError(
      'delivery_relay_wrangler_version_mismatch',
      `Relay delivery requires Wrangler ${pinnedWranglerVersion}.`,
      { observedVersion: packageDocument.devDependencies?.wrangler ?? '' },
    );
  }
  const environment = { ...(input.environment ?? process.env) };
  const token = String(environment.CLOUDFLARE_API_TOKEN ?? '').trim();
  const accountId = String(environment.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
  if (!token || !accountId) {
    throw new DeliveryRelayError('delivery_relay_credentials_missing', 'Cloudflare delivery credentials are not configured.');
  }
  return {
    relayRoot,
    configFile: resolve(relayRoot, 'wrangler.toml'),
    command: process.execPath,
    commonArguments: [
      resolve(relayRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
      '--config',
      resolve(relayRoot, 'wrangler.toml'),
      '--name',
      productionWorkerName,
    ],
    environment,
    token,
  };
}

async function wrangler(input: {
  context: WranglerContext;
  operation: RelayCommandReceipt['operation'];
  arguments: string[];
  runner: DeliveryRelayRunner;
  signal?: AbortSignal;
}): Promise<{ result: BoundedProcessResult; redactedArguments: string[] }> {
  const args = [input.context.commonArguments[0], ...input.arguments, ...input.context.commonArguments.slice(1)];
  const result = await input.runner({
    command: input.context.command,
    args,
    cwd: input.context.relayRoot,
    env: input.context.environment,
    deadlineMs: input.operation === 'upload' ? 5 * 60_000 : 60_000,
    killGraceMs: 2_000,
    maximumOutputBytes: 1024 * 1024,
    signal: input.signal,
    context: { component: 'delivery-relay', operation: input.operation },
  });
  if (!result.ok) {
    const detail = redactDeliveryText(redactDeliverySecret(
      result.stderr.trim() || result.stdout.trim() || result.spawnError || result.termination || `exit ${result.exitCode}`,
      input.context.token,
    ));
    throw new DeliveryRelayError(`delivery_relay_${input.operation}_failed`, `Wrangler ${input.operation} failed: ${detail}.`);
  }
  return {
    result: {
      ...result,
      stdout: redactDeliverySecret(result.stdout, input.context.token),
      stderr: redactDeliverySecret(result.stderr, input.context.token),
      spawnError: result.spawnError ? redactDeliverySecret(result.spawnError, input.context.token) : null,
    },
    redactedArguments: args.map((argument) => redactDeliverySecret(argument, input.context.token)),
  };
}

function parseDeployments(output: string): RelayDeployment[] {
  let document: unknown;
  try {
    document = JSON.parse(output);
  } catch {
    throw new DeliveryRelayError('delivery_relay_deployment_evidence_invalid', 'Wrangler deployment output is not valid JSON.');
  }
  if (!Array.isArray(document)) {
    throw new DeliveryRelayError('delivery_relay_deployment_evidence_invalid', 'Wrangler deployment output is not an array.');
  }
  return document.map((entryInput) => {
    const entry = entryInput && typeof entryInput === 'object' ? entryInput as Record<string, unknown> : {};
    const versions = Array.isArray(entry.versions) ? entry.versions as Array<Record<string, unknown>> : [];
    const active = versions.filter((version) => Number(version.percentage) === 100);
    if (active.length !== 1) {
      throw new DeliveryRelayError(
        'delivery_relay_deployment_evidence_invalid',
        'A relay deployment must identify exactly one version at 100 percent traffic.',
      );
    }
    const createdAt = String(entry.created_on ?? '');
    if (!Number.isFinite(Date.parse(createdAt))) {
      throw new DeliveryRelayError('delivery_relay_deployment_evidence_invalid', 'Relay deployment created_on is invalid.');
    }
    return {
      deploymentId: identifier(entry.id, 'deploymentId'),
      versionId: identifier(active[0].version_id, 'versionId'),
      createdAt: new Date(Date.parse(createdAt)).toISOString(),
    };
  }).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function parseVersions(output: string): RelayVersionAuthority[] {
  let document: unknown;
  try {
    document = JSON.parse(output);
  } catch {
    throw new DeliveryRelayError('delivery_relay_version_evidence_invalid', 'Wrangler version output is not valid JSON.');
  }
  const entries = Array.isArray(document)
    ? document
    : document && typeof document === 'object' && Array.isArray((document as { items?: unknown }).items)
      ? (document as { items: unknown[] }).items
      : null;
  if (!entries) {
    throw new DeliveryRelayError('delivery_relay_version_evidence_invalid', 'Wrangler version output is not an array.');
  }
  return entries.map((entryValue) => {
    const entry = entryValue && typeof entryValue === 'object' ? entryValue as Record<string, unknown> : {};
    const annotations = entry.annotations && typeof entry.annotations === 'object'
      ? entry.annotations as Record<string, unknown>
      : {};
    const tag = String(entry.tag ?? annotations['workers/tag'] ?? '');
    const message = String(entry.message ?? annotations['workers/message'] ?? '');
    const releaseSha = `${tag} ${message}`.match(/\b([a-f0-9]{40})\b/)?.[1] ?? null;
    const createdAtValue = String(entry.created_on ?? entry.createdAt ?? '');
    if (!Number.isFinite(Date.parse(createdAtValue))) {
      throw new DeliveryRelayError('delivery_relay_version_evidence_invalid', 'Relay version created timestamp is invalid.');
    }
    return {
      versionId: identifier(entry.id ?? entry.version_id, 'versionId'),
      releaseSha,
      tag,
      createdAt: new Date(Date.parse(createdAtValue)).toISOString(),
    };
  });
}

export async function readRelayAuthority(input: {
  releaseWorktree: string;
  runner?: DeliveryRelayRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<{
  deployment: RelayDeployment;
  deployments: RelayDeployment[];
  versions: RelayVersionAuthority[];
}> {
  const context = wranglerContext(input);
  const runner = input.runner ?? runBoundedProcess;
  const [deploymentResult, versionResult] = await Promise.all([
    wrangler({
      context,
      operation: 'list',
      arguments: ['deployments', 'list', '--json'],
      runner,
      signal: input.signal,
    }),
    wrangler({
      context,
      operation: 'list',
      arguments: ['versions', 'list', '--json'],
      runner,
      signal: input.signal,
    }),
  ]);
  const deployments = parseDeployments(deploymentResult.result.stdout);
  const deployment = deployments.at(-1);
  if (!deployment) throw new DeliveryRelayError('delivery_relay_deployment_missing', 'No production relay deployment exists.');
  return {
    deployment,
    deployments,
    versions: parseVersions(versionResult.result.stdout),
  };
}

export async function readCurrentRelayDeployment(input: {
  releaseWorktree: string;
  runner?: DeliveryRelayRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<{ deployment: RelayDeployment; receipt: RelayCommandReceipt }> {
  const context = wranglerContext(input);
  const { result, redactedArguments } = await wrangler({
    context,
    operation: 'list',
    arguments: ['deployments', 'list', '--json'],
    runner: input.runner ?? runBoundedProcess,
    signal: input.signal,
  });
  const deployment = parseDeployments(result.stdout).at(-1);
  if (!deployment) {
    throw new DeliveryRelayError('delivery_relay_deployment_missing', 'No production relay deployment exists.');
  }
  return {
    deployment,
    receipt: {
      operation: 'list',
      redactedArguments,
      workerName: productionWorkerName,
      releaseSha: null,
      deploymentId: deployment.deploymentId,
      versionId: deployment.versionId,
    },
  };
}

export async function uploadRelayVersion(input: {
  releaseWorktree: string;
  mainSha: string;
  runner?: DeliveryRelayRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<{ versionId: string; receipt: RelayCommandReceipt }> {
  const mainSha = sha(input.mainSha, 'mainSha');
  const context = wranglerContext(input);
  const { result, redactedArguments } = await wrangler({
    context,
    operation: 'upload',
    arguments: [
      'versions',
      'upload',
      '--strict',
      '--var',
      `DECISION_OS_RELEASE_SHA:${mainSha}`,
      '--tag',
      `decision-os-${mainSha}`,
      '--message',
      `Decision OS relay ${mainSha}`,
    ],
    runner: input.runner ?? runBoundedProcess,
    signal: input.signal,
  });
  const versionId = result.stdout.match(/Worker Version ID:\s*([A-Za-z0-9][A-Za-z0-9._:-]*)/)?.[1] ?? '';
  identifier(versionId, 'versionId');
  return {
    versionId,
    receipt: {
      operation: 'upload',
      redactedArguments,
      workerName: productionWorkerName,
      releaseSha: mainSha,
      deploymentId: null,
      versionId,
    },
  };
}

export async function deployRelayVersion(input: {
  releaseWorktree: string;
  mainSha: string;
  versionId: string;
  runner?: DeliveryRelayRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<RelayCommandReceipt> {
  const mainSha = sha(input.mainSha, 'mainSha');
  const versionId = identifier(input.versionId, 'versionId');
  const context = wranglerContext(input);
  const { redactedArguments } = await wrangler({
    context,
    operation: 'deploy',
    arguments: [
      'versions',
      'deploy',
      `${versionId}@100%`,
      '--yes',
      '--message',
      `Activate Decision OS relay ${mainSha}`,
    ],
    runner: input.runner ?? runBoundedProcess,
    signal: input.signal,
  });
  return {
    operation: 'deploy',
    redactedArguments,
    workerName: productionWorkerName,
    releaseSha: mainSha,
    deploymentId: null,
    versionId,
  };
}

export async function rollbackRelayVersion(input: {
  releaseWorktree: string;
  failedMainSha: string;
  priorVersionId: string;
  runner?: DeliveryRelayRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<RelayCommandReceipt> {
  const failedMainSha = sha(input.failedMainSha, 'failedMainSha');
  const priorVersionId = identifier(input.priorVersionId, 'priorVersionId');
  const context = wranglerContext(input);
  const { redactedArguments } = await wrangler({
    context,
    operation: 'rollback',
    arguments: [
      'rollback',
      priorVersionId,
      '--yes',
      '--message',
      `Rollback Decision OS relay ${failedMainSha}`,
    ],
    runner: input.runner ?? runBoundedProcess,
    signal: input.signal,
  });
  return {
    operation: 'rollback',
    redactedArguments,
    workerName: productionWorkerName,
    releaseSha: failedMainSha,
    deploymentId: null,
    versionId: priorVersionId,
  };
}

export async function verifyRelayReleaseHealth(input: {
  expectedReleaseSha: string;
  readHealth: (signal: AbortSignal) => Promise<unknown>;
  signal?: AbortSignal;
  deadlineMs?: number;
}): Promise<Record<string, unknown>> {
  const expectedReleaseSha = sha(input.expectedReleaseSha, 'expectedReleaseSha');
  try {
    const value = await runDeliveryOperationBoundary({
      deadlineMs: input.deadlineMs ?? 10_000,
      maximumDeadlineMs: 60_000,
      signal: input.signal,
      cancellationError: () => new Error('delivery_relay_health_cancelled'),
      timeoutError: () => new Error('delivery_relay_health_timeout'),
      execute: input.readHealth,
    });
    const health = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    if (
      health.ok !== true
      || health.status !== 'ready'
      || health.releaseSha !== expectedReleaseSha
      || health.deliveryProtocol !== decisionOsDeliveryProtocol
      || health.protocolVersion !== 1
      || health.stateProtocol !== taskStateProtocol
      || health.stateSchema !== taskCurrentStateVersion
      || health.baselineEpoch !== taskCurrentBaselineEpoch
    ) {
      throw new DeliveryRelayError('delivery_relay_health_mismatch', 'Relay health does not match the deployed release and protocol.');
    }
    return health;
  } catch (error) {
    if (error instanceof DeliveryRelayError) throw error;
    const code = String(error).includes('timeout')
      ? 'delivery_relay_health_timeout'
      : input.signal?.aborted
        ? 'delivery_relay_health_cancelled'
        : 'delivery_relay_health_unavailable';
    throw new DeliveryRelayError(code, error instanceof Error ? error.message : String(error));
  }
}

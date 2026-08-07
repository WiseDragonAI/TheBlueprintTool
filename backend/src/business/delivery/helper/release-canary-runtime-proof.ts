/**
 * WHAT: Runs the copied-state federation canary through real epoch-4 stores, connectors, replicators, and the Termux relay.
 * WHY: Release admission needs behavioral receipts for the rel-0.3.12 replay and candidate convergence, not synthetic hashes.
 */
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { readProjectRegistry } from '../../server/helper/project-registry.js';
import { readReleaseCanaryManifest, ReleaseCanaryHarnessError } from './release-canary-harness.js';

type CommandEvidence = {
  name: string;
  status: 'passed';
  exitCode: 0;
  stdoutFile: string;
  stderrFile: string;
  stdoutSha256: string;
  stderrSha256: string;
};

export type ReleaseCanaryRuntimeEvidence = {
  phase: 'termux-runtime';
  status: 'passed';
  evidence: {
    baseline: { releaseTag: 'rel-0.3.12'; releaseSha: string; reconnectCount: 2; reconnectRepairFrames: number; reconnectRepairBytes: number; repairRecordStable: boolean };
    candidate: {
      candidateSha: string;
      reconnectCount: number;
      reconnectRepairFrames: number;
      reconnectRepairBytes: number;
      repairRecordStable: boolean;
      augmentationProjectId: string;
      registryProjects: Array<{ projectId: string; state: 'task-state' | 'no-task-state' }>;
      sourceCountBeforeAugmentation: number;
      syntheticCount: number;
      entityCount: number;
      bucketCount: 256;
      encodedBytes: number;
      totalEntityCount: number;
      totalDurableBytes: number;
      sourceRoot: string;
      replicaRoot: string;
      destinationReloadEqual: true;
      copiedProjects: Array<{ projectId: string; originalEntityCount: number; originalDurableEntityCount: number; originalHeldEntityCount: number; originalRoot: string; originalEntityInventorySha256: string }>;
      sourceProjects: Array<{ projectId: string; entityCount: number; root: string }>;
      reloadedProjects: Array<{ projectId: string; entityCount: number; root: string }>;
    };
    collisionRecovery: {
      terminalPause: boolean;
      reconnectRetryCount: number;
      oneSuccessor: boolean;
      equalRootResume: boolean;
      healthyControlProject: boolean;
    };
    commands: CommandEvidence[];
    remoteWorker: { exercised: false; blocker: 'env.dev Worker mutation is outside offline runtime proof authority' };
  };
};

export type ReleaseCanaryRuntimeReceipt = {
  receiptFile: string;
  receiptId: string;
  evidence: ReleaseCanaryRuntimeEvidence;
  phaseReceipts: {
    'termux-runtime': { receiptFile: string; receiptId: string };
    'reconnect-quiescence': { receiptFile: string; receiptId: string };
    'incident-recovery': { receiptFile: string; receiptId: string };
  };
};

export type ReleaseCanaryWorkerRuntimeEvidence = {
  phase: 'worker-runtime';
  status: 'passed';
  evidence: {
    relayUrl: 'https://decision-os-federation-relay-dev.ardaria.workers.dev';
    relayRuntime: 'cloudflare-worker-env-dev';
    federationId: string;
    candidateSha: string;
    augmentationProjectId: string;
    registryProjects: Array<{ projectId: string; state: 'task-state' | 'no-task-state' }>;
    sourceCountBeforeAugmentation: number;
    syntheticCount: number;
    entityCount: number;
    bucketCount: 256;
    encodedBytes: number;
    totalEntityCount: number;
    totalDurableBytes: number;
    sourceRoot: string;
    replicaRoot: string;
    destinationReloadEqual: true;
    copiedProjects: Array<{ projectId: string; originalEntityCount: number; originalDurableEntityCount: number; originalHeldEntityCount: number; originalRoot: string; originalEntityInventorySha256: string }>;
    sourceProjects: Array<{ projectId: string; entityCount: number; root: string }>;
    reloadedProjects: Array<{ projectId: string; entityCount: number; root: string }>;
    temporaryFederationTeardownConfirmed: boolean;
    command: CommandEvidence;
  };
};

const fixedDevWorkerUrl = 'https://decision-os-federation-relay-dev.ardaria.workers.dev' as const;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function runGit(root: string, args: readonly string[]): string {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  // WHAT: Reject an incomplete local baseline checkout.
  // WHY: Baseline evidence must bind to the exact canonical rel-0.3.12 object.
  if (result.error || result.status !== 0) {
    throw new ReleaseCanaryHarnessError('release_canary_runtime_git_failed', String(result.stderr ?? '').trim() || result.error?.message || 'Local Git operation failed.');
  }
  return String(result.stdout ?? '').trim();
}

function directoryBytes(root: string): number {
  // WHAT: Treat an absent optional task-state directory as empty.
  // WHY: The selected copied project must be determined from available durable state only.
  if (!existsSync(root)) return 0;
  const stat = lstatSync(root);
  // WHAT: Count ordinary files without following copied symlinks.
  // WHY: Runtime selection must stay inside the manifest-owned lane.
  if (stat.isSymbolicLink()) return 0;
  // WHAT: Return the durable byte count for one ordinary file.
  // WHY: The largest real copied project is the highest-yield huge-state source.
  if (stat.isFile()) return stat.size;
  // WHAT: Recurse only through real directories.
  // WHY: Sockets and devices are not accepted snapshot state.
  if (stat.isDirectory()) return readdirSync(root).reduce((total, name) => total + directoryBytes(resolve(root, name)), 0);
  return 0;
}

function selectCopiedTaskState(laneRoot: string): { projectId: string; stateRoot: string } {
  const masterRoot = resolve(laneRoot, '.decision-os');
  const registry = readProjectRegistry(masterRoot);
  // WHAT: Require the copied authoritative registry.
  // WHY: Recursive project discovery could select state outside the accepted snapshot.
  if (!registry) throw new ReleaseCanaryHarnessError('release_canary_runtime_registry_missing', 'Copied canary registry is unavailable.');
  const candidates = Object.values(registry.projects).flatMap((project) => {
    const stateRoot = resolve(laneRoot, project.relativePath, '.decision-os', 'task-state', project.id);
    const formatFile = resolve(stateRoot, 'format.json');
    // WHAT: Admit only an epoch-4 store that can be opened by the real TaskCurrentStateStore.
    // WHY: Authored project files without current state cannot seed Canary A.
    if (!existsSync(formatFile)) return [];
    return [{ projectId: project.id, stateRoot, bytes: directoryBytes(stateRoot) }];
  }).sort((left, right) => right.bytes - left.bytes || left.projectId.localeCompare(right.projectId));
  // WHAT: Require at least one copied current-state store.
  // WHY: Empty synthetic-only state would not prove preservation of main Decision OS state.
  if (!candidates[0]) throw new ReleaseCanaryHarnessError('release_canary_runtime_state_missing', 'No copied task-state store is available.');
  return candidates[0];
}

async function runEvidenceCommand(input: {
  name: string;
  command: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  evidenceRoot: string;
  timeoutMs: number;
}): Promise<{ command: CommandEvidence; stdout: string }> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: input.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      // WHAT: Terminate the exact owned test process at the finite proof deadline.
      // WHY: A stalled connector, relay, or store flush must settle without touching persistent servers.
      if (!settled) child.kill('SIGTERM');
    }, input.timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', (error) => {
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      settled = true;
      clearTimeout(timer);
      const stdoutFile = resolve(input.evidenceRoot, `${input.name}.stdout.log`);
      const stderrFile = resolve(input.evidenceRoot, `${input.name}.stderr.log`);
      writeFileSync(stdoutFile, stdout, { mode: 0o600 });
      writeFileSync(stderrFile, stderr, { mode: 0o600 });
      // WHAT: Reject every nonzero behavioral proof command while retaining its exact logs.
      // WHY: A partial TAP stream cannot become release admission evidence.
      if (code !== 0) {
        reject(new ReleaseCanaryHarnessError('release_canary_runtime_command_failed', `${input.name} exited ${String(code)}. Evidence: ${stdoutFile}, ${stderrFile}.`));
        return;
      }
      resolvePromise({
        stdout,
        command: {
          name: input.name,
          status: 'passed',
          exitCode: 0,
          stdoutFile,
          stderrFile,
          stdoutSha256: sha256(stdout),
          stderrSha256: sha256(stderr),
        },
      });
    });
  });
}

function eventFrom(stdout: string, event: string): Record<string, unknown> {
  for (const line of stdout.split('\n')) {
    try {
      const parsed = JSON.parse(line.trim()) as Record<string, unknown>;
      // WHAT: Return the exact structured runtime event emitted by the behavioral test.
      // WHY: TAP success alone does not expose entity, byte, root, and traffic counters.
      if (parsed.event === event) return parsed;
    } catch {
      // Non-JSON TAP lines are expected around the structured event.
    }
  }
  throw new ReleaseCanaryHarnessError('release_canary_runtime_event_missing', `Runtime event ${event} is missing.`);
}

function integer(value: unknown, field: string): number {
  const result = Number(value);
  // WHAT: Require a non-negative integer counter from the real runtime event.
  // WHY: String placeholders and malformed measurements cannot satisfy proof thresholds.
  if (!Number.isInteger(result) || result < 0) throw new ReleaseCanaryHarnessError('release_canary_runtime_event_invalid', `${field} is invalid.`);
  return result;
}

function registryProjectEvidence(
  value: unknown,
  expected: Array<{ projectId: string; state: 'task-state' | 'no-task-state' }>,
): Array<{ projectId: string; state: 'task-state' | 'no-task-state' }> {
  // WHAT: Require one classified runtime observation for every authoritative registry project.
  // WHY: Synchronizing only the largest project cannot prove complete-state scope, including projects with no task-state yet.
  if (!Array.isArray(value) || value.length !== expected.length) {
    throw new ReleaseCanaryHarnessError('release_canary_runtime_registry_projects_invalid', 'Runtime registry project evidence is incomplete.');
  }
  const observed = value.map((entry) => {
    const document = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const state = String(document.state ?? '');
    // WHAT: Admit only the two manifest-owned project state classifications.
    // WHY: An ambiguous state cannot account for a registry project in release evidence.
    if (state !== 'task-state' && state !== 'no-task-state') {
      throw new ReleaseCanaryHarnessError('release_canary_runtime_registry_projects_invalid', 'Runtime registry project classification is invalid.');
    }
    return { projectId: String(document.projectId ?? ''), state: state as 'task-state' | 'no-task-state' };
  }).sort((left, right) => left.projectId.localeCompare(right.projectId));
  const expectedSorted = [...expected].sort((left, right) => left.projectId.localeCompare(right.projectId));
  // WHAT: Reject omitted, duplicated, added, or reclassified registry identities.
  // WHY: Runtime proof must bind exactly to the immutable snapshot manifest catalog.
  if (JSON.stringify(observed) !== JSON.stringify(expectedSorted)) {
    throw new ReleaseCanaryHarnessError('release_canary_runtime_registry_projects_invalid', 'Runtime registry projects do not match the snapshot manifest.');
  }
  return observed;
}

function projectEvidence(
  value: unknown,
  expectedProjectIds: string[],
): Array<{ projectId: string; originalEntityCount: number; originalDurableEntityCount: number; originalHeldEntityCount: number; originalRoot: string; originalEntityInventorySha256: string }> {
  // WHAT: Require a nonempty per-project copied-state inventory from the real runtime.
  // WHY: Selecting only the largest project would leave the rest of main state unproved.
  if (!Array.isArray(value) || value.length === 0) throw new ReleaseCanaryHarnessError('release_canary_runtime_projects_invalid', 'Copied project evidence is missing.');
  const projects = value.map((entry) => {
    const document = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const projectId = String(document.projectId ?? '');
    const originalRoot = String(document.originalRoot ?? '');
    const originalEntityInventorySha256 = String(document.originalEntityInventorySha256 ?? '');
    // WHAT: Reject malformed project identities and hash evidence.
    // WHY: Each reloaded root must correlate to one exact copied entity inventory.
    if (!projectId || !/^[a-f0-9]{64}$/.test(originalRoot) || !/^[a-f0-9]{64}$/.test(originalEntityInventorySha256)) {
      throw new ReleaseCanaryHarnessError('release_canary_runtime_projects_invalid', 'Copied project evidence is malformed.');
    }
    const originalEntityCount = integer(document.originalEntityCount, `${projectId}.originalEntityCount`);
    const originalDurableEntityCount = integer(document.originalDurableEntityCount, `${projectId}.originalDurableEntityCount`);
    const originalHeldEntityCount = integer(document.originalHeldEntityCount, `${projectId}.originalHeldEntityCount`);
    // WHAT: Require active plus held entities to equal the copied durable entity count.
    // WHY: The A-full snapshot must preserve held state without attempting to federate it into B.
    if (originalEntityCount + originalHeldEntityCount !== originalDurableEntityCount) {
      throw new ReleaseCanaryHarnessError('release_canary_runtime_projects_invalid', `Copied project ${projectId} held-state counts are invalid.`);
    }
    return { projectId, originalEntityCount, originalDurableEntityCount, originalHeldEntityCount, originalRoot, originalEntityInventorySha256 };
  });
  const observedIds = projects.map((project) => project.projectId).sort();
  const expectedIds = [...expectedProjectIds].sort();
  // WHAT: Require exact copied-state evidence for every project classified with task-state.
  // WHY: Synthetic augmentation of one project must remain separate from byte-preservation proof for the complete copied set.
  if (JSON.stringify(observedIds) !== JSON.stringify(expectedIds)) {
    throw new ReleaseCanaryHarnessError('release_canary_runtime_projects_invalid', 'Copied task-state projects do not match the snapshot manifest.');
  }
  return projects;
}

function finalProjectEvidence(value: unknown, copied: ReturnType<typeof projectEvidence>, label: string): Array<{ projectId: string; entityCount: number; root: string }> {
  // WHAT: Require one destination reload observation for every copied project.
  // WHY: An in-memory convergence event does not prove durable B state.
  if (!Array.isArray(value) || value.length !== copied.length) throw new ReleaseCanaryHarnessError('release_canary_runtime_reloads_invalid', `${label} project evidence is incomplete.`);
  const reloaded = value.map((entry) => {
    const document = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return { projectId: String(document.projectId ?? ''), entityCount: integer(document.entityCount, `${label}.entityCount`), root: String(document.root ?? '') };
  });
  for (const source of copied) {
    const destination = reloaded.find((entry) => entry.projectId === source.projectId);
    // WHAT: Require exact original count and final source root for every destination reload.
    // WHY: Partial project transfer cannot satisfy whole-catalog synchronization.
    if (!destination || destination.entityCount < source.originalEntityCount || !/^[a-f0-9]{64}$/.test(destination.root)) {
      throw new ReleaseCanaryHarnessError('release_canary_runtime_reloads_invalid', `${label} project ${source.projectId} is invalid.`);
    }
  }
  return reloaded;
}

function noninteractiveAdminSecret(repositoryRoot: string, environment: NodeJS.ProcessEnv): string {
  const fromProcess = String(environment.ADMIN_SECRET ?? '').trim();
  // WHAT: Prefer the already-injected noninteractive administrator secret.
  // WHY: Delivery orchestration may provide authority without reading another file.
  if (fromProcess.length >= 32) return fromProcess;
  const envFile = resolve(repositoryRoot, '.env');
  // WHAT: Reject absent fixed repository credentials.
  // WHY: Cloudflare canary runtime must never fall back to a browser or caller-selected secret file.
  if (!existsSync(envFile)) throw new ReleaseCanaryHarnessError('release_canary_admin_secret_missing', 'Repository .env does not provide ADMIN_SECRET.');
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*ADMIN_SECRET\s*=\s*(.*?)\s*$/);
    // WHAT: Ignore unrelated ignored settings without exposing their values.
    // WHY: Runtime proof owns only the relay administrator credential.
    if (!match) continue;
    const value = String(match[1] ?? '').replace(/^(['"])(.*)\1$/, '$2').trim();
    // WHAT: Accept only a nonempty administrator secret of the relay's minimum strength.
    // WHY: An empty assignment must remain a hard noninteractive configuration failure.
    if (value.length >= 32) return value;
  }
  throw new ReleaseCanaryHarnessError('release_canary_admin_secret_missing', 'Repository .env does not provide a valid ADMIN_SECRET.');
}

export async function proveReleaseCanaryDevWorkerRuntime(input: {
  repositoryRoot: string;
  runId: string;
  candidateSha: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<{ receiptFile: string; receiptId: string; evidence: ReleaseCanaryWorkerRuntimeEvidence }> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const manifest = readReleaseCanaryManifest({ repositoryRoot, runId: input.runId });
  const selected = selectCopiedTaskState(manifest.runtimeFixtures.candidate.canaryA);
  const evidenceRoot = resolve(manifest.runRoot, 'runtime-proof');
  mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  const administratorSecret = noninteractiveAdminSecret(repositoryRoot, input.environment ?? process.env);
  const federationId = `release_canary_${sha256(`${input.runId}:${input.candidateSha}`).slice(0, 24)}`;
  const nodeLoader = resolve(repositoryRoot, 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs');
  const result = await runEvidenceCommand({
    name: 'candidate-env-dev-huge-state',
    command: process.execPath,
    args: ['--test', '--import', nodeLoader, '--test-name-pattern', 'two real canary nodes synchronize a sanitized copied Decision OS state through the temporary relay', resolve(repositoryRoot, 'federation-relay', 'test', 'termux-local-relay.node.test.ts')],
    cwd: resolve(repositoryRoot, 'federation-relay'),
    env: {
      ...process.env,
      ...(input.environment ?? {}),
      TSX_TSCONFIG_PATH: resolve(repositoryRoot, 'backend', 'tsconfig.json'),
      DECISION_OS_CANARY_SOURCE_CATALOG_ROOT: manifest.runtimeFixtures.candidate.canaryA,
      DECISION_OS_CANARY_RELAY_URL: fixedDevWorkerUrl,
      DECISION_OS_CANARY_FEDERATION_ID: federationId,
      DECISION_OS_CANARY_ADMIN_SECRET: administratorSecret,
    },
    evidenceRoot,
    timeoutMs: 14_400_000,
  });
  const event = eventFrom(result.stdout, 'federation-huge-state-canary');
  const sourceRoot = String(event.sourceRoot ?? '');
  const replicaRoot = String(event.replicaRoot ?? '');
  const expectedRegistryProjects = manifest.projectStates.map(({ projectId, state }) => ({ projectId, state }));
  const registryProjects = registryProjectEvidence(event.registryProjects, expectedRegistryProjects);
  const copiedProjects = projectEvidence(event.copiedProjects, manifest.projectStates.filter((project) => project.state === 'task-state').map((project) => project.projectId));
  const sourceProjects = finalProjectEvidence(event.sourceProjects, copiedProjects, 'source');
  const reloadedProjects = finalProjectEvidence(event.reloadedProjects, copiedProjects, 'reloaded');
  // WHAT: Require every B reload to equal its final A root and entity count.
  // WHY: The selected augmented project and untouched copied projects share the same whole-catalog proof boundary.
  if (sourceProjects.some((source) => {
    const destination = reloadedProjects.find((entry) => entry.projectId === source.projectId);
    return !destination || destination.root !== source.root || destination.entityCount !== source.entityCount;
  })) throw new ReleaseCanaryHarnessError('release_canary_runtime_reloads_invalid', 'Worker destination reloads do not equal final source projects.');
  const teardownProjectCount = integer(event.externalTeardownProjectCount, 'worker.externalTeardownProjectCount');
  const expectedTeardownProjectCount = integer(event.externalExpectedTeardownProjectCount, 'worker.externalExpectedTeardownProjectCount');
  const temporaryFederationTeardownConfirmed = event.externalTeardownConfirmed === true
    && expectedTeardownProjectCount === copiedProjects.length
    && teardownProjectCount === expectedTeardownProjectCount;
  // WHAT: Require the fixed env.dev runtime identity and exact destination reload equality.
  // WHY: A Termux event or unmatched root cannot be labeled Worker proof.
  if (event.relayRuntime !== 'cloudflare-worker-env-dev' || event.federationId !== federationId
    || !temporaryFederationTeardownConfirmed
    || event.augmentationProjectId !== selected.projectId
    || !/^[a-f0-9]{64}$/.test(sourceRoot) || replicaRoot !== sourceRoot) {
    throw new ReleaseCanaryHarnessError('release_canary_worker_runtime_invalid', 'env.dev runtime evidence is invalid.');
  }
  const evidence: ReleaseCanaryWorkerRuntimeEvidence = {
    phase: 'worker-runtime',
    status: 'passed',
    evidence: {
      relayUrl: fixedDevWorkerUrl,
      relayRuntime: 'cloudflare-worker-env-dev',
      federationId,
      candidateSha: input.candidateSha,
      augmentationProjectId: selected.projectId,
      registryProjects,
      sourceCountBeforeAugmentation: integer(event.sourceCountBeforeAugmentation, 'worker.sourceCountBeforeAugmentation'),
      syntheticCount: integer(event.syntheticCount, 'worker.syntheticCount'),
      entityCount: integer(event.entityCount, 'worker.entityCount'),
      bucketCount: integer(event.bucketCount, 'worker.bucketCount') as 256,
      encodedBytes: integer(event.encodedBytes, 'worker.encodedBytes'),
      totalEntityCount: integer(event.totalEntityCount, 'worker.totalEntityCount'),
      totalDurableBytes: integer(event.totalDurableBytes, 'worker.totalDurableBytes'),
      sourceRoot,
      replicaRoot,
      destinationReloadEqual: true,
      copiedProjects,
      sourceProjects,
      reloadedProjects,
      temporaryFederationTeardownConfirmed,
      command: result.command,
    },
  };
  // WHAT: Apply the same huge-state gates used by the Termux lane before writing Worker evidence.
  // WHY: Identical A/B proof requires identical count, bucket, byte, and reload thresholds.
  if (evidence.evidence.totalEntityCount < 20_000 || evidence.evidence.bucketCount !== 256 || evidence.evidence.totalDurableBytes <= 32 * 1024 * 1024) {
    throw new ReleaseCanaryHarnessError('release_canary_worker_runtime_threshold_failed', 'env.dev runtime evidence did not meet the accepted thresholds.');
  }
  const receiptFile = resolve(evidenceRoot, 'worker-runtime-phase.json');
  const bytes = `${JSON.stringify(evidence, null, 2)}\n`;
  writeFileSync(receiptFile, bytes, { mode: 0o600 });
  return { receiptFile, receiptId: `sha256:${sha256(bytes)}`, evidence };
}

export async function proveReleaseCanaryRuntime(input: {
  repositoryRoot: string;
  runId: string;
  candidateSha: string;
}): Promise<ReleaseCanaryRuntimeReceipt> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const manifest = readReleaseCanaryManifest({ repositoryRoot, runId: input.runId });
  const evidenceRoot = resolve(manifest.runRoot, 'runtime-proof');
  mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  const selected = selectCopiedTaskState(manifest.runtimeFixtures.candidate.canaryA);
  const baselineRoot = resolve(evidenceRoot, 'rel-0.3.12');
  runGit(evidenceRoot, ['clone', '--local', '--no-hardlinks', '--no-checkout', repositoryRoot, baselineRoot]);
  runGit(baselineRoot, ['checkout', '--detach', 'rel-0.3.12']);
  const baselineSha = runGit(baselineRoot, ['rev-parse', 'HEAD']);
  // WHAT: Bind the baseline to the repository's exact rel-0.3.12 tag object.
  // WHY: Another historical commit cannot establish the regression boundary accepted by the plan.
  if (baselineSha !== runGit(repositoryRoot, ['rev-parse', 'rel-0.3.12^{commit}'])) {
    throw new ReleaseCanaryHarnessError('release_canary_runtime_baseline_mismatch', 'Baseline checkout does not match rel-0.3.12.');
  }
  symlinkSync(resolve(repositoryRoot, 'backend', 'node_modules'), resolve(baselineRoot, 'backend', 'node_modules'));
  symlinkSync(resolve(repositoryRoot, 'federation-relay', 'node_modules'), resolve(baselineRoot, 'federation-relay', 'node_modules'));

  const testFile = resolve(repositoryRoot, 'federation-relay', 'test', 'termux-local-relay.node.test.ts');
  const nodeLoader = resolve(repositoryRoot, 'backend', 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs');
  const baseEnvironment = { ...process.env, TSX_TSCONFIG_PATH: resolve(repositoryRoot, 'backend', 'tsconfig.json') };
  const commands: CommandEvidence[] = [];
  const baseline = await runEvidenceCommand({
    name: 'baseline-reconnect',
    command: process.execPath,
    args: ['--test', '--import', nodeLoader, '--test-name-pattern', 'Termux relay serves one bucket once across restart and twenty reconnects', testFile],
    cwd: resolve(repositoryRoot, 'federation-relay'),
    env: { ...baseEnvironment, DECISION_OS_CANARY_IMPLEMENTATION_ROOT: baselineRoot, DECISION_OS_CANARY_EXPECT_RECONNECT_REPLAY: '1' },
    evidenceRoot,
    timeoutMs: 120_000,
  });
  commands.push(baseline.command);
  const baselineEvent = eventFrom(baseline.stdout, 'federation-reconnect-canary');
  const candidateReconnect = await runEvidenceCommand({
    name: 'candidate-reconnect',
    command: process.execPath,
    args: ['--test', '--import', nodeLoader, '--test-name-pattern', 'Termux relay serves one bucket once across restart and twenty reconnects', testFile],
    cwd: resolve(repositoryRoot, 'federation-relay'),
    env: { ...baseEnvironment, DECISION_OS_CANARY_IMPLEMENTATION_ROOT: repositoryRoot },
    evidenceRoot,
    timeoutMs: 120_000,
  });
  commands.push(candidateReconnect.command);
  const reconnectEvent = eventFrom(candidateReconnect.stdout, 'federation-reconnect-canary');

  const huge = await runEvidenceCommand({
    name: 'candidate-huge-state',
    command: process.execPath,
    args: ['--test', '--import', nodeLoader, '--test-name-pattern', 'two real canary nodes synchronize a sanitized copied Decision OS state through the temporary relay', testFile],
    cwd: resolve(repositoryRoot, 'federation-relay'),
    env: { ...baseEnvironment, DECISION_OS_CANARY_SOURCE_CATALOG_ROOT: manifest.runtimeFixtures.candidate.canaryA },
    evidenceRoot,
    timeoutMs: 14_400_000,
  });
  commands.push(huge.command);
  const hugeEvent = eventFrom(huge.stdout, 'federation-huge-state-canary');

  const collision = await runEvidenceCommand({
    name: 'candidate-collision-recovery',
    command: process.execPath,
    args: ['--test', '--import', nodeLoader, '--test-name-pattern', 'correlated terminal rejection pauses reconnect delivery until equal-root explicit resume', resolve(repositoryRoot, 'backend', 'test', 'unit', 'federation', 'federation-task-state-replicator.test.ts')],
    cwd: resolve(repositoryRoot, 'backend'),
    env: baseEnvironment,
    evidenceRoot,
    timeoutMs: 120_000,
  });
  commands.push(collision.command);
  const collisionEvent = eventFrom(collision.stdout, 'federation-collision-recovery-canary');

  const sourceRoot = String(hugeEvent.sourceRoot ?? '');
  const replicaRoot = String(hugeEvent.replicaRoot ?? '');
  const expectedRegistryProjects = manifest.projectStates.map(({ projectId, state }) => ({ projectId, state }));
  const registryProjects = registryProjectEvidence(hugeEvent.registryProjects, expectedRegistryProjects);
  const copiedProjects = projectEvidence(hugeEvent.copiedProjects, manifest.projectStates.filter((project) => project.state === 'task-state').map((project) => project.projectId));
  const sourceProjects = finalProjectEvidence(hugeEvent.sourceProjects, copiedProjects, 'source');
  const reloadedProjects = finalProjectEvidence(hugeEvent.reloadedProjects, copiedProjects, 'reloaded');
  if (sourceProjects.some((sourceProject) => {
    const destination = reloadedProjects.find((entry) => entry.projectId === sourceProject.projectId);
    return !destination || destination.root !== sourceProject.root || destination.entityCount !== sourceProject.entityCount;
  })) throw new ReleaseCanaryHarnessError('release_canary_runtime_reloads_invalid', 'Termux destination reloads do not equal final source projects.');
  // WHAT: Require exact reloaded destination equality from the real store event.
  // WHY: Successful frame delivery without durable reload equality is not synchronization proof.
  if (!/^[a-f0-9]{64}$/.test(sourceRoot) || replicaRoot !== sourceRoot) {
    throw new ReleaseCanaryHarnessError('release_canary_runtime_root_mismatch', 'Huge-state destination reload root does not equal Canary A.');
  }
  // WHAT: Bind synthetic size augmentation to the exact copied project selected by the harness.
  // WHY: Augmentation evidence must remain separate from full copied-state verification and cannot drift to an unclassified project.
  if (hugeEvent.augmentationProjectId !== selected.projectId) {
    throw new ReleaseCanaryHarnessError('release_canary_runtime_augmentation_project_invalid', 'Runtime augmentation project does not match the selected copied project.');
  }
  const evidence: ReleaseCanaryRuntimeEvidence = {
    phase: 'termux-runtime',
    status: 'passed',
    evidence: {
      baseline: {
        releaseTag: 'rel-0.3.12',
        releaseSha: baselineSha,
        reconnectCount: integer(baselineEvent.reconnectCount, 'baseline.reconnectCount') as 2,
        reconnectRepairFrames: integer(baselineEvent.reconnectRepairFrames, 'baseline.reconnectRepairFrames'),
        reconnectRepairBytes: integer(baselineEvent.reconnectRepairBytes, 'baseline.reconnectRepairBytes'),
        repairRecordStable: baselineEvent.repairRecordStable === true,
      },
      candidate: {
        candidateSha: input.candidateSha,
        reconnectCount: integer(reconnectEvent.reconnectCount, 'candidate.reconnectCount') as 20,
        reconnectRepairFrames: integer(reconnectEvent.reconnectRepairFrames, 'candidate.reconnectRepairFrames') as 0,
        reconnectRepairBytes: integer(reconnectEvent.reconnectRepairBytes, 'candidate.reconnectRepairBytes') as 0,
        repairRecordStable: reconnectEvent.repairRecordStable === true,
        augmentationProjectId: selected.projectId,
        registryProjects,
        sourceCountBeforeAugmentation: integer(hugeEvent.sourceCountBeforeAugmentation, 'huge.sourceCountBeforeAugmentation'),
        syntheticCount: integer(hugeEvent.syntheticCount, 'huge.syntheticCount'),
        entityCount: integer(hugeEvent.entityCount, 'huge.entityCount'),
        bucketCount: integer(hugeEvent.bucketCount, 'huge.bucketCount') as 256,
        encodedBytes: integer(hugeEvent.encodedBytes, 'huge.encodedBytes'),
        totalEntityCount: integer(hugeEvent.totalEntityCount, 'huge.totalEntityCount'),
        totalDurableBytes: integer(hugeEvent.totalDurableBytes, 'huge.totalDurableBytes'),
        sourceRoot,
        replicaRoot,
        destinationReloadEqual: true,
        copiedProjects,
        sourceProjects,
        reloadedProjects,
      },
      collisionRecovery: {
        terminalPause: integer(collisionEvent.terminalIncidentCount, 'collision.terminalIncidentCount') === 1,
        reconnectRetryCount: integer(collisionEvent.reconnectRetryCount, 'collision.reconnectRetryCount'),
        oneSuccessor: integer(collisionEvent.successorCount, 'collision.successorCount') === 1,
        equalRootResume: collisionEvent.equalRootBeforeResume === true && integer(collisionEvent.pausedAfterResume, 'collision.pausedAfterResume') === 0,
        healthyControlProject: integer(collisionEvent.healthyControlDeliveryCount, 'collision.healthyControlDeliveryCount') > 0,
      },
      commands,
      remoteWorker: { exercised: false, blocker: 'env.dev Worker mutation is outside offline runtime proof authority' },
    },
  };
  // WHAT: Enforce the accepted behavioral thresholds before writing a passed artifact.
  // WHY: Literal typed fields must reflect the observed events instead of coercing insufficient measurements.
  if (evidence.evidence.baseline.reconnectCount !== 2
    || evidence.evidence.baseline.reconnectRepairFrames < 2
    || evidence.evidence.baseline.reconnectRepairBytes <= 0
    || evidence.evidence.baseline.repairRecordStable
    || evidence.evidence.candidate.reconnectCount !== 20
    || evidence.evidence.candidate.reconnectRepairFrames !== 0
    || evidence.evidence.candidate.reconnectRepairBytes !== 0
    || !evidence.evidence.candidate.repairRecordStable
    || evidence.evidence.candidate.totalEntityCount < 20_000
    || evidence.evidence.candidate.bucketCount !== 256
    || evidence.evidence.candidate.totalDurableBytes <= 32 * 1024 * 1024
    || !evidence.evidence.collisionRecovery.terminalPause
    || evidence.evidence.collisionRecovery.reconnectRetryCount !== 0
    || !evidence.evidence.collisionRecovery.oneSuccessor
    || !evidence.evidence.collisionRecovery.equalRootResume
    || !evidence.evidence.collisionRecovery.healthyControlProject) {
    throw new ReleaseCanaryHarnessError('release_canary_runtime_threshold_failed', 'Runtime canary evidence did not meet the accepted thresholds.');
  }
  const receiptFile = resolve(evidenceRoot, 'termux-runtime-phase.json');
  const bytes = `${JSON.stringify(evidence, null, 2)}\n`;
  writeFileSync(receiptFile, bytes, { mode: 0o600 });
  const writePhase = (phase: 'reconnect-quiescence' | 'incident-recovery', phaseEvidence: unknown): { receiptFile: string; receiptId: string } => {
    const phaseFile = resolve(evidenceRoot, `${phase}-phase.json`);
    const phaseBytes = `${JSON.stringify({ phase, status: 'passed', evidence: phaseEvidence }, null, 2)}\n`;
    writeFileSync(phaseFile, phaseBytes, { mode: 0o600 });
    return { receiptFile: phaseFile, receiptId: `sha256:${sha256(phaseBytes)}` };
  };
  const receiptId = `sha256:${sha256(bytes)}`;
  return {
    receiptFile,
    receiptId,
    evidence,
    phaseReceipts: {
      'termux-runtime': { receiptFile, receiptId },
      'reconnect-quiescence': writePhase('reconnect-quiescence', {
        baseline: evidence.evidence.baseline,
        candidate: {
          candidateSha: evidence.evidence.candidate.candidateSha,
          reconnectCount: evidence.evidence.candidate.reconnectCount,
          reconnectRepairFrames: evidence.evidence.candidate.reconnectRepairFrames,
          reconnectRepairBytes: evidence.evidence.candidate.reconnectRepairBytes,
          repairRecordStable: evidence.evidence.candidate.repairRecordStable,
        },
        commands: commands.filter((command) => command.name.includes('reconnect') || command.name.includes('divergence')),
      }),
      'incident-recovery': writePhase('incident-recovery', {
        collisionRecovery: evidence.evidence.collisionRecovery,
        command: commands.find((command) => command.name === 'candidate-collision-recovery'),
      }),
    },
  };
}

/**
 * WHAT: Creates immutable, manifest-owned Decision OS canary snapshots and cleans only their owned resources.
 * WHY: Release and recovery proof must exercise copied production-shaped state without reading from or writing to live state after capture.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { readProjectRegistry, type ProjectRegistry } from '../../server/helper/project-registry.js';

const canaryRootName = 'decision-os-release-canary';
const excludedDecisionOsEntries = new Set([
  '.git',
  '.settings.json',
  'cache',
  'delivery',
  'runs',
  'runtime',
  'uploads',
  'voice-uploads',
]);

export type ReleaseCanaryInventoryEntry = {
  path: string;
  type: 'file' | 'symlink';
  bytes: number;
  sha256: string;
  linkTargetSha256?: string;
};

export type ReleaseCanaryInventory = {
  digest: string;
  fileCount: number;
  byteCount: number;
  entries: ReleaseCanaryInventoryEntry[];
};

export type ReleaseCanaryManifest = {
  version: 2;
  integritySha256: string;
  runId: string;
  repositoryRoot: string;
  repositoryIdentity: string;
  runRoot: string;
  manifestFile: string;
  createdAt: string;
  status: 'snapshot-ready' | 'release-proven' | 'proof-failed' | 'proof-complete';
  sourceMasterRoot: string;
  sourceCatalogRoot: string;
  sourceReleaseRoot: string;
  snapshotArchiveRoot: string;
  snapshotCatalogRoot: string;
  lanes: {
    baseline: string;
    candidate: string;
    recovery: string;
  };
  runtimeFixtures: {
    baseline: { canaryA: string; canaryB: string };
    candidate: { canaryA: string; canaryB: string };
  };
  canaryIdentities: Array<{
    lane: 'baseline-a' | 'baseline-b' | 'candidate-a' | 'candidate-b' | 'recovery';
    federationId: string;
    nodeId: string;
  }>;
  projectGit: Array<{
    projectId: string;
    sourceOriginPresent: boolean;
    sourceOriginHash: string | null;
  }>;
  projectStates: Array<{
    projectId: string;
    relativePath: string;
    state: 'task-state' | 'no-task-state';
  }>;
  laneProvenance: {
    baseline: 'derived-fresh-incidents';
    candidate: 'derived-fresh-incidents';
    recovery: 'derived-copied-ledger';
  };
  releaseTopology: {
    currentPointer: 'current';
    activeReleaseSha: string;
    immutableReleaseCount: number;
  };
  sourceInventory: ReleaseCanaryInventory;
  copiedInventory: ReleaseCanaryInventory;
  projectCount: number;
  resources: Array<{ kind: 'directory'; path: string }>;
  externalWorker: null | {
    priorVersionId: string;
    ownedVersionId: string;
    restored: boolean;
  };
  release: null | {
    receiptFile: string;
    receiptId: string;
    candidateSha: string;
    mainSha: string;
    releaseSha: string;
    releaseTag: string;
  };
};

export class ReleaseCanaryHarnessError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ReleaseCanaryHarnessError';
  }
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function repositoryIdentity(repositoryRoot: string): string {
  return sha256(realpathSync(repositoryRoot)).slice(0, 24);
}

function releaseCanaryBaseRoot(): string {
  return resolve(realpathSync(tmpdir()), canaryRootName);
}

function stableRunId(value: string): string {
  // WHAT: Accept only a filename-safe run identity.
  // WHY: Cleanup derives its target from this identity and must not accept path traversal.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(value)) {
    throw new ReleaseCanaryHarnessError('release_canary_run_id_invalid', 'Canary run ID is invalid.');
  }
  return value;
}

function pathInside(root: string, candidate: string): boolean {
  const relation = relative(resolve(root), resolve(candidate));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

function requireInside(root: string, candidate: string, code: string): string {
  const result = resolve(candidate);
  // WHAT: Reject every path outside the manifest-owned root.
  // WHY: Snapshot mutation and cleanup must never target live or unrelated files.
  if (!pathInside(root, result)) throw new ReleaseCanaryHarnessError(code, `Path escapes the canary root: ${result}.`);
  return result;
}

function projectDecisionOsRoot(catalogRoot: string, relativePath: string): string {
  const projectRoot = resolve(catalogRoot, relativePath);
  // WHAT: Reject registered paths that escape the settings-owned catalog.
  // WHY: A registry entry must not make the canary read unrelated host state.
  if (!pathInside(catalogRoot, projectRoot)) {
    throw new ReleaseCanaryHarnessError('release_canary_project_path_invalid', `Registered project path escapes the catalog: ${relativePath}.`);
  }
  return resolve(projectRoot, '.decision-os');
}

function sourceProjectDecisionOsRoot(catalogRoot: string, relativePath: string): string {
  const projectRoot = resolve(catalogRoot, relativePath);
  const decisionOsRoot = resolve(projectRoot, '.decision-os');
  let realProject: string;
  let realDecisionOs: string;
  try {
    realProject = realpathSync(projectRoot);
    realDecisionOs = realpathSync(decisionOsRoot);
  } catch {
    throw new ReleaseCanaryHarnessError('release_canary_project_state_missing', `Registered project state is unavailable: ${relativePath}.`);
  }
  // WHAT: Require each authoritative registry target's .decision-os beneath its own real project root.
  // WHY: External registered projects such as Ardaria are valid, while a redirected .decision-os must not escape its registered owner.
  if (!pathInside(realProject, realDecisionOs)) {
    throw new ReleaseCanaryHarnessError('release_canary_project_realpath_invalid', `Registered project state escapes its project root: ${relativePath}.`);
  }
  return realDecisionOs;
}

function sourceReleaseRootFor(masterRoot: string): string {
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(readFileSync(resolve(masterRoot, '.settings.json'), 'utf8')) as Record<string, unknown>;
  } catch {
    throw new ReleaseCanaryHarnessError('release_canary_settings_invalid', 'Source settings are unavailable or invalid.');
  }
  const configured = String(settings.deliveryReleaseRoot ?? '');
  // WHAT: Accept only the settings-owned absolute release root.
  // WHY: The canary has no caller override and must archive the same release authority used by production delivery.
  if (!isAbsolute(configured)) throw new ReleaseCanaryHarnessError('release_canary_release_root_invalid', 'Source settings do not identify an absolute release root.');
  try {
    return realpathSync(configured);
  } catch {
    throw new ReleaseCanaryHarnessError('release_canary_release_root_invalid', 'The settings-owned release root is unavailable.');
  }
}

function releaseTopologyFor(releaseRoot: string): ReleaseCanaryManifest['releaseTopology'] {
  const currentPointer = resolve(releaseRoot, 'current');
  const releasesRoot = resolve(releaseRoot, 'releases');
  let target: string;
  // WHAT: Require the stable current pointer to be a symlink before resolving it.
  // WHY: A copied directory cannot establish the production release activation topology.
  if (!lstatSync(currentPointer).isSymbolicLink()) throw new ReleaseCanaryHarnessError('release_canary_release_topology_invalid', 'Release current pointer is not a symlink.');
  target = resolve(releaseRoot, readlinkSync(currentPointer));
  // WHAT: Require current to select exactly one immutable 40-character release directory.
  // WHY: The archive must preserve a non-running active release identity without following authority outside releases/.
  if (!pathInside(releasesRoot, target) || dirname(target) !== releasesRoot || !/^[a-f0-9]{40}$/.test(target.split('/').at(-1) ?? '')) {
    throw new ReleaseCanaryHarnessError('release_canary_release_topology_invalid', 'Release current pointer target is invalid.');
  }
  const immutableReleaseCount = readdirSync(releasesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  return { currentPointer: 'current', activeReleaseSha: target.split('/').at(-1)!, immutableReleaseCount };
}

function shouldExclude(relativePath: string): boolean {
  const segments = relativePath.split('/');
  const decisionOsEntries = segments.flatMap((segment, index) => {
    // WHAT: Treat both the copied root and every nested .decision-os directory as authority boundaries.
    // WHY: Nested project state must not leak settings, credentials, runtime state, or telemetry into a runnable lane.
    if (index === 0) return [segment];
    // WHAT: Select only the first child below a nested .decision-os directory.
    // WHY: Quarantine rules apply to Decision OS-owned top-level entries, not authored files with coincidental names.
    if (segments[index - 1] === '.decision-os') return [segment];
    return [];
  });
  return segments.some((segment) => segment === '.git')
    || decisionOsEntries.some((entry) => excludedDecisionOsEntries.has(entry) || entry.startsWith('frontend-telemetry.jsonl'));
}

function inventoryTree(input: {
  root: string;
  logicalRoot: string;
  entries: ReleaseCanaryInventoryEntry[];
  excludeRunnableAuthority?: boolean;
}): void {
  // WHAT: Treat an absent optional incident ledger as an empty inventory contribution.
  // WHY: A fresh installation may not have recorded an incident yet.
  if (!existsSync(input.root)) return;
  const visit = (absolute: string, relativePath: string): void => {
    // WHAT: Exclude secrets, delivery state, caches, uploads, process state, and Git metadata.
    // WHY: Canary execution owns generated replacements and must never inherit live authority.
    if (input.excludeRunnableAuthority && relativePath && shouldExclude(relativePath)) return;
    const stat = lstatSync(absolute);
    // WHAT: Inventory a symlink by its link text without following it.
    // WHY: An external link target must never expand the snapshot read boundary.
    if (stat.isSymbolicLink()) {
      const linkTarget = readlinkSync(absolute);
      input.entries.push({
        path: `${input.logicalRoot}/${relativePath}`.replace(/\/$/, ''),
        type: 'symlink',
        bytes: Buffer.byteLength(linkTarget),
        sha256: sha256(linkTarget),
        linkTargetSha256: sha256(linkTarget),
      });
      return;
    }
    // WHAT: Recurse only through real directories.
    // WHY: Symlinks are already terminal inventory entries and must not be traversed.
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
        visit(resolve(absolute, entry.name), relativePath ? `${relativePath}/${entry.name}` : entry.name);
      }
      return;
    }
    // WHAT: Reject sockets, devices, and other non-file state.
    // WHY: A byte-stable canary snapshot supports only durable files and preserved symlinks.
    if (!stat.isFile()) {
      throw new ReleaseCanaryHarnessError('release_canary_source_type_invalid', `Unsupported source entry: ${absolute}.`);
    }
    const bytes = readFileSync(absolute);
    input.entries.push({
      path: `${input.logicalRoot}/${relativePath}`.replace(/\/$/, ''),
      type: 'file',
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    });
  };
  visit(input.root, '');
}

function registryFor(masterRoot: string): ProjectRegistry {
  const registry = readProjectRegistry(masterRoot);
  // WHAT: Require the authoritative version-2 registry.
  // WHY: Recursive discovery cannot preserve the production catalog identity contract.
  if (!registry) throw new ReleaseCanaryHarnessError('release_canary_registry_missing', 'The source master registry is unavailable.');
  return registry;
}

export function inventoryReleaseCanarySource(masterRootInput: string): ReleaseCanaryInventory {
  const masterRoot = resolve(masterRootInput);
  const catalogRoot = dirname(masterRoot);
  const registry = registryFor(masterRoot);
  const sourceReleaseRoot = sourceReleaseRootFor(masterRoot);
  const entries: ReleaseCanaryInventoryEntry[] = [];
  inventoryTree({ root: masterRoot, logicalRoot: 'master', entries });
  for (const project of Object.values(registry.projects).sort((left, right) => left.id.localeCompare(right.id))) {
    inventoryTree({
      root: sourceProjectDecisionOsRoot(catalogRoot, project.relativePath),
      logicalRoot: `projects/${project.id}`,
      entries,
    });
  }
  inventoryTree({ root: sourceReleaseRoot, logicalRoot: 'release', entries });
  entries.sort((left, right) => left.path.localeCompare(right.path));
  const digest = sha256(entries.map((entry) => JSON.stringify(entry)).join('\n'));
  return {
    digest,
    fileCount: entries.length,
    byteCount: entries.reduce((total, entry) => total + entry.bytes, 0),
    entries,
  };
}

function inventoryReleaseCanaryArchive(archiveRoot: string, registry: ProjectRegistry): ReleaseCanaryInventory {
  const entries: ReleaseCanaryInventoryEntry[] = [];
  inventoryTree({ root: resolve(archiveRoot, 'master'), logicalRoot: 'master', entries });
  for (const project of Object.values(registry.projects).sort((left, right) => left.id.localeCompare(right.id))) {
    inventoryTree({ root: resolve(archiveRoot, 'projects', project.id), logicalRoot: `projects/${project.id}`, entries });
  }
  inventoryTree({ root: resolve(archiveRoot, 'release'), logicalRoot: 'release', entries });
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    digest: sha256(entries.map((entry) => JSON.stringify(entry)).join('\n')),
    fileCount: entries.length,
    byteCount: entries.reduce((total, entry) => total + entry.bytes, 0),
    entries,
  };
}

function copyTreeExact(source: string, destination: string): void {
  const stat = lstatSync(source);
  // WHAT: Preserve symlink text as a terminal archive entry without following it.
  // WHY: The owner-only source archive must retain exact evidence while never expanding its read boundary.
  if (stat.isSymbolicLink()) {
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(readlinkSync(source), destination);
    return;
  }
  // WHAT: Recurse through every real source directory without runnable-lane exclusions.
  // WHY: Settings, Git metadata, incidents, uploads, caches, and delivery authority are part of immutable source evidence.
  if (stat.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      copyTreeExact(resolve(source, entry.name), resolve(destination, entry.name));
    }
    return;
  }
  // WHAT: Archive only ordinary durable files after directories and symlinks are handled.
  // WHY: Sockets and devices cannot be represented as byte-identical portable evidence.
  if (!stat.isFile()) throw new ReleaseCanaryHarnessError('release_canary_source_type_invalid', `Unsupported source entry: ${source}.`);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function copyTree(source: string, destination: string, relativePath = ''): void {
  const stat = lstatSync(source);
  // WHAT: Recreate symlinks without reading their targets.
  // WHY: Copying must not escape the registered source tree.
  if (stat.isSymbolicLink()) {
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(readlinkSync(source), destination);
    return;
  }
  // WHAT: Recurse only through accepted real directories.
  // WHY: Every copied child needs the same exclusion and no-follow boundary.
  if (stat.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      // WHAT: Quarantine live secrets and runtime-owned state.
      // WHY: The runnable canary must generate its own authority and process state.
      if (shouldExclude(childRelative)) continue;
      copyTree(resolve(source, entry.name), resolve(destination, entry.name), childRelative);
    }
    return;
  }
  // WHAT: Copy only ordinary durable files.
  // WHY: Device and socket replication is outside the state contract.
  if (!stat.isFile()) throw new ReleaseCanaryHarnessError('release_canary_source_type_invalid', `Unsupported source entry: ${source}.`);
  mkdirSync(dirname(destination), { recursive: true });
  try {
    copyFileSync(source, destination, constants.COPYFILE_FICLONE);
  } catch {
    copyFileSync(source, destination);
  }
}

function assertRunnableSymlinksContained(root: string): void {
  const registry = registryFor(resolve(root, '.decision-os'));
  const inspect = (projectRoot: string, absolute: string): void => {
    const stat = lstatSync(absolute);
    // WHAT: Validate a runnable symlink without following it.
    // WHY: Copied link text must never redirect canary reads or writes outside the copied project state.
    if (stat.isSymbolicLink()) {
      const target = resolve(dirname(absolute), readlinkSync(absolute));
      if (!pathInside(projectRoot, target)) {
        throw new ReleaseCanaryHarnessError('release_canary_symlink_escape', `Runnable symlink escapes copied project state: ${absolute}.`);
      }
      return;
    }
    // WHAT: Recurse only through real directories.
    // WHY: Symlinks are validated as terminal entries and are never traversed.
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolute, { withFileTypes: true })) inspect(projectRoot, resolve(absolute, entry.name));
    }
  };
  for (const project of Object.values(registry.projects)) {
    const projectRoot = projectDecisionOsRoot(root, project.relativePath);
    inspect(projectRoot, projectRoot);
  }
}

function gitOutput(root: string, args: readonly string[], allowMissing = false): string {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  // WHAT: Return an empty optional observation when Git reports it absent.
  // WHY: Origin presence is copied as a boolean, and absence is a valid source state.
  if (allowMissing && result.status !== 0) return '';
  // WHAT: Reject failed scratch repository setup.
  // WHY: Origin-sensitive runtime behavior must not fall back to the production repository.
  if (result.error || result.status !== 0) {
    throw new ReleaseCanaryHarnessError('release_canary_scratch_git_failed', `Scratch Git operation failed: ${String(result.stderr ?? '').trim() || result.error?.message || result.status}.`);
  }
  return String(result.stdout ?? '').trim();
}

function sourceProjectGit(input: {
  sourceCatalogRoot: string;
  registry: ProjectRegistry;
}): ReleaseCanaryManifest['projectGit'] {
  return Object.values(input.registry.projects).sort((left, right) => left.id.localeCompare(right.id)).map((project) => {
    const projectRoot = resolve(input.sourceCatalogRoot, project.relativePath);
    const origin = existsSync(resolve(projectRoot, '.git'))
      ? gitOutput(projectRoot, ['config', '--get', 'remote.origin.url'], true)
      : '';
    return {
      projectId: project.id,
      sourceOriginPresent: Boolean(origin),
      sourceOriginHash: origin ? sha256(origin) : null,
    };
  });
}

function initializeScratchProjectGit(input: {
  laneRoot: string;
  registry: ProjectRegistry;
  projectGit: ReleaseCanaryManifest['projectGit'];
}): void {
  for (const project of Object.values(input.registry.projects)) {
    const projectRoot = resolve(input.laneRoot, project.relativePath);
    mkdirSync(projectRoot, { recursive: true });
    gitOutput(projectRoot, ['init', '--initial-branch=main']);
    gitOutput(projectRoot, ['config', 'user.name', 'Decision OS Release Canary']);
    gitOutput(projectRoot, ['config', 'user.email', 'decision-os-release-canary@example.invalid']);
    const origin = input.projectGit.find((entry) => entry.projectId === project.id);
    // WHAT: Reproduce only source origin presence with a generated inert URL.
    // WHY: Origin-sensitive behavior stays testable without copying credentials or contacting production remotes.
    if (origin?.sourceOriginPresent && origin.sourceOriginHash) {
      gitOutput(projectRoot, ['remote', 'add', 'origin', `https://canary.invalid/${origin.sourceOriginHash}.git`]);
    }
  }
}

function installIsolatedSettings(input: {
  laneRoot: string;
  lane: ReleaseCanaryManifest['canaryIdentities'][number]['lane'];
  runId: string;
}): ReleaseCanaryManifest['canaryIdentities'][number] {
  const cohort = input.lane.replace(/-[ab]$/, '');
  const federationId = `release_canary_${cohort}_${sha256(`${input.runId}:${cohort}`).slice(0, 16)}`;
  const nodeId = `${input.lane.replaceAll('-', '_')}_${sha256(`${input.runId}:${input.lane}`).slice(0, 16)}`;
  const settings = {
    federationId,
    federationNodeId: nodeId,
    federationNodeLabel: `Release Canary ${input.lane}`,
    federationNodeCredential: createHash('sha256').update(`${randomUUID()}:${input.runId}:${input.lane}`).digest('base64url'),
  };
  const file = resolve(input.laneRoot, '.decision-os', '.settings.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  return { lane: input.lane, federationId, nodeId };
}

function copyAcceptedCatalog(archiveRoot: string, destinationCatalogRoot: string): void {
  const archivedMasterRoot = resolve(archiveRoot, 'master');
  const registry = registryFor(archivedMasterRoot);
  const destinationMasterRoot = resolve(destinationCatalogRoot, '.decision-os');
  copyTree(archivedMasterRoot, destinationMasterRoot);
  const runnableRegistry: ProjectRegistry = {
    ...registry,
    projects: Object.fromEntries(Object.values(registry.projects).map((project) => [project.id, {
      ...project,
      relativePath: `.canary-projects/${sha256(project.id).slice(0, 24)}`,
    }])),
  };
  writeFileSync(resolve(destinationMasterRoot, 'projects.json'), `${JSON.stringify(runnableRegistry, null, 2)}\n`, { mode: 0o600 });
  for (const project of Object.values(registry.projects).sort((left, right) => left.id.localeCompare(right.id))) {
    const source = resolve(archiveRoot, 'projects', project.id);
    const runnableProject = runnableRegistry.projects[project.id]!;
    const destination = projectDecisionOsRoot(destinationCatalogRoot, runnableProject.relativePath);
    copyTree(source, destination);
  }
}

function projectStatesFor(catalogRoot: string, registry: ProjectRegistry): ReleaseCanaryManifest['projectStates'] {
  return Object.values(registry.projects).sort((left, right) => left.id.localeCompare(right.id)).map((project) => {
    const formatFile = resolve(projectDecisionOsRoot(catalogRoot, project.relativePath), 'task-state', project.id, 'format.json');
    return {
      projectId: project.id,
      relativePath: project.relativePath,
      // WHAT: Classify each registry identity by the presence of its real current-state format authority.
      // WHY: A project without task-state remains in complete-catalog proof instead of disappearing from runtime accounting.
      state: existsSync(formatFile) ? 'task-state' as const : 'no-task-state' as const,
    };
  });
}

function removeIncidentLedgers(root: string): void {
  const registry = registryFor(resolve(root, '.decision-os'));
  const incidentFiles = [resolve(root, '.decision-os', 'runtime-incidents.json')];
  for (const project of Object.values(registry.projects)) {
    incidentFiles.push(resolve(projectDecisionOsRoot(root, project.relativePath), 'runtime-incidents.json'));
  }
  for (const file of incidentFiles) {
    // WHAT: Remove only copied incident ledgers from fresh comparison lanes.
    // WHY: Baseline and candidate startup must independently reproduce incident transitions.
    if (existsSync(file)) rmSync(file);
  }
}

function emptyTaskStateStores(root: string): void {
  const registry = registryFor(resolve(root, '.decision-os'));
  for (const project of Object.values(registry.projects)) {
    const taskStateRoot = resolve(projectDecisionOsRoot(root, project.relativePath), 'task-state');
    // WHAT: Empty only the copied task-state tree in Canary B.
    // WHY: Catalog and authored state remain identical while A-to-B transfer stays observable.
    if (existsSync(taskStateRoot)) rmSync(taskStateRoot, { recursive: true, force: true });
  }
}

function writeManifest(manifest: ReleaseCanaryManifest): void {
  const temporary = `${manifest.manifestFile}.tmp-${process.pid}`;
  const integritySha256 = sha256(JSON.stringify({ ...manifest, integritySha256: '' }));
  writeFileSync(temporary, `${JSON.stringify({ ...manifest, integritySha256 }, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, manifest.manifestFile);
}

function equalInventory(left: ReleaseCanaryInventory, right: ReleaseCanaryInventory): boolean {
  return left.digest === right.digest
    && left.fileCount === right.fileCount
    && left.byteCount === right.byteCount;
}

export function createReleaseCanarySnapshot(input: {
  repositoryRoot: string;
  sourceMasterRoot: string;
  runId?: string;
  now?: () => Date;
  maximumAttempts?: number;
  afterCopyAttempt?: (attempt: number) => void;
}): ReleaseCanaryManifest {
  const repositoryRoot = realpathSync(resolve(input.repositoryRoot));
  const sourceMasterRoot = realpathSync(resolve(input.sourceMasterRoot));
  const sourceCatalogRoot = dirname(sourceMasterRoot);
  const sourceReleaseRoot = sourceReleaseRootFor(sourceMasterRoot);
  const releaseTopology = releaseTopologyFor(sourceReleaseRoot);
  const id = stableRunId(input.runId ?? `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`);
  const identity = repositoryIdentity(repositoryRoot);
  const runRoot = resolve(releaseCanaryBaseRoot(), identity, id);
  // WHAT: Reject reuse of an existing run root.
  // WHY: A proof must not inherit artifacts or cleanup authority from another run.
  if (existsSync(runRoot)) throw new ReleaseCanaryHarnessError('release_canary_run_exists', 'Canary run already exists.');
  mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  const snapshotArchiveRoot = resolve(runRoot, 'snapshot', 'archive');
  const snapshotCatalogRoot = resolve(runRoot, 'snapshot', 'catalog');
  const lanes = {
    baseline: resolve(runRoot, 'lanes', 'baseline'),
    candidate: resolve(runRoot, 'lanes', 'candidate'),
    recovery: resolve(runRoot, 'lanes', 'recovery'),
  };
  const runtimeFixtures = {
    baseline: { canaryA: lanes.baseline, canaryB: resolve(runRoot, 'lanes', 'baseline-empty') },
    candidate: { canaryA: lanes.candidate, canaryB: resolve(runRoot, 'lanes', 'candidate-empty') },
  };
  const manifestFile = resolve(runRoot, 'manifest.json');
  const emptyInventory: ReleaseCanaryInventory = { digest: sha256(''), fileCount: 0, byteCount: 0, entries: [] };
  writeManifest({
    version: 2,
    integritySha256: '',
    runId: id,
    repositoryRoot,
    repositoryIdentity: identity,
    runRoot,
    manifestFile,
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
    status: 'proof-failed',
    sourceMasterRoot,
    sourceCatalogRoot,
    sourceReleaseRoot,
    snapshotArchiveRoot,
    snapshotCatalogRoot,
    lanes,
    runtimeFixtures,
    canaryIdentities: [],
    projectGit: [],
    projectStates: [],
    laneProvenance: {
      baseline: 'derived-fresh-incidents',
      candidate: 'derived-fresh-incidents',
      recovery: 'derived-copied-ledger',
    },
    releaseTopology,
    sourceInventory: emptyInventory,
    copiedInventory: emptyInventory,
    projectCount: 0,
    resources: [{ kind: 'directory', path: runRoot }],
    externalWorker: null,
    release: null,
  });
  const attempts = Math.max(1, Math.min(input.maximumAttempts ?? 2, 3));
  let sourceInventory: ReleaseCanaryInventory | null = null;
  let copiedInventory: ReleaseCanaryInventory | null = null;
  const registry = registryFor(sourceMasterRoot);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const attemptRoot = requireInside(runRoot, resolve(runRoot, `snapshot-attempt-${attempt}`), 'release_canary_attempt_path_invalid');
    mkdirSync(attemptRoot, { recursive: true });
    const before = inventoryReleaseCanarySource(sourceMasterRoot);
    copyTreeExact(sourceMasterRoot, resolve(attemptRoot, 'master'));
    for (const project of Object.values(registry.projects).sort((left, right) => left.id.localeCompare(right.id))) {
      copyTreeExact(
        sourceProjectDecisionOsRoot(sourceCatalogRoot, project.relativePath),
        resolve(attemptRoot, 'projects', project.id),
      );
    }
    copyTreeExact(sourceReleaseRoot, resolve(attemptRoot, 'release'));
    input.afterCopyAttempt?.(attempt);
    const after = inventoryReleaseCanarySource(sourceMasterRoot);
    const copied = inventoryReleaseCanaryArchive(attemptRoot, registry);
    // WHAT: Accept only a byte-stable source and exact copied inventory.
    // WHY: A concurrent live write would make baseline and candidate evidence incomparable.
    if (equalInventory(before, after) && equalInventory(before, copied)) {
      mkdirSync(dirname(snapshotArchiveRoot), { recursive: true });
      renameSync(attemptRoot, snapshotArchiveRoot);
      sourceInventory = after;
      copiedInventory = copied;
      break;
    }
    rmSync(attemptRoot, { recursive: true, force: true });
  }
  // WHAT: Retain the run evidence root but reject an unstable source capture.
  // WHY: The harness must never report proof from a torn production snapshot.
  if (!sourceInventory || !copiedInventory) {
    throw new ReleaseCanaryHarnessError('release_canary_source_changed', 'Source state changed while the canary snapshot was copied.');
  }
  const archivedReleaseTopology = releaseTopologyFor(resolve(snapshotArchiveRoot, 'release'));
  // WHAT: Require the archived non-running release topology to preserve the source active identity exactly.
  // WHY: Byte inventory alone must not relabel a different immutable release as current.
  if (JSON.stringify(archivedReleaseTopology) !== JSON.stringify(releaseTopology)) {
    throw new ReleaseCanaryHarnessError('release_canary_release_topology_changed', 'Archived release topology does not match the source.');
  }
  copyAcceptedCatalog(snapshotArchiveRoot, snapshotCatalogRoot);
  assertRunnableSymlinksContained(snapshotCatalogRoot);
  const runnableRegistry = registryFor(resolve(snapshotCatalogRoot, '.decision-os'));
  const runnableStates = new Map(projectStatesFor(snapshotCatalogRoot, runnableRegistry).map((project) => [project.projectId, project.state]));
  const projectStates = Object.values(registry.projects).sort((left, right) => left.id.localeCompare(right.id)).map((project) => ({
    projectId: project.id,
    relativePath: project.relativePath,
    state: runnableStates.get(project.id) ?? 'no-task-state',
  }));
  const projectGit = sourceProjectGit({ sourceCatalogRoot, registry });
  for (const lane of Object.values(lanes)) copyTree(snapshotCatalogRoot, lane);
  removeIncidentLedgers(lanes.baseline);
  removeIncidentLedgers(lanes.candidate);
  copyTree(lanes.baseline, runtimeFixtures.baseline.canaryB);
  copyTree(lanes.candidate, runtimeFixtures.candidate.canaryB);
  emptyTaskStateStores(runtimeFixtures.baseline.canaryB);
  emptyTaskStateStores(runtimeFixtures.candidate.canaryB);
  const laneInputs = [
    { lane: 'baseline-a' as const, root: runtimeFixtures.baseline.canaryA },
    { lane: 'baseline-b' as const, root: runtimeFixtures.baseline.canaryB },
    { lane: 'candidate-a' as const, root: runtimeFixtures.candidate.canaryA },
    { lane: 'candidate-b' as const, root: runtimeFixtures.candidate.canaryB },
    { lane: 'recovery' as const, root: lanes.recovery },
  ];
  for (const lane of laneInputs) initializeScratchProjectGit({ laneRoot: lane.root, registry: runnableRegistry, projectGit });
  const canaryIdentities = laneInputs.map((lane) => installIsolatedSettings({
    laneRoot: lane.root,
    lane: lane.lane,
    runId: id,
  }));
  const archiveInventoryAfterLaneDerivation = inventoryReleaseCanaryArchive(snapshotArchiveRoot, registry);
  // WHAT: Reject any archive mutation introduced while runnable lanes were derived.
  // WHY: The full untouched snapshot is source evidence and must remain byte-identical to its accepted capture inventory.
  if (!equalInventory(copiedInventory, archiveInventoryAfterLaneDerivation)) {
    throw new ReleaseCanaryHarnessError('release_canary_archive_changed', 'Immutable source archive changed during runnable lane derivation.');
  }
  const manifest: ReleaseCanaryManifest = {
    version: 2,
    integritySha256: '',
    runId: id,
    repositoryRoot,
    repositoryIdentity: identity,
    runRoot,
    manifestFile,
    createdAt: readReleaseCanaryManifest({ repositoryRoot, runId: id }).createdAt,
    status: 'snapshot-ready',
    sourceMasterRoot,
    sourceCatalogRoot,
    sourceReleaseRoot,
    snapshotArchiveRoot,
    snapshotCatalogRoot,
    lanes,
    runtimeFixtures,
    canaryIdentities,
    projectGit,
    projectStates,
    laneProvenance: {
      baseline: 'derived-fresh-incidents',
      candidate: 'derived-fresh-incidents',
      recovery: 'derived-copied-ledger',
    },
    releaseTopology,
    sourceInventory,
    copiedInventory,
    projectCount: Object.keys(registry.projects).length,
    resources: [{ kind: 'directory', path: runRoot }],
    externalWorker: null,
    release: null,
  };
  writeManifest(manifest);
  return manifest;
}

export function recordReleaseCanaryGitProof(input: {
  repositoryRoot: string;
  runId: string;
  evidence: unknown;
  candidateSha: string;
  mainSha: string;
  releaseSha: string;
  releaseTag: string;
}): { receiptFile: string; receiptId: string } {
  const manifest = readReleaseCanaryManifest({ repositoryRoot: input.repositoryRoot, runId: input.runId });
  // WHAT: Reject replacement of an already-recorded canonical release proof.
  // WHY: A run binds one candidate to one immutable paired-tag result.
  if (manifest.release) throw new ReleaseCanaryHarnessError('release_canary_release_already_recorded', 'Canary release proof is already recorded.');
  for (const [field, value] of Object.entries({
    candidateSha: input.candidateSha,
    mainSha: input.mainSha,
    releaseSha: input.releaseSha,
  })) {
    // WHAT: Require complete Git identities in the manifest release boundary.
    // WHY: Symbolic refs and abbreviated hashes are not durable proof authority.
    if (!/^[a-f0-9]{40}$/.test(value)) throw new ReleaseCanaryHarnessError('release_canary_release_identity_invalid', `${field} is invalid.`);
  }
  const receiptBytes = `${JSON.stringify(input.evidence, null, 2)}\n`;
  const receiptId = `sha256:${sha256(receiptBytes)}`;
  const receiptFile = resolve(manifest.runRoot, 'release-receipt.json');
  writeFileSync(receiptFile, receiptBytes, { mode: 0o600 });
  const release = {
    receiptFile,
    receiptId,
    candidateSha: input.candidateSha,
    mainSha: input.mainSha,
    releaseSha: input.releaseSha,
    releaseTag: input.releaseTag,
  };
  writeManifest({ ...manifest, status: 'release-proven', release });
  return { receiptFile, receiptId };
}

export function recordReleaseCanaryExternalWorker(input: {
  repositoryRoot: string;
  runId: string;
  priorVersionId: string;
  ownedVersionId: string;
}): void {
  const manifest = readReleaseCanaryManifest({ repositoryRoot: input.repositoryRoot, runId: input.runId });
  // WHAT: Reject replacement of an already-recorded shared Worker mutation.
  // WHY: Cleanup authority must remain bound to one predecessor and one harness-owned version.
  if (manifest.externalWorker) throw new ReleaseCanaryHarnessError('release_canary_worker_already_recorded', 'Canary Worker mutation is already recorded.');
  for (const [field, value] of Object.entries({
    priorVersionId: input.priorVersionId,
    ownedVersionId: input.ownedVersionId,
  })) {
    // WHAT: Require stable Wrangler version identities.
    // WHY: Cleanup cannot safely compare or restore an ambiguous external authority.
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(value)) {
      throw new ReleaseCanaryHarnessError('release_canary_worker_identity_invalid', `${field} is invalid.`);
    }
  }
  writeManifest({
    ...manifest,
    externalWorker: {
      priorVersionId: input.priorVersionId,
      ownedVersionId: input.ownedVersionId,
      restored: false,
    },
  });
}

export function recordReleaseCanaryExternalWorkerRestored(input: {
  repositoryRoot: string;
  runId: string;
  priorVersionId: string;
  ownedVersionId: string;
}): void {
  const manifest = readReleaseCanaryManifest({ repositoryRoot: input.repositoryRoot, runId: input.runId });
  // WHAT: Require the exact recorded Worker authority before marking restoration.
  // WHY: A different predecessor or owned version cannot discharge cleanup responsibility.
  if (
    !manifest.externalWorker
    || manifest.externalWorker.priorVersionId !== input.priorVersionId
    || manifest.externalWorker.ownedVersionId !== input.ownedVersionId
  ) {
    throw new ReleaseCanaryHarnessError('release_canary_worker_restore_authority_invalid', 'Canary Worker restoration does not match the manifest.');
  }
  writeManifest({ ...manifest, externalWorker: { ...manifest.externalWorker, restored: true } });
}

export function recordReleaseCanaryProofComplete(input: {
  repositoryRoot: string;
  runId: string;
}): void {
  const manifest = readReleaseCanaryManifest(input);
  // WHAT: Require canonical release proof and restored shared Worker authority before completion.
  // WHY: A local receipt cannot be complete while release identity or env.dev cleanup remains unresolved.
  if (!manifest.release || !manifest.externalWorker?.restored) {
    throw new ReleaseCanaryHarnessError('release_canary_completion_not_ready', 'Release or env.dev restoration evidence is incomplete.');
  }
  writeManifest({ ...manifest, status: 'proof-complete' });
}

export function readReleaseCanaryManifest(input: {
  repositoryRoot: string;
  runId: string;
}): ReleaseCanaryManifest {
  const repositoryRoot = realpathSync(resolve(input.repositoryRoot));
  const identity = repositoryIdentity(repositoryRoot);
  const runRoot = resolve(releaseCanaryBaseRoot(), identity, stableRunId(input.runId));
  const manifestFile = resolve(runRoot, 'manifest.json');
  let manifest: ReleaseCanaryManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as ReleaseCanaryManifest;
  } catch {
    throw new ReleaseCanaryHarnessError('release_canary_manifest_invalid', 'Canary manifest is unavailable or invalid.');
  }
  const expectedIntegrity = sha256(JSON.stringify({ ...manifest, integritySha256: '' }));
  // WHAT: Require the manifest to identify the exact derived run root and repository.
  // WHY: Cleanup authority cannot be delegated by editable paths inside the manifest.
  if (
    manifest.version !== 2
    || manifest.integritySha256 !== expectedIntegrity
    || manifest.runId !== input.runId
    || manifest.repositoryRoot !== repositoryRoot
    || manifest.repositoryIdentity !== identity
    || manifest.runRoot !== runRoot
    || manifest.manifestFile !== manifestFile
    || manifest.snapshotArchiveRoot !== resolve(runRoot, 'snapshot', 'archive')
    || manifest.snapshotCatalogRoot !== resolve(runRoot, 'snapshot', 'catalog')
    || manifest.lanes.baseline !== resolve(runRoot, 'lanes', 'baseline')
    || manifest.lanes.candidate !== resolve(runRoot, 'lanes', 'candidate')
    || manifest.lanes.recovery !== resolve(runRoot, 'lanes', 'recovery')
    || manifest.runtimeFixtures.baseline.canaryA !== manifest.lanes.baseline
    || manifest.runtimeFixtures.baseline.canaryB !== resolve(runRoot, 'lanes', 'baseline-empty')
    || manifest.runtimeFixtures.candidate.canaryA !== manifest.lanes.candidate
    || manifest.runtimeFixtures.candidate.canaryB !== resolve(runRoot, 'lanes', 'candidate-empty')
    || manifest.resources.length !== 1
    || manifest.resources[0]?.kind !== 'directory'
    || manifest.resources[0]?.path !== runRoot
  ) {
    throw new ReleaseCanaryHarnessError('release_canary_manifest_authority_invalid', 'Canary manifest ownership is invalid.');
  }
  return manifest;
}

export async function cleanupReleaseCanaryRun(input: {
  repositoryRoot: string;
  runId: string;
  readActiveDevWorkerVersion?: () => Promise<string>;
  restoreDevWorkerVersion?: (versionId: string) => Promise<void>;
}): Promise<{ cleaned: boolean; runId: string; status: 'cleaned' | 'external-worker-drift' }> {
  const manifest = readReleaseCanaryManifest(input);
  // WHAT: Reconcile a manifest-owned Worker mutation before deleting local proof evidence.
  // WHY: Cleanup must not erase evidence while shared external authority is unresolved.
  if (manifest.externalWorker) {
    // WHAT: Require both fixed external cleanup effects.
    // WHY: Silent local-only cleanup would leave env.dev on the harness version.
    if (!input.readActiveDevWorkerVersion || !input.restoreDevWorkerVersion) {
      throw new ReleaseCanaryHarnessError('release_canary_worker_cleanup_unavailable', 'Canary Worker cleanup effects are unavailable.');
    }
    const active = await input.readActiveDevWorkerVersion();
    // WHAT: Fail closed when another actor changed the shared dev Worker.
    // WHY: The harness must never overwrite an external deployment it does not own.
    if (active !== manifest.externalWorker.ownedVersionId && active !== manifest.externalWorker.priorVersionId) {
      return { cleaned: false, runId: manifest.runId, status: 'external-worker-drift' };
    }
    // WHAT: Restore only when the harness-owned version is still active.
    // WHY: The recorded predecessor already active means activation never took effect or was already compensated.
    if (active === manifest.externalWorker.ownedVersionId) {
      await input.restoreDevWorkerVersion(manifest.externalWorker.priorVersionId);
      const restored = await input.readActiveDevWorkerVersion();
      // WHAT: Retain evidence unless the prior Worker version is confirmed active.
      // WHY: Local cleanup cannot claim completion while external restoration is unproven.
      if (restored !== manifest.externalWorker.priorVersionId) {
        throw new ReleaseCanaryHarnessError('release_canary_worker_restore_unverified', 'Canary Worker restoration was not verified.');
      }
    }
  }
  const repositoryRunsRoot = resolve(releaseCanaryBaseRoot(), manifest.repositoryIdentity);
  requireInside(repositoryRunsRoot, manifest.runRoot, 'release_canary_cleanup_path_invalid');
  const repositoryRunsStat = lstatSync(repositoryRunsRoot);
  // WHAT: Require the exact real repository run directory and one direct child run.
  // WHY: Symlinked ancestors and identity-root aliases must not redirect or broaden recursive deletion.
  if (
    !repositoryRunsStat.isDirectory()
    || repositoryRunsStat.isSymbolicLink()
    || realpathSync(repositoryRunsRoot) !== repositoryRunsRoot
    || dirname(manifest.runRoot) !== repositoryRunsRoot
  ) {
    throw new ReleaseCanaryHarnessError('release_canary_cleanup_parent_invalid', 'Canary cleanup parent is not the exact owned directory.');
  }
  const runStat = lstatSync(manifest.runRoot);
  // WHAT: Delete only the real manifest-owned directory, never a substituted symlink.
  // WHY: Lexical containment alone cannot protect recursive cleanup from symlinked ancestry.
  if (!runStat.isDirectory() || runStat.isSymbolicLink() || realpathSync(manifest.runRoot) !== manifest.runRoot) {
    throw new ReleaseCanaryHarnessError('release_canary_cleanup_target_invalid', 'Canary cleanup target is not the exact owned directory.');
  }
  rmSync(realpathSync(manifest.runRoot), { recursive: true, force: true });
  return { cleaned: true, runId: manifest.runId, status: 'cleaned' };
}

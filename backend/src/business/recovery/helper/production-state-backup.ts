/**
 * WHAT: Archives and independently restores every settings-owned production Decision OS state root.
 * WHY: Destructive recovery needs byte-preserving authority for the complete registered catalog and active releases.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  createReadStream,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { copyFile, mkdir, statfs } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { hashTaskCurrentBucket, hashTaskCurrentRoot, taskCurrentBucketForEntityKey } from '../../../../../shared/task-current-state-core.js';
import { readProjectRegistry, type ProjectRegistry, type ProjectRegistryEntry } from '../../server/helper/project-registry.js';
import { assertTaskCurrentEntity } from '../../task-state/helper/task-current-state-join.js';
import type { TaskCurrentBucket, TaskCurrentEntity, TaskCurrentFormat } from '../../task-state/helper/task-current-state-types.js';

const manifestName = 'decision-os-production-state-backup.json';

type InventoryEntry = {
  relativePath: string;
  type: 'directory' | 'file' | 'symlink';
  mode: number;
  bytes: number;
  sha256: string;
  linkTarget: string;
};

type TreeInventory = {
  owner: string;
  sourceRoot: string;
  archiveRelative: string;
  entries: InventoryEntry[];
  directoryCount: number;
  fileCount: number;
  symlinkCount: number;
  byteCount: number;
  rootHash: string;
};

type ProjectTopology = {
  id: string;
  name: string;
  relativePath: string;
  lexicalProjectRoot: string;
  canonicalProjectRoot: string;
  lexicalType: 'directory' | 'symlink';
  lexicalLinkTarget: string;
  sourceDecisionOsRoot: string;
  archiveRelative: string;
  restoredDecisionOsRoot: string;
};

type ProjectTaskStateInventory = {
  projectId: string;
  stateProtocol: string;
  stateSchema: number;
  baselineEpoch: number;
  formatBaselineRoot: string;
  entityCount: number;
  heldEntityCount: number;
  journalCount: number;
  currentBytes: number;
  bucketManifest: TaskCurrentBucket[];
  root: string;
};

type ReleaseProof = {
  releaseRoot: string;
  currentPointer: string;
  activeReleasePath: string;
  releaseSha: string;
  deliveryProtocol: number;
  markerFile: string;
  launcherFile: string;
};

export type ProductionStateBackupManifest = {
  version: 1;
  kind: 'decision-os-production-state-backup';
  status: 'verified';
  backupId: string;
  createdAt: string;
  backupDirectory: string;
  manifestFile: string;
  settingsFile: string;
  catalogRoot: string;
  masterDecisionOsRoot: string;
  releaseRoot: string;
  registryVersion: 2;
  registry: ProjectRegistry;
  projectCount: number;
  projects: ProjectTopology[];
  sourceInventories: TreeInventory[];
  archiveInventories: TreeInventory[];
  restoredInventories: TreeInventory[];
  sourceRootHash: string;
  archiveRootHash: string;
  restoredRootHash: string;
  directoryCount: number;
  fileCount: number;
  symlinkCount: number;
  byteCount: number;
  taskState: ProjectTaskStateInventory[];
  release: ReleaseProof;
  restoration: {
    ready: true;
    restoreRoot: string;
    sourceMutationPerformed: false;
    verifiedEntryCount: number;
  };
  retention: {
    archive: 'retain';
    restoreProof: 'retain';
    automaticDeletionPermitted: false;
  };
};

export class ProductionStateBackupError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ProductionStateBackupError';
  }
}

function contained(parent: string, child: string): boolean {
  const inner = relative(resolve(parent), resolve(child));
  return inner === '' || (inner !== '..' && !inner.startsWith('../') && !isAbsolute(inner));
}

function sha256Bytes(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file, { highWaterMark: 256 * 1024 })) hash.update(chunk);
  return hash.digest('hex');
}

function inventoryIdentity(inventory: Pick<TreeInventory, 'owner' | 'archiveRelative' | 'entries'>): string {
  return `${JSON.stringify({
    owner: inventory.owner,
    archiveRelative: inventory.archiveRelative,
    entries: inventory.entries.map((entry) => ({
      relativePath: entry.relativePath,
      type: entry.type,
      mode: entry.mode,
      bytes: entry.bytes,
      sha256: entry.sha256,
      linkTarget: entry.linkTarget,
    })),
  })}\n`;
}

async function inventoryTree(input: {
  owner: string;
  sourceRoot: string;
  archiveRelative: string;
}): Promise<TreeInventory> {
  const entries: InventoryEntry[] = [];
  const visit = async (absolute: string, relativePath: string): Promise<void> => {
    const metadata = lstatSync(absolute);
    // WHAT: Record link text as a terminal entry without following its target.
    // WHY: Unregistered links must never widen the backup read boundary.
    if (metadata.isSymbolicLink()) {
      const linkTarget = readlinkSync(absolute);
      entries.push({
        relativePath,
        type: 'symlink',
        mode: metadata.mode & 0o7777,
        bytes: Buffer.byteLength(linkTarget),
        sha256: sha256Bytes(linkTarget),
        linkTarget,
      });
      return;
    }
    // WHAT: Inventory every directory, including an empty directory.
    // WHY: Restoration topology and owner-only permissions are part of production state.
    if (metadata.isDirectory()) {
      entries.push({ relativePath, type: 'directory', mode: metadata.mode & 0o7777, bytes: 0, sha256: '', linkTarget: '' });
      for (const name of readdirSync(absolute).sort()) {
        await visit(resolve(absolute, name), relativePath ? `${relativePath}/${name}` : name);
      }
      return;
    }
    // WHAT: Admit ordinary files as the sole byte-bearing source type.
    // WHY: Sockets, devices, pipes, and live processes are outside restoration authority.
    if (!metadata.isFile()) {
      throw new ProductionStateBackupError('production_state_backup_source_type_unsupported', `Unsupported source object: ${absolute}.`);
    }
    entries.push({
      relativePath,
      type: 'file',
      mode: metadata.mode & 0o7777,
      bytes: metadata.size,
      sha256: await sha256File(absolute),
      linkTarget: '',
    });
  };
  await visit(resolve(input.sourceRoot), '');
  const sorted = entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const inventory: TreeInventory = {
    owner: input.owner,
    sourceRoot: resolve(input.sourceRoot),
    archiveRelative: input.archiveRelative,
    entries: sorted,
    directoryCount: sorted.filter((entry) => entry.type === 'directory').length,
    fileCount: sorted.filter((entry) => entry.type === 'file').length,
    symlinkCount: sorted.filter((entry) => entry.type === 'symlink').length,
    byteCount: sorted.reduce((sum, entry) => sum + entry.bytes, 0),
    rootHash: '',
  };
  inventory.rootHash = sha256Bytes(inventoryIdentity(inventory));
  return inventory;
}

function inventorySetHash(inventories: readonly TreeInventory[]): string {
  return sha256Bytes(inventories
    .map((inventory) => `${inventory.owner}\u0000${inventory.archiveRelative}\u0000${inventory.rootHash}`)
    .sort()
    .join('\n'));
}

function inventoryEqual(left: TreeInventory, right: TreeInventory): boolean {
  return left.owner === right.owner
    && left.archiveRelative === right.archiveRelative
    && left.directoryCount === right.directoryCount
    && left.fileCount === right.fileCount
    && left.symlinkCount === right.symlinkCount
    && left.byteCount === right.byteCount
    && left.rootHash === right.rootHash;
}

function inventorySetsEqual(left: readonly TreeInventory[], right: readonly TreeInventory[]): boolean {
  const rightByOwner = new Map(right.map((inventory) => [inventory.owner, inventory]));
  return left.length === right.length && left.every((inventory) => {
    const matched = rightByOwner.get(inventory.owner);
    return Boolean(matched && inventoryEqual(inventory, matched));
  });
}

async function copyInventory(input: {
  inventory: TreeInventory;
  destinationRoot: string;
}): Promise<void> {
  const destinationBase = resolve(input.destinationRoot, input.inventory.archiveRelative);
  const directories: Array<{ path: string; mode: number }> = [];
  for (const entry of input.inventory.entries) {
    const source = entry.relativePath ? resolve(input.inventory.sourceRoot, entry.relativePath) : input.inventory.sourceRoot;
    const destination = entry.relativePath ? resolve(destinationBase, entry.relativePath) : destinationBase;
    // WHAT: Recreate each inventoried directory and its exact permission mode.
    // WHY: Empty directories and owner-only settings roots must survive restoration.
    if (entry.type === 'directory') {
      mkdirSync(destination, { recursive: true, mode: 0o700 });
      directories.push({ path: destination, mode: entry.mode });
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    // WHAT: Recreate a symlink from its recorded text without opening its target.
    // WHY: The backup preserves link authority but never reads unregistered external bytes.
    if (entry.type === 'symlink') {
      symlinkSync(entry.linkTarget, destination);
      continue;
    }
    await copyFile(source, destination);
    chmodSync(destination, entry.mode);
  }
  for (const directory of directories.sort((left, right) => right.path.length - left.path.length)) {
    chmodSync(directory.path, directory.mode);
  }
}

function readSettings(settingsFileInput: string): { file: string; settings: Record<string, unknown> } {
  const file = realpathSync(resolve(settingsFileInput));
  const value = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  // WHAT: Require one object-shaped settings authority.
  // WHY: Production state roots must not be inferred from an invalid secret-bearing document.
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProductionStateBackupError('production_state_backup_settings_invalid', 'Production settings are invalid.');
  }
  return { file, settings: value as Record<string, unknown> };
}

function requiredAbsoluteSetting(settings: Record<string, unknown>, key: string): string {
  const value = String(settings[key] ?? '');
  // WHAT: Accept only absolute settings-owned filesystem authority.
  // WHY: Relative state roots could resolve against an operator-selected working directory.
  if (!isAbsolute(value)) {
    throw new ProductionStateBackupError('production_state_backup_settings_invalid', `${key} must be an absolute path.`);
  }
  return resolve(value);
}

function projectTopology(input: {
  catalogRoot: string;
  entry: ProjectRegistryEntry;
  restoreCatalogRoot: string;
}): ProjectTopology {
  const lexicalProjectRoot = resolve(input.catalogRoot, input.entry.relativePath);
  // WHAT: Require the registered lexical path to remain beneath the settings-owned catalog.
  // WHY: Only the version-2 registry may authorize an external target through an explicit symlink.
  if (!contained(input.catalogRoot, lexicalProjectRoot)) {
    throw new ProductionStateBackupError('production_state_backup_project_path_invalid', `Registered project path escapes the catalog: ${input.entry.relativePath}.`);
  }
  const lexicalMetadata = lstatSync(lexicalProjectRoot);
  // WHAT: Admit a registered project root only as a directory or a terminal symlink.
  // WHY: Ardaria uses an explicit lexical symlink while arbitrary filesystem objects are not project authority.
  if (!lexicalMetadata.isDirectory() && !lexicalMetadata.isSymbolicLink()) {
    throw new ProductionStateBackupError('production_state_backup_project_root_type_invalid', `Registered project root is invalid: ${input.entry.relativePath}.`);
  }
  const canonicalProjectRoot = realpathSync(lexicalProjectRoot);
  const sourceDecisionOsRoot = realpathSync(resolve(canonicalProjectRoot, '.decision-os'));
  // WHAT: Require the canonical Decision OS root beneath the registered canonical project root.
  // WHY: A project-local `.decision-os` link must not delegate state to another unregistered tree.
  if (!contained(canonicalProjectRoot, sourceDecisionOsRoot)) {
    throw new ProductionStateBackupError('production_state_backup_project_state_invalid', `Registered project state escapes its canonical root: ${input.entry.relativePath}.`);
  }
  const archiveRelative = `state/projects/${encodeURIComponent(input.entry.id)}/decision-os`;
  return {
    id: input.entry.id,
    name: input.entry.name,
    relativePath: input.entry.relativePath,
    lexicalProjectRoot,
    canonicalProjectRoot,
    lexicalType: lexicalMetadata.isSymbolicLink() ? 'symlink' : 'directory',
    lexicalLinkTarget: lexicalMetadata.isSymbolicLink() ? readlinkSync(lexicalProjectRoot) : '',
    sourceDecisionOsRoot,
    archiveRelative,
    restoredDecisionOsRoot: resolve(input.restoreCatalogRoot, input.entry.relativePath, '.decision-os'),
  };
}

function heldEntityKeys(taskStateRoot: string): Set<string> {
  const heldRoot = resolve(taskStateRoot, 'local', 'held');
  const keys = new Set<string>();
  // WHAT: Treat an absent held directory as an empty publication hold set.
  // WHY: Valid epoch-4 stores created before held publication have no marker directory.
  if (!existsSync(heldRoot)) return keys;
  for (const name of readdirSync(heldRoot).filter((entry) => entry.endsWith('.json')).sort()) {
    const value = JSON.parse(readFileSync(resolve(heldRoot, name), 'utf8')) as { version?: unknown; taskId?: unknown; entityKeys?: unknown };
    // WHAT: Require the existing held-marker contract before excluding an entity from the root.
    // WHY: Invalid durable state must remain preserved and must block a false semantic success claim.
    if (value.version !== 1 || typeof value.taskId !== 'string' || !Array.isArray(value.entityKeys)) {
      throw new ProductionStateBackupError('production_state_backup_held_marker_invalid', `Invalid held marker: ${name}.`);
    }
    for (const key of value.entityKeys) keys.add(String(key));
  }
  return keys;
}

function taskStateInventory(decisionOsRoot: string, projectId: string): ProjectTaskStateInventory {
  const taskStateRoot = resolve(decisionOsRoot, 'task-state', projectId);
  const format = JSON.parse(readFileSync(resolve(taskStateRoot, 'format.json'), 'utf8')) as TaskCurrentFormat;
  // WHAT: Require the compatible epoch-4 format for every registered project.
  // WHY: A catalog-wide backup cannot claim restoration readiness from MOH semantics alone.
  if (format.stateProtocol !== 'decision-os-task-state/4' || format.stateSchema !== 4 || format.baselineEpoch !== 4 || format.projectId !== projectId) {
    throw new ProductionStateBackupError('production_state_backup_task_state_format_invalid', `Task-state format is invalid for project ${projectId}.`);
  }
  const held = heldEntityKeys(taskStateRoot);
  const buckets = new Map<string, Map<string, TaskCurrentEntity>>();
  let entityCount = 0;
  let currentBytes = 0;
  const currentRoot = resolve(taskStateRoot, 'current');
  const entityTypes = existsSync(currentRoot) ? readdirSync(currentRoot).sort() : [];
  for (const entityType of entityTypes) {
    const directory = resolve(currentRoot, entityType);
    // WHAT: Require each current-state entity-type entry to be a directory.
    // WHY: Unexpected durable objects cannot be silently omitted from the calculated root.
    if (!statSync(directory).isDirectory()) {
      throw new ProductionStateBackupError('production_state_backup_task_state_current_invalid', `Unexpected current-state object: ${directory}.`);
    }
    for (const name of readdirSync(directory).filter((entry) => entry.endsWith('.json')).sort()) {
      const file = resolve(directory, name);
      const entity = JSON.parse(readFileSync(file, 'utf8')) as TaskCurrentEntity;
      assertTaskCurrentEntity(entity);
      // WHAT: Reject a current entity attributed to another registered project.
      // WHY: Cross-project state would invalidate the owner inventory and relay root.
      if (entity.projectId !== projectId) {
        throw new ProductionStateBackupError('production_state_backup_task_state_project_mismatch', `Current-state entity belongs to another project: ${file}.`);
      }
      entityCount += 1;
      currentBytes += statSync(file).size;
      const key = `${entity.entityType}\u0000${entity.entityId}`;
      // WHAT: Leave held entities outside the active replicated root.
      // WHY: Held task publication markers intentionally withhold their entities from federation.
      if (held.has(key)) continue;
      const bucket = taskCurrentBucketForEntityKey(key);
      const entries = buckets.get(bucket) ?? new Map<string, TaskCurrentEntity>();
      entries.set(key, entity);
      buckets.set(bucket, entries);
    }
  }
  const bucketManifest = [...buckets.entries()].map(([bucket, entries]) => ({
    bucket,
    count: entries.size,
    checksum: hashTaskCurrentBucket(entries),
  })).sort((left, right) => left.bucket.localeCompare(right.bucket));
  const journalRoot = resolve(taskStateRoot, 'journal');
  return {
    projectId,
    stateProtocol: format.stateProtocol,
    stateSchema: format.stateSchema,
    baselineEpoch: format.baselineEpoch,
    formatBaselineRoot: format.baselineRoot,
    entityCount,
    heldEntityCount: held.size,
    journalCount: existsSync(journalRoot) ? readdirSync(journalRoot).filter((entry) => entry.endsWith('.json')).length : 0,
    currentBytes,
    bucketManifest,
    root: hashTaskCurrentRoot(bucketManifest),
  };
}

function verifyRegistryTopology(input: {
  masterDecisionOsRoot: string;
  projectRoots: ReadonlyMap<string, string>;
  expectedRegistry: ProjectRegistry;
}): void {
  const registry = readProjectRegistry(input.masterDecisionOsRoot);
  // WHAT: Require the restored version-2 registry and exact project identity set.
  // WHY: File hashes alone do not prove that the restored catalog is addressable.
  if (!registry || JSON.stringify(registry) !== JSON.stringify(input.expectedRegistry)) {
    throw new ProductionStateBackupError('production_state_backup_restored_registry_invalid', 'Restored project registry does not match the source authority.');
  }
  for (const entry of Object.values(registry.projects)) {
    const root = input.projectRoots.get(entry.id);
    // WHAT: Require one restored Decision OS root for every registry identity.
    // WHY: A complete registry with a missing project tree is not restoration-ready.
    if (!root) {
      throw new ProductionStateBackupError('production_state_backup_restored_project_missing', `Restored project is missing: ${entry.id}.`);
    }
    const identity = JSON.parse(readFileSync(resolve(root, 'project.json'), 'utf8')) as { id?: unknown };
    // WHAT: Bind the restored project bytes to the exact registry key.
    // WHY: A reused path must not substitute another project's state.
    if (String(identity.id ?? '') !== entry.id) {
      throw new ProductionStateBackupError('production_state_backup_restored_project_identity_mismatch', `Restored project identity is invalid: ${entry.id}.`);
    }
  }
}

function verifyRelease(releaseRootInput: string): ReleaseProof {
  const releaseRoot = resolve(releaseRootInput);
  const currentPointer = resolve(releaseRoot, 'current');
  // WHAT: Require the active release authority to remain a symbolic link.
  // WHY: Delivery activation is an atomic pointer, not a copied directory convention.
  if (!existsSync(currentPointer) || !lstatSync(currentPointer).isSymbolicLink()) {
    throw new ProductionStateBackupError('production_state_backup_release_pointer_invalid', 'Active release pointer is invalid.');
  }
  const activeReleasePath = resolve(dirname(currentPointer), readlinkSync(currentPointer));
  // WHAT: Require the pointer target inside the immutable releases directory.
  // WHY: A restored pointer must not launch code outside settings-owned release authority.
  if (!contained(resolve(releaseRoot, 'releases'), activeReleasePath)) {
    throw new ProductionStateBackupError('production_state_backup_release_pointer_escape', 'Active release pointer escapes immutable releases.');
  }
  const markerFile = resolve(activeReleasePath, '.decision-os-release.json');
  const marker = JSON.parse(readFileSync(markerFile, 'utf8')) as { protocol?: unknown; releaseSha?: unknown; launcher?: unknown };
  // WHAT: Require the fixed release marker and full Git identity.
  // WHY: Restored executable bytes must remain bound to canonical delivery protocol 1.
  if (marker.protocol !== 1 || typeof marker.releaseSha !== 'string' || !/^[a-f0-9]{40}$/.test(marker.releaseSha) || marker.launcher !== 'bin/decision-os-server.mjs') {
    throw new ProductionStateBackupError('production_state_backup_release_marker_invalid', 'Active release marker is invalid.');
  }
  // WHAT: Match the immutable release directory to its marker SHA.
  // WHY: Pointer and marker disagreement would make reported release identity ambiguous.
  if (basename(activeReleasePath) !== marker.releaseSha) {
    throw new ProductionStateBackupError('production_state_backup_release_identity_mismatch', 'Active release directory does not match its marker.');
  }
  const launcherFile = resolve(activeReleasePath, marker.launcher);
  // WHAT: Require the restored launcher to be an ordinary file.
  // WHY: A marker without executable release content is not restoration-ready.
  if (!existsSync(launcherFile) || !statSync(launcherFile).isFile()) {
    throw new ProductionStateBackupError('production_state_backup_release_launcher_missing', 'Active release launcher is unavailable.');
  }
  return {
    releaseRoot,
    currentPointer,
    activeReleasePath,
    releaseSha: marker.releaseSha,
    deliveryProtocol: marker.protocol,
    markerFile,
    launcherFile,
  };
}

function atomicDurableJson(file: string, value: unknown): void {
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
  const descriptor = openSync(temporary, 'wx', 0o600);
  try {
    try {
      writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, file);
  } catch (error) {
    throw error;
  }
  const fileDescriptor = openSync(file, 'r');
  try { fsyncSync(fileDescriptor); } finally { closeSync(fileDescriptor); }
  const directoryDescriptor = openSync(dirname(file), 'r');
  try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
}

async function assertCapacity(parent: string, byteCount: number, availableBytes?: bigint): Promise<void> {
  const capacity = availableBytes === undefined ? await statfs(parent, { bigint: true }) : null;
  const available = availableBytes ?? (capacity!.bavail * capacity!.bsize);
  const required = BigInt(Math.ceil(byteCount * 2.1 + 1024 * 1024));
  // WHAT: Require space for the retained archive, retained restore proof, and ten-percent margin.
  // WHY: A partial second copy cannot prove restoration readiness.
  if (available < required) {
    throw new ProductionStateBackupError('production_state_backup_capacity_insufficient', `Backup capacity is insufficient: ${available} available, ${required} required.`);
  }
}

function assertNewExternalBackup(input: {
  backupDirectory: string;
  catalogRoot: string;
  protectedRoots: readonly string[];
}): { backupDirectory: string; parent: string } {
  const requested = resolve(input.backupDirectory);
  // WHAT: Require an absolute normalized destination selected explicitly by the operator.
  // WHY: Relative paths can resolve into live production state.
  if (!isAbsolute(input.backupDirectory) || requested !== input.backupDirectory) {
    throw new ProductionStateBackupError('production_state_backup_path_invalid', 'Backup directory must be an absolute normalized path.');
  }
  // WHAT: Require a new destination with no pre-existing bytes.
  // WHY: Existing content could substitute evidence or be overwritten.
  if (existsSync(requested)) {
    throw new ProductionStateBackupError('production_state_backup_already_exists', 'Backup directory must not already exist.');
  }
  // WHAT: Require the backup outside the complete production catalog.
  // WHY: A catalog recovery must not consume or overwrite its own retained authority.
  if (contained(input.catalogRoot, requested) || contained(requested, input.catalogRoot)) {
    throw new ProductionStateBackupError('production_state_backup_not_external', 'Backup directory must be external to the production catalog.');
  }
  for (const protectedRoot of input.protectedRoots) {
    // WHAT: Reject overlap in either direction with each canonical source root.
    // WHY: Registered external targets and release authority require the same separation as the catalog.
    if (contained(protectedRoot, requested) || contained(requested, protectedRoot)) {
      throw new ProductionStateBackupError('production_state_backup_overlaps_source', `Backup directory overlaps source state: ${protectedRoot}.`);
    }
  }
  return { backupDirectory: requested, parent: realpathSync(dirname(requested)) };
}

function totals(inventories: readonly TreeInventory[]) {
  return {
    directoryCount: inventories.reduce((sum, inventory) => sum + inventory.directoryCount, 0),
    fileCount: inventories.reduce((sum, inventory) => sum + inventory.fileCount, 0),
    symlinkCount: inventories.reduce((sum, inventory) => sum + inventory.symlinkCount, 0),
    byteCount: inventories.reduce((sum, inventory) => sum + inventory.byteCount, 0),
  };
}

function assertFixedInventoryOwners(input: {
  inventories: readonly TreeInventory[];
  expectedArchiveByOwner: ReadonlyMap<string, string>;
  collection: string;
}): void {
  const seen = new Set<string>();
  // WHAT: Require the inventory collection to contain the exact fixed owner count.
  // WHY: Duplicate owners could conceal one missing master, project, or release inventory.
  if (input.inventories.length !== input.expectedArchiveByOwner.size) {
    throw new ProductionStateBackupError('production_state_backup_inventory_owners_invalid', `${input.collection} owner count is invalid.`);
  }
  for (const inventory of input.inventories) {
    const expectedArchiveRelative = input.expectedArchiveByOwner.get(inventory.owner);
    // WHAT: Reject duplicate, unknown, and omitted inventory owners.
    // WHY: Map construction must not silently replace one manifest owner with another entry.
    if (seen.has(inventory.owner) || expectedArchiveRelative === undefined) {
      throw new ProductionStateBackupError('production_state_backup_inventory_owners_invalid', `${input.collection} owner is invalid: ${inventory.owner}.`);
    }
    seen.add(inventory.owner);
    // WHAT: Bind each owner to its fixed archive-relative location.
    // WHY: A valid owner name must not redirect archive verification to another retained tree.
    if (inventory.archiveRelative !== expectedArchiveRelative) {
      throw new ProductionStateBackupError('production_state_backup_inventory_mapping_invalid', `${input.collection} archive mapping is invalid: ${inventory.owner}.`);
    }
  }
  // WHAT: Require every expected owner to have been observed exactly once.
  // WHY: Exact count alone cannot distinguish a complete set from substituted identities.
  if ([...input.expectedArchiveByOwner.keys()].some((owner) => !seen.has(owner))) {
    throw new ProductionStateBackupError('production_state_backup_inventory_owners_invalid', `${input.collection} owner set is incomplete.`);
  }
}

function fixedVerificationTopology(input: {
  backupDirectory: string;
  manifest: ProductionStateBackupManifest;
}): {
  restoreRoot: string;
  restoreMasterRoot: string;
  restoreReleaseRoot: string;
  restoredProjectRoots: Map<string, string>;
  restoredRootsByOwner: Map<string, string>;
} {
  const restoreRoot = resolve(input.backupDirectory, 'restored');
  // WHAT: Bind restoration verification to the one fixed backup-owned scratch root.
  // WHY: A modified manifest must not choose an external containment authority.
  if (input.manifest.restoration.restoreRoot !== restoreRoot) {
    throw new ProductionStateBackupError('production_state_backup_restore_root_invalid', 'Restored root does not match the backup-owned topology.');
  }
  const restoreCatalogRoot = resolve(restoreRoot, 'catalog');
  const restoreMasterRoot = resolve(restoreCatalogRoot, '.decision-os');
  const restoreReleaseRoot = resolve(restoreRoot, 'release');
  const registryProjects = Object.values(input.manifest.registry.projects).sort((left, right) => left.id.localeCompare(right.id));
  const projectById = new Map<string, ProjectTopology>();
  for (const project of input.manifest.projects) {
    // WHAT: Reject duplicate project topology identities before path derivation.
    // WHY: A later duplicate must not replace the registered project's retained path.
    if (projectById.has(project.id)) {
      throw new ProductionStateBackupError('production_state_backup_project_topology_invalid', `Duplicate restored project topology: ${project.id}.`);
    }
    projectById.set(project.id, project);
  }
  // WHAT: Require manifest topology count to equal the registry authority.
  // WHY: Verification must cover every registered project and no additional project.
  if (projectById.size !== registryProjects.length || input.manifest.projectCount !== registryProjects.length) {
    throw new ProductionStateBackupError('production_state_backup_project_topology_invalid', 'Restored project topology does not match the registry.');
  }
  const restoredProjectRoots = new Map<string, string>();
  const expectedArchiveByOwner = new Map<string, string>([
    ['master', 'state/master'],
    ['release', 'state/release'],
  ]);
  for (const entry of registryProjects) {
    const project = projectById.get(entry.id);
    const restoredProjectRoot = resolve(restoreCatalogRoot, entry.relativePath);
    // WHAT: Require each registry-relative project path inside the trusted scratch catalog.
    // WHY: A modified registry path must not escape through `..` or an absolute path.
    if (!contained(restoreCatalogRoot, restoredProjectRoot)) {
      throw new ProductionStateBackupError('production_state_backup_project_restore_path_invalid', `Restored project path escapes the catalog: ${entry.id}.`);
    }
    const restoredDecisionOsRoot = resolve(restoredProjectRoot, '.decision-os');
    const archiveRelative = `state/projects/${encodeURIComponent(entry.id)}/decision-os`;
    // WHAT: Require retained project metadata to match the registry-derived fixed paths.
    // WHY: Manifest project paths are evidence only and never path authority.
    if (
      !project
      || project.relativePath !== entry.relativePath
      || project.archiveRelative !== archiveRelative
      || project.restoredDecisionOsRoot !== restoredDecisionOsRoot
    ) {
      throw new ProductionStateBackupError('production_state_backup_project_topology_invalid', `Restored project topology is invalid: ${entry.id}.`);
    }
    restoredProjectRoots.set(entry.id, restoredDecisionOsRoot);
    expectedArchiveByOwner.set(`project:${entry.id}`, archiveRelative);
  }
  assertFixedInventoryOwners({ inventories: input.manifest.sourceInventories, expectedArchiveByOwner, collection: 'source' });
  assertFixedInventoryOwners({ inventories: input.manifest.archiveInventories, expectedArchiveByOwner, collection: 'archive' });
  assertFixedInventoryOwners({ inventories: input.manifest.restoredInventories, expectedArchiveByOwner, collection: 'restored' });
  return {
    restoreRoot,
    restoreMasterRoot,
    restoreReleaseRoot,
    restoredProjectRoots,
    restoredRootsByOwner: new Map<string, string>([
      ['master', restoreMasterRoot],
      ['release', restoreReleaseRoot],
      ...[...restoredProjectRoots].map(([projectId, root]) => [`project:${projectId}`, root] as const),
    ]),
  };
}

export async function prepareProductionStateBackup(input: {
  backupDirectory: string;
  settingsFile: string;
  now?: () => Date;
  availableBytes?: bigint;
  afterCopy?: () => void;
}): Promise<ProductionStateBackupManifest> {
  const authority = readSettings(input.settingsFile);
  const masterDecisionOsRoot = realpathSync(requiredAbsoluteSetting(authority.settings, 'deliveryDecisionOsRoot'));
  // WHAT: Require the fixed settings file to be owned by the selected master root.
  // WHY: A project-local settings file cannot redirect production backup authority.
  if (authority.file !== resolve(masterDecisionOsRoot, '.settings.json')) {
    throw new ProductionStateBackupError('production_state_backup_settings_authority_invalid', 'Settings file does not belong to the selected master root.');
  }
  const catalogRoot = realpathSync(dirname(masterDecisionOsRoot));
  const releaseRoot = realpathSync(requiredAbsoluteSetting(authority.settings, 'deliveryReleaseRoot'));
  const configuredCurrentPointer = requiredAbsoluteSetting(authority.settings, 'deliveryCurrentPointer');
  // WHAT: Require delivery settings to select the release root's canonical current pointer.
  // WHY: Backup authority must not omit or redirect the active release link.
  if (configuredCurrentPointer !== resolve(releaseRoot, 'current')) {
    throw new ProductionStateBackupError('production_state_backup_release_authority_invalid', 'Configured current pointer does not belong to the release root.');
  }
  const registry = readProjectRegistry(masterDecisionOsRoot);
  // WHAT: Require the authoritative version-2 registry.
  // WHY: Recursive discovery can include unregistered roots and omit registered external projects.
  if (!registry) {
    throw new ProductionStateBackupError('production_state_backup_registry_missing', 'Production project registry version 2 is unavailable.');
  }
  const restoreRoot = resolve(input.backupDirectory, 'restored');
  const restoreCatalogRoot = resolve(restoreRoot, 'catalog');
  const projects = Object.values(registry.projects)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => projectTopology({ catalogRoot, entry, restoreCatalogRoot }));
  const selected = assertNewExternalBackup({
    backupDirectory: input.backupDirectory,
    catalogRoot,
    protectedRoots: [masterDecisionOsRoot, releaseRoot, ...projects.map((project) => project.canonicalProjectRoot)],
  });
  const sourceSpecs = [
    { owner: 'master', sourceRoot: masterDecisionOsRoot, archiveRelative: 'state/master' },
    ...projects.map((project) => ({
      owner: `project:${project.id}`,
      sourceRoot: project.sourceDecisionOsRoot,
      archiveRelative: project.archiveRelative,
    })),
    { owner: 'release', sourceRoot: releaseRoot, archiveRelative: 'state/release' },
  ];
  const sourceInventories = await Promise.all(sourceSpecs.map((spec) => inventoryTree(spec)));
  const sourceTotals = totals(sourceInventories);
  await assertCapacity(selected.parent, sourceTotals.byteCount, input.availableBytes);
  mkdirSync(selected.backupDirectory, { recursive: false, mode: 0o700 });
  chmodSync(selected.backupDirectory, 0o700);
  for (const inventory of sourceInventories) await copyInventory({ inventory, destinationRoot: selected.backupDirectory });
  // WHAT: Invoke only an injected observation hook after the complete copy.
  // WHY: Focused tests must prove that concurrent source mutation invalidates admission.
  input.afterCopy?.();
  const afterInventories = await Promise.all(sourceSpecs.map((spec) => inventoryTree(spec)));
  // WHAT: Reject any source mutation observed across the complete copy window.
  // WHY: A torn catalog/release snapshot cannot authorize restoration or destructive recovery.
  if (!inventorySetsEqual(sourceInventories, afterInventories)) {
    throw new ProductionStateBackupError('production_state_backup_source_changed', 'Production state changed during backup.');
  }
  const archiveInventories = await Promise.all(sourceInventories.map((inventory) => inventoryTree({
    owner: inventory.owner,
    sourceRoot: resolve(selected.backupDirectory, inventory.archiveRelative),
    archiveRelative: inventory.archiveRelative,
  })));
  // WHAT: Require an independent inventory of the retained archive to equal the source.
  // WHY: Successful copy calls are not byte-preservation evidence.
  if (!inventorySetsEqual(sourceInventories, archiveInventories)) {
    throw new ProductionStateBackupError('production_state_backup_archive_mismatch', 'Retained archive does not match production state.');
  }
  const restoreMasterRoot = resolve(restoreCatalogRoot, '.decision-os');
  const restoreReleaseRoot = resolve(restoreRoot, 'release');
  const restoreDestinations = new Map<string, string>([
    ['master', restoreMasterRoot],
    ['release', restoreReleaseRoot],
    ...projects.map((project) => [`project:${project.id}`, project.restoredDecisionOsRoot] as const),
  ]);
  for (const archive of archiveInventories) {
    const destination = restoreDestinations.get(archive.owner);
    // WHAT: Require a fixed scratch destination for every archived owner.
    // WHY: The restore proof cannot silently omit an unrecognized inventory.
    if (!destination) {
      throw new ProductionStateBackupError('production_state_backup_restore_owner_invalid', `Restore owner is unavailable: ${archive.owner}.`);
    }
    await copyInventory({
      inventory: { ...archive, sourceRoot: archive.sourceRoot, archiveRelative: '' },
      destinationRoot: destination,
    });
  }
  const restoredInventories = await Promise.all(sourceInventories.map((inventory) => {
    const restoredRoot = restoreDestinations.get(inventory.owner);
    // WHAT: Require the fixed restored root corresponding to the source owner.
    // WHY: A missing topology mapping cannot produce valid restoration evidence.
    if (!restoredRoot) {
      throw new ProductionStateBackupError('production_state_backup_restore_owner_invalid', `Restored owner is unavailable: ${inventory.owner}.`);
    }
    return inventoryTree({ owner: inventory.owner, sourceRoot: restoredRoot, archiveRelative: inventory.archiveRelative });
  }));
  // WHAT: Require every restored file, directory, mode, and link text to match the source.
  // WHY: Archive integrity alone does not prove restoration readiness.
  if (!inventorySetsEqual(sourceInventories, restoredInventories)) {
    throw new ProductionStateBackupError('production_state_backup_restore_mismatch', 'Scratch restoration does not match production state.');
  }
  const restoredProjectRoots = new Map(projects.map((project) => [project.id, project.restoredDecisionOsRoot]));
  verifyRegistryTopology({ masterDecisionOsRoot: restoreMasterRoot, projectRoots: restoredProjectRoots, expectedRegistry: registry });
  const taskState = projects.map((project) => taskStateInventory(project.restoredDecisionOsRoot, project.id));
  const sourceTaskState = projects.map((project) => taskStateInventory(project.sourceDecisionOsRoot, project.id));
  // WHAT: Require every restored epoch-4 semantic inventory to match its source.
  // WHY: Equal files must also remain readable under the current task-state contract.
  if (JSON.stringify(taskState) !== JSON.stringify(sourceTaskState)) {
    throw new ProductionStateBackupError('production_state_backup_task_state_restore_mismatch', 'Restored task-state semantics do not match production.');
  }
  const sourceRelease = verifyRelease(releaseRoot);
  const restoredRelease = verifyRelease(restoreReleaseRoot);
  // WHAT: Require restored release identity to equal production release identity.
  // WHY: A runnable tree with a different active SHA cannot restore coordinator authority.
  if (restoredRelease.releaseSha !== sourceRelease.releaseSha || restoredRelease.deliveryProtocol !== sourceRelease.deliveryProtocol) {
    throw new ProductionStateBackupError('production_state_backup_release_restore_mismatch', 'Restored release identity does not match production.');
  }
  const manifestFile = resolve(selected.backupDirectory, manifestName);
  const createdAt = (input.now ?? (() => new Date()))().toISOString();
  const manifest: ProductionStateBackupManifest = {
    version: 1,
    kind: 'decision-os-production-state-backup',
    status: 'verified',
    backupId: `production-state-${createdAt.replaceAll(':', '-')}-${randomUUID()}`,
    createdAt,
    backupDirectory: selected.backupDirectory,
    manifestFile,
    settingsFile: authority.file,
    catalogRoot,
    masterDecisionOsRoot,
    releaseRoot,
    registryVersion: 2,
    registry,
    projectCount: projects.length,
    projects,
    sourceInventories,
    archiveInventories,
    restoredInventories,
    sourceRootHash: inventorySetHash(sourceInventories),
    archiveRootHash: inventorySetHash(archiveInventories),
    restoredRootHash: inventorySetHash(restoredInventories),
    ...sourceTotals,
    taskState,
    release: {
      ...restoredRelease,
      releaseRoot,
      currentPointer: configuredCurrentPointer,
      activeReleasePath: sourceRelease.activeReleasePath,
      markerFile: sourceRelease.markerFile,
      launcherFile: sourceRelease.launcherFile,
    },
    restoration: {
      ready: true,
      restoreRoot,
      sourceMutationPerformed: false,
      verifiedEntryCount: sourceInventories.reduce((sum, inventory) => sum + inventory.entries.length, 0),
    },
    retention: { archive: 'retain', restoreProof: 'retain', automaticDeletionPermitted: false },
  };
  atomicDurableJson(manifestFile, manifest);
  chmodSync(manifestFile, 0o600);
  return manifest;
}

export async function verifyProductionStateBackup(input: {
  backupDirectory: string;
}): Promise<ProductionStateBackupManifest> {
  const backupDirectory = realpathSync(resolve(input.backupDirectory));
  const manifestFile = resolve(backupDirectory, manifestName);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as ProductionStateBackupManifest;
  // WHAT: Bind verification to the fixed retained manifest and owner-only backup directory.
  // WHY: Verification must not accept redirected paths, cleanup authority, or another manifest kind.
  if (
    manifest.version !== 1
    || manifest.kind !== 'decision-os-production-state-backup'
    || manifest.status !== 'verified'
    || manifest.backupDirectory !== backupDirectory
    || manifest.manifestFile !== manifestFile
    || manifest.registryVersion !== 2
    || manifest.registry?.version !== 2
    || !manifest.registry.projects
    || typeof manifest.registry.projects !== 'object'
    || Array.isArray(manifest.registry.projects)
    || !Array.isArray(manifest.projects)
    || !Array.isArray(manifest.sourceInventories)
    || !Array.isArray(manifest.archiveInventories)
    || !Array.isArray(manifest.restoredInventories)
    || manifest.projectCount !== manifest.projects.length
    || !manifest.restoration
    || typeof manifest.restoration !== 'object'
    || !manifest.retention
    || typeof manifest.retention !== 'object'
    || manifest.retention.archive !== 'retain'
    || manifest.retention.restoreProof !== 'retain'
    || manifest.retention.automaticDeletionPermitted !== false
    || (statSync(backupDirectory).mode & 0o077) !== 0
    || (statSync(manifestFile).mode & 0o077) !== 0
  ) {
    throw new ProductionStateBackupError('production_state_backup_manifest_invalid', 'Production-state backup manifest authority is invalid.');
  }
  const topology = fixedVerificationTopology({ backupDirectory, manifest });
  const archiveInventories = await Promise.all(manifest.archiveInventories.map((inventory) => inventoryTree({
    owner: inventory.owner,
    sourceRoot: (() => {
      const root = resolve(backupDirectory, inventory.archiveRelative);
      // WHAT: Keep each retained archive inventory inside the selected backup directory.
      // WHY: A modified manifest must not redirect verification to production or unrelated state.
      if (!contained(backupDirectory, root)) {
        throw new ProductionStateBackupError('production_state_backup_archive_path_invalid', `Archive path is invalid: ${inventory.owner}.`);
      }
      return root;
    })(),
    archiveRelative: inventory.archiveRelative,
  })));
  // WHAT: Recompute every retained archive inventory from disk.
  // WHY: Edited, missing, added, renamed, and mode-changed objects must invalidate verification.
  if (!inventorySetsEqual(manifest.sourceInventories, archiveInventories) || inventorySetHash(archiveInventories) !== manifest.archiveRootHash) {
    throw new ProductionStateBackupError('production_state_backup_archive_changed', 'Retained production-state archive changed.');
  }
  const restoredInventories = await Promise.all(manifest.restoredInventories.map((inventory) => {
    const root = topology.restoredRootsByOwner.get(inventory.owner);
    // WHAT: Require every manifest owner inside the retained scratch topology.
    // WHY: A modified manifest must not redirect verification to live or unrelated files.
    if (!root || !contained(topology.restoreRoot, root)) {
      throw new ProductionStateBackupError('production_state_backup_restore_path_invalid', `Restored path is invalid: ${inventory.owner}.`);
    }
    return inventoryTree({ owner: inventory.owner, sourceRoot: root, archiveRelative: inventory.archiveRelative });
  }));
  // WHAT: Recompute every retained restored inventory independently.
  // WHY: Restoration proof must remain byte-identical after preparation.
  if (!inventorySetsEqual(manifest.sourceInventories, restoredInventories) || inventorySetHash(restoredInventories) !== manifest.restoredRootHash) {
    throw new ProductionStateBackupError('production_state_backup_restore_changed', 'Retained restoration proof changed.');
  }
  const registry = readProjectRegistry(topology.restoreMasterRoot);
  // WHAT: Require the retained restored registry before identity verification.
  // WHY: A missing version-2 authority cannot prove catalog restoration.
  if (!registry) {
    throw new ProductionStateBackupError('production_state_backup_restored_registry_invalid', 'Retained restored registry is invalid.');
  }
  verifyRegistryTopology({
    masterDecisionOsRoot: topology.restoreMasterRoot,
    projectRoots: topology.restoredProjectRoots,
    expectedRegistry: manifest.registry,
  });
  const taskState = Object.keys(manifest.registry.projects).sort().map((projectId) => {
    const restoredProjectRoot = topology.restoredProjectRoots.get(projectId);
    // WHAT: Require the trusted registry-derived project root before semantic verification.
    // WHY: Task-state validation must never consume a manifest-selected external path.
    if (!restoredProjectRoot) {
      throw new ProductionStateBackupError('production_state_backup_project_topology_invalid', `Restored project root is unavailable: ${projectId}.`);
    }
    return taskStateInventory(restoredProjectRoot, projectId);
  });
  // WHAT: Require retained epoch-4 semantic evidence to remain unchanged.
  // WHY: Byte changes that still parse must not silently replace the accepted project roots.
  if (JSON.stringify(taskState) !== JSON.stringify(manifest.taskState)) {
    throw new ProductionStateBackupError('production_state_backup_task_state_changed', 'Retained task-state semantics changed.');
  }
  const release = verifyRelease(topology.restoreReleaseRoot);
  // WHAT: Require the retained restored active release identity to remain unchanged.
  // WHY: Restoration readiness includes the exact executable coordinator release.
  if (release.releaseSha !== manifest.release.releaseSha || release.deliveryProtocol !== manifest.release.deliveryProtocol) {
    throw new ProductionStateBackupError('production_state_backup_release_changed', 'Retained restored release identity changed.');
  }
  return manifest;
}

export const productionStateBackupManifestName = manifestName;

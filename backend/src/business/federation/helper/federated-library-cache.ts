/**
 * WHAT: Exports and materializes complete federation skill packages and saved pipeline definitions.
 * WHY: Federation libraries must be local before any Skills or Process Card UI reads them.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { CodexPipeline, CodexPipelineStep } from '../../../../../shared/schemas/codex-pipeline-types.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '../../codex/helper/codex-pipeline-store.js';
import { parseSkillFrontmatter, scanCodexSkills } from '../../codex/helper/scan-codex-skills.js';

const snapshotVersion = 1 as const;
// Base64 expands the package by one third; leave room inside the connector's 25 MiB JSON frame.
const maximumSnapshotBytes = 18 * 1024 * 1024;

export type FederatedSkillFile = { path: string; data: string; mode: number };
export type FederatedSkillPackage = {
  name: string;
  revision: string;
  updatedAt: string;
  files: FederatedSkillFile[];
};
export type FederatedSkillManifestEntry = Omit<FederatedSkillPackage, 'files'>;
export type FederatedSkillManifest = { version: 1; skills: FederatedSkillManifestEntry[] };
export type FederatedSkillSnapshot = { version: 1; skills: FederatedSkillPackage[] };
export type FederatedPipelineDefinition = { pipeline: CodexPipeline; steps: CodexPipelineStep[] };
export type FederatedPipelineSnapshot = { version: 1; pipelines: FederatedPipelineDefinition[] };

function safeSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized !== value) throw new Error('Federated library identity is invalid.');
  return normalized;
}

function safeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.includes('\0') || isAbsolute(normalized)) throw new Error('Federated skill path is invalid.');
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('Federated skill path escapes its package.');
  return normalized;
}

function collectPackageFiles(root: string, directory = root): FederatedSkillFile[] {
  const files: FederatedSkillFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const file = resolve(directory, entry.name);
    if (entry.isSymbolicLink() || lstatSync(file).isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...collectPackageFiles(root, file));
    if (!entry.isFile()) continue;
    const path = safeRelativePath(relative(root, file));
    files.push({ path, data: readFileSync(file).toString('base64'), mode: statSync(file).mode & 0o777 });
  }
  return files;
}

function decodedBytes(files: readonly FederatedSkillFile[]): number {
  return files.reduce((total, file) => total + Buffer.from(file.data, 'base64').byteLength, 0);
}

function packageRevision(files: readonly FederatedSkillFile[]): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(String(file.mode));
    hash.update('\0');
    hash.update(file.data);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function packageUpdatedAt(directory: string): Date {
  let latest = new Date(0);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink() || lstatSync(path).isSymbolicLink()) continue;
    const updatedAt = entry.isDirectory() ? packageUpdatedAt(path) : statSync(path).mtime;
    if (updatedAt > latest) latest = updatedAt;
  }
  return latest;
}

function compareRevision(left: { updatedAt: string; revision: string }, right: { updatedAt: string; revision: string }): number {
  return left.updatedAt.localeCompare(right.updatedAt) || left.revision.localeCompare(right.revision);
}

function exportableSkills(serverRoot: string, workspaceRoots: readonly string[]): ReturnType<typeof scanCodexSkills> {
  const byName = new Map<string, ReturnType<typeof scanCodexSkills>[number]>();
  for (const workspaceRoot of workspaceRoots) {
    for (const skill of scanCodexSkills({ workspaceRoot, serverRoot })) {
      const prior = byName.get(skill.name);
      if (!prior || compareRevision(
        { revision: prior.revision, updatedAt: statSync(prior.skillFile).mtime.toISOString() },
        { revision: skill.revision, updatedAt: statSync(skill.skillFile).mtime.toISOString() },
      ) < 0) byName.set(skill.name, skill);
    }
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function exportFederatedSkillManifest(serverRoot: string, workspaceRoots: readonly string[] = [serverRoot]): FederatedSkillManifest {
  return {
    version: snapshotVersion,
    skills: exportableSkills(serverRoot, workspaceRoots).map((skill) => {
      const packageRoot = dirname(skill.skillFile);
      const files = collectPackageFiles(packageRoot);
      return {
        name: skill.name,
        revision: packageRevision(files),
        updatedAt: packageUpdatedAt(packageRoot).toISOString(),
      };
    }),
  };
}

export function exportFederatedSkillSnapshot(serverRoot: string, skillNames?: ReadonlySet<string>, workspaceRoots: readonly string[] = [serverRoot]): FederatedSkillSnapshot {
  const skills = exportableSkills(serverRoot, workspaceRoots)
    .filter((skill) => !skillNames || skillNames.has(skill.name))
    .map((skill) => {
    const packageRoot = dirname(skill.skillFile);
    const files = collectPackageFiles(packageRoot);
    if (decodedBytes(files) > maximumSnapshotBytes) throw new Error(`Federated skill package exceeds 18 MiB: ${skill.name}.`);
    return {
      name: skill.name,
      revision: packageRevision(files),
      updatedAt: packageUpdatedAt(packageRoot).toISOString(),
      files,
    };
  });
  return { version: snapshotVersion, skills };
}

function validateSkillPackage(skill: FederatedSkillPackage): { files: Array<{ path: string; bytes: Buffer; mode: number }>; updatedAt: Date } {
  safeSegment(skill.name);
  if (!/^[a-f0-9]{64}$/.test(skill.revision)) throw new Error(`Federated skill revision is invalid: ${skill.name}.`);
  const updatedAt = new Date(skill.updatedAt);
  if (!Number.isFinite(updatedAt.getTime())) throw new Error(`Federated skill timestamp is invalid: ${skill.name}.`);
  if (!Array.isArray(skill.files) || skill.files.length === 0) throw new Error(`Federated skill package is empty: ${skill.name}.`);
  const seen = new Set<string>();
  const files = skill.files.map((file) => {
    const path = safeRelativePath(String(file.path ?? ''));
    if (seen.has(path)) throw new Error(`Federated skill package contains a duplicate path: ${skill.name}.`);
    seen.add(path);
    const mode = Number(file.mode);
    if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) throw new Error(`Federated skill file mode is invalid: ${skill.name}.`);
    const data = String(file.data ?? '');
    const bytes = Buffer.from(data, 'base64');
    if (bytes.toString('base64') !== data) throw new Error(`Federated skill file encoding is invalid: ${skill.name}.`);
    return { path, bytes, mode };
  });
  if (decodedBytes(skill.files) > maximumSnapshotBytes) throw new Error(`Federated skill package exceeds 18 MiB: ${skill.name}.`);
  const skillFile = files.find((file) => file.path === 'SKILL.md');
  const metadata = skillFile ? parseSkillFrontmatter(skillFile.bytes.toString('utf8')) : null;
  if (!metadata || metadata.name !== skill.name) throw new Error(`Federated skill package has an invalid SKILL.md: ${skill.name}.`);
  if (packageRevision(skill.files) !== skill.revision) throw new Error(`Federated skill revision does not match its package: ${skill.name}.`);
  return { files, updatedAt };
}

function replaceSkillDirectory(input: { serverRoot: string; skill: FederatedSkillPackage; files: Array<{ path: string; bytes: Buffer; mode: number }>; updatedAt: Date }): void {
  const skillsRoot = resolve(input.serverRoot, '.skills');
  const target = resolve(skillsRoot, safeSegment(input.skill.name));
  const staging = resolve(skillsRoot, `.federated-${safeSegment(input.skill.name)}-${randomUUID()}.tmp`);
  const backup = resolve(skillsRoot, `.federated-${safeSegment(input.skill.name)}-${randomUUID()}.bak`);
  mkdirSync(staging, { recursive: true });
  let backedUp = false;
  try {
    for (const file of input.files) {
      const destination = resolve(staging, file.path);
      const inner = relative(staging, destination);
      if (!inner || inner.startsWith('..') || isAbsolute(inner)) throw new Error('Federated skill destination escapes its package.');
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, file.bytes, { flag: 'wx', mode: file.mode });
      utimesSync(destination, input.updatedAt, input.updatedAt);
    }
    if (existsSync(target)) {
      renameSync(target, backup);
      backedUp = true;
    }
    renameSync(staging, target);
    if (backedUp) rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    if (backedUp && !existsSync(target) && existsSync(backup)) renameSync(backup, target);
    throw error;
  }
}

export function importFederatedSkillSnapshot(input: { serverRoot: string; snapshot: FederatedSkillSnapshot }): { imported: string[] } {
  if (input.snapshot?.version !== snapshotVersion || !Array.isArray(input.snapshot.skills)) throw new Error('Federated skill snapshot is invalid.');
  const packages = [...input.snapshot.skills]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((skill) => ({ skill, validated: validateSkillPackage(skill) }));
  const current = new Map(exportFederatedSkillManifest(input.serverRoot).skills.map((skill) => [skill.name, skill]));
  const imported: string[] = [];
  for (const { skill, validated } of packages) {
    const existing = current.get(skill.name);
    if (existing && compareRevision(existing, skill) >= 0) continue;
    replaceSkillDirectory({ serverRoot: input.serverRoot, skill, ...validated });
    current.set(skill.name, { name: skill.name, revision: skill.revision, updatedAt: skill.updatedAt });
    imported.push(skill.name);
  }
  return { imported };
}

export function exportFederatedPipelineSnapshot(decisionOsRoots: string | readonly string[]): FederatedPipelineSnapshot {
  const roots = typeof decisionOsRoots === 'string' ? [decisionOsRoots] : decisionOsRoots;
  const definitions = new Map<string, FederatedPipelineDefinition>();
  for (const decisionOsRoot of roots) {
    const store = readCodexPipelineStore({ decisionOsRoot }).store;
    const steps = new Map(store.steps.map((step) => [step.id, step]));
    for (const pipeline of store.pipelines) {
      const definition = { pipeline, steps: pipeline.stepIds.map((stepId) => steps.get(stepId)).filter((step): step is CodexPipelineStep => Boolean(step)) };
      const prior = definitions.get(pipeline.id);
      if (!prior || pipelineWinner(prior.pipeline, pipeline) === pipeline) definitions.set(pipeline.id, definition);
    }
  }
  return {
    version: snapshotVersion,
    pipelines: [...definitions.values()].sort((left, right) => left.pipeline.id.localeCompare(right.pipeline.id)),
  };
}

function pipelineWinner(left: CodexPipeline, right: CodexPipeline): CodexPipeline {
  const freshness = left.updatedAt.localeCompare(right.updatedAt);
  if (freshness !== 0) return freshness > 0 ? left : right;
  return JSON.stringify(left).localeCompare(JSON.stringify(right)) >= 0 ? left : right;
}

export function importFederatedPipelineSnapshot(input: { decisionOsRoot: string; snapshot: FederatedPipelineSnapshot }): { imported: string[] } {
  if (input.snapshot?.version !== snapshotVersion || !Array.isArray(input.snapshot.pipelines)) throw new Error('Federated pipeline snapshot is invalid.');
  const before = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  const pipelines = new Map(before.store.pipelines.map((pipeline) => [pipeline.id, pipeline]));
  const steps = new Map(before.store.steps.map((step) => [step.id, step]));
  const imported: string[] = [];
  for (const definition of input.snapshot.pipelines) {
    const pipeline = definition?.pipeline;
    if (!pipeline?.id || !Array.isArray(pipeline.stepIds) || !Array.isArray(definition.steps)) throw new Error('Federated pipeline definition is invalid.');
    if (definition.steps.some((step) => !pipeline.stepIds.includes(step.id))) throw new Error(`Federated pipeline contains an unrelated step: ${pipeline.id}.`);
    if (pipeline.stepIds.some((stepId) => !definition.steps.some((step) => step.id === stepId))) throw new Error(`Federated pipeline is missing a step: ${pipeline.id}.`);
    const existing = pipelines.get(pipeline.id);
    if (existing && pipelineWinner(existing, pipeline) === existing) continue;
    pipelines.set(pipeline.id, pipeline);
    for (const step of definition.steps) steps.set(step.id, step);
    imported.push(pipeline.id);
  }
  if (imported.length > 0) {
    writeCodexPipelineStore({
      decisionOsRoot: input.decisionOsRoot,
      store: { ...before.store, pipelines: [...pipelines.values()], steps: [...steps.values()] },
    });
  }
  return { imported };
}

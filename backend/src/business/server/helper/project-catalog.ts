/**
 * WHAT: Discovers and configures Decision OS projects below one master workspace.
 * WHY: A home-scoped server needs stable, validated project roots without trusting request paths.
 */
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { createLinkedLedger } from '../../ledger/helper/create-linked-ledger.js';
import { readProjectRegistry, type ProjectRegistryEntry } from './project-registry.js';
import { resolveProjectDirectory } from './project-directory-browser.js';

export type DecisionOsProject = {
  id: string;
  name: string;
  relativePath: string;
  root: string;
  decisionOsRoot: string;
  description: string;
  color: string;
  ledgers: Array<{ id: string; title: string; ledgerFile: string }>;
  available: boolean;
  diagnostic: string;
  originFingerprint?: string;
};

type ProjectMetadata = { name: string; description: string; color: string };
type ProjectIdentity = { id?: string };
type ProjectSettings = {
  projects?: Record<string, Partial<ProjectMetadata>>;
  colors?: Record<string, string>;
};
const skippedDirectories = new Set(['.git', '.decision-os', '.worktrees', 'node_modules']);
const defaultColors = ['#38d9e8', '#a78bfa', '#fb7185', '#fbbf24', '#34d399', '#60a5fa'];

function validateProjectCreationInput(nameInput: string, descriptionInput: string): { name: string; description: string } {
  const name = nameInput.trim();
  const description = descriptionInput.trim();
  if (!name) throw new Error('Project name is required.');
  if (name.length > 120) throw new Error('Project name must not exceed 120 characters.');
  if (description.length > 1000) throw new Error('Project description must not exceed 1000 characters.');
  if (name === '.' || name === '..' || /[\\/\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Project name must be a safe directory name without path separators or control characters.');
  }
  return { name, description };
}

function normalizedRelative(root: string, candidate: string): string {
  return relative(root, candidate).split(sep).join('/');
}

function projectId(relativePath: string): string {
  return Buffer.from(relativePath || '.', 'utf8').toString('base64url');
}

function stableProjectId(decisionOsRoot: string, relativePath: string, persistIdentity = true): string {
  const identityFile = resolve(decisionOsRoot, 'project.json');
  try {
    const identity = JSON.parse(readFileSync(identityFile, 'utf8')) as ProjectIdentity;
    const id = String(identity.id ?? '').trim();
    if (/^[a-zA-Z0-9_-]+$/.test(id)) return id;
  } catch {
    // Existing projects receive their legacy URL id on first discovery.
  }
  const id = projectId(relativePath);
  if (!persistIdentity) return id;
  const temporary = `${identityFile}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify({ id }, null, 2)}\n`);
  renameSync(temporary, identityFile);
  return id;
}

export function projectFromRegisteredPath(input: { masterRoot: string; entry: ProjectRegistryEntry }): DecisionOsProject {
  const masterRoot = realpathSync(input.masterRoot);
  const configuredRoot = resolve(masterRoot, input.entry.relativePath);
  const configuredRelativePath = normalizedRelative(masterRoot, configuredRoot) || '.';
  // WHAT: Reject a persisted path that is lexically outside the configured root.
  // WHY: An unavailable path still must not escape containment before realpath validation is possible.
  if (configuredRelativePath === '..' || configuredRelativePath.startsWith('../')) throw new Error('Registered project path escapes the catalog root.');
  let root = configuredRoot;
  let relativePath = configuredRelativePath;
  try {
    const selected = resolveProjectDirectory({ masterRoot, path: configuredRelativePath });
    root = selected.absolutePath;
    relativePath = selected.path;
  } catch {
    return {
      id: input.entry.id,
      name: input.entry.name,
      description: input.entry.description,
      relativePath: input.entry.relativePath,
      root,
      decisionOsRoot: resolve(root, '.decision-os'),
      color: validColor(input.entry.color) ? input.entry.color.toLowerCase() : defaultColors[0],
      ledgers: [],
      available: false,
      diagnostic: `Registered project path is unavailable: ${input.entry.relativePath}`,
    };
  }
  const decisionOsRoot = resolve(root, '.decision-os');
  if (!existsSync(resolve(decisionOsRoot, 'state.json'))) {
    return {
      id: input.entry.id,
      name: input.entry.name,
      description: input.entry.description,
      relativePath,
      root,
      decisionOsRoot,
      color: validColor(input.entry.color) ? input.entry.color.toLowerCase() : defaultColors[0],
      ledgers: [],
      available: false,
      diagnostic: `Registered project state is unavailable: ${input.entry.relativePath}`,
    };
  }
  const id = stableProjectId(decisionOsRoot, relativePath);
  // WHAT: Reject identity drift instead of silently changing a registered URL.
  // WHY: Project identity must remain stable across moves and server restarts.
  if (input.entry.id && input.entry.id !== id) throw new Error(`Registered project identity mismatch: ${input.entry.relativePath}`);
  return {
    id,
    name: input.entry.name.trim() || basename(root),
    description: input.entry.description,
    relativePath,
    root,
    decisionOsRoot,
    color: validColor(input.entry.color) ? input.entry.color.toLowerCase() : defaultColors[0],
    ledgers: ledgersFor(decisionOsRoot),
    available: true,
    diagnostic: '',
  };
}

function settingsFile(masterDecisionOsRoot: string): string {
  return resolve(masterDecisionOsRoot, 'projects.json');
}

function readSettings(masterDecisionOsRoot: string): ProjectSettings {
  try {
    return JSON.parse(readFileSync(settingsFile(masterDecisionOsRoot), 'utf8')) as ProjectSettings;
  } catch {
    return {};
  }
}

function validColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function ledgersFor(decisionOsRoot: string): DecisionOsProject['ledgers'] {
  try {
    const state = JSON.parse(readFileSync(resolve(decisionOsRoot, 'state.json'), 'utf8')) as { ledgers?: unknown[]; tabs?: unknown[] };
    const entries = Array.isArray(state.ledgers) ? state.ledgers : Array.isArray(state.tabs) ? state.tabs : [];
    return entries.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const record = entry as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      const title = String(record.title ?? id).trim();
      const ledgerFile = String(record.ledgerFile ?? '').trim();
      return id && ledgerFile ? [{ id, title, ledgerFile }] : [];
    });
  } catch {
    return [];
  }
}

export function discoverDecisionOsProjects(input: { masterRoot: string; masterDecisionOsRoot: string; persistIdentities?: boolean }): DecisionOsProject[] {
  const masterRoot = realpathSync(input.masterRoot);
  const settings = readSettings(input.masterDecisionOsRoot);
  const candidates: string[] = [];
  const visit = (directory: string): void => {
    if (existsSync(resolve(directory, '.decision-os'))) candidates.push(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || skippedDirectories.has(entry.name)) continue;
      const child = resolve(directory, entry.name);
      try {
        if (lstatSync(child).isDirectory()) visit(child);
      } catch {
        // Unreadable directories are outside the usable project catalog.
      }
    }
  };
  visit(masterRoot);
  const projects = candidates.map((root, index) => {
    const relativePath = normalizedRelative(masterRoot, root) || '.';
    const decisionOsRoot = resolve(root, '.decision-os');
    const id = stableProjectId(decisionOsRoot, relativePath, input.persistIdentities !== false);
    const metadata = settings.projects?.[id];
    const fallbackName = basename(root);
    const configuredName = typeof metadata?.name === 'string' ? metadata.name.trim() : '';
    const configuredDescription = typeof metadata?.description === 'string' ? metadata.description : '';
    const configuredColor = validColor(metadata?.color)
      ? metadata.color
      : validColor(settings.colors?.[id])
        ? settings.colors[id]
        : defaultColors[index % defaultColors.length];
    return {
      id,
      name: configuredName || fallbackName,
      description: configuredDescription,
      relativePath,
      root,
      decisionOsRoot,
      color: configuredColor.toLowerCase(),
      ledgers: ledgersFor(decisionOsRoot),
      available: true,
      diagnostic: '',
    };
  });
  const nestedProjects = projects.filter((project) => project.relativePath !== '.');
  const visibleProjects = nestedProjects.length
    ? projects.filter((project) => project.relativePath !== '.' || project.ledgers.length > 0)
    : projects;
  return visibleProjects.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function resolveCatalogProject(input: { projects: DecisionOsProject[]; projectId?: string; fallbackDecisionOsRoot: string }): DecisionOsProject | null {
  if (input.projectId) return input.projects.find((project) => project.id === input.projectId) ?? null;
  const fallbackRoot = realpathSync(dirname(input.fallbackDecisionOsRoot));
  return input.projects.find((project) => realpathSync(project.root) === fallbackRoot) ?? input.projects[0] ?? null;
}

export function createDecisionOsProject(input: {
  masterRoot: string;
  masterDecisionOsRoot: string;
  name: string;
  description: string;
  directory?: string;
}): DecisionOsProject {
  const { name, description } = validateProjectCreationInput(input.name, input.description);
  const masterRoot = realpathSync(input.masterRoot);
  const selectedDirectory = String(input.directory ?? '').trim();
  const selected = selectedDirectory ? resolveProjectDirectory({ masterRoot, path: selectedDirectory }) : null;
  const projectRoot = selected ? selected.absolutePath : resolve(masterRoot, name);
  const projectRelativePath = selected?.path ?? normalizedRelative(masterRoot, projectRoot);
  if (!selectedDirectory && dirname(projectRoot) !== masterRoot) throw new Error('Project directory must be directly below the catalog root.');
  if (!selectedDirectory && existsSync(projectRoot)) throw new Error('A file or directory already exists with this project name.');

  const decisionOsRoot = resolve(projectRoot, '.decision-os');
  const projectRootCreated = !existsSync(projectRoot);
  const decisionOsStateExisted = existsSync(resolve(decisionOsRoot, 'state.json'));
  const decisionOsDirectoryExisted = existsSync(decisionOsRoot);
  let gitCreated = false;
  try {
    if (projectRootCreated) mkdirSync(projectRoot, { recursive: true });
    const hasGitMetadata = existsSync(resolve(projectRoot, '.git'));
    const gitProbe = hasGitMetadata
      ? null
      : spawnSync('git', ['-C', projectRoot, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
    if (!hasGitMetadata && gitProbe?.status !== 0) {
      const gitInitialization = spawnSync('git', ['init', projectRoot], { encoding: 'utf8' });
      if (gitInitialization.status !== 0) {
        const diagnostic = String(gitInitialization.stderr ?? gitInitialization.error?.message ?? '').trim();
        throw new Error(diagnostic || 'Git repository initialization failed.');
      }
      gitCreated = true;
    }
    if (!decisionOsStateExisted) {
      if (decisionOsDirectoryExisted) throw new Error('The selected directory contains an incomplete .decision-os directory without state.json.');
      mkdirSync(decisionOsRoot, { recursive: true });
      writeFileSync(resolve(decisionOsRoot, 'state.json'), `${JSON.stringify({ ledgers: [] }, null, 2)}\n`);
      writeFileSync(resolve(decisionOsRoot, 'project.json'), `${JSON.stringify({ id: randomUUID() }, null, 2)}\n`);
    }
    if (ledgersFor(decisionOsRoot).length === 0) {
      createLinkedLedger({ decisionOsRoot, title: 'tasks' });
    }
    const id = stableProjectId(decisionOsRoot, projectRelativePath);
    return {
      id,
      name,
      description,
      relativePath: projectRelativePath,
      root: projectRoot,
      decisionOsRoot,
      color: defaultColors[0],
      ledgers: ledgersFor(decisionOsRoot),
      available: true,
      diagnostic: '',
    };
  } catch (error) {
    if (projectRootCreated) rmSync(projectRoot, { recursive: true, force: true });
    else {
      if (!decisionOsStateExisted && !decisionOsDirectoryExisted) rmSync(decisionOsRoot, { recursive: true, force: true });
      if (gitCreated) rmSync(resolve(projectRoot, '.git'), { recursive: true, force: true });
    }
    throw error;
  }
}

export function saveProjectMetadata(input: {
  masterDecisionOsRoot: string;
  projects: DecisionOsProject[];
  projectId: string;
  name: string;
  description: string;
  color: string;
}): DecisionOsProject {
  const project = input.projects.find((entry) => entry.id === input.projectId);
  if (!project) throw new Error('Unknown project id.');
  const name = input.name.trim();
  const description = input.description.trim();
  const color = input.color.toLowerCase();
  if (!name) throw new Error('Project name is required.');
  if (name.length > 120) throw new Error('Project name must not exceed 120 characters.');
  if (description.length > 1000) throw new Error('Project description must not exceed 1000 characters.');
  if (!validColor(color)) throw new Error('Project color must be a six-digit hex color.');
  // WHAT: Let ProjectCatalogStore commit versioned registry updates as one authoritative write.
  // WHY: The legacy metadata writer has no path fields and would otherwise erase registry membership.
  if (readProjectRegistry(input.masterDecisionOsRoot)) return { ...project, name, description, color };
  const settings = readSettings(input.masterDecisionOsRoot);
  const migratedProjects = { ...settings.projects };
  for (const [id, legacyColor] of Object.entries(settings.colors ?? {})) {
    if (validColor(legacyColor)) migratedProjects[id] = { ...migratedProjects[id], color: legacyColor.toLowerCase() };
  }
  migratedProjects[input.projectId] = { name, description, color };
  const next: ProjectSettings = { projects: migratedProjects };
  mkdirSync(input.masterDecisionOsRoot, { recursive: true });
  const destination = settingsFile(input.masterDecisionOsRoot);
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(temporary, destination);
  return { ...project, name, description, color };
}

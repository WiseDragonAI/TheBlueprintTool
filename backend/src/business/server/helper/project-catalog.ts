/**
 * WHAT: Discovers and configures Decision OS projects below one master workspace.
 * WHY: A home-scoped server needs stable, validated project roots without trusting request paths.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

export type DecisionOsProject = {
  id: string;
  name: string;
  relativePath: string;
  root: string;
  decisionOsRoot: string;
  description: string;
  color: string;
  ledgers: Array<{ id: string; title: string; ledgerFile: string }>;
};

type ProjectMetadata = { name: string; description: string; color: string };
type ProjectIdentity = { id?: string };
type ProjectSettings = {
  projects?: Record<string, Partial<ProjectMetadata>>;
  colors?: Record<string, string>;
};
const skippedDirectories = new Set(['.git', '.decision-os', '.worktrees', 'node_modules']);
const defaultColors = ['#38d9e8', '#a78bfa', '#fb7185', '#fbbf24', '#34d399', '#60a5fa'];

function normalizedRelative(root: string, candidate: string): string {
  return relative(root, candidate).split(sep).join('/');
}

function projectId(relativePath: string): string {
  return Buffer.from(relativePath || '.', 'utf8').toString('base64url');
}

function stableProjectId(decisionOsRoot: string, relativePath: string): string {
  const identityFile = resolve(decisionOsRoot, 'project.json');
  try {
    const identity = JSON.parse(readFileSync(identityFile, 'utf8')) as ProjectIdentity;
    const id = String(identity.id ?? '').trim();
    if (/^[a-zA-Z0-9_-]+$/.test(id)) return id;
  } catch {
    // Existing projects receive their legacy URL id on first discovery.
  }
  const id = projectId(relativePath);
  const temporary = `${identityFile}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify({ id }, null, 2)}\n`);
  renameSync(temporary, identityFile);
  return id;
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

export function discoverDecisionOsProjects(input: { masterRoot: string; masterDecisionOsRoot: string }): DecisionOsProject[] {
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
    const id = stableProjectId(decisionOsRoot, relativePath);
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

/**
 * WHAT: Discovers and configures Decision OS projects below one master workspace.
 * WHY: A home-scoped server needs stable, validated project roots without trusting request paths.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

export type DecisionOsProject = {
  id: string;
  name: string;
  relativePath: string;
  root: string;
  decisionOsRoot: string;
  color: string;
  ledgers: Array<{ id: string; title: string; ledgerFile: string }>;
};

type ProjectSettings = { colors?: Record<string, string> };
const skippedDirectories = new Set(['.git', '.decision-os', '.worktrees', 'node_modules']);
const defaultColors = ['#38d9e8', '#a78bfa', '#fb7185', '#fbbf24', '#34d399', '#60a5fa'];

function normalizedRelative(root: string, candidate: string): string {
  return relative(root, candidate).split(sep).join('/');
}

function projectId(relativePath: string): string {
  return Buffer.from(relativePath || '.', 'utf8').toString('base64url');
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
    if (existsSync(resolve(directory, '.decision-os', 'state.json'))) candidates.push(directory);
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
  return candidates.map((root, index) => {
    const relativePath = normalizedRelative(masterRoot, root) || '.';
    const id = projectId(relativePath);
    return {
      id,
      name: basename(root),
      relativePath,
      root,
      decisionOsRoot: resolve(root, '.decision-os'),
      color: String(settings.colors?.[id] ?? defaultColors[index % defaultColors.length]),
      ledgers: ledgersFor(resolve(root, '.decision-os')),
    };
  }).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function resolveCatalogProject(input: { projects: DecisionOsProject[]; projectId?: string; fallbackDecisionOsRoot: string }): DecisionOsProject | null {
  if (input.projectId) return input.projects.find((project) => project.id === input.projectId) ?? null;
  const fallbackRoot = realpathSync(dirname(input.fallbackDecisionOsRoot));
  return input.projects.find((project) => realpathSync(project.root) === fallbackRoot) ?? input.projects[0] ?? null;
}

export function saveProjectColor(input: { masterDecisionOsRoot: string; projects: DecisionOsProject[]; projectId: string; color: string }): DecisionOsProject {
  const project = input.projects.find((entry) => entry.id === input.projectId);
  if (!project) throw new Error('Unknown project id.');
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) throw new Error('Project color must be a six-digit hex color.');
  const settings = readSettings(input.masterDecisionOsRoot);
  const next = { ...settings, colors: { ...settings.colors, [input.projectId]: input.color.toLowerCase() } };
  mkdirSync(input.masterDecisionOsRoot, { recursive: true });
  writeFileSync(settingsFile(input.masterDecisionOsRoot), `${JSON.stringify(next, null, 2)}\n`);
  return { ...project, color: input.color.toLowerCase() };
}

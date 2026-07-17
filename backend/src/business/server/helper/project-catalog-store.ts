/**
 * WHAT: Owns the in-memory project catalog and its explicit lifecycle mutations.
 * WHY: Requests need a stable snapshot while project membership changes only through registered operations.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';
import {
  createDecisionOsProject,
  discoverDecisionOsProjects,
  projectFromRegisteredPath,
  saveProjectMetadata,
  type DecisionOsProject,
} from './project-catalog.js';
import {
  backupLegacyProjectRegistry,
  readProjectRegistry,
  writeProjectRegistry,
  type ProjectRegistry,
  type ProjectRegistryEntry,
} from './project-registry.js';
import { resolveProjectDirectory } from './project-directory-browser.js';

const defaultColors = ['#38d9e8', '#a78bfa', '#fb7185', '#fbbf24', '#34d399', '#60a5fa'];

function normalizedRelative(root: string, candidate: string): string {
  return relative(root, candidate).split(sep).join('/') || '.';
}

function projectIdentity(directory: string): string {
  try {
    const identity = JSON.parse(readFileSync(resolve(directory, '.decision-os', 'project.json'), 'utf8')) as { id?: string };
    return String(identity.id ?? '').trim();
  } catch {
    return '';
  }
}

function registryEntry(project: DecisionOsProject, registeredAt = new Date().toISOString()): ProjectRegistryEntry {
  return {
    id: project.id,
    relativePath: project.relativePath,
    name: project.name,
    description: project.description,
    color: project.color,
    registeredAt,
    cardId: `project-card:${project.id}`,
  };
}

function registryFromProjects(projects: DecisionOsProject[]): ProjectRegistry {
  const identities = new Set<string>();
  const paths = new Set<string>();
  for (const project of projects) {
    if (identities.has(project.id)) throw new Error(`Duplicate project identity in migration manifest: ${project.id}`);
    if (paths.has(project.relativePath)) throw new Error(`Duplicate project path in migration manifest: ${project.relativePath}`);
    identities.add(project.id);
    paths.add(project.relativePath);
  }
  return {
    version: 2,
    projects: Object.fromEntries(projects.map((project) => [project.id, registryEntry(project)])),
  };
}

export function migrateLegacyProjectRegistry(input: {
  masterRoot: string;
  masterDecisionOsRoot: string;
  apply: boolean;
}): { applied: boolean; backup: string | null; registry: ProjectRegistry } {
  const current = readProjectRegistry(input.masterDecisionOsRoot);
  if (current) return { applied: false, backup: null, registry: current };
  const projects = discoverDecisionOsProjects({
    masterRoot: input.masterRoot,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    persistIdentities: input.apply,
  });
  const registry = registryFromProjects(projects);
  if (!input.apply) return { applied: false, backup: null, registry };
  const backup = backupLegacyProjectRegistry(input.masterDecisionOsRoot);
  writeProjectRegistry(input.masterDecisionOsRoot, registry);
  return { applied: true, backup, registry };
}

export type ProjectCatalogStore = ReturnType<typeof createProjectCatalogStore>;

export function createProjectCatalogStore(input: { masterRoot: string; masterDecisionOsRoot: string }) {
  const masterRoot = realpathSync(input.masterRoot);
  let registry = readProjectRegistry(input.masterDecisionOsRoot);
  // WHAT: Seed the authoritative registry once when upgrading a legacy workspace.
  // WHY: Existing installations need one compatibility migration before runtime scans can stop.
  if (!registry) {
    registry = migrateLegacyProjectRegistry({ masterRoot, masterDecisionOsRoot: input.masterDecisionOsRoot, apply: true }).registry;
  }

  let projects: DecisionOsProject[] = [];
  const reload = (): DecisionOsProject[] => {
    projects = Object.values(registry.projects).map((entry) => projectFromRegisteredPath({ masterRoot, entry }));
    projects.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    return projects;
  };
  const persist = (): void => {
    writeProjectRegistry(input.masterDecisionOsRoot, registry);
    reload();
  };
  reload();

  return {
    projects(): DecisionOsProject[] {
      return projects;
    },
    refresh(projectId: string): DecisionOsProject {
      const entry = registry.projects[projectId];
      if (!entry) throw new Error('Unknown project id.');
      const project = projectFromRegisteredPath({ masterRoot, entry });
      projects = projects.map((candidate) => candidate.id === projectId ? project : candidate);
      projects.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
      return project;
    },
    create(name: string, description: string, directory = ''): DecisionOsProject {
      if (directory) {
        const selected = resolveProjectDirectory({ masterRoot, path: directory });
        if (Object.values(registry.projects).some((entry) => entry.relativePath === selected.path)) throw new Error('Project directory is already registered.');
        const identity = projectIdentity(selected.absolutePath);
        if (identity && registry.projects[identity]) throw new Error('Project id is already registered.');
      }
      const project = createDecisionOsProject({ masterRoot, masterDecisionOsRoot: input.masterDecisionOsRoot, name, description, directory });
      registry.projects[project.id] = registryEntry(project);
      persist();
      return projects.find((entry) => entry.id === project.id)!;
    },
    register(pathInput: string): DecisionOsProject {
      const candidate = realpathSync(resolve(masterRoot, pathInput));
      const relativePath = normalizedRelative(masterRoot, candidate);
      // WHAT: Reject paths outside the server root.
      // WHY: Registry paths are server-owned capabilities and cannot escape their configured boundary.
      if (relativePath === '..' || relativePath.startsWith('../')) throw new Error('Project path must remain below the catalog root.');
      if (!existsSync(resolve(candidate, '.decision-os', 'state.json'))) throw new Error('Registered project must contain .decision-os/state.json.');
      const project = projectFromRegisteredPath({
        masterRoot,
        entry: {
          id: '', relativePath, name: basename(candidate), description: '',
          color: defaultColors[Object.keys(registry.projects).length % defaultColors.length],
          registeredAt: new Date().toISOString(), cardId: '',
        },
      });
      if (registry.projects[project.id]) throw new Error('Project id is already registered.');
      if (Object.values(registry.projects).some((entry) => entry.relativePath === relativePath)) throw new Error('Project path is already registered.');
      registry.projects[project.id] = registryEntry(project);
      persist();
      return projects.find((entry) => entry.id === project.id)!;
    },
    update(projectId: string, name: string, description: string, color: string): DecisionOsProject {
      const project = saveProjectMetadata({ masterDecisionOsRoot: input.masterDecisionOsRoot, projects, projectId, name, description, color });
      const existing = registry.projects[projectId];
      registry.projects[projectId] = { ...existing, name: project.name, description: project.description, color: project.color };
      persist();
      return projects.find((entry) => entry.id === projectId)!;
    },
    relink(projectId: string, pathInput: string): DecisionOsProject {
      const existing = registry.projects[projectId];
      if (!existing) throw new Error('Unknown project id.');
      const candidate = realpathSync(resolve(masterRoot, pathInput));
      const relativePath = normalizedRelative(masterRoot, candidate);
      if (relativePath === '..' || relativePath.startsWith('../')) throw new Error('Project path must remain below the catalog root.');
      if (Object.values(registry.projects).some((entry) => entry.id !== projectId && entry.relativePath === relativePath)) throw new Error('Project path is already registered.');
      const identity = JSON.parse(readFileSync(resolve(candidate, '.decision-os', 'project.json'), 'utf8')) as { id?: string };
      if (identity.id !== projectId) throw new Error('Relinked project identity does not match the registered project.');
      registry.projects[projectId] = { ...existing, relativePath };
      persist();
      return projects.find((entry) => entry.id === projectId)!;
    },
    unregister(projectId: string): DecisionOsProject {
      const project = projects.find((entry) => entry.id === projectId);
      if (!project) throw new Error('Unknown project id.');
      delete registry.projects[projectId];
      persist();
      return project;
    },
  };
}

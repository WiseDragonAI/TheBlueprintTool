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
  readProjectRegistry,
  writeProjectRegistry,
  type ProjectRegistry,
  type ProjectRegistryEntry,
} from './project-registry.js';

const defaultColors = ['#38d9e8', '#a78bfa', '#fb7185', '#fbbf24', '#34d399', '#60a5fa'];

function normalizedRelative(root: string, candidate: string): string {
  return relative(root, candidate).split(sep).join('/') || '.';
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
  return {
    version: 2,
    projects: Object.fromEntries(projects.map((project) => [project.id, registryEntry(project)])),
  };
}

export type ProjectCatalogStore = ReturnType<typeof createProjectCatalogStore>;

export function createProjectCatalogStore(input: { masterRoot: string; masterDecisionOsRoot: string }) {
  const masterRoot = realpathSync(input.masterRoot);
  let registry = readProjectRegistry(input.masterDecisionOsRoot);
  // WHAT: Seed the authoritative registry once when upgrading a legacy workspace.
  // WHY: Existing installations need one compatibility migration before runtime scans can stop.
  if (!registry) {
    registry = registryFromProjects(discoverDecisionOsProjects({ masterRoot, masterDecisionOsRoot: input.masterDecisionOsRoot }));
    writeProjectRegistry(input.masterDecisionOsRoot, registry);
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
    create(name: string, description: string): DecisionOsProject {
      const project = createDecisionOsProject({ masterRoot, masterDecisionOsRoot: input.masterDecisionOsRoot, name, description });
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

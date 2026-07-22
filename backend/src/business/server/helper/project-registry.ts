/**
 * WHAT: Persists the authoritative versioned list of projects owned by one Decision OS server.
 * WHY: Normal server work must resolve registered projects without recursively scanning its launch root.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type ProjectRegistryEntry = {
  id: string;
  relativePath: string;
  name: string;
  description: string;
  color: string;
  registeredAt: string;
  cardId: string;
};

export type ProjectRegistry = {
  version: 2;
  projects: Record<string, ProjectRegistryEntry>;
};

export class ProjectRegistryCorruptionError extends Error {
  readonly code = 'project_registry_corrupt';
  constructor(readonly file: string, cause: unknown) {
    super(`Could not read the authoritative project registry ${file}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export function projectRegistryFile(masterDecisionOsRoot: string): string {
  return resolve(masterDecisionOsRoot, 'projects.json');
}

export function backupLegacyProjectRegistry(masterDecisionOsRoot: string): string | null {
  const source = projectRegistryFile(masterDecisionOsRoot);
  if (!existsSync(source)) return null;
  const backup = `${source}.legacy-${new Date().toISOString().replaceAll(':', '-')}.backup`;
  copyFileSync(source, backup);
  return backup;
}

export function readProjectRegistry(masterDecisionOsRoot: string): ProjectRegistry | null {
  const file = projectRegistryFile(masterDecisionOsRoot);
  if (!existsSync(file)) return null;
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')) as Partial<ProjectRegistry>;
    // WHAT: Accept only the explicit registry schema.
    // WHY: Legacy metadata documents contain no paths and cannot safely replace discovery by themselves.
    if (value && typeof value === 'object' && !Array.isArray(value) && value.version === undefined) return null;
    if (value.version !== 2 || !value.projects || typeof value.projects !== 'object' || Array.isArray(value.projects)) {
      throw new Error('Expected a version 2 registry with a projects object.');
    }
    return { version: 2, projects: value.projects };
  } catch (error) {
    if (error instanceof ProjectRegistryCorruptionError) throw error;
    throw new ProjectRegistryCorruptionError(file, error);
  }
}

export function writeProjectRegistry(masterDecisionOsRoot: string, registry: ProjectRegistry): void {
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  const destination = projectRegistryFile(masterDecisionOsRoot);
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`);
  renameSync(temporary, destination);
}

/**
 * WHAT: Persists the authoritative versioned list of projects owned by one Decision OS server.
 * WHY: Normal server work must resolve registered projects without recursively scanning its launch root.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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

export function projectRegistryFile(masterDecisionOsRoot: string): string {
  return resolve(masterDecisionOsRoot, 'projects.json');
}

export function readProjectRegistry(masterDecisionOsRoot: string): ProjectRegistry | null {
  try {
    const value = JSON.parse(readFileSync(projectRegistryFile(masterDecisionOsRoot), 'utf8')) as Partial<ProjectRegistry>;
    // WHAT: Accept only the explicit registry schema.
    // WHY: Legacy metadata documents contain no paths and cannot safely replace discovery by themselves.
    if (value.version !== 2 || !value.projects || typeof value.projects !== 'object') return null;
    return { version: 2, projects: value.projects };
  } catch {
    return null;
  }
}

export function writeProjectRegistry(masterDecisionOsRoot: string, registry: ProjectRegistry): void {
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  const destination = projectRegistryFile(masterDecisionOsRoot);
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`);
  renameSync(temporary, destination);
}

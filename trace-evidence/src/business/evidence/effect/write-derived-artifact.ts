/**
 * WHAT: Atomically installs one derived evidence artifact.
 * WHY: Readers must never observe partially rendered stacks, reports, scopes, or manifests.
 */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writeDerivedArtifact(path: string, body: string): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporary, body, 'utf8');
  await rename(temporary, path);
}

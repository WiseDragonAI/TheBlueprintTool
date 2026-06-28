import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export async function walkFiles(root: string, predicate: (path: string) => boolean = () => true): Promise<string[]> {
  if (!await exists(root)) return [];
  const output: string[] = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...await walkFiles(path, predicate));
      continue;
    }
    if (entry.isFile() && predicate(path)) output.push(path);
  }
  return output;
}

/**
 * WHAT: Verifies and installs the immutable object union collected from every writable v2 node.
 * WHY: Epoch-3 cutover must retain remote-only content bytes instead of rebuilding only local sidecars.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

async function fileSha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function restoreTaskContentObjects(sourceRoots: string[], targetRoot: string): Promise<{ sourceObjects: number; installedObjects: number; installedBytes: number }> {
  const installed = new Set<string>();
  let sourceObjects = 0;
  let installedBytes = 0;
  for (const sourceRoot of sourceRoots) {
    const objectsRoot = resolve(sourceRoot, 'objects');
    if (!existsSync(objectsRoot)) continue;
    for (const prefix of readdirSync(objectsRoot).sort()) {
      const prefixRoot = resolve(objectsRoot, prefix);
      for (const name of readdirSync(prefixRoot).sort()) {
        // WHAT: Reject misplaced and corrupt objects before installing any bytes under their claimed hash.
        // WHY: A filename collision is safe to deduplicate only after the source content verifies exactly.
        if (!/^[a-f0-9]{64}$/.test(name) || name.slice(0, 2) !== prefix) throw new Error(`invalid_task_content_object_name:${sourceRoot}:${prefix}:${name}`);
        sourceObjects += 1;
        const source = resolve(prefixRoot, name);
        if (await fileSha256(source) !== name) throw new Error(`invalid_task_content_object_hash:${source}`);
        const target = resolve(targetRoot, 'objects', prefix, name);
        if (!installed.has(name) && !existsSync(target)) {
          await mkdir(dirname(target), { recursive: true });
          await copyFile(source, target);
          installedBytes += (await stat(target)).size;
        }
        installed.add(name);
      }
    }
  }
  return { sourceObjects, installedObjects: installed.size, installedBytes };
}

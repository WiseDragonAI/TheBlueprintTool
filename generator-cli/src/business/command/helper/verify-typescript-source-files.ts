/**
 * WHAT: TypeScript source verifier.
 * WHY: generator-cli source, helpers, controllers, effects, actions, harnesses, and tests must be TypeScript.
 */
import { join } from 'node:path';
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

async function walk(dir: string, fs: FileSystemPort, files: string[]): Promise<void> {
  const entries = await fs.readdir(dir);

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = await fs.stat(path);

    // WHY: nested source and test folders are part of the TypeScript contract.
    // WHAT: recurse into directories and collect file paths.
    if (stat.isDirectory()) {
      await walk(path, fs, files);
      continue;
    }

    // WHY: only files participate in implementation extension checks.
    // WHAT: collect the file path for validation.
    if (stat.isFile()) {
      files.push(path);
    }
  }
}

export async function verifyTypescriptSourceFiles(root = '.', fs: FileSystemPort = nodeFileSystem): Promise<Result<string[]>> {
  const files: string[] = [];
  await walk(join(root, 'src'), fs, files);
  await walk(join(root, 'bin'), fs, files);
  await walk(join(root, 'test'), fs, files);
  const invalid = files.find((file) => !file.endsWith('.ts'));

  // WHY: implementation files must use TypeScript source.
  // WHAT: reject non-TypeScript implementation files.
  if (invalid) {
    return { ok: false, error: `Non-TypeScript implementation file found: ${invalid}` };
  }

  return { ok: true, value: files };
}

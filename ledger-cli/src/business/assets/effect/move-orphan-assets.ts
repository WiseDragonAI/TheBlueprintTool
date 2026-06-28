import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ClassifiedAsset } from '../../../lib/types.js';
import { isInsideWorkspace, resolveWorkspacePath, workspaceRelativePath } from '../helper/workspace-paths.js';

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function moveFile(from: string, to: string): Promise<void> {
  if (await exists(to)) throw new Error(`Refusing to overwrite existing trash asset: ${to}`);
  await fs.mkdir(dirname(to), { recursive: true });
  try {
    await fs.rename(from, to);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code !== 'EXDEV') throw error;
    await fs.copyFile(from, to);
    await fs.unlink(from);
  }
}

export async function moveOrphanAssets(input: { assets: ClassifiedAsset[]; moveTo: string; workspaceRoot: string }): Promise<Array<{ from: string; to: string }>> {
  const trashRoot = resolve(input.workspaceRoot, input.moveTo);
  if (!isInsideWorkspace(input.workspaceRoot, trashRoot)) {
    throw new Error(`Refusing to move assets outside workspace: ${input.moveTo}`);
  }
  const movedAssets: Array<{ from: string; to: string }> = [];
  for (const asset of input.assets) {
    const source = resolveWorkspacePath(input.workspaceRoot, asset.path);
    if (!source) throw new Error(`Refusing to move asset outside workspace: ${asset.path}`);
    const destination = resolve(trashRoot, asset.path);
    await moveFile(source, destination);
    movedAssets.push({
      from: asset.path,
      to: workspaceRelativePath(input.workspaceRoot, destination),
    });
  }
  return movedAssets;
}

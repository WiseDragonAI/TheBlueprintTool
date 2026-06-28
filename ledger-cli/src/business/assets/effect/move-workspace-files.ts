import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
  if (await exists(to)) throw new Error(`Refusing to overwrite existing trash file: ${to}`);
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

export async function moveWorkspaceFiles(input: { files: Array<{ path: string }>; moveTo: string; workspaceRoot: string }): Promise<Array<{ from: string; to: string }>> {
  const trashRoot = resolve(input.workspaceRoot, input.moveTo);
  if (!isInsideWorkspace(input.workspaceRoot, trashRoot)) {
    throw new Error(`Refusing to move files outside workspace: ${input.moveTo}`);
  }
  const movedFiles: Array<{ from: string; to: string }> = [];
  for (const file of input.files) {
    const source = resolveWorkspacePath(input.workspaceRoot, file.path);
    if (!source) throw new Error(`Refusing to move file outside workspace: ${file.path}`);
    const destination = resolve(trashRoot, file.path);
    await moveFile(source, destination);
    movedFiles.push({
      from: file.path,
      to: workspaceRelativePath(input.workspaceRoot, destination),
    });
  }
  return movedFiles;
}

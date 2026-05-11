/**
 * WHAT: Writes generated source files into the target worktree.
 * WHY: apply mode materializes one source file per generated function.
 */
import { join } from 'node:path';
import type { FileSystemPort, OutputFile } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function writeSourceFile(worktreePath: string, files: OutputFile[], fs: FileSystemPort = nodeFileSystem): Promise<void> {
  for (const file of files) {
    await fs.writeFile(join(worktreePath, file.path), file.content);
  }
}

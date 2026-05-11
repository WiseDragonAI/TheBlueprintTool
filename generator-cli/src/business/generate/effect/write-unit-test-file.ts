/**
 * WHAT: Writes generated unit test files into the target worktree.
 * WHY: every generated function gets one intentionally red unit test scaffold.
 */
import { join } from 'node:path';
import type { FileSystemPort, OutputFile } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function writeUnitTestFile(worktreePath: string, files: OutputFile[], fs: FileSystemPort = nodeFileSystem): Promise<void> {
  for (const file of files) {
    await fs.writeFile(join(worktreePath, file.path), file.content);
  }
}

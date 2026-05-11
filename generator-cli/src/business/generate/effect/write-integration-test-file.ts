/**
 * WHAT: Writes generated integration test suites into the target worktree.
 * WHY: suite files dispatch controllers and record telemetry for agent review.
 */
import { join } from 'node:path';
import type { FileSystemPort, OutputFile } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function writeIntegrationTestFile(worktreePath: string, files: OutputFile[], fs: FileSystemPort = nodeFileSystem): Promise<void> {
  for (const file of files) {
    await fs.writeFile(join(worktreePath, file.path), file.content);
  }
}

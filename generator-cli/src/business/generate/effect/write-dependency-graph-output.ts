/**
 * WHAT: Writes the generated dependency graph artifact.
 * WHY: agents need a machine-readable import graph for generated scaffolds.
 */
import { join } from 'node:path';
import type { FileSystemPort, OutputFile } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function writeDependencyGraphOutput(worktreePath: string, file: OutputFile, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await fs.writeFile(join(worktreePath, file.path), file.content);
}

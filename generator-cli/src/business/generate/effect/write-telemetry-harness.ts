/**
 * WHAT: Writes the generated telemetry harness into the target worktree.
 * WHY: generated controllers and stubs share one trace recorder.
 */
import { join } from 'node:path';
import type { FileSystemPort, OutputFile } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function writeTelemetryHarness(worktreePath: string, file: OutputFile, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await fs.writeFile(join(worktreePath, file.path), file.content);
}

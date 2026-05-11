/**
 * WHAT: MasterLedger markdown reader.
 * WHY: generation must start from the canonical MasterLedger document.
 */
import type { FileSystemPort, MasterLedgerDocument, Result } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function readMasterLedger(path: string, fs: FileSystemPort = nodeFileSystem): Promise<Result<MasterLedgerDocument>> {
  try {
    return { ok: true, value: { path, text: await fs.readFile(path) } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${path}` };
  }
}

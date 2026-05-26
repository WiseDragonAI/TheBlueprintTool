/**
 * WHAT: Committed ledger JSON reader.
 * WHY: ledger storage must operate on durable JSON files, not shadow state.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { parseJson } from '../../../lib/json/json.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function readLedgerJson(path: string, fs: FileSystemPort = nodeFileSystem): Promise<Result<unknown>> {
  try {
    const text = await fs.readFile(path);
    return parseJson(text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${path}` };
  }
}

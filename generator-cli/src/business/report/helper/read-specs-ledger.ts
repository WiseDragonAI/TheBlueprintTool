/**
 * WHAT: SpecsLedger JSON reader.
 * WHY: check-ledger compares MasterLedger suites against selected SpecsLedger cards.
 */
import type { FileSystemPort, Result, SpecsLedger } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { parseJson } from '../../../lib/json/json.js';

export async function readSpecsLedger(path: string, fs: FileSystemPort = nodeFileSystem): Promise<Result<SpecsLedger>> {
  try {
    const text = await fs.readFile(path);
    return parseJson<SpecsLedger>(text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${path}` };
  }
}

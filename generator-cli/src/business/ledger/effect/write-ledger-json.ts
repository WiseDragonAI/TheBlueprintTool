/**
 * WHAT: Committed ledger JSON writer.
 * WHY: controlled ledger mutations must be persisted back to architecture ledger files.
 */
import type { FileSystemPort } from '../../../lib/types.js';
import { stringifyJson } from '../../../lib/json/json.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function writeLedgerJson(path: string, ledger: unknown, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await fs.writeFile(path, stringifyJson(ledger));
}

/**
 * WHAT: TypeScript project config reader.
 * WHY: generator-cli must prove it has TypeScript project configuration.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { parseJson } from '../../../lib/json/json.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function readTypescriptProjectConfig(path = 'tsconfig.json', fs: FileSystemPort = nodeFileSystem): Promise<Result<unknown>> {
  try {
    return parseJson(await fs.readFile(path));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${path}` };
  }
}

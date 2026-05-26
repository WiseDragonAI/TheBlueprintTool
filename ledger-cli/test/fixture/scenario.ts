/**
 * WHAT: Shared test fixtures for ledger-cli specs.
 * WHY: ledger mutation tests need isolated temporary JSON files.
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function tempDir(prefix = 'ledger-cli-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function createJsonFile(value: unknown): Promise<string> {
  const dir = await tempDir();
  const file = join(dir, 'ledger.json');
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

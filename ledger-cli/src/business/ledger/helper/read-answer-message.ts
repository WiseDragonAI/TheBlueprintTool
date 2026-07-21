/**
 * WHAT: Resolves one CLI answer body from its inline value or explicit message file.
 * WHY: Scoped task-answer transport and local ledger answers must receive the same bounded text input.
 */
import type { FileSystemPort } from '../../../lib/types.js';

export async function readAnswerMessage(operation: { message?: string; messageFile?: string } | undefined, fs?: FileSystemPort): Promise<string> {
  if (!operation?.messageFile) return String(operation?.message ?? '').trimEnd();
  if (fs) return (await fs.readFile(operation.messageFile)).trimEnd();
  const { readFile } = await import('node:fs/promises');
  return (await readFile(operation.messageFile, 'utf8')).trimEnd();
}

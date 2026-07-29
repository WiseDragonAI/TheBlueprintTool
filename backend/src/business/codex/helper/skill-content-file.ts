/**
 * WHAT: Provides atomic create and replace operations for authored Markdown files.
 * WHY: Skill and pipeline-prompt writes must share one durable, path-resolved transaction primitive.
 */
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, linkSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function atomicCreateTextFile(file: string, content: string): void {
  const temporaryFile = resolve(dirname(file), `.${randomUUID()}.create.tmp`);
  try {
    writeFileSync(temporaryFile, content, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
    // link(2) atomically refuses a destination created after validation; rename would overwrite it.
    linkSync(temporaryFile, file);
  } finally {
    if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
  }
}

export function atomicReplaceTextFile(file: string, content: string): void {
  const mode = statSync(file).mode & 0o777;
  const temporaryFile = resolve(dirname(file), `.${randomUUID()}.replace.tmp`);
  try {
    writeFileSync(temporaryFile, content, { encoding: 'utf8', flag: 'wx', mode });
    chmodSync(temporaryFile, mode);
    renameSync(temporaryFile, file);
  } finally {
    if (existsSync(temporaryFile)) rmSync(temporaryFile, { force: true });
  }
}

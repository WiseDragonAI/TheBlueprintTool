/**
 * WHAT: Writes bounded delivery JSON through fsync, atomic rename, and directory fsync.
 * WHY: A coordinator or node crash must expose either the prior document or one complete replacement.
 */
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';

export type DeliveryPersistenceStage =
  | 'before-temporary-open'
  | 'after-temporary-fsync'
  | 'after-rename'
  | 'after-directory-fsync';

export type DeliveryPersistenceHooks = {
  atStage?(stage: DeliveryPersistenceStage, context: { file: string; temporaryFile: string }): void;
};

export function atomicWriteDeliveryJson(input: {
  file: string;
  value: unknown;
  hooks?: DeliveryPersistenceHooks;
}): void {
  const directory = dirname(input.file);
  mkdirSync(directory, { recursive: true });
  const temporaryFile = `${input.file}.${process.pid}.${randomUUID()}.tmp`;
  let installed = false;
  let descriptor = -1;
  try {
    input.hooks?.atStage?.('before-temporary-open', { file: input.file, temporaryFile });
    descriptor = openSync(temporaryFile, 'wx', 0o600);
    const bytes = Buffer.from(`${JSON.stringify(input.value, null, 2)}\n`, 'utf8');
    writeSync(descriptor, bytes, 0, bytes.length);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = -1;
    input.hooks?.atStage?.('after-temporary-fsync', { file: input.file, temporaryFile });
    renameSync(temporaryFile, input.file);
    installed = true;
    input.hooks?.atStage?.('after-rename', { file: input.file, temporaryFile });
    const directoryDescriptor = openSync(directory, 'r');
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
    input.hooks?.atStage?.('after-directory-fsync', { file: input.file, temporaryFile });
  } catch (error) {
    if (descriptor >= 0) {
      try { closeSync(descriptor); } catch { /* Preserve the primary persistence failure. */ }
    }
    if (!installed) rmSync(temporaryFile, { force: true });
    throw error;
  }
}

export function fsyncDeliveryDirectory(directory: string): void {
  const descriptor = openSync(directory, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

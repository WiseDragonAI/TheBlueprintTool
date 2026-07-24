/**
 * WHAT: Copies one settled execution artifact into a project's immutable object namespace.
 * WHY: Selected-node executions may not have the task project's workspace, but their exact bytes must remain hash-addressable.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TaskExecutionArtifactHead } from './task-current-state-types.js';

export async function captureTaskExecutionArtifact(input: {
  objectRoot: string;
  file: string;
  mediaType: string;
}): Promise<TaskExecutionArtifactHead | null> {
  let metadata;
  try { metadata = await stat(input.file); } catch { return null; }
  if (!metadata.isFile()) return null;
  await mkdir(input.objectRoot, { recursive: true });
  const temporary = resolve(input.objectRoot, `.capture-${process.pid}-${randomUUID()}`);
  const output = await open(temporary, 'wx');
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(input.file, { highWaterMark: 256 * 1024 })) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(buffer);
      bytes += buffer.byteLength;
      await output.write(buffer);
    }
    await output.sync();
  } catch (error) {
    await output.close();
    await rm(temporary, { force: true });
    throw error;
  }
  await output.close();
  const digest = hash.digest('hex');
  const directory = resolve(input.objectRoot, digest.slice(0, 2));
  const target = resolve(directory, digest);
  await mkdir(directory, { recursive: true });
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    try { await stat(target); } catch { throw error; }
  }
  return { hash: digest, bytes, mediaType: input.mediaType };
}

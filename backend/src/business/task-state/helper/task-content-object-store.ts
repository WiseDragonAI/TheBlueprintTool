/**
 * WHAT: Captures exact task resources as immutable content-addressed objects.
 * WHY: Concurrent resource heads must remain fetchable after their mutable workspace files change.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, type Stats } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { canonicalTaskContentResource } from './task-content-resources.js';

export type TaskContentHead = {
  type: 'card-markdown' | 'thread-markdown' | 'managed-asset';
  key: string;
  hash: string;
  bytes: number;
  changedAt: string;
};

const captureAttempts = 3;

function sameFileVersion(
  before: Stats,
  after: Stats,
  bytes: number,
): boolean {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mtimeMs === after.mtimeMs
    && bytes === after.size;
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function resourceType(key: string): TaskContentHead['type'] {
  if (key.includes('/cards/') && key.endsWith('.md')) return 'card-markdown';
  if (key.includes('/threads/') && key.endsWith('.md')) return 'thread-markdown';
  return 'managed-asset';
}

function sourceFile(decisionOsRoot: string, key: string): string {
  const file = resolve(decisionOsRoot, key.replace(/^\/?\.decision-os\//, ''));
  const inner = relative(decisionOsRoot, file);
  if (!inner || inner.startsWith('..') || isAbsolute(inner)) throw new Error('task_content_outside_project');
  return file;
}

export function createTaskContentObjectStore(input: {
  decisionOsRoot: string;
  projectId: string;
  captureChunkBytes?: number;
  onCaptureProgress?: (progress: { attempt: number; bytes: number }) => void | Promise<void>;
}) {
  const root = resolve(input.decisionOsRoot, 'task-state', input.projectId, 'objects');
  const objectFile = (hash: string): string => resolve(root, hash.slice(0, 2), hash);

  return {
    objectFile,
    async capture(value: string): Promise<TaskContentHead | null> {
      const key = canonicalTaskContentResource(input.decisionOsRoot, value);
      if (!key) return null;
      const source = sourceFile(input.decisionOsRoot, key);
      await mkdir(root, { recursive: true });
      for (let attempt = 1; attempt <= captureAttempts; attempt += 1) {
        let sourceHandle: FileHandle;
        try {
          sourceHandle = await open(source, 'r');
        } catch {
          return null;
        }
        const before = await sourceHandle.stat();
        // WHAT: Reject directories and other non-file resources before allocating a capture object.
        // WHY: Only stable regular files can become task-content heads.
        if (!before.isFile()) {
          await sourceHandle.close();
          return null;
        }
        const temporary = resolve(root, `.capture-${process.pid}-${randomUUID()}`);
        const output = await open(temporary, 'wx');
        const hash = createHash('sha256');
        let bytes = 0;
        try {
          for await (const chunk of createReadStream(source, {
            fd: sourceHandle.fd,
            autoClose: false,
            highWaterMark: input.captureChunkBytes ?? 256 * 1024,
          })) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            hash.update(buffer);
            bytes += buffer.byteLength;
            let offset = 0;
            while (offset < buffer.byteLength) {
              const { bytesWritten } = await output.write(buffer, offset, buffer.byteLength - offset);
              // WHAT: Reject a zero-progress regular-file write during immutable capture.
              // WHY: Advancing the hash without persisting the same bytes would create an unverifiable object.
              if (bytesWritten === 0) throw new Error(`task_content_capture_write_stalled:${key}`);
              offset += bytesWritten;
            }
            await input.onCaptureProgress?.({ attempt, bytes });
          }
          const after = await sourceHandle.stat();
          // WHAT: Retry when the opened source changed while its bytes were being captured.
          // WHY: A causal content head must never identify a torn mixture of two editor writes.
          if (!sameFileVersion(before, after, bytes)) {
            await output.close();
            await sourceHandle.close();
            await rm(temporary, { force: true });
            continue;
          }
          await output.sync();
          await output.close();
          await sourceHandle.close();
          const digest = hash.digest('hex');
          const directory = resolve(root, digest.slice(0, 2));
          const target = objectFile(digest);
          await mkdir(directory, { recursive: true });
          try {
            await rename(temporary, target);
            await syncDirectory(directory);
          } catch (error) {
            await rm(temporary, { force: true });
            let targetHandle: FileHandle | undefined;
            try {
              targetHandle = await open(target, 'r');
            } catch {
              throw error;
            } finally {
              await targetHandle?.close();
            }
          }
          return { type: resourceType(key), key, hash: digest, bytes, changedAt: after.mtime.toISOString() };
        } catch (error) {
          await output.close().catch(() => undefined);
          await sourceHandle.close().catch(() => undefined);
          await rm(temporary, { force: true });
          throw error;
        }
      }
      throw new Error(`task_content_capture_unstable:${key}`);
    },
  };
}

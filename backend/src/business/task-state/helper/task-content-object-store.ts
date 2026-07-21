/**
 * WHAT: Captures exact task resources as immutable content-addressed objects.
 * WHY: Concurrent resource heads must remain fetchable after their mutable workspace files change.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { canonicalTaskContentResource } from './task-content-resources.js';

export type TaskContentHead = {
  type: 'card-markdown' | 'thread-markdown' | 'managed-asset';
  key: string;
  hash: string;
  bytes: number;
  changedAt: string;
};

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

export function createTaskContentObjectStore(input: { decisionOsRoot: string; projectId: string }) {
  const root = resolve(input.decisionOsRoot, 'task-state', input.projectId, 'objects');
  const objectFile = (hash: string): string => resolve(root, hash.slice(0, 2), hash);

  return {
    objectFile,
    async capture(value: string): Promise<TaskContentHead | null> {
      const key = canonicalTaskContentResource(input.decisionOsRoot, value);
      if (!key) return null;
      const source = sourceFile(input.decisionOsRoot, key);
      let metadata;
      try { metadata = await stat(source); } catch { return null; }
      if (!metadata.isFile()) return null;
      await mkdir(root, { recursive: true });
      const temporary = resolve(root, `.capture-${process.pid}-${randomUUID()}`);
      const output = await open(temporary, 'wx');
      const hash = createHash('sha256');
      let bytes = 0;
      try {
        for await (const chunk of createReadStream(source, { highWaterMark: 256 * 1024 })) {
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
      const target = objectFile(digest);
      await mkdir(resolve(root, digest.slice(0, 2)), { recursive: true });
      try {
        await rename(temporary, target);
      } catch (error) {
        await rm(temporary, { force: true });
        try { await stat(target); } catch { throw error; }
      }
      return { type: resourceType(key), key, hash: digest, bytes, changedAt: metadata.mtime.toISOString() };
    },
  };
}

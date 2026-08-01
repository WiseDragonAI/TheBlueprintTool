/**
 * WHAT: Owns append-only raw artifact writes and immutable integrity finalization.
 * WHY: Reports need byte counts and hashes from the exact evidence consumed by later stages.
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { finished } from 'node:stream/promises';
import type { ArtifactDescriptor } from '../../../lib/types.js';

export async function openArtifact(path: string) {
  await mkdir(dirname(path), { recursive: true });
  return createWriteStream(path, { flags: 'a' });
}

export async function finalizeArtifact(path: string, producer: string, mediaType: string, scopeIds: string[] = []): Promise<ArtifactDescriptor> {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('data', (chunk) => hash.update(chunk));
  await finished(stream);
  return { path, mediaType, bytes: (await stat(path)).size, sha256: hash.digest('hex'), producer, complete: true, createdAt: new Date().toISOString(), scopeIds };
}

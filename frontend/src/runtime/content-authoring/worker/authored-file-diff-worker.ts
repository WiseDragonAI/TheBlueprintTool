/**
 * WHAT: Derives complete authored-file diff metadata in an isolated browser Worker.
 * WHY: Large Markdown comparisons must not block editor input or import Pierre interaction managers.
 */
import { parseDiffFromFile } from '@pierre/diffs';
import { normalizeAuthoredFileDiff } from '../helper/normalize-authored-file-diff.js';

type DiffRequest = {
  generation: number;
  identity: string;
  filename: string;
  baseMarkdown: string;
  draftMarkdown: string;
  baseKey: string;
  draftKey: string;
};

self.addEventListener('message', (event: MessageEvent<DiffRequest>) => {
  const request = event.data;
  try {
    const metadata = parseDiffFromFile(
      { name: request.filename, contents: request.baseMarkdown, cacheKey: request.baseKey },
      { name: request.filename, contents: request.draftMarkdown, cacheKey: request.draftKey },
    );
    const normalized = normalizeAuthoredFileDiff({
      identity: request.identity,
      document: request.draftMarkdown,
      metadata,
    });
    self.postMessage({
      ok: true,
      generation: request.generation,
      identity: request.identity,
      hunks: normalized.hunks,
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      generation: request.generation,
      identity: request.identity,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

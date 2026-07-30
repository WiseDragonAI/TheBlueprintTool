/**
 * WHAT: Derives complete authored-file diff metadata in an isolated browser Worker.
 * WHY: Large Markdown comparisons must not block editor input or import Pierre interaction managers.
 */
import { parseDiffFromFile } from '@pierre/diffs';

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
    self.postMessage({
      ok: true,
      generation: request.generation,
      identity: request.identity,
      metadata,
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

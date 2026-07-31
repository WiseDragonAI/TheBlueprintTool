/**
 * WHAT: Owns one finite Pierre Worker request from creation through cancellation and termination.
 * WHY: Every diff generation must settle exactly once without leaving timers, listeners, or Workers alive.
 */
export type AuthoredFileDiffDerivation = {
  generation: number;
  identity: string;
  metadata: unknown;
};

type WorkerLike = {
  addEventListener(type: 'message' | 'error', listener: EventListener): void;
  removeEventListener(type: 'message' | 'error', listener: EventListener): void;
  postMessage(message: unknown): void;
  terminate(): void;
};

export async function deriveAuthoredFileDiff(input: {
  generation: number;
  identity: string;
  filename: string;
  baseMarkdown: string;
  draftMarkdown: string;
  baseKey: string;
  draftKey: string;
  deadlineMs?: number;
  signal?: AbortSignal;
  createWorker?: () => WorkerLike;
}): Promise<AuthoredFileDiffDerivation> {
  const deadlineMs = input.deadlineMs ?? 2_000;
  const createWorker = input.createWorker ?? (() => new Worker(
    '/assets/vendor/pierre-diff-worker-1.2.12.js',
    { type: 'module', name: 'authored-file-diff' },
  ));
  return await new Promise<AuthoredFileDiffDerivation>((resolve, reject) => {
    const worker = createWorker();
    let settled = false;
    const finish = (result: { value?: AuthoredFileDiffDerivation; error?: Error }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      input.signal?.removeEventListener('abort', abort);
      worker.removeEventListener('message', message);
      worker.removeEventListener('error', failure);
      worker.terminate();
      if (result.error) reject(result.error);
      else resolve(result.value!);
    };
    const abort = (): void => finish({ error: new DOMException('The diff request was cancelled.', 'AbortError') });
    const failure = (event: Event): void => finish({
      error: new Error((event as ErrorEvent).message || 'The diff Worker failed.'),
    });
    const message = (event: Event): void => {
      const result = (event as MessageEvent).data as Record<string, unknown>;
      if (result.generation !== input.generation || result.identity !== input.identity) return;
      if (result.ok !== true) {
        finish({ error: new Error(String(result.error ?? 'The diff Worker rejected the request.')) });
        return;
      }
      finish({
        value: {
          generation: input.generation,
          identity: input.identity,
          metadata: result.metadata,
        },
      });
    };
    const deadline = setTimeout(
      () => finish({
        error: new DOMException(`The diff Worker exceeded its ${deadlineMs.toLocaleString('en-US')} ms deadline.`, 'TimeoutError'),
      }),
      deadlineMs,
    );
    worker.addEventListener('message', message);
    worker.addEventListener('error', failure);
    input.signal?.addEventListener('abort', abort, { once: true });
    if (input.signal?.aborted) {
      abort();
      return;
    }
    worker.postMessage({
      generation: input.generation,
      identity: input.identity,
      filename: input.filename,
      baseMarkdown: input.baseMarkdown,
      draftMarkdown: input.draftMarkdown,
      baseKey: input.baseKey,
      draftKey: input.draftKey,
    });
  });
}

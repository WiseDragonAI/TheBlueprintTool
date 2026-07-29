/**
 * WHAT: Owns one cancellable, deadline-bounded asynchronous delivery operation.
 * WHY: Admission, relay health, and coordinator waits need identical settlement and listener cleanup.
 */
export async function runDeliveryOperationBoundary<T>(input: {
  deadlineMs: number;
  maximumDeadlineMs: number;
  signal?: AbortSignal;
  cancellationError: () => Error;
  timeoutError: () => Error;
  execute: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const controller = new AbortController();
  let rejectBoundary: (error: Error) => void = () => undefined;
  const boundary = new Promise<never>((_resolve, reject) => {
    rejectBoundary = reject;
  });
  const cancel = (): void => {
    const reason = input.signal?.reason instanceof Error
      ? input.signal.reason
      : input.cancellationError();
    controller.abort(reason);
    rejectBoundary(reason);
  };
  // WHAT: Forward an already-settled parent before starting downstream work.
  // WHY: A cancelled caller must not leave a new delivery operation running.
  if (input.signal?.aborted) cancel();
  else input.signal?.addEventListener('abort', cancel, { once: true });

  const deadlineMs = Math.max(
    100,
    Math.min(input.maximumDeadlineMs, Math.floor(input.deadlineMs)),
  );
  const timer = setTimeout(() => {
    const error = input.timeoutError();
    controller.abort(error);
    rejectBoundary(error);
  }, deadlineMs);
  try {
    return await Promise.race([input.execute(controller.signal), boundary]);
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', cancel);
  }
}

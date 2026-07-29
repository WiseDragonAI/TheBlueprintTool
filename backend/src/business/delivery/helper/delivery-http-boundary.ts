/**
 * WHAT: Authenticates and bounds protocol-1 delivery HTTP dispatch.
 * WHY: Arbitrary HTTP callers, oversized bodies, disconnects, and timed-out clients must not reach node mutation.
 */
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const maximumDeliveryRequestBytes = 4 * 1024;
export const deliveryRequestDeadlineMs = 30_000;

export class DeliveryHttpBoundaryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'DeliveryHttpBoundaryError';
  }
}

export function localDeliveryDispatchToken(settingsValue: unknown): string {
  const settings = settingsValue && typeof settingsValue === 'object' && !Array.isArray(settingsValue)
    ? settingsValue as Record<string, unknown>
    : {};
  const token = String(settings.deliveryLocalDispatchToken ?? '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new DeliveryHttpBoundaryError(
      'delivery_local_dispatch_not_configured',
      'The local delivery dispatch capability is not configured.',
      503,
    );
  }
  return token;
}

export function authorizeLocalDeliveryDispatch(input: {
  authorization: string | undefined;
  settings: unknown;
}): void {
  const expected = Buffer.from(localDeliveryDispatchToken(input.settings));
  const suppliedValue = String(input.authorization ?? '');
  const supplied = Buffer.from(suppliedValue.startsWith('Bearer ') ? suppliedValue.slice(7) : '');
  if (supplied.byteLength !== expected.byteLength || !timingSafeEqual(supplied, expected)) {
    throw new DeliveryHttpBoundaryError(
      'delivery_local_dispatch_authority_invalid',
      'A valid local delivery dispatch capability is required.',
      403,
    );
  }
}

export function createDeliveryHttpRequestScope(input: {
  request: IncomingMessage;
  response: ServerResponse;
  timeoutMs?: number;
}): { signal: AbortSignal; dispose(): void } {
  const controller = new AbortController();
  const abort = (reason: string): void => {
    if (!controller.signal.aborted) controller.abort(new Error(reason));
  };
  const onRequestAborted = (): void => abort('delivery_request_aborted');
  const onRequestClose = (): void => {
    if (!input.request.complete) abort('delivery_request_closed');
  };
  const onResponseClose = (): void => {
    if (!input.response.writableEnded) abort('delivery_response_closed');
  };
  input.request.once('aborted', onRequestAborted);
  input.request.once('close', onRequestClose);
  input.response.once('close', onResponseClose);
  const timeoutMs = Math.max(1, Math.min(10 * 60_000, Math.floor(input.timeoutMs ?? deliveryRequestDeadlineMs)));
  const timeout = setTimeout(() => abort('delivery_request_timeout'), timeoutMs);
  let disposed = false;
  return {
    signal: controller.signal,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeout);
      input.request.off('aborted', onRequestAborted);
      input.request.off('close', onRequestClose);
      input.response.off('close', onResponseClose);
    },
  };
}

export function readDeliveryRequestJson(
  request: IncomingMessage,
  signal: AbortSignal,
  maximumBytes = maximumDeliveryRequestBytes,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const cleanup = (): void => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const settleError = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = (): void => settleError(new DeliveryHttpBoundaryError(
      String(signal.reason ?? '').includes('timeout') ? 'delivery_request_timeout' : 'delivery_request_cancelled',
      String(signal.reason ?? 'The delivery request was cancelled.'),
      String(signal.reason ?? '').includes('timeout') ? 504 : 499,
    ));
    const onError = (error: Error): void => settleError(new DeliveryHttpBoundaryError(
      'delivery_request_failed',
      error.message,
      400,
    ));
    const onData = (part: Buffer | string): void => {
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      bytes += chunk.byteLength;
      if (bytes > maximumBytes) {
        settleError(new DeliveryHttpBoundaryError(
          'delivery_request_too_large',
          `Delivery request body exceeds ${maximumBytes} bytes.`,
          413,
        ));
        request.resume();
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as unknown);
      } catch (error) {
        reject(new DeliveryHttpBoundaryError(
          'invalid_json',
          error instanceof Error ? error.message : 'Delivery request JSON is invalid.',
          400,
        ));
      }
    };
    const contentLength = Number(request.headers['content-length'] ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
      settleError(new DeliveryHttpBoundaryError(
        'delivery_request_too_large',
        `Delivery request body exceeds ${maximumBytes} bytes.`,
        413,
      ));
      request.resume();
      return;
    }
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

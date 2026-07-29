/**
 * WHAT: Serves delivery admission evidence and authenticated internal delivery commands.
 * WHY: Delivery transport and cancellation belong to delivery, not server composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DeliveryNodeCommandError } from '../controller/delivery-node-command-controller.js';
import {
  createDeliveryHttpRequestScope,
  DeliveryHttpBoundaryError,
  readDeliveryRequestJson,
} from '../helper/delivery-http-boundary.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;

export async function handleDeliveryRoutes(input: {
  admissionState: () => AnyRecord;
  consumeCapability: (capability: string) => unknown;
  request: IncomingMessage;
  response: ServerResponse;
  runCommand: (command: unknown, signal: AbortSignal) => Promise<unknown>;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/delivery/admission-state' && input.request.method === 'GET') {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify(input.admissionState()));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url !== '/api/internal/delivery' || input.request.method !== 'POST') {
    return HTTP_ROUTE_NEXT;
  }
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  const requestScope = createDeliveryHttpRequestScope({
    request: input.request,
    response: input.response,
  });
  const capability = String(
    input.request.headers['x-decision-os-delivery-capability'] ?? '',
  );
  const authority = capability ? input.consumeCapability(capability) : null;
  if (!authority) {
    requestScope.dispose();
    input.response.statusCode = 403;
    input.response.end(JSON.stringify({
      ok: false,
      error: 'delivery_transport_capability_invalid',
    }));
    return HTTP_ROUTE_HANDLED;
  }
  try {
    const command = await readDeliveryRequestJson(input.request, requestScope.signal);
    const receipt = await input.runCommand(command, requestScope.signal);
    input.response.end(JSON.stringify({ ok: true, receipt }));
  } catch (error) {
    input.response.statusCode = error instanceof DeliveryHttpBoundaryError
      ? error.statusCode
      : error instanceof DeliveryNodeCommandError
        ? error.statusCode
        : error instanceof SyntaxError
          ? 400
          : 500;
    input.response.end(JSON.stringify({
      ok: false,
      error: error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : error instanceof SyntaxError
          ? 'invalid_json'
          : 'delivery_node_action_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
  } finally {
    requestScope.dispose();
  }
  return HTTP_ROUTE_HANDLED;
}

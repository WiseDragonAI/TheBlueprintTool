/**
 * WHAT: Registers Control Room and project ledger event-stream clients.
 * WHY: SSE connection ownership is an HTTP transport concern, not application composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from './http-route.js';

function connectEventStream(
  request: IncomingMessage,
  response: ServerResponse,
  clients: Set<ServerResponse>,
): void {
  response.writeHead(200, {
    'cache-control': 'no-store',
    connection: 'keep-alive',
    'content-type': 'text/event-stream',
  });
  response.write(': connected\n\n');
  clients.add(response);
  request.on('close', () => clients.delete(response));
}

export function handleContentEventRoutes(input: {
  contentEventClients: Set<ServerResponse>;
  globalContentEventClients: Set<ServerResponse>;
  request: IncomingMessage;
  response: ServerResponse;
  url: string;
}): HttpRouteOutcome {
  if (input.url === '/api/control-room-events' && input.request.method === 'GET') {
    connectEventStream(input.request, input.response, input.globalContentEventClients);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/ledger-content-events' && input.request.method === 'GET') {
    connectEventStream(input.request, input.response, input.contentEventClients);
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}

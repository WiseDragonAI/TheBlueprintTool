/**
 * WHAT: Sends a JSON response through the Node HTTP boundary.
 * WHY: Capability routes need one response implementation without importing server composition.
 */
import type { ServerResponse } from 'node:http';

export function sendJsonResponse(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json');
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

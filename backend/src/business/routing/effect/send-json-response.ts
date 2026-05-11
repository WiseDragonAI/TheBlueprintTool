/**
 * WHAT: Generated effect function send-json-response.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@backend/telemetry/harness.js';

export function sendJsonResponse(input: unknown = {}, ...args: unknown[]): void {
  telemetry('effect:send-json-response -> stubbed scaffold return', { functionName: 'send-json-response', phase: 'event', arguments: input });
}

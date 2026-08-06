/**
 * WHAT: Detects the Codex capacity failure that can safely resume the same session.
 * WHY: Capacity exhaustion is transient and must not turn a durable headless session into a failed run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { codexSessionIdFromEvent } from './codex-session-id.js';

type AnyRecord = Record<string, unknown>;

export const codexCapacityResumeDelayMs = 5_000;

const capacityMessage = /selected model is at capacity\. please try a different model\.?/i;

function contentAfter(file: string, byteOffset: number): string {
  if (!existsSync(file)) return '';
  return readFileSync(file).subarray(byteOffset).toString('utf8');
}

export function isTransientCodexCapacityFailure(input: {
  stdoutFile: string;
  stderrFile: string;
  stdoutByteOffset?: number;
  stderrByteOffset?: number;
}): boolean {
  const output = [
    contentAfter(input.stdoutFile, input.stdoutByteOffset ?? 0),
    contentAfter(input.stderrFile, input.stderrByteOffset ?? 0),
  ].join('\n');
  return capacityMessage.test(output);
}

export function readCodexSessionId(stdoutFile: string): string {
  if (!existsSync(stdoutFile)) return '';
  let sessionId = '';
  for (const line of readFileSync(stdoutFile, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as AnyRecord;
      const captured = codexSessionIdFromEvent(event);
      if (captured) sessionId = captured;
    } catch {
      // Later valid JSONL events can still identify the durable session.
    }
  }
  return sessionId;
}

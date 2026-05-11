/**
 * WHAT: JSON parsing and serialization helpers.
 * WHY: ledger storage, reports, graph output, and patch batches all use durable JSON files.
 */
import type { Result } from '../types.js';

export function parseJson<T = unknown>(text: string): Result<T> {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
}

export function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

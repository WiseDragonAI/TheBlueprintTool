/**
 * WHAT: Validates and canonically encodes the CRDT's JSON value domain.
 * WHY: Object insertion order and platform-specific coercions must not affect hashes.
 */
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);

function assertJsonValue(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    // WHAT: Reject values JSON would silently coerce to null.
    // WHY: Hash admission must not depend on pre-encoding JavaScript values.
    if (!Number.isFinite(value)) throw new Error('invalid_task_current_json_number');
    return;
  }
  if (typeof value !== 'object') throw new Error('invalid_task_current_json_value');
  if (seen.has(value)) throw new Error('invalid_task_current_json_cycle');
  seen.add(value);
  if (Array.isArray(value)) {
    for (const child of value) assertJsonValue(child, seen);
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error('invalid_task_current_json_object');
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (unsafeKeys.has(key)) throw new Error('invalid_task_current_json_key');
      assertJsonValue(child, seen);
    }
  }
  seen.delete(value);
}

export function canonicalJson(value: unknown): string {
  assertJsonValue(value);
  return encodeCanonicalJson(value);
}

function encodeCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(encodeCanonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${encodeCanonicalJson(child)}`)
    .join(',')}}`;
}

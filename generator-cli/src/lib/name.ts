/**
 * WHAT: Stable name and id utilities for generated functions and paths.
 * WHY: generation needs deterministic function ids, export names, and file paths.
 */
import { createHash } from 'node:crypto';

export function hash8(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

export function dashToCamel(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function safeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function relativeImport(from: string, to: string): string {
  const fromParts = from.split('/').slice(0, -1);
  const toParts = to.split('/');
  while (fromParts.length > 0 && toParts.length > 0 && fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }
  const prefix = fromParts.map(() => '..');
  const joined = [...prefix, ...toParts].join('/');
  const normalized = joined.startsWith('.') ? joined : `./${joined}`;
  return normalized.replace(/\.ts$/, '.js');
}

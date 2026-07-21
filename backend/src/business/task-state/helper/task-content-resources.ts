/**
 * WHAT: Normalizes local task-content references into canonical replication resource identifiers.
 * WHY: Resource-head lanes must use one stable key across local capture and remote demand.
 */
import { isAbsolute, relative } from 'node:path';

export function canonicalTaskContentResource(decisionOsRoot: string, value: string): string {
  if (!value) return '';
  if (/^\/?\.decision-os\//.test(value)) return value.replace(/^\//, '');
  if (!isAbsolute(value)) return '';
  const inner = relative(decisionOsRoot, value);
  return inner && !inner.startsWith('..') && !isAbsolute(inner) ? `.decision-os/${inner.replaceAll('\\', '/')}` : '';
}

export function taskContentReferences(markdown: string): string[] {
  return [...markdown.matchAll(/\((\/?\.decision-os\/[^\s)]+)(?:\s+[^)]*)?\)/g)].map((match) => match[1]);
}

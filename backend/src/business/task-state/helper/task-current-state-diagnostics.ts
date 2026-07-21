/**
 * WHAT: Measures durable current-state shards and unfinished crash journals.
 * WHY: Operational diagnostics should not complicate the causal state store.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { taskEntityTypes } from './task-current-state-types.js';

export function taskCurrentStateDiagnostics(input: { root: string; journalDirectory: string; entityCount: number }): { entityCount: number; journalCount: number; currentBytes: number } {
  let currentBytes = 0;
  for (const entityType of taskEntityTypes) {
    const directory = resolve(input.root, 'current', entityType);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory)) currentBytes += statSync(resolve(directory, name)).size;
  }
  const journalCount = existsSync(input.journalDirectory)
    ? readdirSync(input.journalDirectory).filter((name) => name.endsWith('.json')).length
    : 0;
  return { entityCount: input.entityCount, journalCount, currentBytes };
}

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
    let names: string[];
    try {
      names = readdirSync(directory);
    } catch (error) {
      // WHAT: Treat a concurrently removed shard directory as an empty diagnostic sample.
      // WHY: Atomic materialization may replace an empty type directory while diagnostics are reading it.
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
      throw error;
    }
    for (const name of names) {
      // WHAT: Count only canonical durable shard files.
      // WHY: Atomic `.json.tmp-*` files are transient implementation details and can disappear before stat.
      if (!name.endsWith('.json')) continue;
      try {
        currentBytes += statSync(resolve(directory, name)).size;
      } catch (error) {
        // WHAT: Ignore one canonical shard that disappeared during the diagnostic sample.
        // WHY: A concurrent atomic replacement must not take the failsafe status route offline.
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
        throw error;
      }
    }
  }
  const journalCount = existsSync(input.journalDirectory)
    ? readdirSync(input.journalDirectory).filter((name) => name.endsWith('.json')).length
    : 0;
  return { entityCount: input.entityCount, journalCount, currentBytes };
}

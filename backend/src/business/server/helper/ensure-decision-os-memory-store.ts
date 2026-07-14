/**
 * WHAT: Provisions the catalog-wide Decision OS memory database in the server launch root.
 * WHY: Every discovered project must share one durable lesson store without writing into Codex internals.
 */
import { dirname } from 'node:path';
import { ensureMemoryStore } from '../../../../../tool/memory/memory-store.mjs';

export function ensureDecisionOsMemoryStore(masterDecisionOsRoot: string): string {
  return ensureMemoryStore(dirname(masterDecisionOsRoot));
}

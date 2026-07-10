/**
 * WHAT: Resolves the workspace-local artifact directory for one pipeline ledger.
 * WHY: Manifest construction must not depend on the process-spawning pipeline runner to derive a filesystem path.
 */
import { basename, extname, resolve } from 'node:path';

export function resolveCodexPipelineRunDirectory(decisionOsRoot: string, ledgerPath: string): string {
  const ledgerStem = basename(ledgerPath, extname(ledgerPath));
  const safeLedgerStem = String(ledgerStem || 'untitled')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
  return resolve(decisionOsRoot, 'runs', 'codex-skills', safeLedgerStem);
}

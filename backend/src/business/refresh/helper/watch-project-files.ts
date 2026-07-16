/**
 * WHAT: Watches one registered project's state, ledger, canvas, card, and thread dependencies.
 * WHY: View reconstruction must react to owned project changes without scanning the server root.
 */
import { readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { watchCardContentFiles, type CardContentChange } from './watch-card-content-files.js';

export type ProjectFileChange = {
  kind: 'state' | 'ledger' | 'ledgers-canvas';
  file: string;
  ledgerId?: string;
  reason: string;
};

type FileSignature = { size: number; modifiedAtMs: number } | null;

function fileSignature(file: string): FileSignature {
  try {
    const stat = statSync(file);
    return { size: stat.size, modifiedAtMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

function signatureKey(signature: FileSignature): string {
  return signature ? `${signature.size}:${signature.modifiedAtMs}` : 'missing';
}

function ledgerFiles(decisionOsRoot: string): Map<string, string> {
  try {
    const state = JSON.parse(readFileSync(resolve(decisionOsRoot, 'state.json'), 'utf8')) as { ledgers?: unknown[]; tabs?: unknown[] };
    const entries = Array.isArray(state.ledgers) ? state.ledgers : Array.isArray(state.tabs) ? state.tabs : [];
    return new Map(entries.flatMap((entry) => {
      // WHAT: Ignore malformed ledger registrations.
      // WHY: Watch ownership requires both an exact ledger identity and an exact file path.
      if (!entry || typeof entry !== 'object') return [];
      const record = entry as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      const ledgerFile = String(record.ledgerFile ?? '').trim();
      if (!id || !ledgerFile) return [];
      return [[resolve(dirname(decisionOsRoot), ledgerFile), id] as const];
    }));
  } catch {
    return new Map();
  }
}

export function watchProjectFiles(input: {
  decisionOsRoot: string;
  onContentChange: (event: CardContentChange) => void;
  onProjectChange: (event: ProjectFileChange) => void;
  auditIntervalMs?: number;
}) {
  const stateFile = resolve(input.decisionOsRoot, 'state.json');
  const canvasFile = resolve(input.decisionOsRoot, 'ledgers-canvas.json');
  const contentWatcher = watchCardContentFiles({ decisionOsRoot: input.decisionOsRoot, onChange: input.onContentChange });
  const pending = new Map<string, NodeJS.Timeout>();
  const ignoredWrites = new Set<string>();
  let ledgers = ledgerFiles(input.decisionOsRoot);
  let signatures = new Map<string, string>();

  const dependencies = (): Map<string, ProjectFileChange> => {
    const owned = new Map<string, ProjectFileChange>();
    owned.set(stateFile, { kind: 'state', file: stateFile, reason: 'project-state-changed' });
    owned.set(canvasFile, { kind: 'ledgers-canvas', file: canvasFile, reason: 'ledgers-canvas-changed' });
    for (const [file, ledgerId] of ledgers) {
      owned.set(file, { kind: 'ledger', file, ledgerId, reason: 'external-ledger-changed' });
    }
    return owned;
  };

  const refreshSignatures = (): void => {
    signatures = new Map([...dependencies().keys()].map((file) => [file, signatureKey(fileSignature(file))]));
  };

  const emit = (change: ProjectFileChange): void => {
    const file = resolve(change.file);
    // WHAT: Consume a marked server-owned write without publishing a duplicate external event.
    // WHY: HTTP mutations already advance revisions and must not be counted twice by their filesystem echo.
    if (ignoredWrites.delete(file)) {
      signatures.set(file, signatureKey(fileSignature(file)));
      return;
    }
    const existing = pending.get(file);
    // WHAT: Coalesce editor write bursts by dependency path.
    // WHY: One durable filesystem edit should commit one reconstruction revision.
    if (existing) clearTimeout(existing);
    pending.set(file, setTimeout(() => {
      pending.delete(file);
      // WHAT: Rebuild ledger watcher ownership after state membership changes.
      // WHY: `state.json` is the canonical list of ledger dependencies for this project.
      if (change.kind === 'state') {
        ledgers = ledgerFiles(input.decisionOsRoot);
        contentWatcher.refreshOwnership();
      }
      signatures.set(file, signatureKey(fileSignature(file)));
      input.onProjectChange(change);
    }, 50));
  };

  refreshSignatures();
  const rootWatcher: FSWatcher = watch(input.decisionOsRoot, { persistent: false }, (_eventType, filename) => {
    // WHAT: Ignore anonymous root events.
    // WHY: Reconstruction needs an exact dependency path.
    if (!filename) return;
    const file = resolve(input.decisionOsRoot, String(filename));
    const change = dependencies().get(file);
    // WHAT: Ignore project-root files outside the registered dependency set.
    // WHY: Card and thread subtrees have their own ownership-aware watcher.
    if (!change) return;
    emit(change);
  });

  const audit = setInterval(() => {
    for (const [file, change] of dependencies()) {
      const next = signatureKey(fileSignature(file));
      // WHAT: Skip dependencies whose bounded signature is unchanged.
      // WHY: The audit exists only to recover missed native watcher events.
      if (signatures.get(file) === next) continue;
      emit({ ...change, reason: `audit-${change.reason}` });
    }
  }, input.auditIntervalMs ?? 30_000);
  audit.unref();

  return {
    close(): void {
      clearInterval(audit);
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      rootWatcher.close();
      contentWatcher.close();
    },
    refreshOwnership(): void {
      ledgers = ledgerFiles(input.decisionOsRoot);
      contentWatcher.refreshOwnership();
      refreshSignatures();
    },
    ignoreNext(file: string): void {
      ignoredWrites.add(resolve(file));
    },
    get watchedDirectories(): number {
      return contentWatcher.watchedDirectories + 1;
    },
  };
}

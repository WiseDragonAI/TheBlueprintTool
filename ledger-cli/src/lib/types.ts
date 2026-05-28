/**
 * WHAT: Shared contracts for ledger-cli controllers, helpers, effects, and tests.
 * WHY: ledger editing must have its own package boundary instead of depending on generator scaffold contracts.
 */
import type { Stats } from 'node:fs';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type LedgerCommand = 'done' | 'inspect' | 'mutate' | 'overview' | 'todo';

export type LedgerMutationOperation = {
  addCardFile?: string;
  addRelationships: Array<{
    from: string;
    id: string;
    label?: string;
    to: string;
  }>;
  cardLabels?: string[];
  cardCommentFile?: string;
  cardId?: string;
  cardTitle?: string;
  removeCardIds: string[];
  removeRelationshipIds: string[];
};

export type LedgerCliCommand = {
  mode: LedgerCommand;
  ledgerJsonFile: string;
  mutationFile?: string;
  mutationOperation: LedgerMutationOperation;
  statusOperation?: {
    cardId?: string;
    status: 'todo' | 'done';
  };
};

export type FileSystemPort = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  rm(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<Stats>;
};

export type TelemetryTrace = {
  name: string;
  phase: 'started' | 'completed' | 'failed' | 'event';
  args?: unknown;
  at: string;
};

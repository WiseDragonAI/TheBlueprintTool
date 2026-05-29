/**
 * WHAT: Shared contracts for ledger-cli controllers, helpers, effects, and tests.
 * WHY: ledger editing must have its own package boundary instead of depending on generator scaffold contracts.
 */
import type { Stats } from 'node:fs';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type LedgerCommand = 'answer' | 'done' | 'inspect' | 'mutate' | 'overview' | 'todo' | 'unanswered';

export type LedgerMutationOperation = {
  addCardFile?: string;
  addRelationships: Array<{
    from: string;
    id: string;
    label?: string;
    to: string;
  }>;
  cardLabels?: string[];
  cardComment?: string;
  cardCommentFile?: string;
  cardH?: number;
  cardId?: string;
  cardTitle?: string;
  cardW?: number;
  cardX?: number;
  cardY?: number;
  removeCardIds: string[];
  removeRelationshipIds: string[];
};

export type LedgerCliCommand = {
  mode: LedgerCommand;
  ledgerJsonFile: string;
  answerOperation?: {
    message?: string;
    messageFile?: string;
    threadId?: string;
  };
  json: boolean;
  mutationFile?: string;
  mutationOperation: LedgerMutationOperation;
  statusOperation?: {
    cardId?: string;
    status: 'todo' | 'done';
  };
};

export type ThreadNote = {
  error?: string;
  id?: string;
  message?: string;
  role?: string;
  status?: string;
  timestamp?: string;
  voiceFileRef?: string;
};

export type UnansweredThread = {
  answerCommand: string;
  lastNote: ThreadNote;
  pendingNotes: ThreadNote[];
  targetId: string;
  threadId: string;
  title: string;
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

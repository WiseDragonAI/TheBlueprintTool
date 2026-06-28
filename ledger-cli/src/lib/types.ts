/**
 * WHAT: Shared contracts for ledger-cli controllers, helpers, effects, and tests.
 * WHY: ledger editing must have its own package boundary instead of depending on generator scaffold contracts.
 */
import type { Stats } from 'node:fs';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type LedgerCommand = 'answer' | 'done' | 'export' | 'help' | 'inspect' | 'mutate' | 'overview' | 'todo' | 'unanswered';

export type AssetCommand = 'gc' | 'list-orphans' | 'list-referenced' | 'prune-json' | 'stage-referenced';

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
  mode: LedgerCommand | 'assets';
  ledgerJsonFile: string;
  assetOperation?: AssetOperation;
  answerOperation?: {
    message?: string;
    messageFile?: string;
    threadId?: string;
  };
  json: boolean;
  exportOperation?: {
    outputFile?: string;
  };
  mutationFile?: string;
  mutationOperation: LedgerMutationOperation;
  statusOperation?: {
    cardId?: string;
    status: 'todo' | 'done';
  };
};

export type AssetOperation = {
  action: AssetCommand;
  delete: boolean;
  domain?: string;
  dryRun: boolean;
  includeRisky: string[];
  json: boolean;
  manifestFile?: string;
  moveTo?: string;
  root?: string;
  write: boolean;
};

export type AssetReferenceKind = 'html-img' | 'json-key' | 'json-value' | 'markdown-image' | 'raw-media-mention';

export type AssetReference = {
  path: string;
  exists: boolean;
  referenceKinds: AssetReferenceKind[];
  sources: string[];
};

export type ClassifiedAsset = {
  path: string;
  bytes: number;
  root: string;
  referenceKinds?: AssetReferenceKind[];
  sources?: string[];
};

export type AssetGcReport = {
  generatedAt: string;
  root: string;
  managedRoots: string[];
  scannedSourceFiles: string[];
  referencedAssets: ClassifiedAsset[];
  orphanAssets: ClassifiedAsset[];
  pinnedAssets: ClassifiedAsset[];
  missingReferences: AssetReference[];
  jsonReferences: AssetReference[];
  prunedJsonReferences?: AssetReference[];
  softReferences: AssetReference[];
  staleJsonReferences: AssetReference[];
  movedAssets?: Array<{ from: string; to: string }>;
  summary: {
    jsonReferences: number;
    managedAssets: number;
    missingReferences: number;
    orphanAssets: number;
    orphanBytes: number;
    pinnedAssets: number;
    prunedJsonReferences?: number;
    referencedAssets: number;
    referencedBytes: number;
    softReferences: number;
    staleJsonReferences: number;
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
  editInstruction: string;
  lastNote: ThreadNote;
  pendingNotes: ThreadNote[];
  targetId: string;
  threadFile: string;
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

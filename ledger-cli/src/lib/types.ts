/**
 * WHAT: Shared contracts for ledger-cli controllers, helpers, effects, and tests.
 * WHY: ledger editing must have its own package boundary instead of depending on generator scaffold contracts.
 */
import type { Stats } from 'node:fs';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type LedgerCommand = 'answer' | 'card-context' | 'codex-run-audit' | 'codex-run-events' | 'done' | 'execution-profile' | 'export' | 'help' | 'inspect' | 'master-task-apply' | 'master-task-gate' | 'migrate-decision-os' | 'mutate' | 'overview' | 'session-context' | 'skills' | 'todo' | 'unanswered' | 'validate-master-tasks' | 'zone-cards';

export type AssetCommand = 'apply-gc-plan' | 'gc' | 'list-orphans' | 'list-referenced' | 'prune-json' | 'stage-referenced';

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
    messageStdin?: boolean;
    threadId?: string;
  };
  cardOperation?: {
    cardId?: string;
  };
  json: boolean;
  exportOperation?: {
    outputFile?: string;
  };
  mutationFile?: string;
  mutationOperation: LedgerMutationOperation;
  migrationOperation?: MigrationOperation;
  masterTaskOperation?: { planStdin: boolean };
  runAuditOperation?: { root?: string; count: number; cutoff?: number; exclusions: string[] };
  runEventsOperation?: { root?: string; runId: string; itemType: string; limit?: number };
  skillOperation?: SkillOperation;
  statusOperation?: {
    cardId?: string;
    status: 'todo' | 'done';
  };
  zoneOperation?: {
    zoneId?: string;
  };
};

export type SkillOperation = {
  action: 'create' | 'update';
  json: boolean;
  rootFlagProvided: boolean;
  source?: string;
};

export type MigrationOperation = {
  allowDirty: boolean;
  dryRun: boolean;
  json: boolean;
  root?: string;
  write: boolean;
};

export type DecisionOsMigrationReport = {
  changedFiles: string[];
  dryRun: boolean;
  manualFollowUpFiles: string[];
  movedDirectories: Array<{ from: string; to: string }>;
  replacements: Record<string, number>;
  root: string;
  skippedBinaryFiles: string[];
  write: boolean;
};

export type AssetOperation = {
  action: AssetCommand;
  domain?: string;
  dryRun: boolean;
  includeRisky: string[];
  json: boolean;
  planFile?: string;
  root?: string;
  writePlanFile?: string;
  write: boolean;
};

export type AssetReferenceKind =
  | 'html-img'
  | 'html-link'
  | 'html-script'
  | 'json-key'
  | 'json-value'
  | 'markdown-html-embed'
  | 'markdown-image'
  | 'raw-media-mention';

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

export type ClassifiedTextFile = {
  path: string;
  bytes: number;
  kind: 'card-markdown' | 'ledger-json' | 'thread-markdown';
  referencedBy?: string[];
};

export type AssetGcPlanEntry = {
  path: string;
  bytes: number;
  category: 'orphan-asset' | 'unused-text';
  detail: string;
};

export type AssetGcPlan = {
  kind: 'decision-os.asset-gc-plan';
  version: 1;
  generatedAt: string;
  root: string;
  activeLedgerFiles: string[];
  deleteFiles: AssetGcPlanEntry[];
  summary: {
    deleteBytes: number;
    deleteFiles: number;
    orphanAssets: number;
    unusedTextFiles: number;
  };
};

export type AppliedAssetGcPlan = {
  planFile: string;
  root: string;
  deletedFiles: string[];
  removedDirectories: string[];
  skippedMissingFiles: string[];
};

export type AssetGcReport = {
  generatedAt: string;
  root: string;
  managedRoots: string[];
  scannedSourceFiles: string[];
  activeLedgerFiles: string[];
  referencedAssets: ClassifiedAsset[];
  referencedTextFiles: ClassifiedTextFile[];
  orphanAssets: ClassifiedAsset[];
  unusedTextFiles: ClassifiedTextFile[];
  pinnedAssets: ClassifiedAsset[];
  keptTrackedFiles: string[];
  keptUntrackedFiles: string[];
  missingReferences: AssetReference[];
  jsonReferences: AssetReference[];
  prunedJsonReferences?: AssetReference[];
  softReferences: AssetReference[];
  staleJsonReferences: AssetReference[];
  summary: {
    activeLedgers: number;
    jsonReferences: number;
    keptBytes: number;
    keptFiles: number;
    keptTrackedBytes: number;
    keptTrackedFiles: number;
    keptUntrackedBytes: number;
    keptUntrackedFiles: number;
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
    unusedTextBytes: number;
    unusedTextFiles: number;
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

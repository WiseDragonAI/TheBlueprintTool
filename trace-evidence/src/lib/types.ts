/**
 * WHAT: Defines the durable and adapter contracts for generalized trace evidence jobs.
 * WHY: Every repository must exchange the same identities and artifacts with the reusable core.
 */
export type TraceJobPhase = 'accepted' | 'resolving_scope' | 'waiting_for_lease' | 'running_tests' | 'collecting_evidence' | 'flushing_evidence' | 'evidence_ready' | 'mapping_sources' | 'running_graphify' | 'writing_report' | 'complete' | 'failed' | 'cancelled' | 'interrupted';

export type TraceScope = {
  scopeId: string;
  projectId?: string;
  kind: 'test' | 'task';
  testIds: string[];
  cardIds: string[];
  executionIds: string[];
  sessionIds: string[];
  providerSessionIds: string[];
  collectRawCodex?: boolean;
  collectPresentation?: boolean;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  error: string | null;
};

export type TraceParseFailure = {
  artifact: string;
  line: number;
  byteOffset: number;
  code: 'malformed_jsonl' | 'invalid_telemetry_event';
  message: string;
};

export type TraceProcessRecord = {
  scopeId: string;
  pid: number | null;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  deadlineAt: string;
  cancellationOrigin: string | null;
  settled: boolean;
};

export type ArtifactDescriptor = {
  path: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  producer: string;
  complete: boolean;
  createdAt: string;
  scopeIds: string[];
};

export type TraceJob = {
  version: 1;
  jobId: string;
  adapter: string;
  kind: 'test' | 'task';
  phase: TraceJobPhase;
  createdAt: string;
  updatedAt: string;
  supervisorPid?: number | null;
  phaseTimestamps?: Partial<Record<TraceJobPhase, string>>;
  artifactRoot: string;
  scopes: TraceScope[];
  failures: Array<{ component: string; operation: string; code: string; message: string; at: string }>;
  parseFailures?: TraceParseFailure[];
  droppedRecords?: Array<{ artifact: string; firstDroppedByte: number; reason: string }>;
  processes?: TraceProcessRecord[];
  cancellation?: { requestedAt: string | null; origin: string | null };
  artifacts: ArtifactDescriptor[];
  request: TraceJobRequest;
  options: { graphify: 'off' | 'touched' | 'all'; stacks: 'raw' | 'mapped' | 'both'; timeoutMs: number; graphifyTimeoutMs?: number; maxArtifactBytes?: number; redaction?: string };
};

export type TraceJobRequest = {
  cwd: string;
  testFiles: string[];
  testNames: string[];
  command: string[];
  projectId: string;
  cardIds: string[];
  executionIds: string[];
  sessionIds: string[];
  providerSessionIds?: string[];
  sourceMaps: string[];
  environment?: Record<string, string>;
  includePresentation?: boolean;
  includeRawCodex?: boolean;
  runtimeRoot?: string;
  executionMode?: 'default' | 'latest' | 'active';
  includeSubtasks?: boolean;
  replica?: string;
  telemetryRoot?: string;
};

export type RawTelemetryEvent = {
  schemaVersion: 1;
  traceJobId: string;
  traceRunId: string;
  scopeId: string;
  testId: string | null;
  cardId: string | null;
  executionId: string | null;
  sessionId: string | null;
  eventId: string;
  sequence: number;
  emittedAt: string;
  monotonicNs: string;
  processId: number;
  threadId: number | null;
  name: string;
  phase: 'started' | 'completed' | 'failed' | 'event';
  args: unknown;
  rawStack: string;
};

export type CardDescriptor = {
  projectId: string;
  ledgerId: string;
  cardId: string;
  title: string;
  masterTaskId: string | null;
  subtaskIds: string[];
  durableStatus: string;
  internalStatus: string;
  executionIds: string[];
  sessionIds: string[];
  providerSessionIds: string[];
  artifacts: Record<string, boolean>;
  defaultExecutionId?: string | null;
  activeExecutionIds?: string[];
  predecessorExecutionIds?: string[];
  successorExecutionIds?: string[];
  restartedExecutionIds?: string[];
  executions?: Array<{ executionId: string; sessionId: string; kind: string; phase: string; requestedAt: string; startedAt: string | null; finishedAt: string | null; model: string; effort: string; executorNodeId: string; predecessorExecutionId: string | null; artifacts: Record<string, boolean> }>;
};

export type TestCommand = { testId: string; executable: string; args: string[]; cwd: string; env: Record<string, string> };
export type RawEvidenceRecord = { source: 'telemetry' | 'task-events' | 'raw-codex' | 'presentation' | 'stdout' | 'stderr'; scopeId: string; cardId: string | null; executionId: string | null; sessionId: string | null; bytes: string };
export type SourceFileDescriptor = { path: string; repositoryRelativePath: string; tracked: boolean; gitBlobHash: string | null };

export interface TraceRepositoryAdapter {
  readonly name: string;
  readonly version: string;
  discoverTests(input: { files: string[]; names: string[]; command: string[]; cwd: string }): Promise<TestCommand[]>;
  resolveCards(input: { projectId: string; cardIds: string[]; replica?: string; signal?: AbortSignal }): Promise<CardDescriptor[]>;
  resolveScopes(input: { projectId: string; cardIds: string[]; executionIds: string[]; sessionIds: string[]; providerSessionIds?: string[]; executionMode?: 'default' | 'latest' | 'active'; replica?: string; includeRawCodex?: boolean; includePresentation?: boolean; signal?: AbortSignal }): Promise<TraceScope[]>;
  wrapTestCommandWithLease(input: { jobId: string; command: TestCommand }): Promise<TestCommand>;
  wrapTestBatchWithLease?(input: { jobId: string; commands: TestCommand[]; batchWorker: string; specificationFile: string }): Promise<TestCommand>;
  collectEvidence(scope: TraceScope, signal?: AbortSignal): AsyncIterable<RawEvidenceRecord>;
  locateSourceMaps(input: { scopes: TraceScope[]; generatedFiles: string[]; signal?: AbortSignal }): Promise<string[]>;
  resolveSourceFiles(input: { files: string[] }): Promise<SourceFileDescriptor[]>;
}

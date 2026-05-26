/**
 * WHAT: Shared contracts for generator-cli data moving between controllers, helpers, effects, and tests.
 * WHY: The MasterLedger Data Model names GeneratedFunction, RuntimeData, TelemetryTrace, TestRun, and GeneratedReport as contractual records.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type CliMode = 'dry-run' | 'apply' | 'report' | 'patch-doc' | 'check-ledger';

export type CliCommand =
  | {
      mode: 'dry-run' | 'apply';
      masterLedgerFile: string;
      specsLedgerFile: string;
      output: string;
    }
  | {
      mode: 'report';
      testCommand: string;
      reportFile: string;
      telemetryFile?: string;
      functionsFile?: string;
    }
  | {
      mode: 'patch-doc';
      patchBatchFile: string;
    }
  | {
      mode: 'check-ledger';
      masterLedgerFile: string;
      specsLedgerFile: string;
      groups: string[];
      json: boolean;
    };

export type TelemetryTrace = {
  name: string;
  phase: 'started' | 'completed' | 'failed' | 'event';
  args?: unknown;
  at: string;
};

export type MasterLedgerDocument = {
  path: string;
  text: string;
};

export type FunctionKind = 'input' | 'controller' | 'helper' | 'effect' | 'test' | 'component';

export type GeneratedFunction = {
  functionId: string;
  rootBlock?: string;
  kind: FunctionKind;
  domain: string;
  name: string;
  exportName: string;
  path: string;
  sourceSpecIds: string[];
  telemetryName: string;
  description: string;
  returnType?: string;
  body: string;
  pure: boolean;
  componentOutput?: boolean;
};

export type TestSuitePlan = {
  suiteName: string;
  specId: string;
  rootBlock?: string;
  path: string;
  expectedTelemetry: string[];
};

export type OutputFile = {
  path: string;
  content: string;
  functionName?: string;
  kind?: FunctionKind;
};

export type WorktreePlan = {
  rootDir: string;
  worktreePath: string;
  rootBlockPath: string;
  rootBlockPaths?: string[];
  functions: GeneratedFunction[];
  suites: TestSuitePlan[];
  supportFiles: OutputFile[];
  sourceFiles: OutputFile[];
  unitTestFiles: OutputFile[];
  integrationTestFiles: OutputFile[];
  telemetryHarness: OutputFile;
  graphOutput: OutputFile;
  reportConfig: OutputFile;
  testResults: OutputFile;
};

export type DependencyReference = {
  from: string;
  to: string;
  importPath: string;
};

export type DependencyGraph = {
  nodes: string[];
  edges: DependencyReference[];
};

export type TestRun = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  traces: TelemetryTrace[];
};

export type ExecutionStackTrace = {
  status: 'success' | 'failure';
  frames: string[];
};

export type GeneratedReport = {
  testRun: Pick<TestRun, 'command' | 'exitCode' | 'stdout' | 'stderr'>;
  telemetry: TelemetryTrace[];
  stackTrace: ExecutionStackTrace;
  graph: DependencyGraph;
  usedFunctions: string[];
  unusedFunctions: string[];
};

export type MasterLedgerProblem = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  details?: unknown;
};

export type MasterLedgerCheckReport = {
  ok: boolean;
  counts: {
    rootBlocks: number;
    domains: number;
    controllers: number;
    helpers: number;
    effects: number;
    generatedFunctions: number;
    sourceFiles: number;
    unitTestFiles: number;
    integrationTestFiles: number;
    testSuites: number;
    uniqueSpecIds: number;
    specsLedgerCards: number;
    selectedSpecCards: number;
    matchedSpecCards: number;
    declaredScopedSpecCount: number | null;
  };
  rootBlocks: string[];
  domains: string[];
  selectedGroups: string[];
  unmatchedGroups: string[];
  missingSpecTests: string[];
  testSuitesOutsideSelectedSpecs: string[];
  problems: MasterLedgerProblem[];
};

export type SpecsLedgerCard = {
  id: string;
  title: string;
  cardType?: string;
  x?: number;
  y?: number;
  w?: number;
  comment?: { what?: string };
};

export type SpecsLedgerGroup = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  variant?: string;
};

export type SpecsLedger = {
  cards?: SpecsLedgerCard[];
  annotations?: SpecsLedgerGroup[];
  positions?: Record<string, { x?: number; y?: number; w?: number }>;
};

export type PatchReplacement = {
  find: string;
  replace: string;
};

export type PatchBatch = {
  documentPath: string;
  replacements: PatchReplacement[];
};

export type FileSystemPort = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  rm(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
};

export type ProcessPort = {
  exec(command: string, cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

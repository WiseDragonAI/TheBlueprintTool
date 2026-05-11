/**
 * WHAT: Worktree generation plan builder.
 * WHY: dry-run and apply modes must share the same planned files before writes occur.
 */
import { join } from 'node:path';
import type { GeneratedFunction, OutputFile, TestSuitePlan, WorktreePlan } from '../../../lib/types.js';
import { deriveSourceFilePath } from './derive-source-file-path.js';
import { deriveUnitTestFilePath } from './derive-unit-test-file-path.js';
import { deriveIntegrationTestSuitePath } from './derive-integration-test-suite-path.js';

export function createWorktreePlan(input: {
  output: string;
  functions: GeneratedFunction[];
  suites: TestSuitePlan[];
  graph?: OutputFile;
}): WorktreePlan {
  const sourceFiles = deriveSourceFilePath(input.functions);
  const unitTestFiles = deriveUnitTestFilePath(input.functions);
  const integrationTestFiles = deriveIntegrationTestSuitePath(input.suites);

  return {
    rootDir: process.cwd(),
    worktreePath: input.output,
    functions: input.functions,
    suites: input.suites,
    sourceFiles,
    unitTestFiles,
    integrationTestFiles,
    telemetryHarness: {
      path: 'src/telemetry/harness.ts',
      content: `/**
 * WHAT: Generated telemetry harness.
 * WHY: generated files need shared observable execution evidence.
 */
export const traces = [];
export function telemetry(name, args = {}) {
  traces.push({ name, args, at: new Date().toISOString() });
}
`,
    },
    graphOutput: input.graph ?? {
      path: 'generated/dependency-graph.json',
      content: '{\n  "nodes": [],\n  "edges": []\n}\n',
    },
    reportConfig: {
      path: join('generated', 'report-config.json'),
      content: '{\n  "report": "generated-report.json"\n}\n',
    },
  };
}

/**
 * WHAT: Worktree generation plan builder.
 * WHY: dry-run and apply modes must share the same planned files before writes occur.
 */
import { join } from 'node:path';
import type { GeneratedFunction, OutputFile, TestSuitePlan, WorktreePlan } from '../../../lib/types.js';
import { resolveGeneratedDependenciesController } from '../../graph/controller/resolve-generated-dependencies.js';
import { deriveSourceFilePath } from './derive-source-file-path.js';
import { deriveUnitTestFilePath } from './derive-unit-test-file-path.js';
import { deriveIntegrationTestSuitePath } from './derive-integration-test-suite-path.js';

function rootBlockForPath(path: string): string {
  if (path.startsWith('src/')) {
    return 'generator-cli';
  }

  return path.split('/')[0] || 'generator-cli';
}

function rootBlockForFunction(generatedFunction: GeneratedFunction): string {
  return generatedFunction.rootBlock ?? rootBlockForPath(generatedFunction.path);
}

function normalizedFunction(generatedFunction: GeneratedFunction): GeneratedFunction {
  const rootBlock = rootBlockForFunction(generatedFunction);
  const path = generatedFunction.path.startsWith(`${rootBlock}/`) ? generatedFunction.path : `${rootBlock}/${generatedFunction.path}`;
  return { ...generatedFunction, rootBlock, path };
}

function rootBlocksFor(functions: GeneratedFunction[], suites: TestSuitePlan[]): string[] {
  return [...new Set([
    ...functions.map(rootBlockForFunction),
    ...suites.flatMap((suite) => suite.rootBlock ? [suite.rootBlock] : []),
  ])].sort();
}

function telemetryHarnessContent(): string {
  return `/**
 * WHAT: Generated telemetry harness.
 * WHY: generated files need shared observable execution evidence.
 */
export type GeneratedTrace = { name: string; args: unknown; at: string };
export const traces: GeneratedTrace[] = [];
export function telemetry(name: string, args: unknown = {}) {
  const trace = { name, args, at: new Date().toISOString() };
  traces.push(trace);
  console.log(JSON.stringify({ telemetry: trace }));
}
`;
}

function supportFilesFor(rootBlocks: string[]): OutputFile[] {
  return rootBlocks.flatMap((rootBlock) => [
    {
      path: `${rootBlock}/package.json`,
      content: `${JSON.stringify({
        name: rootBlock,
        version: '0.0.0-generated',
        private: true,
        type: 'module',
        scripts: {
          test: 'node --test --import tsx "test/**/*.test.ts"',
          'test:integration': 'node --test --import tsx "test/**/*.test.ts" --test-skip-pattern "unit/"',
          typecheck: 'tsc -p tsconfig.json --noEmit',
        },
        devDependencies: {
          '@types/node': '^24.0.0',
          tsx: '^4.20.0',
          typescript: '^5.8.0',
        },
      }, null, 2)}\n`,
    },
    {
      path: `${rootBlock}/tsconfig.json`,
      content: `${JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: false,
          noEmit: true,
          types: ['node'],
          paths: {
            [`@${rootBlock}/*`]: ['./src/*'],
          },
          skipLibCheck: true,
        },
        include: ['src/**/*.ts', 'test/**/*.ts'],
      }, null, 2)}\n`,
    },
    {
      path: `${rootBlock}/README.md`,
      content: `# Generated ${rootBlock} scaffold\n\nThis root block is generated from the MasterLedger. Helpers and effects are stubs; controllers preserve the ledger pseudocode execution path.\n`,
    },
    {
      path: `${rootBlock}/src/telemetry/harness.ts`,
      content: telemetryHarnessContent(),
    },
  ]);
}

export function createWorktreePlan(input: {
  output: string;
  functions: GeneratedFunction[];
  suites: TestSuitePlan[];
  graph?: OutputFile;
}): WorktreePlan {
  const functions = input.functions.map(normalizedFunction);
  const rootBlockPaths = rootBlocksFor(functions, input.suites);
  const rootBlockPath = rootBlockPaths[0] ?? 'generator-cli';
  const graph = resolveGeneratedDependenciesController(functions);
  const sourceFiles = deriveSourceFilePath(functions, graph.edges);
  const unitTestFiles = deriveUnitTestFilePath(functions);
  const integrationTestFiles = deriveIntegrationTestSuitePath(input.suites, functions, graph);

  return {
    rootDir: process.cwd(),
    worktreePath: input.output,
    rootBlockPath,
    rootBlockPaths,
    functions,
    suites: input.suites,
    supportFiles: supportFilesFor(rootBlockPaths),
    sourceFiles,
    unitTestFiles,
    integrationTestFiles,
    telemetryHarness: {
      path: `${rootBlockPath}/src/telemetry/harness.ts`,
      content: telemetryHarnessContent(),
    },
    graphOutput: input.graph ?? {
      path: `${rootBlockPath}/generated/dependency-graph.json`,
      content: `${JSON.stringify(graph, null, 2)}\n`,
    },
    reportConfig: {
      path: join(rootBlockPath, 'generated', 'report-config.json'),
      content: '{\n  "report": "generated-report.json"\n}\n',
    },
    testResults: {
      path: join(rootBlockPath, 'generated', 'test-results.json'),
      content: '{\n  "status": "not-run"\n}\n',
    },
  };
}

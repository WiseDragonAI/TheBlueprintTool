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

function generatedRootFunction(generatedFunction: GeneratedFunction): GeneratedFunction {
  return { ...generatedFunction, path: `generator-cli/${generatedFunction.path}` };
}

export function createWorktreePlan(input: {
  output: string;
  functions: GeneratedFunction[];
  suites: TestSuitePlan[];
  graph?: OutputFile;
}): WorktreePlan {
  const rootBlockPath = 'generator-cli';
  const functions = input.functions.map(generatedRootFunction);
  const graph = resolveGeneratedDependenciesController(functions);
  const sourceFiles = deriveSourceFilePath(functions, graph.edges);
  const unitTestFiles = deriveUnitTestFilePath(functions);
  const integrationTestFiles = deriveIntegrationTestSuitePath(input.suites, functions, graph);

  return {
    rootDir: process.cwd(),
    worktreePath: input.output,
    rootBlockPath,
    functions,
    suites: input.suites,
    supportFiles: [
      {
        path: 'generator-cli/package.json',
        content: `${JSON.stringify({
          name: 'generator-cli',
          version: '0.0.0-generated',
          private: true,
          type: 'module',
          scripts: {
            test: 'node --test --import tsx "test/**/*.test.ts"',
            'test:integration': 'node --test --import tsx "test/*.test.ts" "test/**/*.test.ts"',
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
        path: 'generator-cli/tsconfig.json',
        content: `${JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: false,
            noEmit: true,
            types: ['node'],
            paths: {
              '@generator-cli/*': ['./src/*'],
            },
            skipLibCheck: true,
          },
          include: ['src/**/*.ts', 'test/**/*.ts'],
        }, null, 2)}\n`,
      },
      {
        path: 'generator-cli/README.md',
        content: '# Generated generator-cli scaffold\n\nThis root block is generated from the MasterLedger. Helpers and effects are stubs; controllers preserve the ledger pseudocode execution path.\n',
      },
    ],
    sourceFiles,
    unitTestFiles,
    integrationTestFiles,
    telemetryHarness: {
      path: 'generator-cli/src/telemetry/harness.ts',
      content: `/**
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
`,
    },
    graphOutput: input.graph ?? {
      path: 'generator-cli/generated/dependency-graph.json',
      content: `${JSON.stringify(graph, null, 2)}\n`,
    },
    reportConfig: {
      path: join('generator-cli', 'generated', 'report-config.json'),
      content: '{\n  "report": "generated-report.json"\n}\n',
    },
    testResults: {
      path: join('generator-cli', 'generated', 'test-results.json'),
      content: '{\n  "status": "not-run"\n}\n',
    },
  };
}

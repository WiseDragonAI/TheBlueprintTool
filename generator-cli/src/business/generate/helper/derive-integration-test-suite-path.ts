/**
 * WHAT: Integration suite file derivation.
 * WHY: every suite must execute controller paths only and report telemetry evidence.
 */
import type { DependencyGraph, GeneratedFunction, OutputFile, TestSuitePlan } from '../../../lib/types.js';

function sourceAlias(path: string): string {
  const [rootBlock, ...rest] = path.split('/');
  const sourcePath = rest.join('/').replace(/^src\//, '').replace(/\.ts$/, '.js');
  return `@${rootBlock || 'generator-cli'}/${sourcePath}`;
}

function literal(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function directTelemetryNames(generatedFunction: GeneratedFunction): string[] {
  return [...generatedFunction.body.matchAll(/telemetry\('([^']+)'\)/g)].map((match) => match[1]);
}

function transitiveTelemetryNames(generatedFunction: GeneratedFunction, functions: GeneratedFunction[], graph?: DependencyGraph, seen = new Set<string>()): string[] {
  if (seen.has(generatedFunction.name)) {
    return [];
  }

  seen.add(generatedFunction.name);
  const byName = new Map(functions.map((candidate) => [candidate.name, candidate]));
  const dependencies = (graph?.edges ?? [])
    .filter((edge) => edge.from === generatedFunction.name)
    .flatMap((edge) => {
      const dependency = byName.get(edge.to);
      return dependency ? transitiveTelemetryNames(dependency, functions, graph, seen) : [];
    });

  const ownTelemetry = generatedFunction.kind === 'controller' ? directTelemetryNames(generatedFunction) : [generatedFunction.name, ...directTelemetryNames(generatedFunction)];
  return [...ownTelemetry, ...dependencies];
}

function modeForSuite(expectedTelemetry: string[]): string {
  if (expectedTelemetry.some((name) => ['create-git-worktree', 'write-source-file', 'write-unit-test-file', 'write-integration-test-file', 'write-telemetry-harness'].includes(name))) {
    return 'apply';
  }

  if (expectedTelemetry.some((name) => ['run-node-test', 'write-generated-report-file', 'collect-telemetry-traces'].includes(name))) {
    return 'report';
  }

  if (expectedTelemetry.some((name) => ['parse-patch-batch', 'apply-document-patch'].includes(name))) {
    return 'patch-doc';
  }

  if (expectedTelemetry.some((name) => ['read-specs-ledger', 'analyze-master-ledger', 'emit-check-ledger-report'].includes(name))) {
    return 'check-ledger';
  }

  return 'dry-run';
}

function selectControllers(suite: TestSuitePlan, functions: GeneratedFunction[], graph?: DependencyGraph): GeneratedFunction[] {
  const controllers = functions.filter((generatedFunction) => generatedFunction.kind === 'controller' && (!suite.rootBlock || generatedFunction.rootBlock === suite.rootBlock));
  const dispatchIsExpected = suite.expectedTelemetry.some((eventName) => ['parse-cli-argv', 'emit-dispatch-cli-command-started', 'dispatch-cli-command-rejected'].includes(eventName));
  const coverageControllers = controllers.filter((controller) => dispatchIsExpected || controller.name !== 'dispatch-cli-command');
  const coverage = new Map(coverageControllers.map((controller) => [
    controller.name,
    new Set(controller.name === 'dispatch-cli-command' ? directTelemetryNames(controller) : transitiveTelemetryNames(controller, functions, graph)),
  ]));
  const selected: GeneratedFunction[] = [];
  const uncovered = new Set(suite.expectedTelemetry);

  while (uncovered.size > 0) {
    let bestController: GeneratedFunction | undefined;
    let bestCount = 0;

    for (const controller of coverageControllers) {
      if (selected.includes(controller)) {
        continue;
      }

      const coveredCount = [...uncovered].filter((eventName) => coverage.get(controller.name)?.has(eventName)).length;

      if (coveredCount > bestCount) {
        bestController = controller;
        bestCount = coveredCount;
      }
    }

    if (!bestController) {
      break;
    }

    selected.push(bestController);
    for (const eventName of coverage.get(bestController.name) ?? []) {
      uncovered.delete(eventName);
    }
  }

  const dispatchController = controllers.find((controller) => controller.name === 'dispatch-cli-command');
  return selected.length > 0 ? selected : dispatchController ? [dispatchController] : controllers.slice(0, 1);
}

function normalizedSuitePath(suite: TestSuitePlan): string {
  const rawPath = suite.path.replace(/^\.\//, '');
  const rootBlock = suite.rootBlock ?? rawPath.split('/')[0] ?? 'generator-cli';
  return rawPath.replace(new RegExp(`^${rootBlock}/src/test/`), `${rootBlock}/test/`);
}

export function deriveIntegrationTestSuitePath(suites: TestSuitePlan[], functions: GeneratedFunction[] = [], graph?: DependencyGraph): OutputFile[] {
  return suites.map((suite) => {
    const selectedControllers = selectControllers(suite, functions, graph);
    const mode = modeForSuite(suite.expectedTelemetry);
    const testPath = normalizedSuitePath(suite);
    const imports = selectedControllers
      .map((controller) => `import { ${controller.exportName} } from '${sourceAlias(controller.path)}';`)
      .join('\n');
    const calls = selectedControllers
      .map((controller) => `  try {
    await ${controller.exportName}({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '${suite.specId}', controllerName: '${controller.name}', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }`)
      .join('\n');
    const controllerNames = selectedControllers.map((controller) => controller.name);

    return {
      path: testPath,
      kind: 'test',
      content: `/**
 * WHAT: Integration test for spec ${suite.specId}.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '${sourceAlias(`${suite.rootBlock ?? testPath.split('/')[0]}/src/telemetry/harness.ts`)}';
${imports}

test('${literal(suite.suiteName)}', async () => {
  traces.length = 0;
  const expectedTelemetry = ${JSON.stringify(suite.expectedTelemetry)};
  const argvPayload = {
    ok: true,
    mode: '${mode}',
    apply_command: true,
    check_ledger_command: true,
    report_command: true,
    patch_doc_command: true,
    master_ledger_file: 'generated-master-ledger.md',
    specs_ledger_file: 'generated-specs-ledger.json',
    patch_batch_file: 'generated-patch-batch.json',
    report_file: 'generated-report.json'
  };
  const actionPayload = { ...argvPayload, cli_command_argv: argvPayload, argv: argvPayload };
${calls}
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '${suite.specId}', suiteName: '${literal(suite.suiteName)}', controllerName: ${JSON.stringify(controllerNames)}, executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
`,
    };
  });
}

/**
 * WHAT: Materializes frontend/backend wrapper and test files from the generated master-ledger scaffold inventory.
 * WHY: The real source tree must keep the same one-function and one-test-file shape produced by archi-generator.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFunctionBatch } from '../../archi-generator/src/business/master-ledger/helper/parse-function-batch.js';
import type { GeneratedFunction, TestSuite } from '../../archi-generator/src/input/contracts.js';

const repoRoot = process.cwd();
const ledgerPath = path.join(repoRoot, 'tmp/master-ledger-front-back-26-05-10-1.md');
const ledger = parseFunctionBatch(readFileSync(ledgerPath, 'utf8'));

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  await Promise.all([
    ...ledger.generatedFunctions.map(writeFunctionFile),
    ...ledger.generatedFunctions.map(writeUnitTestFile),
    ...ledger.testSuites.map(writeIntegrationTestFile)
  ]);
}

async function writeFunctionFile(fn: GeneratedFunction): Promise<void> {
  if (fn.rootBlock !== 'frontend' && fn.rootBlock !== 'backend') {
    return;
  }

  const filePath = path.join(repoRoot, fn.rootBlock, 'src/business', fn.domain ?? 'generated', fn.kind, `${fn.name}.ts`);
  await writeText(filePath, functionTemplate(fn));
}

async function writeUnitTestFile(fn: GeneratedFunction): Promise<void> {
  if (fn.rootBlock !== 'frontend' && fn.rootBlock !== 'backend') {
    return;
  }

  const filePath = path.join(repoRoot, fn.rootBlock, 'src/test', fn.domain ?? 'generated', `${fn.name}.unit.test.ts`);
  await writeText(filePath, unitTestTemplate(fn));
}

async function writeIntegrationTestFile(suite: TestSuite): Promise<void> {
  if (suite.rootBlock !== 'frontend' && suite.rootBlock !== 'backend') {
    return;
  }

  const relativePath = suite.integrationPath.replace(/^\.\//, '');
  const filePath = path.join(repoRoot, relativePath);
  await writeText(filePath, integrationTemplate(suite, filePath));
}

function functionTemplate(fn: GeneratedFunction): string {
  const exportName = camel(fn.name);
  const description = sanitize(fn.comments ?? `Generated ${fn.kind} ${fn.name}.`);
  if (fn.rootBlock === 'frontend') {
    return frontendFunctionTemplate(fn, exportName, description);
  }

  return backendFunctionTemplate(fn, exportName, description);
}

function frontendFunctionTemplate(fn: GeneratedFunction, exportName: string, description: string): string {
  if (fn.kind === 'controller') {
    return header(description, fn) + `import { runFrontendController, type FrontendFunctionInput } from '../../../lib/frontend-runtime.js';

export function ${exportName}(input: FrontendFunctionInput = {}) {
  return runFrontendController('${fn.name}', input);
}
`;
  }

  if (fn.kind === 'helper') {
    return header(description, fn) + `import { runFrontendHelper, type FrontendFunctionInput } from '../../../lib/frontend-runtime.js';

export function ${exportName}(input: FrontendFunctionInput = {}) {
  return runFrontendHelper('${fn.name}', input);
}
`;
  }

  if (fn.kind === 'effect') {
    return header(description, fn) + `import { runFrontendEffect, type FrontendFunctionInput } from '../../../lib/frontend-runtime.js';

export function ${exportName}(input: FrontendFunctionInput = {}) {
  return runFrontendEffect('${fn.name}', input);
}
`;
  }

  return header(description, fn) + `import type { FrontendFunctionInput } from '../../../lib/frontend-runtime.js';

export type ${pascal(exportName)}Payload = FrontendFunctionInput & {
  readonly type: '${fn.name.replace(/-action$/, '')}';
};

export function ${exportName}(input: FrontendFunctionInput = {}): ${pascal(exportName)}Payload {
  return { ...input, type: '${fn.name.replace(/-action$/, '')}' };
}
`;
}

function backendFunctionTemplate(fn: GeneratedFunction, exportName: string, description: string): string {
  if (fn.kind === 'controller') {
    return header(description, fn) + `import { runBackendController, type BackendFunctionInput } from '../../../lib/backend-runtime.js';

export function ${exportName}(input: BackendFunctionInput = {}) {
  return runBackendController('${fn.name}', input);
}
`;
  }

  if (fn.kind === 'helper') {
    return header(description, fn) + `import { runBackendHelper, type BackendFunctionInput } from '../../../lib/backend-runtime.js';

export function ${exportName}(input: BackendFunctionInput = {}) {
  return runBackendHelper('${fn.name}', input);
}
`;
  }

  if (fn.kind === 'effect') {
    return header(description, fn) + `import { runBackendEffect, type BackendFunctionInput } from '../../../lib/backend-runtime.js';

export function ${exportName}(input: BackendFunctionInput = {}) {
  return runBackendEffect('${fn.name}', input);
}
`;
  }

  return header(description, fn) + `import type { BackendFunctionInput } from '../../../lib/backend-runtime.js';

export type ${pascal(exportName)}Payload = BackendFunctionInput & {
  readonly type: '${fn.name.replace(/-action$/, '')}';
};

export function ${exportName}(input: BackendFunctionInput = {}): ${pascal(exportName)}Payload {
  return { ...input, type: '${fn.name.replace(/-action$/, '')}' };
}
`;
}

function unitTestTemplate(fn: GeneratedFunction): string {
  const exportName = camel(fn.name);
  const fixtureImport = fn.rootBlock === 'frontend' ? '../fixture-inputs.js' : '../fixture-inputs.js';
  const inputFactory = fn.rootBlock === 'frontend' ? 'frontendInput' : 'backendInput';
  const assertion = fn.rootBlock === 'frontend' ? 'assertFrontendUnitResult' : 'assertBackendUnitResult';
  return `/**
 * WHAT: Unit-tests ${fn.name}.
 * WHY: Every generated function must have a dedicated executable unit test.
 */

import test from 'node:test';
import { ${exportName} } from '../../business/${fn.domain ?? 'generated'}/${fn.kind}/${fn.name}.js';
import { ${assertion}, ${inputFactory} } from '${fixtureImport}';

test('${fn.name} executes from its generated function file', async () => {
  const result = await ${exportName}(${inputFactory}());
  ${assertion}('${fn.name}', result);
});
`;
}

function integrationTemplate(suite: TestSuite, filePath: string): string {
  const rootBlock = suite.rootBlock ?? 'frontend';
  const importPath = rootBlock === 'backend'
    ? relativeImport(filePath, path.join(repoRoot, 'backend/src/test/spec-assertions.ts'))
    : relativeImport(filePath, path.join(repoRoot, 'frontend/src/test/spec-assertions.ts'));
  const functionName = rootBlock === 'backend' ? 'assertBackendSpec' : 'assertFrontendSpec';
  return `/**
 * WHAT: Integration test for spec ${suite.specId}: ${sanitize(suite.suiteName)}.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import { ${functionName} } from '${importPath}';

test('${sanitize(suite.suiteName)}', async () => {
  await ${functionName}('${sanitize(suite.suiteName)}', '${suite.specId}', '${suite.domain ?? ''}');
});
`;
}

function header(description: string, fn: GeneratedFunction): string {
  return `/**
 * WHAT: ${description}
 * WHY: Master-ledger function ${fn.name} must remain addressable as one TypeScript source file.
 */
`;
}

function relativeImport(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  const withoutExt = path.relative(fromDir, toFile).replace(/\\/g, '/').replace(/\.ts$/, '.js');
  return withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`;
}

async function writeText(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, 'utf8');
}

function camel(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function pascal(value: string): string {
  const cased = camel(value);
  return `${cased[0]?.toUpperCase() ?? ''}${cased.slice(1)}`;
}

function sanitize(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

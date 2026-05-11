/**
 * WHAT: Shared test fixtures for generator-cli spec suites.
 * WHY: the 29 ledger-mapped tests need stable MasterLedger, temp files, and process ports.
 */
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { DependencyGraph, GeneratedFunction, ProcessPort, TelemetryTrace } from '../../src/index.js';
import {
  buildDependencyGraph,
  loadAndValidateMasterLedgerController,
  parseFunctionBatch,
  readMasterLedger,
} from '../../src/index.js';

export const masterLedgerPath = resolve('../tmp/master-ledger-generator-cli-26-05-11-1.md');
export const specsLedgerPath = resolve('../documentation/specs.json');

export async function tempDir(prefix = 'generator-cli-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function loadBatch() {
  const loaded = await loadAndValidateMasterLedgerController(masterLedgerPath);

  if (!loaded.ok) {
    throw new Error(loaded.error);
  }

  return loaded.value;
}

export async function parseRawBatch() {
  const document = await readMasterLedger(masterLedgerPath);

  if (!document.ok) {
    throw new Error(document.error);
  }

  return parseFunctionBatch(document.value);
}

export async function createJsonFile(value: unknown): Promise<string> {
  const dir = await tempDir();
  const file = join(dir, 'ledger.json');
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

export async function createPatchFixture() {
  const dir = await tempDir();
  const documentPath = join(dir, 'doc.md');
  const patchBatchFile = join(dir, 'patch.json');
  await writeFile(documentPath, 'before\n', 'utf8');
  await writeFile(
    patchBatchFile,
    JSON.stringify({ documentPath, replacements: [{ find: 'before', replace: 'after' }] }, null, 2),
    'utf8',
  );
  return { documentPath, patchBatchFile };
}

export function fakeProcess(exitCode = 0): ProcessPort {
  return {
    async exec(command: string) {
      return { exitCode, stdout: `ok:${command}`, stderr: exitCode === 0 ? '' : 'failed' };
    },
  };
}

export function sampleFunctions(): GeneratedFunction[] {
  return [
    {
      functionId: 'aaaaaaaa',
      kind: 'helper',
      domain: 'graph',
      name: 'first-helper',
      exportName: 'firstHelper',
      path: 'src/business/graph/helper/first-helper.ts',
      sourceSpecIds: [],
      telemetryName: 'first-helper',
      description: 'first',
      body: 'secondHelper()',
      pure: true,
    },
    {
      functionId: 'bbbbbbbb',
      kind: 'helper',
      domain: 'graph',
      name: 'second-helper',
      exportName: 'secondHelper',
      path: 'src/business/graph/helper/second-helper.ts',
      sourceSpecIds: [],
      telemetryName: 'second-helper',
      description: 'second',
      body: '',
      pure: true,
    },
  ];
}

export function sampleGraph(functions = sampleFunctions()): DependencyGraph {
  return buildDependencyGraph(functions, [{ from: 'first-helper', to: 'second-helper', importPath: './second-helper.js' }]);
}

export function sampleTelemetry(): TelemetryTrace[] {
  return [
    { name: 'first-helper', phase: 'event', at: new Date().toISOString(), args: { functionName: 'first-helper', testKind: 'integration' } },
    { name: 'second-helper', phase: 'event', at: new Date().toISOString(), args: { functionName: 'second-helper', testKind: 'unit' } },
  ];
}

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

export async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

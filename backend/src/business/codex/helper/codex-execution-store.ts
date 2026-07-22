/**
 * WHAT: Persists every operational Codex attempt in one bounded atomic project store.
 * WHY: Scheduling, recovery, replication, and UI projection need one durable lifecycle authority.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  codexExecutionStoreVersion,
  type CodexExecutionPhase,
  type CodexExecutionRecord,
  type CodexExecutionStoreDocument,
} from '../../../../../shared/schemas/codex-execution-types.js';
import { assertCodexExecutionRecord, createCodexExecutionRecord, transitionCodexExecution } from './codex-execution-transition.js';

const maximumExecutionStoreBytes = 16 * 1024 * 1024;
const activePhases = new Set<CodexExecutionPhase>(['preparing', 'queued', 'starting', 'running']);

export class CodexExecutionStoreCorruptionError extends Error {
  readonly code = 'codex_execution_store_corrupt';
  constructor(readonly file: string, cause: unknown) {
    super(`Could not read the canonical Codex execution store ${file}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export function codexExecutionStoreFile(decisionOsRoot: string): string {
  return resolve(decisionOsRoot, 'codex-executions.json');
}

function emptyDocument(projectId: string): CodexExecutionStoreDocument {
  return { version: codexExecutionStoreVersion, projectId, updatedAt: '', executions: [] };
}

function assertDocument(value: unknown, projectId: string): CodexExecutionStoreDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected an object');
  const document = value as Partial<CodexExecutionStoreDocument>;
  if (document.version !== codexExecutionStoreVersion || document.projectId !== projectId || !Array.isArray(document.executions)) throw new Error('unsupported document identity');
  const executionIds = new Set<string>();
  for (const execution of document.executions) {
    assertCodexExecutionRecord(execution);
    if (execution.projectId !== projectId) throw new Error('execution project mismatch');
    if (executionIds.has(execution.executionId)) throw new Error(`duplicate execution id ${execution.executionId}`);
    executionIds.add(execution.executionId);
  }
  return structuredClone(document as CodexExecutionStoreDocument);
}

export function readCodexExecutionStore(input: { decisionOsRoot: string; projectId: string }): CodexExecutionStoreDocument {
  const file = codexExecutionStoreFile(input.decisionOsRoot);
  if (!existsSync(file)) return emptyDocument(input.projectId);
  try {
    if (statSync(file).size > maximumExecutionStoreBytes) throw new Error(`store exceeds ${maximumExecutionStoreBytes} bytes`);
    return assertDocument(JSON.parse(readFileSync(file, 'utf8')), input.projectId);
  } catch (error) {
    if (error instanceof CodexExecutionStoreCorruptionError) throw error;
    throw new CodexExecutionStoreCorruptionError(file, error);
  }
}

export function writeCodexExecutionStore(input: { decisionOsRoot: string; projectId: string; document: CodexExecutionStoreDocument }): CodexExecutionStoreDocument {
  const file = codexExecutionStoreFile(input.decisionOsRoot);
  if (existsSync(file)) readCodexExecutionStore(input);
  const document = assertDocument({ ...input.document, updatedAt: new Date().toISOString() }, input.projectId);
  mkdirSync(input.decisionOsRoot, { recursive: true });
  const temporary = resolve(input.decisionOsRoot, `.codex-executions-${process.pid}-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, file);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
  return document;
}

export function createCodexExecutionStore(input: { decisionOsRoot: string; projectId: string }) {
  const read = (): CodexExecutionStoreDocument => readCodexExecutionStore(input);
  const replace = (executions: readonly CodexExecutionRecord[]): CodexExecutionStoreDocument => writeCodexExecutionStore({
    ...input,
    document: { ...emptyDocument(input.projectId), executions },
  });
  const create = (recordInput: Parameters<typeof createCodexExecutionRecord>[0]): CodexExecutionRecord => {
    const document = read();
    const record = createCodexExecutionRecord(recordInput);
    if (document.executions.some((candidate) => candidate.executionId === record.executionId)) throw new Error('codex_execution_already_exists');
    replace([...document.executions, record]);
    return record;
  };
  const transition = (transitionInput: Omit<Parameters<typeof transitionCodexExecution>[0], 'record'>): CodexExecutionRecord => {
    const document = read();
    const index = document.executions.findIndex((record) => record.executionId === transitionInput.expectedExecutionId);
    if (index < 0) throw new Error('codex_execution_not_found');
    const transitioned = transitionCodexExecution({ ...transitionInput, record: document.executions[index] });
    const executions = [...document.executions];
    executions[index] = transitioned;
    replace(executions);
    return transitioned;
  };
  const find = (executionId: string): CodexExecutionRecord | null => read().executions.find((record) => record.executionId === executionId) ?? null;
  const active = (): CodexExecutionRecord[] => read().executions.filter((record) => activePhases.has(record.phase));
  const nextQueued = (): CodexExecutionRecord | null => read().executions
    .filter((record) => record.phase === 'queued')
    .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt) || left.executionId.localeCompare(right.executionId))[0] ?? null;
  const deleteSession = (sessionId: string): CodexExecutionRecord[] => {
    const document = read();
    const selected = document.executions.filter((record) => record.sessionId === sessionId);
    if (selected.some((record) => activePhases.has(record.phase))) throw new Error('codex_execution_session_active');
    if (selected.length > 0) replace(document.executions.filter((record) => record.sessionId !== sessionId));
    return selected;
  };
  return { read, replace, create, transition, find, active, nextQueued, deleteSession };
}

export type CodexExecutionStore = ReturnType<typeof createCodexExecutionStore>;

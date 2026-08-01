import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CardDescriptor, RawEvidenceRecord, SourceFileDescriptor, TestCommand, TraceJob, TraceRepositoryAdapter, TraceScope } from '../../src/lib/types.js';
import { runTraceJob } from '../../src/business/job/controller/run-trace-job.js';

class TaskBatchAdapter implements TraceRepositoryAdapter {
  readonly name = 'task-batch'; readonly version = '1';
  async discoverTests(): Promise<TestCommand[]> { return []; }
  async resolveCards(input: { projectId: string; cardIds: string[] }): Promise<CardDescriptor[]> { return input.cardIds.map((cardId) => ({ projectId: input.projectId, ledgerId: 'tasks', cardId, title: cardId, masterTaskId: cardId, subtaskIds: [], durableStatus: 'todo', internalStatus: 'task-waiting', executionIds: [`execution-${cardId}`], sessionIds: ['shared-session'], providerSessionIds: [], artifacts: { jsonl: true } })); }
  async resolveScopes(input: { projectId: string; cardIds: string[] }): Promise<TraceScope[]> { return input.cardIds.map((cardId) => ({ scopeId: cardId, projectId: input.projectId, kind: 'task', testIds: [], cardIds: [cardId], executionIds: [`execution-${cardId}`], sessionIds: ['shared-session'], providerSessionIds: [], status: 'pending', error: null })); }
  async wrapTestCommandWithLease(input: { command: TestCommand }): Promise<TestCommand> { return input.command; }
  async *collectEvidence(scope: TraceScope): AsyncIterable<RawEvidenceRecord> { yield { source: 'raw-codex', scopeId: scope.scopeId, cardId: scope.cardIds[0], executionId: null, sessionId: 'shared-session', bytes: '{"shared":true}\n' }; yield { source: 'presentation', scopeId: scope.scopeId, cardId: scope.cardIds[0], executionId: scope.executionIds[0], sessionId: 'shared-session', bytes: JSON.stringify({ executionId: scope.executionIds[0] }) }; }
  async locateSourceMaps(): Promise<string[]> { return []; }
  async resolveSourceFiles(): Promise<SourceFileDescriptor[]> { return []; }
}

test('overlapping task sessions deduplicate raw bytes while retaining separate scope inventories', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'trace-task-batch-'));
  const job: TraceJob = { version: 1, jobId: 'task-batch', adapter: 'task-batch', kind: 'task', phase: 'accepted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactRoot, scopes: [], failures: [], artifacts: [], request: { cwd: artifactRoot, testFiles: [], testNames: [], command: [], projectId: 'project', cardIds: ['card-a', 'card-b'], executionIds: [], sessionIds: [], sourceMaps: [] }, options: { graphify: 'off', stacks: 'both', timeoutMs: 5_000 } };
  await runTraceJob(job, new TaskBatchAdapter());
  assert.equal(await readFile(join(artifactRoot, 'task-batch/raw-codex.jsonl'), 'utf8'), '{"shared":true}\n');
  const inventory = (await readFile(join(artifactRoot, 'task-batch/task-events.jsonl'), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(inventory.filter((entry) => entry.source === 'raw-codex').length, 2);
  assert.equal(inventory.filter((entry) => entry.deduplicated === true).length, 1);
  assert.deepEqual(job.scopes.map((scope) => scope.status), ['succeeded', 'succeeded']);
});

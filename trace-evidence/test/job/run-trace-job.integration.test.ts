/**
 * WHAT: Verifies a test job captures streams, telemetry, stacks, hashes, and one report.
 * WHY: The complete evidence spine must work before repository-specific discovery is trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CardDescriptor, RawEvidenceRecord, TestCommand, TraceJob, TraceRepositoryAdapter, TraceScope } from '../../src/lib/types.js';
import { runTraceJob } from '../../src/business/job/controller/run-trace-job.js';

class FixtureAdapter implements TraceRepositoryAdapter {
  readonly name = 'fixture'; readonly version = '1';
  async discoverTests(input: { command: string[]; cwd: string }): Promise<TestCommand[]> { return [{ testId: 'self', executable: input.command[0], args: input.command.slice(1), cwd: input.cwd, env: {} }]; }
  async resolveCards(): Promise<CardDescriptor[]> { return []; }
  async resolveScopes(): Promise<TraceScope[]> { return []; }
  async wrapTestCommandWithLease(input: { command: TestCommand }): Promise<TestCommand> { return input.command; }
  async *collectEvidence(): AsyncIterable<RawEvidenceRecord> {}
  async locateSourceMaps(): Promise<string[]> { return []; }
  async resolveSourceFiles(): Promise<[]> { return []; }
}

test('finalizes complete test evidence and report', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'trace-job-'));
  const script = `const fs=require('node:fs');const e={schemaVersion:1,traceJobId:process.env.TRACE_EVIDENCE_JOB_ID,traceRunId:'r',scopeId:'self',testId:'self',cardId:null,executionId:null,sessionId:null,eventId:'e1',sequence:1,emittedAt:new Date().toISOString(),monotonicNs:'1',processId:process.pid,threadId:null,name:'self-event',phase:'event',args:{},rawStack:'Error\\n    at self (/tmp/self.js:1:1)'};fs.appendFileSync(process.env.TRACE_EVIDENCE_TELEMETRY_FILE,JSON.stringify(e)+'\\n');console.log('ok')`;
  const job: TraceJob = { version: 1, jobId: 'job-1', adapter: 'fixture', kind: 'test', phase: 'accepted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactRoot, scopes: [], failures: [], artifacts: [], request: { cwd: artifactRoot, testFiles: [], testNames: [], command: [process.execPath, '-e', script], projectId: '', cardIds: [], executionIds: [], sessionIds: [], sourceMaps: [] }, options: { graphify: 'off', stacks: 'both', timeoutMs: 5_000 } };
  await runTraceJob(job, new FixtureAdapter());
  assert.equal(job.phase, 'complete');
  assert.equal(job.failures.length, 0);
  assert.match(await readFile(join(artifactRoot, 'job-1/report.md'), 'utf8'), /self-event/);
  assert.ok(job.artifacts.some((artifact) => artifact.path.endsWith('telemetry.jsonl') && artifact.complete));
});

test('reports malformed telemetry without changing raw bytes', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'trace-malformed-'));
  const script = `require('node:fs').appendFileSync(process.env.TRACE_EVIDENCE_TELEMETRY_FILE,'malformed-record\\n')`;
  const job: TraceJob = { version: 1, jobId: 'job-malformed', adapter: 'fixture', kind: 'test', phase: 'accepted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactRoot, scopes: [], failures: [], artifacts: [], request: { cwd: artifactRoot, testFiles: [], testNames: [], command: [process.execPath, '-e', script], projectId: '', cardIds: [], executionIds: [], sessionIds: [], sourceMaps: [] }, options: { graphify: 'off', stacks: 'both', timeoutMs: 5_000 } };
  await runTraceJob(job, new FixtureAdapter());
  assert.equal(await readFile(join(artifactRoot, 'job-malformed/telemetry.jsonl'), 'utf8'), 'malformed-record\n');
  assert.equal(job.parseFailures?.[0].code, 'malformed_jsonl');
  assert.match(await readFile(join(artifactRoot, 'job-malformed/manifest.json'), 'utf8'), /malformed_jsonl/);
});

test('artifact ceiling records the first dropped byte and forbids complete evidence', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'trace-ceiling-'));
  const job: TraceJob = { version: 1, jobId: 'job-ceiling', adapter: 'fixture', kind: 'test', phase: 'accepted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactRoot, scopes: [], failures: [], artifacts: [], request: { cwd: artifactRoot, testFiles: [], testNames: [], command: [process.execPath, '-e', `process.stdout.write('x'.repeat(100))`], projectId: '', cardIds: [], executionIds: [], sessionIds: [], sourceMaps: [] }, options: { graphify: 'off', stacks: 'both', timeoutMs: 5_000, maxArtifactBytes: 10 } };
  await runTraceJob(job, new FixtureAdapter());
  assert.equal((await readFile(join(artifactRoot, 'job-ceiling/stdout.log'))).byteLength, 10);
  assert.equal(job.droppedRecords?.[0].firstDroppedByte, 10);
  const manifest = JSON.parse(await readFile(join(artifactRoot, 'job-ceiling/manifest.json'), 'utf8'));
  assert.equal(manifest.complete, false);
});

test('recovery after evidence_ready renders derived artifacts without rerunning tests', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'trace-recovery-'));
  const directory = join(artifactRoot, 'job-recovery'); await mkdir(directory);
  const marker = join(artifactRoot, 'reran');
  const job: TraceJob = { version: 1, jobId: 'job-recovery', adapter: 'fixture', kind: 'test', phase: 'evidence_ready', phaseTimestamps: { evidence_ready: new Date().toISOString() }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactRoot, scopes: [{ scopeId: 'retained', kind: 'test', testIds: ['retained'], cardIds: [], executionIds: [], sessionIds: [], providerSessionIds: [], status: 'succeeded', error: null }], failures: [], artifacts: [], request: { cwd: artifactRoot, testFiles: [], testNames: [], command: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'reran')`], projectId: '', cardIds: [], executionIds: [], sessionIds: [], sourceMaps: [] }, options: { graphify: 'off', stacks: 'both', timeoutMs: 5_000 } };
  await writeFile(join(directory, 'test-events.jsonl'), `${JSON.stringify({ testId: 'retained', status: 'succeeded' })}\n`, { flag: 'a' });
  await runTraceJob(job, new FixtureAdapter());
  await assert.rejects(access(marker));
  assert.equal(job.phase, 'complete');
  assert.match(await readFile(join(directory, 'report.md'), 'utf8'), /retained/);
  const firstMachineReport = await readFile(join(directory, 'report.json'), 'utf8');
  job.phase = 'evidence_ready';
  await runTraceJob(job, new FixtureAdapter());
  assert.equal(await readFile(join(directory, 'report.json'), 'utf8'), firstMachineReport);
});

test('interrupted pre-evidence recovery terminates without rerunning tests', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'trace-interrupted-'));
  const marker = join(artifactRoot, 'reran');
  const job: TraceJob = { version: 1, jobId: 'job-interrupted', adapter: 'fixture', kind: 'test', phase: 'running_tests', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactRoot, scopes: [], failures: [], artifacts: [], request: { cwd: artifactRoot, testFiles: [], testNames: [], command: [process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'reran')`], projectId: '', cardIds: [], executionIds: [], sessionIds: [], sourceMaps: [] }, options: { graphify: 'off', stacks: 'both', timeoutMs: 5_000 } };
  await runTraceJob(job, new FixtureAdapter());
  await assert.rejects(access(marker));
  assert.equal(job.phase, 'interrupted');
  assert.match(await readFile(join(artifactRoot, 'job-interrupted/manifest.json'), 'utf8'), /interrupted_before_evidence/);
});

test('Graphify failure preserves successful test evidence and result', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'trace-graphify-failure-'));
  const previous = process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND;
  process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND = JSON.stringify([process.execPath, '-e', 'process.exit(7)']);
  const job: TraceJob = { version: 1, jobId: 'job-graphify-failure', adapter: 'fixture', kind: 'test', phase: 'accepted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactRoot, scopes: [], failures: [], artifacts: [], request: { cwd: artifactRoot, testFiles: [], testNames: [], command: [process.execPath, '-e', `process.stdout.write('test-passed')`], projectId: '', cardIds: [], executionIds: [], sessionIds: [], sourceMaps: [] }, options: { graphify: 'all', stacks: 'both', timeoutMs: 5_000 } };
  try { await runTraceJob(job, new FixtureAdapter()); } finally {
    // WHAT: Restore the process-wide Graphify command after the isolated failure fixture.
    // WHY: Subsequent tests must not inherit this test's executable selection.
    if (previous === undefined) delete process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND; else process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND = previous;
  }
  assert.equal(job.phase, 'complete');
  assert.equal(job.scopes[0].status, 'succeeded');
  assert.ok(job.failures.some((entry) => entry.component === 'graphify'));
  assert.equal(await readFile(join(artifactRoot, 'job-graphify-failure/stdout.log'), 'utf8'), 'test-passed');
  assert.match(await readFile(join(artifactRoot, 'job-graphify-failure/manifest.json'), 'utf8'), /"status": "failed"/);
});

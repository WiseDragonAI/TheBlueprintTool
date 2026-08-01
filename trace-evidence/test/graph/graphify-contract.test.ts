import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { RawTelemetryEvent, TraceJob } from '../../src/lib/types.js';
import { runGraphify } from '../../src/business/graph/effect/run-graphify.js';

function job(root: string): TraceJob { return { version: 1, jobId: 'job', adapter: 'fixture', kind: 'test', phase: 'evidence_ready', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactRoot: root, scopes: [], failures: [], artifacts: [], request: { cwd: root, testFiles: [], testNames: [], command: [], projectId: '', cardIds: [], executionIds: [], sessionIds: [], sourceMaps: [] }, options: { graphify: 'touched', stacks: 'both', timeoutMs: 500, graphifyTimeoutMs: 500 } }; }
const event = { schemaVersion: 1, traceJobId: 'job', traceRunId: 'run', scopeId: 'scope', testId: 'test', cardId: null, executionId: null, sessionId: null, eventId: 'event', sequence: 1, emittedAt: new Date().toISOString(), monotonicNs: '1', processId: 1, threadId: null, name: 'event', phase: 'event', args: { secret: 'must-not-enter' }, rawStack: 'secret-stack' } satisfies RawTelemetryEvent;

test('Graphify receives only sanitized events and implicated source snapshots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-graph-')); await writeFile(join(root, 'source.ts'), 'export const value = 1;\n');
  const fake = join(root, 'fake-graphify.mjs');
  await writeFile(fake, `import{mkdirSync,writeFileSync}from'node:fs';import{join}from'node:path';if(process.argv.includes('extract')){const out=process.argv[process.argv.indexOf('--output')+1];mkdirSync(join(out,'graphify-out'),{recursive:true});writeFileSync(join(out,'graphify-out','graph.json'),'{}');}`); await chmod(fake, 0o755);
  const previous = process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND; process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND = JSON.stringify([process.execPath, fake]);
  try {
    const result = await runGraphify(job(root), [event], [join(root, 'source.ts'), '/etc/passwd']);
    assert.equal(result.status, 'succeeded');
    const trace = await readFile(join(root, 'job/graphify-input/trace.json'), 'utf8');
    assert.doesNotMatch(trace, /must-not-enter|secret-stack/);
    assert.match(await readFile(join(root, 'job/graphify-input/files/source.ts'), 'utf8'), /value/);
    await assert.rejects(readFile(join(root, 'job/graphify-input/files/etc/passwd')));
  } finally { if (previous === undefined) delete process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND; else process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND = previous; }
});

test('Graphify timeout is derived failure with bounded settlement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-graph-timeout-')); const fake = join(root, 'hang.mjs'); await writeFile(fake, 'setInterval(()=>{},1000);');
  const traceJob = job(root); traceJob.options.graphifyTimeoutMs = 20;
  const previous = process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND; process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND = JSON.stringify([process.execPath, fake]);
  try { assert.equal((await runGraphify(traceJob, [], [])).status, 'timed_out'); }
  finally { if (previous === undefined) delete process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND; else process.env.TRACE_EVIDENCE_GRAPHIFY_COMMAND = previous; }
});

/**
 * WHAT: Verifies opt-in telemetry writes one raw emission-time stack.
 * WHY: Later source mapping cannot reconstruct a stack that runtime failed to preserve.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { telemetry } from '../../src/lib/telemetry.js';

test('captures raw stack only when trace output is configured', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trace-telemetry-'));
  const file = join(directory, 'telemetry.jsonl');
  process.env.TRACE_EVIDENCE_TELEMETRY_FILE = file;
  process.env.TRACE_EVIDENCE_JOB_ID = 'job-1';
  try {
    telemetry('example-event', { value: 1 });
    const event = JSON.parse((await readFile(file, 'utf8')).trim());
    assert.equal(event.name, 'example-event');
    assert.equal(event.traceJobId, 'job-1');
    assert.match(event.rawStack, /raw-stack\.test\.ts/);
  } finally {
    delete process.env.TRACE_EVIDENCE_TELEMETRY_FILE;
    delete process.env.TRACE_EVIDENCE_JOB_ID;
  }
});

test('telemetry writer failure remains contained and emits scoped collection failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trace-telemetry-failure-'));
  const failureFile = join(directory, 'failures.jsonl');
  const previous = process.env.TRACE_EVIDENCE_TELEMETRY_FILE;
  const previousFailure = process.env.TRACE_EVIDENCE_FAILURE_FILE;
  process.env.TRACE_EVIDENCE_TELEMETRY_FILE = '/dev/null/unwritable.jsonl';
  process.env.TRACE_EVIDENCE_FAILURE_FILE = failureFile;
  try { assert.doesNotThrow(() => telemetry('writer-failure')); }
  finally { if (previous === undefined) delete process.env.TRACE_EVIDENCE_TELEMETRY_FILE; else process.env.TRACE_EVIDENCE_TELEMETRY_FILE = previous; if (previousFailure === undefined) delete process.env.TRACE_EVIDENCE_FAILURE_FILE; else process.env.TRACE_EVIDENCE_FAILURE_FILE = previousFailure; }
  assert.match(await readFile(failureFile, 'utf8'), /telemetry_write_failed/);
});

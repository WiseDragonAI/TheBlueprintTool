/**
 * WHAT: Verifies generated production frames map during trace-tool invocation.
 * WHY: Reports must retain raw coordinates and original TypeScript coordinates together.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mapTelemetryStacks } from '../../src/business/stack/helper/map-telemetry-stacks.js';
import type { RawTelemetryEvent } from '../../src/lib/types.js';

test('maps an exact generated frame through its source map', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trace-map-'));
  const generated = join(directory, 'sample.js');
  const map = `${generated}.map`;
  await writeFile(map, JSON.stringify({ version: 3, file: 'sample.js', sources: ['sample.ts'], names: ['sample'], mappings: 'AAAAA' }));
  const event = { eventId: 'event-1', name: 'sample', rawStack: `Error\n    at sample (${generated}:1:0)` } as RawTelemetryEvent;
  const [stack] = await mapTelemetryStacks([event], [map]);
  assert.equal(stack.frames[0].failure, null);
  assert.equal(stack.frames[0].originalFile, join(directory, 'sample.ts'));
  assert.equal(stack.frames[0].originalLine, 1);
});

test('retains raw frames with distinct missing incompatible and ambiguous map failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trace-map-failures-'));
  const generated = join(root, 'app.js');
  const event = { schemaVersion: 1, traceJobId: 'j', traceRunId: 'r', scopeId: 's', testId: 't', cardId: null, executionId: null, sessionId: null, eventId: 'e', sequence: 1, emittedAt: new Date().toISOString(), monotonicNs: '1', processId: 1, threadId: null, name: 'event', phase: 'event', args: {}, rawStack: `Error\n    at run (${generated}:1:1)` } as const;
  assert.equal((await mapTelemetryStacks([event], []))[0].frames[0].failure, 'source_map_missing');
  await writeFile(`${generated}.map`, 'not-json');
  assert.equal((await mapTelemetryStacks([event], [`${generated}.map`]))[0].frames[0].failure, 'source_map_incompatible');
  const sameGeneratedAlias = join(root, 'app.js.map'); await writeFile(sameGeneratedAlias, JSON.stringify({ version: 3, file: 'app.js', sources: ['app.ts'], names: [], mappings: 'AAAA' }));
  assert.equal((await mapTelemetryStacks([event], [sameGeneratedAlias, sameGeneratedAlias]))[0].frames[0].failure, 'source_map_ambiguous');
});

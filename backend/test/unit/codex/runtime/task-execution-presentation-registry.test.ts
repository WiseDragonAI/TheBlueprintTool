/**
 * WHAT: Verifies restart-local presentation recovery and relay request containment.
 * WHY: Codex Log restoration must prefer canonical task objects and deduplicate unavailable remote hydration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTaskExecutionPresentationRegistry } from '@backend/business/codex/runtime/task-execution-presentation-registry.js';
import type { ProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';

function terminalExecution(jsonlHash: string) {
  return {
    metadata: {
      executionId: 'execution-a', requestId: 'request-a', sessionId: 'session-a', projectId: 'project-a',
      ledgerId: 'tasks', taskId: 'task-a', sourceCardId: 'task-a', ownerCardId: 'task-a', kind: 'thread' as const,
      requestedAt: '2026-07-31T00:00:00.000Z', model: 'gpt-5.6-sol', effort: 'medium', pipelineRunId: null,
      pipelineStepId: null, pipelineSkillRunId: null, predecessorExecutionId: null, restartOfExecutionId: null,
    },
    lifecycle: {
      phase: 'succeeded' as const, phaseSince: '2026-07-31T00:01:00.000Z', startedAt: '2026-07-31T00:00:00.000Z',
      finishedAt: '2026-07-31T00:01:00.000Z', executorNodeId: 'remote-node', providerSessionId: null,
      result: null, error: null, revision: 3,
    },
    artifacts: {
      jsonl: { hash: jsonlHash, bytes: 1, mediaType: 'application/x-ndjson' }, stderr: null, telemetry: null,
      result: null, changedAt: '2026-07-31T00:01:00.000Z', revision: 1,
    },
  };
}

test('rebuilds terminal presentation from canonical task objects without federation cache access', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-local-presentation-'));
  const body = `${JSON.stringify({ type: 'item.completed', item: { id: 'message-a', type: 'agent_message', text: 'Retained locally.' } })}\n`;
  const hash = createHash('sha256').update(body).digest('hex');
  const canonical = join(workspace, 'task-objects', hash.slice(0, 2), hash);
  mkdirSync(join(workspace, 'task-objects', hash.slice(0, 2)), { recursive: true });
  writeFileSync(canonical, body);
  const execution = terminalExecution(hash);
  const state = {
    executions: {
      find: () => execution,
      bySessionId: () => [execution],
    },
    executionArtifactFile: () => canonical,
  } as unknown as ProjectTaskState;
  let federationCacheReads = 0;
  const registry = createTaskExecutionPresentationRegistry({
    contentStore: { objectFile: () => { federationCacheReads += 1; return join(workspace, 'missing-cache'); } } as never,
    federation: () => null,
    serverCloseSignal: new AbortController().signal,
  });
  try {
    const presentation = registry.locallyHydrated(state, execution);
    assert.equal(presentation?.events.some((event) => event.kind === 'agent_message' && event.text === 'Retained locally.'), true);
    assert.equal(federationCacheReads, 1);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('deduplicates concurrent remote presentation hydration into one relay request', async () => {
  const execution = terminalExecution('a'.repeat(64));
  let relayRequests = 0;
  let settle!: (value: { status: number; body: Buffer }) => void;
  const pending = new Promise<{ status: number; body: Buffer }>((resolve) => { settle = resolve; });
  const registry = createTaskExecutionPresentationRegistry({
    contentStore: { objectFile: () => '/missing' } as never,
    federation: () => ({
      request: async () => { relayRequests += 1; return pending; },
    }) as never,
    serverCloseSignal: new AbortController().signal,
  });
  const failures: Record<string, unknown>[] = [];

  registry.hydrateRemotePresentation('project-a', execution, (failure) => failures.push(failure));
  registry.hydrateRemotePresentation('project-a', execution, (failure) => failures.push(failure));
  assert.equal(relayRequests, 1);

  settle({ status: 503, body: Buffer.from('{}') });
  await new Promise((resolve) => setImmediate(resolve));
  registry.hydrateRemotePresentation('project-a', execution, (failure) => failures.push(failure));

  assert.equal(relayRequests, 1);
  assert.equal(failures.length, 1);
});

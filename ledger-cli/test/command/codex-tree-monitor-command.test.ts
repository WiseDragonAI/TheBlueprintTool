/**
 * WHAT: Verifies recursive Codex session-tree snapshots, deltas, context, and Decision OS step extraction.
 * WHY: minute-resolution program metrics must not double-count cumulative usage or lose subagent ownership.
 */
import assert from 'node:assert/strict';
import { appendFile, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CodexTreeCollector, monitorCodexSessionTree } from '../../src/business/codex/helper/monitor-codex-session-tree.js';
import { parseLedgerCliArgv } from '../../src/business/command/helper/parse-ledger-cli-argv.js';

const rootId = '01a02000-0000-7000-8000-000000000001';
const childId = '01a02001-0000-7000-8000-000000000002';
const line = (timestamp: string, type: string, payload: Record<string, unknown>): string => `${JSON.stringify({ timestamp, type, payload })}\n`;

test('codex tree collector captures descendants, context, deltas, and graph CLI steps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codex-tree-monitor-')); const day = join(root, '2026', '08', '21'); await mkdir(day, { recursive: true });
  const rootFile = join(day, `rollout-root-${rootId}.jsonl`); const childFile = join(day, `rollout-child-${childId}.jsonl`);
  await writeFile(rootFile, line('2026-08-21T00:00:00.000Z', 'session_meta', { id: rootId, cwd: '/workspace', source: 'cli' }) + line('2026-08-21T00:00:01.000Z', 'turn_context', { model: 'gpt-5.6-sol' }) + line('2026-08-21T00:00:02.000Z', 'event_msg', { type: 'token_count', info: { model_context_window: 1000, last_token_usage: { input_tokens: 400, cached_input_tokens: 300, output_tokens: 10, reasoning_output_tokens: 2, total_tokens: 410 }, total_token_usage: { input_tokens: 400, cached_input_tokens: 300, output_tokens: 10, reasoning_output_tokens: 2, total_tokens: 410 } } }));
  await writeFile(childFile, line('2026-08-21T00:00:03.000Z', 'session_meta', { id: childId, cwd: '/workspace', parent_thread_id: rootId, source: { subagent: { thread_spawn: { parent_thread_id: rootId, depth: 1, agent_path: '/root/p01_iteration', agent_nickname: 'Ada' } } } }) + line('2026-08-21T00:00:04.000Z', 'response_item', { type: 'custom_tool_call', name: 'exec', call_id: 'call-a', input: 'const r = await tools.exec_command({cmd:"moh-decision phase-start --phase Developer --master-card-id card-a"});' }) + line('2026-08-21T00:00:05.000Z', 'event_msg', { type: 'token_count', info: { model_context_window: 1000, last_token_usage: { input_tokens: 250, cached_input_tokens: 200, output_tokens: 5, reasoning_output_tokens: 1, total_tokens: 255 }, total_token_usage: { input_tokens: 250, cached_input_tokens: 200, output_tokens: 5, reasoning_output_tokens: 1, total_tokens: 255 } } }));
  const collector = new CodexTreeCollector(rootId, root); const first = await collector.capture(); assert.equal(first.ok, true); if (!first.ok) return;
  assert.equal(first.value.aggregate.agents, 2); assert.equal(first.value.aggregate.cumulative.totalTokens, 665); assert.equal(first.value.aggregate.delta.totalTokens, 665); assert.equal(first.value.agents[0]?.context.leftPercent, 60); assert.equal(first.value.stepEvents[0]?.step, 'SPECIALIST_PHASE_START'); assert.equal(first.value.stepEvents[0]?.agentPath, '/root/p01_iteration');
  await appendFile(rootFile, line('2026-08-21T00:01:02.000Z', 'event_msg', { type: 'token_count', info: { model_context_window: 1000, last_token_usage: { input_tokens: 500, cached_input_tokens: 400, output_tokens: 4, reasoning_output_tokens: 1, total_tokens: 504 }, total_token_usage: { input_tokens: 900, cached_input_tokens: 700, output_tokens: 14, reasoning_output_tokens: 3, total_tokens: 914 } } }));
  const second = await collector.capture(); assert.equal(second.ok, true); if (!second.ok) return; assert.equal(second.value.aggregate.delta.totalTokens, 504); assert.equal(second.value.stepEvents.length, 0); assert.equal(second.value.agents[0]?.context.usedPercent, 50);
});

test('codex tree monitor defaults the current session and appends one JSONL sample', async () => {
  const parsed = parseLedgerCliArgv(['codex-tree-monitor', '--once', '--interval-seconds', '60']); assert.equal(parsed.mode, 'codex-tree-monitor'); assert.equal(parsed.codexTreeMonitorOperation?.once, true);
  const root = await mkdtemp(join(tmpdir(), 'codex-tree-once-')); const day = join(root, '2026', '08', '21'); await mkdir(day, { recursive: true }); await writeFile(join(day, `rollout-${rootId}.jsonl`), line('2026-08-21T00:00:00.000Z', 'session_meta', { id: rootId, cwd: '/workspace' }) + line('2026-08-21T00:00:01.000Z', 'event_msg', { type: 'token_count', info: { model_context_window: 1000, last_token_usage: { input_tokens: 10, total_tokens: 11 }, total_token_usage: { input_tokens: 10, total_tokens: 11 } } }));
  const output = join(root, 'metrics.jsonl'); const result = await monitorCodexSessionTree({ intervalSeconds: 60, once: true, output, samples: 0, sessionId: rootId, sessionsRoot: root }, () => {}); assert.equal(result.ok, true); const snapshots = (await readFile(output, 'utf8')).trim().split('\n'); assert.equal(snapshots.length, 1); assert.equal(JSON.parse(snapshots[0]!).aggregate.agents, 1);
});

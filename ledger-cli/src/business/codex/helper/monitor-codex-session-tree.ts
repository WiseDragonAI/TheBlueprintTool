/**
 * WHAT: Captures one root Codex session plus recursive subagents as append-only token and graph-step metrics.
 * WHY: long-running Decision OS programs need minute-resolution evidence of context growth and orchestration cost.
 */
import { appendFile, mkdir, open, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import type { Result } from '../../../lib/types.js';

type TokenUsage = { inputTokens: number; cachedInputTokens: number; uncachedInputTokens: number; outputTokens: number; reasoningOutputTokens: number; totalTokens: number };
type AgentMeta = { cwd: string; depth: number; nickname: string | null; parentSessionId: string | null; path: string; sessionId: string };
type StepEvent = { agentPath: string; agentSessionId: string; callId: string; command: string; operation: string; step: string; timestamp: string; turnId: string };
type FileState = AgentMeta & { buffer: string; contextWindow: number; lastRequest: TokenUsage; model: string; modelCalls: number; offset: number; steps: StepEvent[]; total: TokenUsage; updatedAt: string };
type AgentSnapshot = AgentMeta & { context: { inputTokens: number; leftPercent: number | null; usedPercent: number | null; windowTokens: number }; cumulative: TokenUsage & { modelCalls: number }; delta: TokenUsage & { modelCalls: number }; model: string; updatedAt: string };
export type CodexTreeSnapshot = { version: 1; capturedAt: string; rootSessionId: string; sessionsRoot: string; agents: AgentSnapshot[]; aggregate: { agents: number; cumulative: TokenUsage & { modelCalls: number }; delta: TokenUsage & { modelCalls: number } }; stepEvents: StepEvent[] };

const zero = (): TokenUsage => ({ inputTokens: 0, cachedInputTokens: 0, uncachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 });
const uuid = /([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.jsonl$/;
const recognized = new Set(['program-create', 'program-context', 'program-reconcile', 'iteration-start', 'phase-start', 'iteration-finish', 'program-amend', 'master-task-create', 'subtask-create', 'master-task-apply', 'master-task-progress', 'master-task-commit', 'master-task-gate', 'master-task-complete', 'work-package']);
const stepNames: Record<string, string> = { 'program-create': 'PROGRAM_INITIALIZE', 'program-context': 'PROGRAM_CONTEXT', 'program-reconcile': 'PROGRAM_RECONCILE', 'iteration-start': 'ITERATION_START', 'phase-start': 'SPECIALIST_PHASE_START', 'iteration-finish': 'ITERATION_FINISH', 'program-amend': 'PROGRAM_AMEND', 'master-task-create': 'GRAPH_CREATE', 'subtask-create': 'GRAPH_CREATE', 'master-task-apply': 'GRAPH_UPDATE', 'master-task-progress': 'GRAPH_UPDATE', 'master-task-commit': 'GRAPH_COMMIT', 'master-task-gate': 'GRAPH_GATE', 'master-task-complete': 'GRAPH_COMPLETE', 'work-package': 'WORK_PACKAGE' };

function usage(value: Record<string, unknown> | undefined): TokenUsage {
  const number = (key: string): number => typeof value?.[key] === 'number' ? value[key] as number : 0;
  const inputTokens = number('input_tokens'); const cachedInputTokens = number('cached_input_tokens');
  return { inputTokens, cachedInputTokens, uncachedInputTokens: Math.max(0, inputTokens - cachedInputTokens), outputTokens: number('output_tokens'), reasoningOutputTokens: number('reasoning_output_tokens'), totalTokens: number('total_tokens') };
}
function add(left: TokenUsage, right: TokenUsage): TokenUsage { return { inputTokens: left.inputTokens + right.inputTokens, cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens, uncachedInputTokens: left.uncachedInputTokens + right.uncachedInputTokens, outputTokens: left.outputTokens + right.outputTokens, reasoningOutputTokens: left.reasoningOutputTokens + right.reasoningOutputTokens, totalTokens: left.totalTokens + right.totalTokens }; }
function subtract(current: TokenUsage, previous?: TokenUsage): TokenUsage { const prior = previous ?? zero(); return { inputTokens: Math.max(0, current.inputTokens - prior.inputTokens), cachedInputTokens: Math.max(0, current.cachedInputTokens - prior.cachedInputTokens), uncachedInputTokens: Math.max(0, current.uncachedInputTokens - prior.uncachedInputTokens), outputTokens: Math.max(0, current.outputTokens - prior.outputTokens), reasoningOutputTokens: Math.max(0, current.reasoningOutputTokens - prior.reasoningOutputTokens), totalTokens: Math.max(0, current.totalTokens - prior.totalTokens) }; }
function operation(command: string): string { const words = command.trim().split(/\s+/); return words.find((word) => recognized.has(word)) ?? ''; }
function extractSteps(input: string, state: FileState, callId: string, timestamp: string, turnId: string): StepEvent[] {
  const matches = input.match(/(?:(?:\/home\/jbb\/\.local\/bin\/)?(?:moh|aura)-decision|ledger-cli)\s+[a-z][a-z0-9-]*(?:\s+[^"'\n;\\]+)?/gi) ?? [];
  return matches.flatMap((raw) => { const command = raw.replace(/\s+/g, ' ').trim().slice(0, 2000); const commandOperation = operation(command); return recognized.has(commandOperation) ? [{ agentPath: state.path, agentSessionId: state.sessionId, callId, command, operation: commandOperation, step: stepNames[commandOperation] ?? 'DECISION_OS_CLI', timestamp, turnId }] : []; });
}
async function files(directory: string): Promise<string[]> {
  try { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : entry.name.endsWith('.jsonl') ? [join(directory, entry.name)] : []))).flat(); } catch { return []; }
}
function parseLine(line: string, state: FileState): void {
  let record: { timestamp?: string; type?: string; payload?: Record<string, unknown> }; try { record = JSON.parse(line) as typeof record; } catch { return; }
  const payload = record.payload ?? {}; const timestamp = String(record.timestamp ?? '');
  if (record.type === 'session_meta' && payload.id === state.sessionId) {
    const source = payload.source as { subagent?: { thread_spawn?: { parent_thread_id?: string; depth?: number; agent_path?: string; agent_nickname?: string } } } | undefined; const spawn = source?.subagent?.thread_spawn;
    state.parentSessionId = String(payload.parent_thread_id ?? spawn?.parent_thread_id ?? '') || null; state.depth = Number(spawn?.depth ?? 0); state.path = String(spawn?.agent_path ?? '/root'); state.nickname = String(spawn?.agent_nickname ?? '') || null; state.cwd = String(payload.cwd ?? '');
  }
  if (record.type === 'turn_context') state.model = String(payload.model ?? state.model);
  if (record.type === 'event_msg' && payload.type === 'token_count') {
    const info = payload.info as { total_token_usage?: Record<string, unknown>; last_token_usage?: Record<string, unknown>; model_context_window?: number } | undefined;
    if (info?.total_token_usage) state.total = usage(info.total_token_usage); if (info?.last_token_usage) state.lastRequest = usage(info.last_token_usage); if (typeof info?.model_context_window === 'number') state.contextWindow = info.model_context_window; state.modelCalls += 1; state.updatedAt = timestamp;
  }
  if (record.type === 'response_item' && payload.type === 'custom_tool_call' && payload.name === 'exec') {
    const input = String(payload.input ?? ''); const metadata = input.match(/"turn_id"\s*:\s*"([^"]+)"/); state.steps.push(...extractSteps(input, state, String(payload.call_id ?? payload.id ?? ''), timestamp, metadata?.[1] ?? ''));
  }
}

export class CodexTreeCollector {
  private readonly states = new Map<string, FileState>();
  private readonly reportedSteps = new Set<string>();
  private previous = new Map<string, { modelCalls: number; usage: TokenUsage }>();
  private previousCapturedAt = '';
  constructor(private readonly rootSessionId: string, private readonly sessionsRoot: string) {}
  restore(snapshot: CodexTreeSnapshot | null): void { if (!snapshot) return; this.previousCapturedAt = snapshot.capturedAt; this.previous = new Map(snapshot.agents.map((agent) => [agent.sessionId, { modelCalls: agent.cumulative.modelCalls, usage: agent.cumulative }])); }
  private async refresh(): Promise<void> {
    for (const file of await files(this.sessionsRoot)) {
      const sessionId = basename(file).match(uuid)?.[1]; if (!sessionId || sessionId < this.rootSessionId) continue;
      let state = this.states.get(file);
      if (!state) { state = { sessionId, parentSessionId: null, path: '/root', nickname: null, depth: 0, cwd: '', offset: 0, buffer: '', contextWindow: 0, lastRequest: zero(), total: zero(), modelCalls: 0, model: '', updatedAt: '', steps: [] }; this.states.set(file, state); }
      const size = (await stat(file)).size; if (size < state.offset) { state.offset = 0; state.buffer = ''; state.steps = []; state.modelCalls = 0; }
      if (size === state.offset) continue;
      const handle = await open(file, 'r'); try { const chunk = Buffer.alloc(size - state.offset); await handle.read(chunk, 0, chunk.length, state.offset); state.offset = size; const lines = `${state.buffer}${chunk.toString('utf8')}`.split('\n'); state.buffer = lines.pop() ?? ''; for (const line of lines) if (line) parseLine(line, state); } finally { await handle.close(); }
    }
  }
  async capture(): Promise<Result<CodexTreeSnapshot>> {
    await this.refresh(); const root = [...this.states.values()].find((state) => state.sessionId === this.rootSessionId); if (!root) return { ok: false, error: `Codex root session not found under ${this.sessionsRoot}: ${this.rootSessionId}` };
    const ids = new Set([this.rootSessionId]); let changed = true; while (changed) { changed = false; for (const state of this.states.values()) if (state.parentSessionId && ids.has(state.parentSessionId) && !ids.has(state.sessionId)) { ids.add(state.sessionId); changed = true; } }
    const agents = [...this.states.values()].filter((state) => ids.has(state.sessionId)).sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path)).map((state): AgentSnapshot => { const prior = this.previous.get(state.sessionId); const delta = subtract(state.total, prior?.usage); return { sessionId: state.sessionId, parentSessionId: state.parentSessionId, path: state.path, nickname: state.nickname, depth: state.depth, cwd: state.cwd, model: state.model, updatedAt: state.updatedAt, context: { inputTokens: state.lastRequest.inputTokens, windowTokens: state.contextWindow, usedPercent: state.contextWindow ? Number((100 * state.lastRequest.inputTokens / state.contextWindow).toFixed(2)) : null, leftPercent: state.contextWindow ? Number((100 * (state.contextWindow - state.lastRequest.inputTokens) / state.contextWindow).toFixed(2)) : null }, cumulative: { ...state.total, modelCalls: state.modelCalls }, delta: { ...delta, modelCalls: Math.max(0, state.modelCalls - (prior?.modelCalls ?? 0)) } }; });
    const cumulative = agents.reduce((sum, agent) => ({ ...add(sum, agent.cumulative), modelCalls: sum.modelCalls + agent.cumulative.modelCalls }), { ...zero(), modelCalls: 0 }); const delta = agents.reduce((sum, agent) => ({ ...add(sum, agent.delta), modelCalls: sum.modelCalls + agent.delta.modelCalls }), { ...zero(), modelCalls: 0 });
    const capturedAt = new Date().toISOString(); const stepEvents = [...this.states.values()].filter((state) => ids.has(state.sessionId)).flatMap((state) => state.steps).filter((event) => { const key = `${event.agentSessionId}\0${event.callId}\0${event.command}`; if (this.reportedSteps.has(key) || (this.previousCapturedAt && event.timestamp <= this.previousCapturedAt)) return false; this.reportedSteps.add(key); return true; }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const snapshot: CodexTreeSnapshot = { version: 1, capturedAt, rootSessionId: this.rootSessionId, sessionsRoot: this.sessionsRoot, agents, aggregate: { agents: agents.length, cumulative, delta }, stepEvents };
    this.previous = new Map(agents.map((agent) => [agent.sessionId, { modelCalls: agent.cumulative.modelCalls, usage: agent.cumulative }])); this.previousCapturedAt = capturedAt; return { ok: true, value: snapshot };
  }
}

async function previousSnapshot(output: string): Promise<CodexTreeSnapshot | null> { try { const lines = (await readFile(output, 'utf8')).trim().split('\n'); return JSON.parse(lines.at(-1) ?? '') as CodexTreeSnapshot; } catch { return null; } }
async function acquireLock(output: string): Promise<Result<{ path: string }>> {
  const path = `${output}.lock`;
  try { const handle = await open(path, 'wx', 0o600); await handle.writeFile(`${process.pid}\n`, { encoding: 'utf8' }); await handle.close(); return { ok: true, value: { path } }; }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') return { ok: false, error: error instanceof Error ? error.message : 'Monitor lock creation failed.' };
    try { const pid = Number((await readFile(path, 'utf8')).trim()); if (Number.isInteger(pid) && pid > 1) process.kill(pid, 0); return { ok: false, error: `codex-tree-monitor is already running for ${output} (pid ${pid}).` }; }
    catch (probe) { if (probe instanceof Error && 'code' in probe && probe.code === 'ESRCH') { await unlink(path); return acquireLock(output); } return { ok: false, error: `codex-tree-monitor lock is unreadable: ${path}` }; }
  }
}
function wait(milliseconds: number, signal: AbortSignal): Promise<void> { return new Promise((settle) => { const timer = setTimeout(settle, milliseconds); signal.addEventListener('abort', () => { clearTimeout(timer); settle(); }, { once: true }); }); }
export async function monitorCodexSessionTree(input: { intervalSeconds: number; ledgerFile?: string; once: boolean; output?: string; samples: number; sessionId?: string; sessionsRoot?: string }, emit: (message: string) => void = console.log): Promise<Result<string>> {
  const sessionId = input.sessionId?.trim(); if (!sessionId) return { ok: false, error: 'codex-tree-monitor requires --session-id or CODEX_SESSION_ID.' }; if (!/^[0-9a-f-]{36}$/.test(sessionId)) return { ok: false, error: 'codex-tree-monitor received an invalid session id.' };
  if (!Number.isFinite(input.intervalSeconds) || input.intervalSeconds < 1) return { ok: false, error: 'codex-tree-monitor requires --interval-seconds >= 1.' }; if (!Number.isInteger(input.samples) || input.samples < 0) return { ok: false, error: 'codex-tree-monitor requires --samples >= 0.' };
  const sessionsRoot = resolve(input.sessionsRoot ?? (process.env.CODEX_HOME ? join(process.env.CODEX_HOME, 'sessions') : join(homedir(), '.codex', 'sessions')));
  const output = input.output ? resolve(input.output) : input.ledgerFile ? join(dirname(resolve(input.ledgerFile)), 'metrics', 'codex-tree', `${sessionId}.jsonl`) : ''; if (!output) return { ok: false, error: 'codex-tree-monitor requires --output when DECISION_OS_LEDGER_FILE is unavailable.' };
  await mkdir(dirname(output), { recursive: true }); const lock = await acquireLock(output); if (!lock.ok) return lock; const collector = new CodexTreeCollector(sessionId, sessionsRoot); collector.restore(await previousSnapshot(output)); const controller = new AbortController(); const stop = (): void => controller.abort(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const target = input.once ? 1 : input.samples; let captured = 0;
  try { while (!controller.signal.aborted && (target === 0 || captured < target)) { const result = await collector.capture(); if (!result.ok) return result; await appendFile(output, `${JSON.stringify(result.value)}\n`, { encoding: 'utf8', mode: 0o600 }); captured += 1; emit(`${result.value.capturedAt} agents=${result.value.aggregate.agents} delta=${result.value.aggregate.delta.totalTokens} context=${result.value.agents.map((agent) => `${agent.path}:${agent.context.inputTokens}/${agent.context.windowTokens}`).join(',')} output=${output}`); if (target !== 0 && captured >= target) break; await wait(input.intervalSeconds * 1000, controller.signal); } } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); await unlink(lock.value.path).catch(() => {}); }
  return { ok: true, value: JSON.stringify({ version: 1, operation: 'codex-tree-monitor', rootSessionId: sessionId, output, samples: captured, stopped: controller.signal.aborted }, null, 2) };
}

/**
 * WHAT: Adapts Decision OS tests and exact task execution state to generalized trace evidence contracts.
 * WHY: Repository-specific routes, artifact paths, and lease commands must not enter the reusable core.
 */
import { access, readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import type { CardDescriptor, RawEvidenceRecord, SourceFileDescriptor, TestCommand, TraceRepositoryAdapter, TraceScope } from '../../lib/types.js';

type AnyRecord = Record<string, any>;
const execFileAsync = promisify(execFile);

function executionDescriptor(entry: AnyRecord): NonNullable<CardDescriptor['executions']>[number] {
  return {
    executionId: String(entry.executionId ?? ''), sessionId: String(entry.sessionId ?? ''), kind: String(entry.kind ?? ''), phase: String(entry.phase ?? ''),
    requestedAt: String(entry.requestedAt ?? ''), startedAt: entry.startedAt ? String(entry.startedAt) : null, finishedAt: entry.finishedAt ? String(entry.finishedAt) : null,
    model: String(entry.model ?? ''), effort: String(entry.effort ?? ''), executorNodeId: String(entry.executorNodeId ?? ''), predecessorExecutionId: entry.predecessorExecutionId ? String(entry.predecessorExecutionId) : null,
    artifacts: typeof entry.artifacts === 'object' && entry.artifacts ? entry.artifacts as Record<string, boolean> : {},
  };
}

export class DecisionOsAdapter implements TraceRepositoryAdapter {
  readonly name = 'decision-os';
  readonly version = '1';
  constructor(private readonly root: string, private readonly serverUrl = process.env.DECISION_OS_SERVER_URL ?? 'http://127.0.0.1:50150', private readonly runtimeRoot = process.env.DECISION_OS_TRACE_RUNTIME_ROOT ?? root, private readonly telemetryRoot = process.env.DECISION_OS_TRACE_TELEMETRY_ROOT ?? runtimeRoot) {}

  async discoverTests(input: { files: string[]; names: string[]; command: string[]; cwd: string }): Promise<TestCommand[]> {
    // WHAT: Require one direct executable and retain every argument boundary.
    // WHY: The verification lease rejects shell wrappers and shell strings.
    if (input.command.length === 0) throw new Error('test_command_required');
    // WHAT: Preserve one independently identified result for every selected test file.
    // WHY: A batch trace must not collapse distinct test outcomes into one anonymous process result.
    if (input.files.length > 1) return input.files.map((file) => ({ testId: file, executable: input.command[0], args: input.command.slice(1).filter((argument) => !input.files.includes(argument)).concat(file), cwd: resolve(input.cwd), env: {} }));
    return [{ testId: input.files[0] ?? (input.names.join(',') || 'selected-tests'), executable: input.command[0], args: input.command.slice(1), cwd: resolve(input.cwd), env: {} }];
  }

  async wrapTestCommandWithLease(input: { jobId: string; command: TestCommand }): Promise<TestCommand> {
    return { ...input.command, executable: process.execPath, args: [resolve(this.root, 'bin/decision-os-verify.mjs'), '--', input.command.executable, ...input.command.args] };
  }

  async wrapTestBatchWithLease(input: { jobId: string; commands: TestCommand[]; batchWorker: string; specificationFile: string }): Promise<TestCommand> {
    return { testId: `batch:${input.jobId}`, executable: process.execPath, args: [resolve(this.root, 'bin/decision-os-verify.mjs'), '--', process.execPath, input.batchWorker, input.specificationFile], cwd: this.root, env: {} };
  }

  private async controlRoomTasks(signal?: AbortSignal): Promise<AnyRecord[]> {
    const response = await fetch(`${this.serverUrl}/api/control-room?localOnly=1`, { signal });
    // WHAT: Reject unavailable Control Room identity data before card resolution.
    // WHY: Discovery cannot substitute inferred titles, task ownership, or lifecycle state.
    if (!response.ok) throw new Error(`control_room_http_${response.status}`);
    const body = await response.json() as AnyRecord;
    return Array.isArray(body.allTasks) ? body.allTasks : [];
  }

  async resolveCards(input: { projectId: string; cardIds: string[]; replica?: string; signal?: AbortSignal }): Promise<CardDescriptor[]> {
    const tasks = await this.controlRoomTasks(input.signal);
    const results: CardDescriptor[] = [];
    for (const cardId of input.cardIds) {
      const task = tasks.find((candidate) => candidate.cardId === cardId && candidate.projectId === input.projectId);
      // WHAT: Reject an absent exact card without selecting a similarly named task.
      // WHY: Caller order and stable task identity are authoritative discovery inputs.
      if (!task) throw new Error(`card_not_found:${cardId}`);
      const response = await fetch(`${this.serverUrl}/p/${encodeURIComponent(input.projectId)}/api/tasks/${encodeURIComponent(cardId)}/execution-state?replica=${encodeURIComponent(input.replica ?? 'workstation')}`, { signal: input.signal });
      // WHAT: Reject a failed exact-task execution read without substituting another task's state.
      // WHY: Card discovery must preserve requested identity and cannot guess from catalog data.
      if (!response.ok) throw new Error(`execution_state_http_${response.status}:${cardId}`);
      const state = await response.json() as AnyRecord;
      const sessions = Array.isArray(state.sessions) ? state.sessions : [];
      const executions = sessions.flatMap((session: AnyRecord) => Array.isArray(session.executions) ? session.executions.map((entry: AnyRecord) => executionDescriptor({ ...entry, sessionId: entry.sessionId ?? session.sessionId })) : []);
      const providerSessionIds = (await Promise.all(sessions.map(async (session: AnyRecord) => {
        const jsonl = await readFile(resolve(this.runtimeRoot, `.decision-os/runs/codex-skills/tasks/${String(session.sessionId)}.jsonl`), 'utf8').catch(() => '');
        for (const line of jsonl.split('\n')) {
          try {
            const record = JSON.parse(line) as AnyRecord;
            // WHAT: Return only the provider thread identity from the selected session artifact.
            // WHY: Discovery exposes session IDs without returning Codex session content.
            if (record.type === 'thread.started' && record.thread_id) return String(record.thread_id);
          } catch { /* Discovery ignores content and malformed run lines. */ }
        }
        return String(session.providerSessionId ?? '');
      }))).filter(Boolean);
      const aggregateArtifacts = executions.reduce<Record<string, boolean>>((inventory, execution) => {
        for (const [name, available] of Object.entries(execution.artifacts)) inventory[name] = inventory[name] || available;
        return inventory;
      }, {});
      results.push({
        projectId: input.projectId, ledgerId: String(task.ledgerId), cardId, title: String(task.title), masterTaskId: task.masterTask ? cardId : String(task.masterTaskId ?? task.executionOwnerCardId ?? ''),
        subtaskIds: Array.isArray(task.subtasks) ? task.subtasks.map((entry: AnyRecord) => String(entry.cardId)) : [], durableStatus: String(task.cardStatus ?? task.lifecycle?.status ?? ''), internalStatus: String(task.status ?? ''),
        executionIds: executions.map((entry) => entry.executionId), sessionIds: sessions.map((entry: AnyRecord) => String(entry.sessionId)).filter(Boolean), providerSessionIds,
        artifacts: aggregateArtifacts, executions, defaultExecutionId: state.defaultExecutionId ? String(state.defaultExecutionId) : null,
        activeExecutionIds: Array.isArray(state.activeExecutionIds) ? state.activeExecutionIds.map(String) : [],
        predecessorExecutionIds: executions.map((execution) => execution.predecessorExecutionId).filter((identity): identity is string => Boolean(identity)),
        successorExecutionIds: executions.filter((execution) => execution.predecessorExecutionId).map((execution) => execution.executionId),
        restartedExecutionIds: executions.filter((execution) => execution.kind === 'restart').map((execution) => execution.executionId),
      });
    }
    return results;
  }

  async resolveScopes(input: { projectId: string; cardIds: string[]; executionIds: string[]; sessionIds: string[]; providerSessionIds?: string[]; executionMode?: 'default' | 'latest' | 'active'; replica?: string; includeRawCodex?: boolean; includePresentation?: boolean; signal?: AbortSignal }): Promise<TraceScope[]> {
    const cards = await this.resolveCards({ projectId: input.projectId, cardIds: input.cardIds, replica: input.replica, signal: input.signal });
    return cards.map((card) => {
      const cardExecutions = card.executions ?? [];
      const selectedExecutions = input.executionIds.length > 0 ? cardExecutions.filter((execution) => input.executionIds.includes(execution.executionId)) : input.sessionIds.length > 0 ? cardExecutions.filter((execution) => input.sessionIds.includes(execution.sessionId)) : (input.providerSessionIds?.length ?? 0) > 0 ? card.providerSessionIds.some((identity) => input.providerSessionIds?.includes(identity)) ? cardExecutions : [] : input.executionMode === 'active' ? cardExecutions.filter((execution) => card.activeExecutionIds?.includes(execution.executionId)) : input.executionMode === 'latest' || !card.defaultExecutionId ? cardExecutions.slice(-1) : cardExecutions.filter((execution) => execution.executionId === card.defaultExecutionId);
      // WHAT: Reject requested execution and session selectors that do not belong to the exact card.
      // WHY: Cross-card event leakage violates task evidence isolation.
      const selectorMismatch = (input.executionIds.length > 0 || input.sessionIds.length > 0 || (input.providerSessionIds?.length ?? 0) > 0) && selectedExecutions.length === 0;
      return { scopeId: card.cardId, projectId: card.projectId, kind: 'task' as const, testIds: [], cardIds: [card.cardId], executionIds: selectedExecutions.map((execution) => execution.executionId), sessionIds: [...new Set(selectedExecutions.map((execution) => execution.sessionId))], providerSessionIds: card.providerSessionIds, collectRawCodex: input.includeRawCodex === true && input.sessionIds.length > 0, collectPresentation: input.includePresentation !== false, status: selectorMismatch ? 'failed' as const : 'pending' as const, error: selectorMismatch ? `selected_execution_not_owned:${card.cardId}` : null };
    });
  }

  async *collectEvidence(scope: TraceScope, signal?: AbortSignal): AsyncIterable<RawEvidenceRecord> {
    for (const executionId of scope.collectPresentation === false ? [] : scope.executionIds) {
      const presentationResponse = await fetch(`${this.serverUrl}/p/${encodeURIComponent(scope.projectId ?? '')}/api/task-executions/${encodeURIComponent(executionId)}`, { signal });
      // WHAT: Contain a failed selected presentation inside its exact task scope.
      // WHY: Other selected cards must remain collectible after one execution disappears.
      if (!presentationResponse.ok) throw new Error(`presentation_http_${presentationResponse.status}:${executionId}`);
      const bytes = await presentationResponse.text();
      yield { source: 'presentation', scopeId: scope.scopeId, cardId: scope.cardIds[0] ?? null, executionId, sessionId: scope.sessionIds[0] ?? null, bytes };
    }
    const runDirectory = resolve(this.runtimeRoot, '.decision-os/runs/codex-skills/tasks');
    const names: string[] = await readdir(runDirectory).catch(() => []);
    for (const sessionId of scope.collectRawCodex ? scope.sessionIds : []) {
      const jsonlName = `${sessionId}.jsonl`;
      const stderrName = `${sessionId}.log`;
      // WHAT: Read only exact selected session artifact names.
      // WHY: Filename timestamps and partial identifiers are not authoritative selectors.
      if (names.includes(jsonlName)) yield { source: 'raw-codex', scopeId: scope.scopeId, cardId: scope.cardIds[0] ?? null, executionId: null, sessionId, bytes: await readFile(resolve(runDirectory, jsonlName), 'utf8') };
      // WHAT: Include stderr only for the selected exact session artifact.
      // WHY: Unrelated session logs must never enter the task trace.
      if (names.includes(stderrName)) yield { source: 'stderr', scopeId: scope.scopeId, cardId: scope.cardIds[0] ?? null, executionId: null, sessionId, bytes: await readFile(resolve(runDirectory, stderrName), 'utf8') };
    }
    const telemetryPath = resolve(this.telemetryRoot, '.decision-os/frontend-telemetry.jsonl');
    const telemetryText = await readFile(telemetryPath, 'utf8').catch(() => '');
    for (const [index, line] of telemetryText.split('\n').entries()) {
      // WHAT: Ignore the terminal empty telemetry line.
      // WHY: It is not a task event record.
      if (!line) continue;
      // WHAT: Retain only telemetry carrying an exact selected task, execution, or session identity.
      // WHY: Time proximity cannot authorize cross-task evidence collection.
      if (!scope.cardIds.some((id) => line.includes(id)) && !scope.executionIds.some((id) => line.includes(id)) && !scope.sessionIds.some((id) => line.includes(id))) continue;
      yield { source: 'task-events', scopeId: scope.scopeId, cardId: scope.cardIds[0] ?? null, executionId: null, sessionId: null, bytes: line };
      try {
        const source = JSON.parse(line) as AnyRecord;
        // WHAT: Normalize only historic task telemetry that retained a non-empty emission stack.
        // WHY: Stackless records remain raw task evidence but cannot satisfy the trace event contract.
        if (!source.rawStack) continue;
        const eventId = `decision-os-${createHash('sha256').update(line).digest('hex').slice(0, 24)}`;
        yield { source: 'telemetry', scopeId: scope.scopeId, cardId: scope.cardIds[0] ?? null, executionId: scope.executionIds.find((id) => line.includes(id)) ?? null, sessionId: scope.sessionIds.find((id) => line.includes(id)) ?? null, bytes: JSON.stringify({ schemaVersion: 1, traceJobId: '', traceRunId: '', scopeId: scope.scopeId, testId: null, cardId: scope.cardIds[0] ?? null, executionId: scope.executionIds.find((id) => line.includes(id)) ?? null, sessionId: scope.sessionIds.find((id) => line.includes(id)) ?? null, eventId, sequence: index + 1, emittedAt: String(source.at ?? new Date(0).toISOString()), monotonicNs: '0', processId: 0, threadId: null, name: String(source.name ?? 'decision-os-telemetry'), phase: 'event', args: source.args ?? {}, rawStack: String(source.rawStack) }) };
      } catch { /* Malformed original bytes remain in task-events.jsonl for manifest inventory. */ }
    }
  }

  async locateSourceMaps(input: { scopes: TraceScope[]; generatedFiles: string[]; signal?: AbortSignal }): Promise<string[]> {
    const candidates = [...new Set(input.generatedFiles.map((file) => `${file}.map`))];
    const maps: string[] = [];
    for (const candidate of candidates) {
      // WHAT: Stop exact source-map probes after cancellation.
      // WHY: A cancelled trace must settle without continuing filesystem work.
      if (input.signal?.aborted) throw input.signal.reason ?? new Error('trace_cancelled');
      // WHAT: Admit only the adjacent map for a generated file captured in a stack.
      // WHY: Walking every build output is expensive and unrelated maps cannot own the frame.
      if (await access(candidate).then(() => true, () => false)) maps.push(candidate);
    }
    void input.scopes;
    return maps;
  }

  async resolveSourceFiles(input: { files: string[] }): Promise<SourceFileDescriptor[]> {
    const candidates = [...new Set(input.files.map((file) => resolve(file)))];
    const existing = await Promise.all(candidates.map(async (file) => ({ file, exists: await access(file).then(() => true, () => false) })));
    return Promise.all(existing.filter((entry) => entry.exists).map(async (entry) => {
      const repositoryRelativePath = relative(this.root, entry.file);
      const tracked = await execFileAsync('git', ['-C', this.root, 'ls-files', '--error-unmatch', repositoryRelativePath]).then(() => true, () => false);
      const gitBlobHash = tracked ? await execFileAsync('git', ['-C', this.root, 'hash-object', repositoryRelativePath]).then((result) => result.stdout.trim(), () => null) : null;
      return { path: entry.file, repositoryRelativePath, tracked, gitBlobHash };
    }));
  }
}

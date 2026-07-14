/**
 * WHAT: Runs durable Codex pipeline skills one at a time and persists every lifecycle transition.
 * WHY: Pipeline progress must survive process-local state loss without ever starting two ordered skills together.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, type WriteStream } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type {
  CodexPipelineRun,
  CodexPipelineRunSkill,
  CodexPipelineRunStep,
  CodexPipelineStatus,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { hydrateLedgerCardContent, resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
import { createCardSkillRunEventIngestor } from '../effect/ingest-card-skill-run-events.js';
import { flushCardSkillRunEventIngestor } from '../effect/flush-card-skill-run-event-ingestor.js';
import { codexRunSegmentMarker } from './codex-run-segment-marker.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from './codex-pipeline-store.js';
import { buildPipelineSkillPrompt } from './build-pipeline-skill-prompt.js';
import { resolveCodexCommand } from './resolve-codex-command.js';
import { decisionOsCodexEnvironment } from './decision-os-codex-runtime.js';
import { resolveServerSkillContext } from './server-skill-context.js';
import { projectCardCodexRun } from './project-card-codex-run.js';

type AnyRecord = Record<string, unknown>;
type TerminalStatus = 'complete' | 'failed' | 'cancelled';

export function maxConcurrentCodexProcesses(runtime: AnyRecord): number {
  const sharedCapacity = runtime.globalCodexProcessCapacity;
  if (typeof sharedCapacity === 'function') {
    const configured = Number(sharedCapacity());
    if (Number.isFinite(configured)) return Math.min(32, Math.max(1, Math.floor(configured)));
  }
  const settings = runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object'
    ? runtime.decisionOsSettings as AnyRecord
    : {};
  const configured = Number(
    process.env.CODEX_MAX_CONCURRENT_PROCESSES
      ?? settings.maxConcurrentCodexProcesses
      ?? settings.CODEX_MAX_CONCURRENT_PROCESSES
      ?? 1,
  );
  if (!Number.isFinite(configured)) return 1;
  return Math.min(32, Math.max(1, Math.floor(configured)));
}

export function pipelineQueuePosition(input: {
  runs: readonly CodexPipelineRun[];
  pipelineRunId: string;
}): number | null {
  const index = input.runs.filter((run) => run.status === 'pending').findIndex((run) => run.id === input.pipelineRunId);
  return index < 0 ? null : index + 1;
}

export type PipelineLedgerContext = {
  ledgerId: string;
  ledgerPath: string;
  ledger: AnyRecord & { cards?: AnyRecord[]; relationships?: AnyRecord[] };
};

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function runtimeRuns(runtime: AnyRecord): Record<string, AnyRecord> {
  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    : {};
  runtime.codexSkillRuns = runs;
  return runs;
}

export function publicPipelineSkillRuntimeRun(run: AnyRecord): AnyRecord {
  const { child: _child, ...publicRun } = run;
  return publicRun;
}

export function pipelineRuntimeRun(runtime: AnyRecord, runId: string): AnyRecord | undefined {
  return runtimeRuns(runtime)[runId];
}

function updateRuntimeRun(runtime: AnyRecord, runId: string, patch: AnyRecord): AnyRecord {
  const runs = runtimeRuns(runtime);
  const run = runs[runId] ?? {};
  Object.assign(run, patch);
  runs[runId] = run;
  return run;
}

function attachRuntimeChild(runtime: AnyRecord, runId: string, child: ChildProcess): void {
  const run = runtimeRuns(runtime)[runId];
  if (!run) return;
  Object.defineProperty(run, 'child', { value: child, writable: true, configurable: true, enumerable: false });
}

function runtimeStatus(runtime: AnyRecord, runId: string): CodexPipelineStatus | null {
  const value = String(runtimeRuns(runtime)[runId]?.status ?? '');
  return value === 'pending' || value === 'running' || value === 'complete' || value === 'failed' || value === 'cancelled'
    ? value
    : null;
}

function notify(callback: unknown, event: AnyRecord): void {
  if (typeof callback === 'function') callback(event);
}

function finishRunStreams(stdout: WriteStream, stderr: WriteStream, callback: () => void): void {
  let pending = 2;
  const done = (): void => {
    pending -= 1;
    if (pending === 0) callback();
  };
  for (const stream of [stdout, stderr]) {
    if (stream.destroyed || stream.writableEnded) done();
    else stream.end(done);
  }
}

function appendRunStatus(filePath: string, status: TerminalStatus, detail: string): void {
  const markdown = ['', '---', '', `Codex run ${status === 'complete' ? 'completed' : status}: ${detail}`].join('\n');
  try {
    const current = existsSync(filePath) ? readFileSync(filePath, 'utf8').replace(/\s+$/g, '') : '';
    writeFileSync(filePath, `${current}${markdown}\n`, 'utf8');
  } catch {
    // The durable manifest and process logs remain authoritative when card output cannot be patched.
  }
}

export function resolvePipelineLedgerContext(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
}): PipelineLedgerContext | null {
  const state = readCanonicalDecisionOsState({
    action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') },
    runtime_state: input.runtime,
  });
  const tab = state.ledgers.find((entry) => entry.id === input.ledgerId);
  if (!tab) return null;
  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(input.decisionOsRoot, ledgerFile);
  if (!isInside(input.decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return null;
  return {
    ledgerId: input.ledgerId,
    ledgerPath,
    ledger: JSON.parse(readFileSync(ledgerPath, 'utf8')) as PipelineLedgerContext['ledger'],
  };
}

function persistLedger(context: PipelineLedgerContext): void {
  stripHydratedThreadNotes(context.ledger);
  writeFileSync(context.ledgerPath, JSON.stringify(context.ledger, null, 2), 'utf8');
}

function cardContent(input: { context: PipelineLedgerContext; decisionOsRoot: string; cardId: string }): string {
  const hydrated = hydrateLedgerCardContent(
    JSON.parse(JSON.stringify(input.context.ledger)),
    input.decisionOsRoot,
  ) as { cards?: AnyRecord[] };
  const card = (hydrated.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return String(comment.what ?? comment.body ?? comment.description ?? '');
}

function outputFileForCard(context: PipelineLedgerContext, decisionOsRoot: string, cardId: string): string {
  const card = (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return resolveCardContentFile(decisionOsRoot, comment.contentFile) ?? '';
}

function projectPipelineSkillRun(input: {
  decisionOsRoot: string;
  context: PipelineLedgerContext;
  step: CodexPipelineRunStep;
  skill: CodexPipelineRunSkill;
  pipelineRun: CodexPipelineRun;
}): void {
  const outputFile = outputFileForCard(input.context, input.decisionOsRoot, input.step.outputCardId);
  const outputFileRef = outputFile ? relative(dirname(input.decisionOsRoot), outputFile) : '';
  const projection = {
    ledger: input.context.ledger,
    runId: input.skill.runId,
    outputFileRef,
    codexModel: input.skill.codexModel,
    codexEffort: input.skill.codexEffort,
    ownership: 'card' as const,
    pipeline: {
      runId: input.pipelineRun.id,
      name: input.pipelineRun.pipelineName,
      stepId: input.step.stepId,
      stepName: input.step.name,
      skillName: input.skill.skillName,
    },
  };
  projectCardCodexRun({ ...projection, cardId: input.pipelineRun.sourceCardId });
  projectCardCodexRun({ ...projection, cardId: input.step.outputCardId });
  persistLedger(input.context);
}

function terminalFromFiles(skill: CodexPipelineRunSkill): TerminalStatus | null {
  const stdout = skill.stdoutFile && existsSync(skill.stdoutFile) ? readFileSync(skill.stdoutFile, 'utf8') : '';
  const stderr = skill.stderrFile && existsSync(skill.stderrFile) ? readFileSync(skill.stderrFile, 'utf8') : '';
  if (/cancelled|canceled|terminated by operator/i.test(stderr)) return 'cancelled';
  if (/"type"\s*:\s*"(?:turn|thread|run)\.failed"|Codex run failed|exit code [1-9]/i.test(`${stdout}\n${stderr}`)) return 'failed';
  if (/"type"\s*:\s*"turn\.completed"/i.test(stdout) || /Codex run completed/i.test(stderr)) return 'complete';
  return null;
}

export function derivePipelineSkillStatus(input: {
  skill: CodexPipelineRunSkill;
  runtime?: AnyRecord;
}): CodexPipelineStatus {
  const inMemory = input.runtime ? runtimeStatus(input.runtime, input.skill.runId) : null;
  if (inMemory) return inMemory;
  return terminalFromFiles(input.skill) ?? input.skill.status;
}

function stepStatus(skills: readonly CodexPipelineRunSkill[]): CodexPipelineStatus {
  if (skills.some((skill) => skill.status === 'cancelled')) return 'cancelled';
  if (skills.some((skill) => skill.status === 'failed')) return 'failed';
  if (skills.length > 0 && skills.every((skill) => skill.status === 'complete')) return 'complete';
  if (skills.some((skill) => skill.status === 'running' || skill.status === 'complete')) return 'running';
  return 'pending';
}

function runStatus(steps: readonly CodexPipelineRunStep[], previous: CodexPipelineStatus): CodexPipelineStatus {
  if (previous === 'cancelled' || steps.some((step) => step.status === 'cancelled')) return 'cancelled';
  if (steps.some((step) => step.status === 'failed')) return 'failed';
  if (steps.length > 0 && steps.every((step) => step.status === 'complete')) return 'complete';
  if (steps.some((step) => step.status === 'running' || step.status === 'complete')) return 'running';
  return 'pending';
}

function isTerminal(status: CodexPipelineStatus): status is TerminalStatus {
  return status === 'complete' || status === 'failed' || status === 'cancelled';
}

export function reassessPipelineAfterSkill(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  pipelineRunId: string;
  skillRunId?: string;
  settledStatus?: TerminalStatus;
  error?: string;
  exitCode?: number | null;
  finishedAt?: string;
}): CodexPipelineRun | null {
  const before = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  const prior = before.store.runs.find((run) => run.id === input.pipelineRunId);
  if (!prior) return null;
  const now = input.finishedAt ?? new Date().toISOString();
  const steps = prior.steps.map((step) => {
    const skills = step.skills.map((skill) => {
      if (input.skillRunId && skill.runId === input.skillRunId && input.settledStatus) {
        return {
          ...skill,
          status: input.settledStatus,
          finishedAt: now,
          error: input.error ?? (input.settledStatus === 'failed' ? `Codex exited with code ${input.exitCode ?? 'unknown'}.` : ''),
        };
      }
      if (skill.status !== 'running') return skill;
      const derived = derivePipelineSkillStatus({ skill, runtime: input.runtime });
      return isTerminal(derived) ? { ...skill, status: derived, finishedAt: skill.finishedAt ?? now } : skill;
    });
    const status = stepStatus(skills);
    const startedAt = step.startedAt ?? skills.find((skill) => skill.startedAt)?.startedAt ?? null;
    const finishedAt = isTerminal(status) ? step.finishedAt ?? now : null;
    const error = skills.find((skill) => skill.status === 'failed' || skill.status === 'cancelled')?.error ?? '';
    return { ...step, skills, status, startedAt, finishedAt, error };
  });
  const status = runStatus(steps, prior.status);
  const run: CodexPipelineRun = {
    ...prior,
    steps,
    status,
    updatedAt: now,
    startedAt: prior.startedAt ?? steps.find((step) => step.startedAt)?.startedAt ?? null,
    finishedAt: isTerminal(status) ? prior.finishedAt ?? now : null,
    error: steps.find((step) => step.status === 'failed' || step.status === 'cancelled')?.error ?? '',
  };
  const nextRuns = before.store.runs.map((entry) => entry.id === run.id ? run : entry);
  const activeWorkspaceRun = isTerminal(status) && before.store.activeWorkspaceRun === run.id
    ? nextRuns.find((entry) => entry.status === 'running')?.id ?? null
    : before.store.activeWorkspaceRun;
  const written = writeCodexPipelineStore({
    decisionOsRoot: input.decisionOsRoot,
    store: {
      ...before.store,
      runs: nextRuns,
      activeWorkspaceRun,
    },
  });
  const persisted = written.store.runs.find((entry) => entry.id === run.id) ?? run;

  // Reload generated card content as part of every reassessment so persisted state,
  // not a stale in-memory card snapshot, remains the handoff source for the next skill.
  const context = resolvePipelineLedgerContext({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: persisted.ledgerId,
  });
  if (context) hydrateLedgerCardContent(context.ledger, input.decisionOsRoot);
  return persisted;
}

function findNextSkill(run: CodexPipelineRun): { step: CodexPipelineRunStep; skill: CodexPipelineRunSkill } | null {
  for (const step of run.steps) {
    for (const skill of step.skills) {
      if (skill.status === 'running') return null;
      if (skill.status === 'failed' || skill.status === 'cancelled') return null;
      if (skill.status === 'pending') return { step, skill };
    }
  }
  return null;
}

export function markPipelineSkillStarted(input: {
  decisionOsRoot: string;
  pipelineRunId: string;
  skillRunId: string;
  startedAt: string;
}): CodexPipelineRun | null {
  const before = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  const prior = before.store.runs.find((run) => run.id === input.pipelineRunId);
  if (!prior || isTerminal(prior.status) || prior.steps.some((step) => step.skills.some((skill) => skill.status === 'running'))) return null;
  let found = false;
  const steps = prior.steps.map((step) => {
    const skills = step.skills.map((skill) => {
      if (skill.runId !== input.skillRunId || skill.status !== 'pending') return skill;
      found = true;
      return { ...skill, status: 'running' as const, startedAt: input.startedAt, finishedAt: null, error: '' };
    });
    if (!found || !skills.some((skill) => skill.runId === input.skillRunId)) return step;
    return { ...step, skills, status: 'running' as const, startedAt: step.startedAt ?? input.startedAt, finishedAt: null, error: '' };
  });
  if (!found) return null;
  const run: CodexPipelineRun = {
    ...prior,
    steps,
    status: 'running',
    startedAt: prior.startedAt ?? input.startedAt,
    finishedAt: null,
    updatedAt: input.startedAt,
    error: '',
  };
  const written = writeCodexPipelineStore({
    decisionOsRoot: input.decisionOsRoot,
    store: {
      ...before.store,
      runs: before.store.runs.map((entry) => entry.id === run.id ? run : entry),
      activeWorkspaceRun: before.store.activeWorkspaceRun ?? run.id,
    },
  });
  return written.store.runs.find((entry) => entry.id === run.id) ?? run;
}

function priorInput(input: {
  run: CodexPipelineRun;
  step: CodexPipelineRunStep;
  skill: CodexPipelineRunSkill;
  context: PipelineLedgerContext;
  decisionOsRoot: string;
}): { cardId: string; content: string } {
  const flattened = input.run.steps.flatMap((step) => step.skills.map((skill) => ({ step, skill })));
  const index = flattened.findIndex((entry) => entry.skill.runId === input.skill.runId);
  if (index <= 0) {
    return {
      cardId: input.run.sourceCardId,
      content: cardContent({ context: input.context, decisionOsRoot: input.decisionOsRoot, cardId: input.run.sourceCardId }),
    };
  }
  const prior = flattened[index - 1];
  return {
    cardId: prior.step.outputCardId,
    content: cardContent({ context: input.context, decisionOsRoot: input.decisionOsRoot, cardId: prior.step.outputCardId }),
  };
}

export function spawnPipelineSkillProcess(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  pipelineRun: CodexPipelineRun;
  step: CodexPipelineRunStep;
  skill: CodexPipelineRunSkill;
}): AnyRecord {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const context = resolvePipelineLedgerContext({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: input.pipelineRun.ledgerId,
  });
  if (!context) throw new Error(`Ledger ${input.pipelineRun.ledgerId} could not be loaded for pipeline run ${input.pipelineRun.id}.`);
  const outputFile = outputFileForCard(context, input.decisionOsRoot, input.step.outputCardId);
  if (!outputFile) throw new Error(`Output card ${input.step.outputCardId} has no Markdown file.`);
  projectPipelineSkillRun({ decisionOsRoot: input.decisionOsRoot, context, step: input.step, skill: input.skill, pipelineRun: input.pipelineRun });
  const stageInput = priorInput({
    run: input.pipelineRun,
    step: input.step,
    skill: input.skill,
    context,
    decisionOsRoot: input.decisionOsRoot,
  });
  const command = resolveCodexCommand({
    workspaceRoot,
    runtime: input.runtime,
    codexModel: input.skill.codexModel,
    codexEffort: input.skill.codexEffort,
  });
  const prompt = buildPipelineSkillPrompt({
    skillName: input.skill.skillName,
    ledgerFile: context.ledgerPath,
    pipelineRunId: input.pipelineRun.id,
    pipelineName: input.pipelineRun.pipelineName,
    sourceCardId: input.pipelineRun.sourceCardId,
    sourceCardTitle: input.pipelineRun.sourceCardTitle,
    stepId: input.step.stepId,
    stepTitle: input.step.name,
    stepInputCardId: stageInput.cardId,
    stepInputCardContent: stageInput.content,
    outputCardId: input.step.outputCardId,
    outputMarkdownFile: outputFile,
    serverSkill: resolveServerSkillContext({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, skillName: input.skill.skillName }),
  });

  mkdirSync(dirname(input.skill.stdoutFile), { recursive: true });
  const child = spawn(command.command, command.args, {
    cwd: workspaceRoot,
    env: decisionOsCodexEnvironment({ runtime: input.runtime, decisionOsRoot: input.decisionOsRoot, ledgerFile: context.ledgerPath }),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stdout = createWriteStream(input.skill.stdoutFile, { flags: 'a' });
  const stderr = createWriteStream(input.skill.stderrFile, { flags: 'a' });
  const runEventIngestor = createCardSkillRunEventIngestor({
    decisionOsRoot: input.decisionOsRoot,
    ledgerPath: context.ledgerPath,
    cardId: input.step.outputCardId,
    runId: input.skill.runId,
    telemetryFile: `${input.skill.stdoutFile}.telemetry.jsonl`,
  });
  const startedAt = input.skill.startedAt ?? new Date().toISOString();
  appendFileSync(input.skill.stderrFile, codexRunSegmentMarker({
    runId: input.skill.runId,
    startedAt,
    segment: 'start',
    startLine: 0,
    metadata: {
      sourceCardTitle: input.pipelineRun.sourceCardTitle,
      codexModel: command.model,
      codexEffort: command.effort,
    },
  }), 'utf8');
  child.stdout.on('data', (chunk: Buffer) => runEventIngestor.ingest(chunk));
  child.stdin.on('error', () => undefined);
  child.stdout.pipe(stdout, { end: false });
  child.stderr.pipe(stderr, { end: false });
  child.stdin.end(prompt);

  const runtimeRun = updateRuntimeRun(input.runtime, input.skill.runId, {
    id: input.skill.runId,
    pipelineRunId: input.pipelineRun.id,
    pipelineId: input.pipelineRun.pipelineId,
    pipelineName: input.pipelineRun.pipelineName,
    pipelineStepId: input.step.stepId,
    pipelineStepName: input.step.name,
    skillName: input.skill.skillName,
    ledgerId: input.pipelineRun.ledgerId,
    sourceCardId: input.pipelineRun.sourceCardId,
    sourceCardTitle: input.pipelineRun.sourceCardTitle,
    outputCardId: input.step.outputCardId,
    outputFile,
    stdoutFile: input.skill.stdoutFile,
    stderrFile: input.skill.stderrFile,
    codexModel: input.skill.codexModel,
    codexEffort: input.skill.codexEffort,
    pid: child.pid ?? 0,
    status: 'running',
    startedAt,
  });
  attachRuntimeChild(input.runtime, input.skill.runId, child);
  notify(input.runtime.onPipelineLedgerChange, {
    reason: 'pipeline-skill-started',
    ledgerId: input.pipelineRun.ledgerId,
    pipelineRunId: input.pipelineRun.id,
    runId: input.skill.runId,
    cardId: input.step.outputCardId,
  });

  let settled = false;
  const settle = (status: TerminalStatus, detail: string, exitCode: number | null, error = ''): void => {
    if (settled) return;
    settled = true;
    const finishedAt = new Date().toISOString();
    appendRunStatus(outputFile, status, detail);
    updateRuntimeRun(input.runtime, input.skill.runId, { status, exitCode, error, finishedAt });
    finishRunStreams(stdout, stderr, () => {
      if (status === 'cancelled') appendFileSync(input.skill.stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
      if (status === 'failed') appendFileSync(input.skill.stderrFile, `Codex run failed: ${detail}\n`, 'utf8');
      flushCardSkillRunEventIngestor(runEventIngestor, input.skill.runId);
      const reassessed = reassessPipelineAfterSkill({
        decisionOsRoot: input.decisionOsRoot,
        runtime: input.runtime,
        pipelineRunId: input.pipelineRun.id,
        skillRunId: input.skill.runId,
        settledStatus: status,
        error,
        exitCode,
        finishedAt,
      });
      updateRuntimeRun(input.runtime, input.skill.runId, { settledAt: new Date().toISOString() });
      notify(input.runtime.onPipelineLedgerChange, {
        reason: 'pipeline-skill-settled',
        ledgerId: input.pipelineRun.ledgerId,
        pipelineRunId: input.pipelineRun.id,
        runId: input.skill.runId,
        cardId: input.step.outputCardId,
        status,
        pipelineStatus: reassessed?.status ?? status,
      });
      if (status === 'complete' && reassessed && !isTerminal(reassessed.status)) {
        runNextPipelineSkill({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, pipelineRunId: input.pipelineRun.id });
      }
      if (reassessed && isTerminal(reassessed.status)) {
        const schedule = input.runtime.scheduleCodexProcesses;
        if (typeof schedule === 'function') void schedule();
      }
      notify(input.runtime.onCodexRunSettled, {
        ledgerId: input.pipelineRun.ledgerId,
        cardId: input.step.outputCardId,
        outputCardId: input.step.outputCardId,
        threadId: `thread-${input.step.outputCardId}`,
        runId: input.skill.runId,
        pipelineRunId: input.pipelineRun.id,
        status,
        pipelineStatus: reassessed?.status ?? status,
        pipelineTerminal: Boolean(reassessed && isTerminal(reassessed.status)),
        exitCode,
      });
    });
  };
  child.on('error', (error) => settle('failed', error.message, null, error.message));
  child.on('close', (exitCode) => {
    const status = runtimeStatus(input.runtime, input.skill.runId) === 'cancelled'
      ? 'cancelled'
      : exitCode === 0 ? 'complete' : 'failed';
    const detail = status === 'cancelled' ? 'terminated by operator' : `exit code ${exitCode ?? 'unknown'}`;
    settle(status, detail, exitCode, status === 'failed' ? detail : '');
  });
  return publicPipelineSkillRuntimeRun(runtimeRun);
}

export function runNextPipelineSkill(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  pipelineRunId: string;
}): AnyRecord {
  const reassessed = reassessPipelineAfterSkill({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    pipelineRunId: input.pipelineRunId,
  });
  if (!reassessed) return { ok: false, statusCode: 404, error: 'Pipeline run not found.', runId: input.pipelineRunId };
  if (isTerminal(reassessed.status)) return { ok: true, statusCode: 200, run: reassessed };
  const next = findNextSkill(reassessed);
  if (!next) return { ok: true, statusCode: 200, run: reassessed };
  const startedAt = new Date().toISOString();
  const started = markPipelineSkillStarted({
    decisionOsRoot: input.decisionOsRoot,
    pipelineRunId: reassessed.id,
    skillRunId: next.skill.runId,
    startedAt,
  });
  if (!started) return { ok: true, statusCode: 200, run: reassessed };
  const step = started.steps.find((entry) => entry.id === next.step.id);
  const skill = step?.skills.find((entry) => entry.runId === next.skill.runId);
  if (!step || !skill) return { ok: false, statusCode: 500, error: 'Started pipeline skill was not persisted.' };
  try {
    const runtimeRun = spawnPipelineSkillProcess({
      decisionOsRoot: input.decisionOsRoot,
      runtime: input.runtime,
      pipelineRun: started,
      step,
      skill,
    });
    return { ok: true, statusCode: 202, run: started, skillRun: runtimeRun };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = reassessPipelineAfterSkill({
      decisionOsRoot: input.decisionOsRoot,
      runtime: input.runtime,
      pipelineRunId: started.id,
      skillRunId: skill.runId,
      settledStatus: 'failed',
      error: message,
    });
    return { ok: false, statusCode: 500, error: message, run: failed };
  }
}

export function scheduleCodexPipelineRuns(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
}): { launched: AnyRecord[]; queuedRunIds: string[]; capacity: number } {
  const capacity = maxConcurrentCodexProcesses(input.runtime);
  const launched: AnyRecord[] = [];
  while (true) {
    const store = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store;
    const runs = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
    const running = Object.values(runs).filter((run) => run.status === 'running').length;
    if (running >= capacity) break;
    const next = store.runs.find((run) => run.status === 'pending');
    if (!next) break;
    const launch = runNextPipelineSkill({
      decisionOsRoot: input.decisionOsRoot,
      runtime: input.runtime,
      pipelineRunId: next.id,
    });
    launched.push(launch);
    if (launch.ok === false || !launch.skillRun) break;
  }
  const finalStore = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store;
  return {
    launched,
    queuedRunIds: finalStore.runs.filter((run) => run.status === 'pending').map((run) => run.id),
    capacity,
  };
}

export function pipelineRunLogAvailability(skill: CodexPipelineRunSkill): {
  stdoutAvailable: boolean;
  stderrAvailable: boolean;
  logAvailable: boolean;
  lastLogWriteAt: string | null;
} {
  const stdoutAvailable = Boolean(skill.stdoutFile && existsSync(skill.stdoutFile));
  const stderrAvailable = Boolean(skill.stderrFile && existsSync(skill.stderrFile));
  const newest = Math.max(
    stdoutAvailable ? statSync(skill.stdoutFile).mtimeMs : 0,
    stderrAvailable ? statSync(skill.stderrFile).mtimeMs : 0,
  );
  return {
    stdoutAvailable,
    stderrAvailable,
    logAvailable: stdoutAvailable || stderrAvailable,
    lastLogWriteAt: newest > 0 ? new Date(newest).toISOString() : null,
  };
}

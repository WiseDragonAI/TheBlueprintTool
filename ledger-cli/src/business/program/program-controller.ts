/**
 * WHAT: Owns durable approved-Plan orchestration above individual Software Iteration master cards.
 * WHY: long-running goals need compact resumable state without replaying agent transcripts or weakening phase prompts.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { Result } from '../../lib/types.js';
import { createMasterTask } from '../ledger/helper/create-master-task.js';
import { createSubtask } from '../ledger/helper/create-subtask.js';
import { queryPipelinePrompts } from '../prompt/helper/query-pipeline-prompts.js';
import { submitTaskMutation } from '../ledger/effect/submit-task-mutation.js';

type PhaseState = 'PLANNED' | 'READY' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'SUPERSEDED';
type PlanPhase = { phaseId: string; title: string; intent: string; dependsOn: string[]; acceptance: string; constraints: string; excluded: string };
type ProgramPhase = PlanPhase & { masterCardId: string; state: PhaseState; resultSummary: string; evidence: string[]; startedAt: string | null; endedAt: string | null };
type ReconciliationDecision = { phaseId: string; state: 'COMPLETED' | 'FAILED' | 'BLOCKED'; summary: string; evidence: string[] };
type ProgramState = {
  version: 1;
  programId: string;
  projectId: string;
  planPath: string;
  planRevision: number;
  planSha256: string;
  executionManifestPath?: string;
  executionManifestSha256?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  controllerMasterCardId: string;
  controllerCards: { execution: string; decisions: string; plan: string };
  active: null | { phaseId: string; masterCardId: string; attemptId: string; startedAt: string };
  phases: ProgramPhase[];
  amendments: Array<{ id: string; fromRevision: number; toRevision: number; oldSha256: string; newSha256: string; changedPhaseIds: string[]; createdAt: string }>;
  latestHandoff: string;
};

const header = ['PHASE', 'TITLE', 'INTENT', 'DEPENDS_ON', 'ACCEPTANCE', 'CONSTRAINTS', 'EXCLUDED'];

function sha256(bytes: string): string { return createHash('sha256').update(bytes).digest('hex'); }
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function programRoot(): Result<string> {
  const ledger = text(process.env.DECISION_OS_LEDGER_FILE);
  return ledger ? { ok: true, value: join(dirname(ledger), 'programs') } : { ok: false, error: 'Program commands require DECISION_OS_LEDGER_FILE.' };
}
function statePath(programId: string): Result<string> {
  if (!/^program-[a-f0-9]{16}$/.test(programId)) return { ok: false, error: 'Invalid program id.' };
  const root = programRoot();
  return root.ok ? { ok: true, value: join(root.value, `${programId}.json`) } : root;
}
async function writeState(state: ProgramState): Promise<void> {
  const target = statePath(state.programId);
  if (!target.ok) throw new Error(target.error);
  await mkdir(dirname(target.value), { recursive: true });
  const temporary = `${target.value}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, target.value);
}
async function readState(programIdInput: string | undefined): Promise<Result<ProgramState>> {
  const programId = text(programIdInput);
  const target = statePath(programId);
  if (!target.ok) return target;
  try {
    const parsed: unknown = JSON.parse(await readFile(target.value, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || (parsed as { version?: unknown }).version !== 1) return { ok: false, error: `Invalid program state: ${target.value}` };
    return { ok: true, value: parsed as ProgramState };
  } catch (error) {
    return { ok: false, error: error instanceof Error && 'code' in error && error.code === 'ENOENT' ? `Program not found: ${programId}` : error instanceof Error ? error.message : 'Program state read failed.' };
  }
}
export function parseApprovedPlan(markdown: string): Result<{ title: string; phases: PlanPhase[] }> {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || 'Approved Program';
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean).join('|') === header.join('|'));
  if (start < 0 || !/^\s*\|?\s*:?-+/.test(lines[start + 1] ?? '')) return { ok: false, error: `Plan requires the phase matrix columns: ${header.join(', ')}.` };
  const phases: PlanPhase[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== header.length) return { ok: false, error: 'Every Plan matrix row must contain exactly seven columns.' };
    const [phaseId, phaseTitle, intent, dependencies, acceptance, constraints, excluded] = cells;
    if (!/^[A-Z]\d{2,}$/.test(phaseId) || !phaseTitle || !intent || !acceptance) return { ok: false, error: `Invalid Plan phase row: ${phaseId || '<empty>'}.` };
    phases.push({ phaseId, title: phaseTitle, intent, dependsOn: dependencies === 'None' ? [] : dependencies.split(',').map((value) => value.trim()).filter(Boolean), acceptance, constraints, excluded });
  }
  if (phases.length === 0) return { ok: false, error: 'Plan phase matrix is empty.' };
  const ids = new Set(phases.map((phase) => phase.phaseId));
  if (ids.size !== phases.length) return { ok: false, error: 'Plan phase IDs must be unique.' };
  for (const phase of phases) if (phase.dependsOn.some((id) => !ids.has(id))) return { ok: false, error: `Plan phase ${phase.phaseId} has an unknown dependency.` };
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string): boolean => { if (visiting.has(id)) return false; if (visited.has(id)) return true; visiting.add(id); const phase = phases.find((entry) => entry.phaseId === id)!; if (!phase.dependsOn.every(visit)) return false; visiting.delete(id); visited.add(id); return true; };
  if (!phases.every((phase) => visit(phase.phaseId))) return { ok: false, error: 'Plan phase dependencies must be acyclic.' };
  return { ok: true, value: { title, phases } };
}
async function readPlanContract(input: { manifestFile?: string; planFile?: string }): Promise<Result<{ manifest: string; manifestPath: string; manifestSha256: string; plan: string; planPath: string; planSha256: string; phases: PlanPhase[]; title: string }>> {
  const planPath = resolve(text(input.planFile));
  if (!text(input.planFile)) return { ok: false, error: 'Program operation requires --plan-file.' };
  let plan: string; try { plan = await readFile(planPath, 'utf8'); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Plan read failed.' }; }
  const manifestPath = text(input.manifestFile) ? resolve(text(input.manifestFile)) : planPath;
  let manifest: string; try { manifest = manifestPath === planPath ? plan : await readFile(manifestPath, 'utf8'); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Execution manifest read failed.' }; }
  const parsed = parseApprovedPlan(manifest); if (!parsed.ok) return { ok: false, error: text(input.manifestFile) ? parsed.error.replace('Plan ', 'Execution manifest ') : `${parsed.error} Supply a separately derived matrix with --manifest-file; do not modify the approved Plan.` };
  return { ok: true, value: { manifest, manifestPath, manifestSha256: sha256(manifest), plan, planPath, planSha256: sha256(plan), phases: parsed.value.phases, title: plan.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(planPath, '.md') } };
}
async function verifyProgramSources(state: ProgramState): Promise<Result<true>> {
  try {
    const plan = await readFile(state.planPath, 'utf8');
    if (sha256(plan) !== state.planSha256) return { ok: false, error: 'Approved Plan digest changed; use program-amend before continuing.' };
    const manifestPath = state.executionManifestPath ?? state.planPath;
    const manifest = manifestPath === state.planPath ? plan : await readFile(manifestPath, 'utf8');
    if (sha256(manifest) !== (state.executionManifestSha256 ?? state.planSha256)) return { ok: false, error: 'Execution manifest digest changed; use program-amend before continuing.' };
    return { ok: true, value: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Program source verification failed.' }; }
}
function phaseMarkdown(state: Pick<ProgramState, 'programId' | 'planRevision' | 'planSha256'>, phase: PlanPhase): string {
  return `## Program Identity\n\n- Program ID: \`${state.programId}\`\n- Plan revision: \`${state.planRevision}\`\n- Plan digest: \`${state.planSha256}\`\n- Phase: \`${phase.phaseId}\`\n\n## Intent\n\n${phase.intent}\n\n## Dependencies\n\n${phase.dependsOn.join(', ') || 'None'}\n\n## Acceptance\n\n${phase.acceptance}\n\n## Constraints\n\n${phase.constraints || 'None'}\n\n## Excluded\n\n${phase.excluded || 'None'}\n`;
}
function matrix(state: ProgramState): string {
  return ['## Program Execution', '', '| PHASE | MASTER CARD | STATE | STARTED | ENDED | RESULT |', '|---|---|---|---|---|---|', ...state.phases.map((phase) => `| ${phase.phaseId} | \`${phase.masterCardId}\` | ${phase.state} | ${phase.startedAt ?? ''} | ${phase.endedAt ?? ''} | ${phase.resultSummary.replaceAll('|', '\\|')} |`), ''].join('\n');
}
async function patchCard(id: string, description: string): Promise<Result<Record<string, unknown>>> { return submitTaskMutation({ action: 'patch-card', cardPatch: { id, description } }); }
async function appendNote(cardId: string, body: string): Promise<Result<Record<string, unknown>>> { return submitTaskMutation({ action: 'append-note', note: { id: `note-agent-${Date.now()}-${randomUUID().slice(0, 12)}`, threadId: `thread-${cardId}`, role: 'agent', body } }); }
function receipt(value: unknown): Record<string, unknown> { return JSON.parse(String(value)) as Record<string, unknown>; }
function phaseState(phases: ProgramPhase[], phase: ProgramPhase): PhaseState { return phase.dependsOn.every((id) => phases.find((candidate) => candidate.phaseId === id)?.state === 'COMPLETED') ? 'READY' : 'PLANNED'; }
function samePhaseContract(left: PlanPhase, right: PlanPhase): boolean {
  return JSON.stringify({ phaseId: left.phaseId, title: left.title, intent: left.intent, dependsOn: left.dependsOn, acceptance: left.acceptance, constraints: left.constraints, excluded: left.excluded })
    === JSON.stringify({ phaseId: right.phaseId, title: right.title, intent: right.intent, dependsOn: right.dependsOn, acceptance: right.acceptance, constraints: right.constraints, excluded: right.excluded });
}

export async function createProgram(input: { manifestFile?: string; planFile?: string }): Promise<Result<string>> {
  if (!text(input.planFile)) return { ok: false, error: 'program-create requires --plan-file.' };
  const projectId = text(process.env.DECISION_OS_PROJECT_ID);
  if (!projectId) return { ok: false, error: 'program-create requires DECISION_OS_PROJECT_ID.' };
  const contract = await readPlanContract(input); if (!contract.ok) return contract; const { manifest, manifestPath, manifestSha256, plan: markdown, planPath, planSha256: digest, phases, title } = contract.value;
  const programId = `program-${sha256(`${projectId}\0${planPath}`).slice(0, 16)}`;
  const existing = await readState(programId);
  if (existing.ok) return existing.value.planSha256 === digest && (existing.value.executionManifestSha256 ?? existing.value.planSha256) === manifestSha256 ? { ok: true, value: JSON.stringify({ version: 1, operation: 'program-create', created: false, programId, planSha256: digest, executionManifestSha256: manifestSha256, phases: existing.value.phases.map((phase) => ({ phaseId: phase.phaseId, masterCardId: phase.masterCardId })) }, null, 2) } : { ok: false, error: `Plan or execution manifest changed for ${programId}; use program-amend.` };
  if (!existing.error.startsWith('Program not found:')) return existing;
  const controller = await createMasterTask({ title: `Program - ${title}`, subtasks: ['00 - Program Execution', '01 - Program Decision Ledger', '02 - Approved Plan'] });
  if (!controller.ok) return controller;
  const controllerReceipt = receipt(controller.value); const files = controllerReceipt.files as Array<{ kind: string; cardId: string }>;
  const controllerMasterCardId = files.find((file) => file.kind === 'master-task')?.cardId ?? '';
  const subcards = files.filter((file) => file.kind === 'subtask');
  const now = new Date().toISOString();
  const state: ProgramState = { version: 1, programId, projectId, planPath, planRevision: 1, planSha256: digest, executionManifestPath: manifestPath, executionManifestSha256: manifestSha256, title, createdAt: now, updatedAt: now, controllerMasterCardId, controllerCards: { execution: subcards[0]?.cardId ?? '', decisions: subcards[1]?.cardId ?? '', plan: subcards[2]?.cardId ?? '' }, active: null, phases: [], amendments: [], latestHandoff: '' };
  await writeState(state);
  for (const planPhase of phases) {
    const created = await createMasterTask({ title: `${planPhase.phaseId} - ${planPhase.title}`, subtasks: [] });
    if (!created.ok) return created;
    const masterCardId = (receipt(created.value).files as Array<{ kind: string; cardId: string }>).find((file) => file.kind === 'master-task')?.cardId ?? '';
    const phase: ProgramPhase = { ...planPhase, masterCardId, state: 'PLANNED', resultSummary: '', evidence: [], startedAt: null, endedAt: null };
    state.phases.push(phase); phase.state = phaseState(state.phases, phase);
    const patched = await patchCard(masterCardId, phaseMarkdown(state, phase)); if (!patched.ok) return patched;
    await writeState({ ...state, updatedAt: new Date().toISOString() });
  }
  for (const phase of state.phases) phase.state = phaseState(state.phases, phase);
  const updates = await Promise.all([patchCard(state.controllerCards.execution, matrix(state)), patchCard(state.controllerCards.plan, `## Approved Plan\n\n- Path: \`${planPath}\`\n- Revision: \`1\`\n- SHA-256: \`${digest}\`\n\n${markdown}\n\n## Derived Execution Manifest\n\n- Path: \`${manifestPath}\`\n- SHA-256: \`${manifestSha256}\`\n\n${manifest}`)]);
  const failed = updates.find((result) => !result.ok); if (failed && !failed.ok) return failed;
  await writeState({ ...state, updatedAt: new Date().toISOString() });
  return { ok: true, value: JSON.stringify({ version: 1, operation: 'program-create', created: true, programId, planSha256: digest, executionManifestSha256: manifestSha256, controllerCards: state.controllerCards, phases: state.phases.map((phase) => ({ phaseId: phase.phaseId, masterCardId: phase.masterCardId, state: phase.state })) }, null, 2) };
}

export async function programContext(input: { programId?: string }): Promise<Result<string>> {
  const loaded = await readState(input.programId); if (!loaded.ok) return loaded; const state = loaded.value;
  return { ok: true, value: [`PROGRAM: ${state.programId}`, `PLAN: revision ${state.planRevision} / sha256:${state.planSha256}`, `COMPLETED: ${state.phases.filter((p) => p.state === 'COMPLETED').map((p) => p.phaseId).join(', ') || 'none'}`, `ACTIVE: ${state.active ? `${state.active.phaseId} / ${state.active.masterCardId} / ${state.active.attemptId} / ${state.active.startedAt}` : 'none'}`, `BLOCKED: ${state.phases.filter((p) => p.state === 'BLOCKED').map((p) => `${p.phaseId}: ${p.resultSummary}`).join('; ') || 'none'}`, `READY: ${state.phases.filter((p) => p.state === 'READY').map((p) => p.phaseId).join(', ') || 'none'}`, `LATEST_HANDOFF: ${state.latestHandoff || 'none'}`, `PENDING_DECISIONS: none`].join('\n') };
}

export function parseProgramReconciliation(source: string): Result<ReconciliationDecision[]> {
  let value: unknown; try { value = JSON.parse(source); } catch { return { ok: false, error: 'Program reconciliation must be valid JSON.' }; }
  const phases = value && typeof value === 'object' && !Array.isArray(value) ? (value as { phases?: unknown }).phases : undefined;
  if (!Array.isArray(phases) || phases.length === 0) return { ok: false, error: 'Program reconciliation requires a non-empty phases array.' };
  const decisions: ReconciliationDecision[] = [];
  for (const candidate of phases) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return { ok: false, error: 'Every reconciliation decision must be an object.' };
    const record = candidate as Record<string, unknown>; const phaseId = text(record.phaseId); const state = text(record.state); const summary = text(record.summary); const evidence = Array.isArray(record.evidence) ? record.evidence.map(text).filter(Boolean) : [];
    if (!/^[A-Z]\d{2,}$/.test(phaseId) || !['COMPLETED', 'FAILED', 'BLOCKED'].includes(state) || !summary) return { ok: false, error: `Invalid reconciliation decision: ${phaseId || '<empty>'}.` };
    if (state === 'COMPLETED' && evidence.length === 0) return { ok: false, error: `Completed reconciliation requires evidence: ${phaseId}.` };
    decisions.push({ phaseId, state: state as ReconciliationDecision['state'], summary, evidence });
  }
  if (new Set(decisions.map((decision) => decision.phaseId)).size !== decisions.length) return { ok: false, error: 'Program reconciliation phase ids must be unique.' };
  return { ok: true, value: decisions };
}

export async function reconcileProgram(input: { programId?: string; reconciliation?: string }): Promise<Result<string>> {
  const loaded = await readState(input.programId); if (!loaded.ok) return loaded; const state = loaded.value;
  if (state.active) return { ok: false, error: 'program-reconcile requires no active iteration.' };
  const verified = await verifyProgramSources(state); if (!verified.ok) return verified;
  const parsed = parseProgramReconciliation(text(input.reconciliation)); if (!parsed.ok) return parsed;
  const incoming = new Map(parsed.value.map((decision) => [decision.phaseId, decision]));
  for (const decision of parsed.value) if (!state.phases.some((phase) => phase.phaseId === decision.phaseId)) return { ok: false, error: `Program phase not found: ${decision.phaseId}` };
  for (const decision of parsed.value.filter((candidate) => candidate.state === 'COMPLETED')) {
    const phase = state.phases.find((candidate) => candidate.phaseId === decision.phaseId)!;
    const incomplete = phase.dependsOn.filter((id) => state.phases.find((candidate) => candidate.phaseId === id)?.state !== 'COMPLETED' && incoming.get(id)?.state !== 'COMPLETED');
    if (incomplete.length) return { ok: false, error: `Reconciled completion ${phase.phaseId} has incomplete dependencies: ${incomplete.join(', ')}.` };
  }
  const reconciledAt = new Date().toISOString();
  for (const decision of parsed.value) {
    const phase = state.phases.find((candidate) => candidate.phaseId === decision.phaseId)!; phase.state = decision.state; phase.resultSummary = decision.summary; phase.evidence = decision.evidence; phase.endedAt = reconciledAt;
  }
  for (const phase of state.phases) if (phase.state === 'PLANNED' || phase.state === 'READY') phase.state = phaseState(state.phases, phase);
  state.updatedAt = reconciledAt; state.latestHandoff = `Reconciled existing Plan evidence: ${parsed.value.map((decision) => `${decision.phaseId}=${decision.state}`).join(', ')}`;
  const decisionNote = await appendNote(state.controllerCards.decisions, [`${reconciledAt} | PROGRAM RECONCILIATION`, ...parsed.value.map((decision) => `${decision.phaseId} | ${decision.state} | ${decision.summary} | ${decision.evidence.join('; ') || 'no evidence claimed'}`)].join('\n')); if (!decisionNote.ok) return decisionNote;
  const executionNote = await appendNote(state.controllerCards.execution, `${reconciledAt} | RECONCILED | ${parsed.value.map((decision) => `${decision.phaseId}=${decision.state}`).join(', ')}`); if (!executionNote.ok) return executionNote;
  const matrixUpdate = await patchCard(state.controllerCards.execution, matrix(state)); if (!matrixUpdate.ok) return matrixUpdate; await writeState(state);
  return { ok: true, value: JSON.stringify({ version: 1, operation: 'program-reconcile', programId: state.programId, reconciled: parsed.value.map((decision) => ({ phaseId: decision.phaseId, state: decision.state })), ready: state.phases.filter((phase) => phase.state === 'READY').map((phase) => phase.phaseId) }, null, 2) };
}

export async function startIteration(input: { programId?: string; phaseId?: string }): Promise<Result<string>> {
  const loaded = await readState(input.programId); if (!loaded.ok) return loaded; const state = loaded.value;
  const verified = await verifyProgramSources(state); if (!verified.ok) return verified;
  const phase = state.phases.find((candidate) => candidate.phaseId === text(input.phaseId));
  if (!phase) return { ok: false, error: `Program phase not found: ${text(input.phaseId)}` };
  if (state.active) return { ok: false, error: `Program already has an active phase: ${state.active.phaseId}.` };
  if (phase.state !== 'READY' && phase.state !== 'FAILED' && phase.state !== 'BLOCKED') return { ok: false, error: `Phase ${phase.phaseId} is not startable from ${phase.state}.` };
  const prompt = await queryPipelinePrompts({ action: 'query', names: ['GateAgent', 'Software-Iteration-Graph', 'CLI_TOOLS', 'GIT_HYGIENE'] }); if (!prompt.ok) return prompt;
  const chronology = await createSubtask({ masterCardId: phase.masterCardId, title: '00 - Chronologic Execution', purpose: '## Execution\n\n| PHASE | STATE | STARTED | ENDED |\n|---|---|---|---|\n' }); if (!chronology.ok) return chronology;
  const decisions = await createSubtask({ masterCardId: phase.masterCardId, title: '01 - Decision Ledger', purpose: '## Decisions\n\nNo decisions recorded.\n' }); if (!decisions.ok) return decisions;
  const attemptId = `attempt-${randomUUID()}`; const startedAt = new Date().toISOString();
  state.active = { phaseId: phase.phaseId, masterCardId: phase.masterCardId, attemptId, startedAt }; phase.state = 'ACTIVE'; phase.startedAt = startedAt; phase.endedAt = null; state.updatedAt = startedAt;
  const logged = await appendNote(state.controllerCards.execution, `${startedAt} | ${phase.phaseId} | ACTIVE | ${attemptId} | ${phase.masterCardId}`); if (!logged.ok) return logged;
  const matrixUpdate = await patchCard(state.controllerCards.execution, matrix(state)); if (!matrixUpdate.ok) return matrixUpdate; await writeState(state);
  return { ok: true, value: ['# Program Iteration Assignment', '', `PROGRAM_ID: ${state.programId}`, `PHASE_ID: ${phase.phaseId}`, `MASTER_CARD_ID: ${phase.masterCardId}`, `ATTEMPT_ID: ${attemptId}`, '', phaseMarkdown(state, phase), '---', '', prompt.value, '', '---', '', '# Iteration Return Contract', '', 'Return the standard SUMMARY with STATUS, DONE, CHANGED, EVIDENCE, OPEN, and SUGGESTION. Do not start another Plan phase.'].join('\n') };
}

function summaryField(summary: string, name: string): string { return summary.match(new RegExp(`^${name}:\\s*(.*)$`, 'mi'))?.[1]?.trim() ?? ''; }
export async function finishIteration(input: { attemptId?: string; phaseId?: string; programId?: string; summary?: string }): Promise<Result<string>> {
  const loaded = await readState(input.programId); if (!loaded.ok) return loaded; const state = loaded.value;
  if (!state.active || state.active.phaseId !== text(input.phaseId) || state.active.attemptId !== text(input.attemptId)) return { ok: false, error: 'iteration-finish attempt does not own the active phase.' };
  const verified = await verifyProgramSources(state); if (!verified.ok) return verified;
  const summary = text(input.summary); const status = summaryField(summary, 'STATUS'); const evidence = summaryField(summary, 'EVIDENCE');
  if (!['COMPLETED', 'FAILED', 'BLOCKED'].includes(status)) return { ok: false, error: 'Iteration summary requires STATUS: COMPLETED | FAILED | BLOCKED.' };
  if (status === 'COMPLETED' && (!evidence || evidence.toLowerCase() === 'none')) return { ok: false, error: 'A completed iteration requires non-empty EVIDENCE.' };
  const phase = state.phases.find((candidate) => candidate.phaseId === state.active!.phaseId)!; const endedAt = new Date().toISOString();
  phase.state = status as PhaseState; phase.resultSummary = summaryField(summary, 'DONE'); phase.evidence = evidence ? [evidence] : []; phase.endedAt = endedAt; state.latestHandoff = summary.replace(/\s+/g, ' ').slice(0, 2000); state.active = null;
  for (const candidate of state.phases) if (candidate.state === 'PLANNED') candidate.state = phaseState(state.phases, candidate);
  state.updatedAt = endedAt; const logged = await appendNote(state.controllerCards.execution, `${endedAt} | ${phase.phaseId} | ${status} | ${text(input.attemptId)} | ${phase.resultSummary}`); if (!logged.ok) return logged;
  const matrixUpdate = await patchCard(state.controllerCards.execution, matrix(state)); if (!matrixUpdate.ok) return matrixUpdate; await writeState(state);
  return { ok: true, value: JSON.stringify({ version: 1, operation: 'iteration-finish', programId: state.programId, phaseId: phase.phaseId, state: phase.state, ready: state.phases.filter((candidate) => candidate.state === 'READY').map((candidate) => candidate.phaseId) }, null, 2) };
}

export async function amendProgram(input: { manifestFile?: string; planFile?: string; programId?: string }): Promise<Result<string>> {
  const loaded = await readState(input.programId); if (!loaded.ok) return loaded; const state = loaded.value;
  if (state.active) return { ok: false, error: 'program-amend requires no active iteration.' };
  if (!text(input.planFile)) return { ok: false, error: 'program-amend requires --plan-file.' };
  const retainedManifest = state.executionManifestPath && state.executionManifestPath !== state.planPath ? state.executionManifestPath : undefined;
  const contract = await readPlanContract({ planFile: input.planFile, manifestFile: input.manifestFile ?? retainedManifest }); if (!contract.ok) return contract;
  const { manifest, manifestPath, manifestSha256, plan: markdown, planPath, planSha256: digest, phases, title } = contract.value;
  if (digest === state.planSha256 && manifestSha256 === (state.executionManifestSha256 ?? state.planSha256)) return { ok: false, error: 'Approved Plan and execution manifest are byte-identical to the accepted sources.' };
  const incoming = new Map(phases.map((phase) => [phase.phaseId, phase]));
  for (const phase of state.phases.filter((candidate) => candidate.state === 'COMPLETED')) {
    const next = incoming.get(phase.phaseId); if (!next || !samePhaseContract(phase, next)) return { ok: false, error: `Completed phase contract cannot change: ${phase.phaseId}.` };
  }
  const oldSha = state.planSha256; const changed: string[] = [];
  for (const planPhase of phases) {
    const phase = state.phases.find((candidate) => candidate.phaseId === planPhase.phaseId);
    if (phase) { if (!samePhaseContract(phase, planPhase)) changed.push(phase.phaseId); Object.assign(phase, planPhase); }
    else { const created = await createMasterTask({ title: `${planPhase.phaseId} - ${planPhase.title}`, subtasks: [] }); if (!created.ok) return created; const masterCardId = (receipt(created.value).files as Array<{ kind: string; cardId: string }>).find((file) => file.kind === 'master-task')?.cardId ?? ''; state.phases.push({ ...planPhase, masterCardId, state: 'PLANNED', resultSummary: '', evidence: [], startedAt: null, endedAt: null }); changed.push(planPhase.phaseId); }
  }
  for (const phase of state.phases) if (!incoming.has(phase.phaseId) && phase.state !== 'COMPLETED') { phase.state = 'SUPERSEDED'; changed.push(phase.phaseId); }
  state.planRevision += 1; state.planSha256 = digest; state.planPath = planPath; state.executionManifestPath = manifestPath; state.executionManifestSha256 = manifestSha256; state.title = title; for (const phase of state.phases) if (!['COMPLETED', 'SUPERSEDED'].includes(phase.state)) phase.state = phaseState(state.phases, phase);
  const amendment = { id: `A${String(state.amendments.length + 1).padStart(2, '0')}`, fromRevision: state.planRevision - 1, toRevision: state.planRevision, oldSha256: oldSha, newSha256: digest, changedPhaseIds: [...new Set(changed)], createdAt: new Date().toISOString() }; state.amendments.push(amendment); state.updatedAt = amendment.createdAt;
  for (const phase of state.phases.filter((candidate) => candidate.state !== 'SUPERSEDED')) { const patched = await patchCard(phase.masterCardId, phaseMarkdown(state, phase)); if (!patched.ok) return patched; }
  const decision = await appendNote(state.controllerCards.decisions, `${amendment.id} | revision ${amendment.fromRevision} -> ${amendment.toRevision} | ${amendment.changedPhaseIds.join(', ')} | ${oldSha} -> ${digest}`); if (!decision.ok) return decision;
  const planUpdate = await patchCard(state.controllerCards.plan, `## Approved Plan\n\n- Path: \`${planPath}\`\n- Revision: \`${state.planRevision}\`\n- SHA-256: \`${digest}\`\n\n${markdown}\n\n## Derived Execution Manifest\n\n- Path: \`${manifestPath}\`\n- SHA-256: \`${manifestSha256}\`\n\n${manifest}`); if (!planUpdate.ok) return planUpdate; await writeState(state);
  return { ok: true, value: JSON.stringify({ version: 1, operation: 'program-amend', programId: state.programId, amendment, ready: state.phases.filter((phase) => phase.state === 'READY').map((phase) => phase.phaseId) }, null, 2) };
}

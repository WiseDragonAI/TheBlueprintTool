/**
 * WHAT: Starts one registered phase by creating its card and returning its full bounded subagent assignment.
 * WHY: the main agent should delegate one tiny command instead of reconstructing prompts, IDs, and graph context.
 */
import { randomUUID } from 'node:crypto';
import type { Result } from '../../../lib/types.js';
import { queryPipelinePrompts } from '../../prompt/helper/query-pipeline-prompts.js';
import { submitTaskMutation } from '../effect/submit-task-mutation.js';
import { createSubtask } from './create-subtask.js';
import { phaseAgentNames, phaseAgentRegistry, type PhaseAgentName } from './phase-agent-registry.js';
import { resolveMasterTaskOwner } from './resolve-master-task-owner.js';

type JsonObject = Record<string, unknown>;

function record(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function titleSuffix(title: unknown): string {
  return String(title ?? '').trim().replace(/^\d{2} - /, '');
}

function assignmentMarkdown(input: {
  attemptId: string;
  contextIds: string[];
  definition: (typeof phaseAgentRegistry)[PhaseAgentName];
  masterCardId: string;
  outputPath: string;
}): string {
  return [
    '## Assignment',
    '',
    `- Objective: Execute the registered \`${input.definition.promptName}\` phase for master card \`${input.masterCardId}\`.`,
    `- Phase prompt: \`${input.definition.promptName}\``,
    `- Agent profile: \`${input.definition.model} / ${input.definition.effort}\``,
    `- Attempt ID: \`${input.attemptId}\``,
    `- Context cards: ${input.contextIds.map((id) => `\`${id}\``).join(', ') || 'None'}`,
    '- Constraints: Follow the registered prompt and repository instructions. Do not select or dispatch the next graph step.',
    '',
    '## Deliverable Matrix',
    '',
    '| DELIVERABLE | DESTINATION | ACCEPTANCE EVIDENCE | REQUIRED |',
    '|---|---|---|---|',
    `| Complete ${input.definition.title} phase artifact | \`${input.outputPath}\` | Registered prompt completion contract and concrete evidence | yes |`,
    '| Compact handoff summary | Subagent final response | STATUS, DONE, CHANGED, EVIDENCE, OPEN, SUGGESTION | yes |',
    '',
    '## Return Contract',
    '',
    'Write the phase artifact to the destination above. Then return:',
    '',
    '```text',
    'SUMMARY',
    'STATUS: COMPLETED | FAILED | BLOCKED',
    'DONE: <one to three sentences>',
    'CHANGED: <paths and card IDs, or none>',
    'EVIDENCE: <tests, commands, findings, and artifact paths>',
    'OPEN: <unresolved issues, or none>',
    'SUGGESTION: <optional non-binding next action, or none>',
    '```',
    '',
  ].join('\n');
}

async function fetchCard(input: { cardId: string; ledgerId: string; projectId: string; serverUrl: string }): Promise<Result<JsonObject>> {
  const response = await fetch(`${input.serverUrl}/p/${encodeURIComponent(input.projectId)}/api/ledgers/${encodeURIComponent(input.ledgerId)}/cards/${encodeURIComponent(input.cardId)}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return { ok: false, error: `Phase context read failed (${response.status}) for ${input.cardId}: ${await response.text()}` };
  const value: unknown = await response.json();
  return record(value) ? { ok: true, value } : { ok: false, error: `Phase context returned invalid content for ${input.cardId}.` };
}

export async function startPhase(input: { masterCardId?: string; phase?: string }): Promise<Result<string>> {
  const phase = String(input.phase ?? '').trim();
  if (!(phase in phaseAgentRegistry)) return { ok: false, error: `phase-start requires --phase with one of: ${phaseAgentNames().join(', ')}.` };
  const definition = phaseAgentRegistry[phase as PhaseAgentName];
  const owner = await resolveMasterTaskOwner(input.masterCardId);
  if (!owner.ok) return owner;
  try {
    const projectionResponse = await fetch(`${owner.value.serverUrl}/api/task-state/projection?projectId=${encodeURIComponent(owner.value.projectId)}`, { signal: AbortSignal.timeout(10_000) });
    if (!projectionResponse.ok) return { ok: false, error: `Task projection failed (${projectionResponse.status}): ${await projectionResponse.text()}` };
    const projection = await projectionResponse.json() as { ledger?: JsonObject };
    const ledger = record(projection.ledger) ? projection.ledger : {};
    const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(record) : [];
    const relationships = Array.isArray(ledger.relationships) ? ledger.relationships.filter(record) : [];
    const linkedIds = relationships
      .filter((relationship) => String(relationship.from ?? '') === owner.value.masterCardId && String(relationship.label ?? '') === 'subtask')
      .sort((left, right) => Number(left.position) - Number(right.position))
      .map((relationship) => String(relationship.to ?? ''));
    const linkedCards = linkedIds.map((id) => cards.find((card) => String(card.id ?? '') === id)).filter(record);
    const chronology = linkedCards.find((card) => titleSuffix(card.title) === 'Chronologic Execution');
    if (!chronology) return { ok: false, error: 'phase-start requires the master subcard NN - Chronologic Execution.' };
    const contextCards: JsonObject[] = [];
    const master = cards.find((card) => String(card.id ?? '') === owner.value.masterCardId);
    if (!master) return { ok: false, error: `Master task not found: ${owner.value.masterCardId}` };
    contextCards.push(master);
    for (const requiredTitle of definition.requiredCardTitles) {
      const card = linkedCards.find((candidate) => titleSuffix(candidate.title) === requiredTitle);
      if (!card) return { ok: false, error: `phase-start ${phase} requires the subcard: ${requiredTitle}.` };
      contextCards.push(card);
    }
    const existing = linkedCards.find((card) => titleSuffix(card.title) === definition.title);
    const nextPosition = relationships.filter((relationship) => String(relationship.from ?? '') === owner.value.masterCardId && String(relationship.label ?? '') === 'subtask').reduce((maximum, relationship) => Math.max(maximum, Number(relationship.position) || 0), -1) + 1;
    const title = existing ? String(existing.title) : `${String(nextPosition).padStart(2, '0')} - ${definition.title}`;
    const attemptId = `attempt-${randomUUID()}`;
    const provisional = assignmentMarkdown({ attemptId, contextIds: contextCards.map((card) => String(card.id ?? '')), definition, masterCardId: owner.value.masterCardId, outputPath: '<server-created-card-path>' });
    const created = await createSubtask({ masterCardId: owner.value.masterCardId, title, purpose: provisional });
    if (!created.ok) return created;
    const receipt = JSON.parse(created.value) as { cardId?: unknown; path?: unknown };
    const cardId = String(receipt.cardId ?? '').trim();
    const outputPath = String(receipt.path ?? '').trim();
    if (!cardId || !outputPath) return { ok: false, error: 'phase-start received an incomplete subtask receipt.' };
    const assignment = assignmentMarkdown({ attemptId, contextIds: contextCards.map((card) => String(card.id ?? '')), definition, masterCardId: owner.value.masterCardId, outputPath });
    const patched = await submitTaskMutation({ action: 'patch-card', cardPatch: { id: cardId, description: assignment } });
    if (!patched.ok) return { ok: false, error: `phase-card-assignment: ${patched.error}` };
    const note = await submitTaskMutation({
      action: 'append-note',
      note: {
        id: `note-agent-${Date.now()}-${randomUUID().slice(0, 12)}`,
        threadId: `thread-${String(chronology.id ?? '')}`,
        role: 'agent',
        body: `${new Date().toISOString()} | ${cardId} | DISPATCHED | ${attemptId} | ${phase} via ${definition.promptName}`,
      },
    });
    if (!note.ok) return { ok: false, error: `phase-chronology-dispatch: ${note.error}` };
    const [prompt, ...contextResults] = await Promise.all([
      queryPipelinePrompts({ action: 'query', names: [definition.promptName] }),
      ...contextCards.map((card) => fetchCard({ cardId: String(card.id ?? ''), ledgerId: owner.value.ledgerId, projectId: owner.value.projectId, serverUrl: owner.value.serverUrl })),
    ]);
    if (!prompt.ok) return prompt;
    const contextDocuments: string[] = [];
    for (const result of contextResults) {
      if (!result.ok) return result;
      const comment = record(result.value.comment) ? result.value.comment : {};
      contextDocuments.push([`# Context Card: ${String(result.value.title ?? result.value.id ?? '')}`, '', String(comment.what ?? '').trim() || '_No card body._'].join('\n'));
    }
    return { ok: true, value: [
      '# Phase Assignment',
      '',
      assignment,
      '---',
      '',
      prompt.value,
      '',
      '---',
      '',
      '# Bounded Context',
      '',
      contextDocuments.join('\n\n---\n\n'),
    ].join('\n') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'phase-start failed.' };
  }
}

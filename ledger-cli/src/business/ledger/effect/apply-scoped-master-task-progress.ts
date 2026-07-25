/**
 * WHAT: Applies one master-task progress plan through scoped card and note mutations.
 * WHY: Progress reporting must preserve replicated lifecycle authority and avoid aggregate task writes.
 */
import { randomUUID } from 'node:crypto';
import type { Result } from '../../../lib/types.js';
import {
  parseMasterTaskProgressPlan,
  renderMasterTaskProgressSections,
} from '../helper/apply-master-task-progress.js';
import { hydrateLedgerCardContent } from '../helper/card-content-file.js';
import { canonicalSubtaskRelationships, isMasterCard, labelsOf, record, stripLegacyTaskProjection } from '../helper/master-task-model.js';
import { readLedgerJson } from '../helper/read-ledger-json.js';
import { hydrateLedgerThreadNotesFor } from '../helper/thread-content-file.js';
import { validateMasterTasks } from '../helper/validate-master-tasks.js';
import { submitTaskMutation } from './submit-task-mutation.js';

type JsonObject = Record<string, unknown>;

async function mutate(step: string, mutation: JsonObject): Promise<Result<JsonObject>> {
  const result = await submitTaskMutation(mutation);
  return result.ok ? result : { ok: false, error: `${step}: ${result.error}` };
}

export async function applyScopedMasterTaskProgress(input: { ledgerJsonFile: string; planJson: string }): Promise<Result<string>> {
  const parsed = parseMasterTaskProgressPlan(input.planJson);
  if (!parsed.ok) return parsed;
  const current = await readLedgerJson(input.ledgerJsonFile);
  if (!current.ok) return current;
  if (!record(current.value)) return { ok: false, error: 'Master-task progress requires an object task projection.' };
  const ledger = current.value;
  const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(record) : [];
  const master = cards.find((card) => String(card.id ?? '') === parsed.value.masterCardId);
  if (!master) return { ok: false, error: `Card not found: ${parsed.value.masterCardId}` };
  if (!isMasterCard(master)) return { ok: false, error: `Card is not a master task: ${parsed.value.masterCardId}` };
  const relationships = canonicalSubtaskRelationships(ledger, parsed.value.masterCardId);
  const subtaskIds = new Set(relationships.map((relationship) => String(relationship.to ?? '')));
  const affected = new Set([parsed.value.masterCardId, ...subtaskIds]);
  if (new Set(parsed.value.updates.map((update) => update.cardId)).size !== parsed.value.updates.length) {
    return { ok: false, error: 'Progress updates contain duplicate card ids.' };
  }
  if (parsed.value.updates.some((update) => !affected.has(update.cardId))) {
    return { ok: false, error: 'Progress updates may only target the master and canonical subtasks.' };
  }
  if (parsed.value.verifiedSubtaskIds.some((id) => !subtaskIds.has(id))) {
    return { ok: false, error: 'Every verified subtask id must belong to the master.' };
  }
  const incomplete = parsed.value.verifiedSubtaskIds.filter((id) => String(cards.find((card) => String(card.id ?? '') === id)?.status ?? '') !== 'done');
  if (incomplete.length > 0) return { ok: false, error: `Verified subtasks require scoped lifecycle completion first: ${incomplete.join(',')}` };

  for (const update of parsed.value.updates) {
    const markdown = `${stripLegacyTaskProjection(update.markdown ?? renderMasterTaskProgressSections(update.sections ?? [])).trimEnd()}\n`;
    const targetIsMaster = update.cardId === parsed.value.masterCardId;
    const labels = update.labels
      ? [...new Set(update.labels.filter((label) => label !== 'master-task' && label !== 'subtask').concat(targetIsMaster ? ['master-task'] : ['subtask']))]
      : undefined;
    const patched = await mutate(`patch-progress:${update.cardId}`, {
      action: 'patch-card',
      cardPatch: {
        id: update.cardId,
        ...(update.title ? { title: update.title } : {}),
        ...(labels ? { labels } : {}),
        description: markdown,
      },
    });
    if (!patched.ok) return patched;
  }

  const noteId = `note-agent-${Date.now()}-${randomUUID().slice(0, 12)}`;
  const replied = await mutate('append-progress-reply', {
    action: 'append-note',
    note: { id: noteId, threadId: `thread-${parsed.value.masterCardId}`, role: 'agent', body: parsed.value.reply },
  });
  if (!replied.ok) return replied;

  const verified = await readLedgerJson(input.ledgerJsonFile);
  if (!verified.ok) return verified;
  const hydratedVerified = await hydrateLedgerCardContent(verified.value, input.ledgerJsonFile);
  await hydrateLedgerThreadNotesFor(hydratedVerified, input.ledgerJsonFile, `thread-${parsed.value.masterCardId}`);
  const validation = validateMasterTasks(hydratedVerified, parsed.value.masterCardId);
  if (validation.errors.length > 0) {
    return { ok: false, error: JSON.stringify({ version: 1, code: 'invalid_master_task', validation }) };
  }
  const verifiedLedger = record(hydratedVerified) ? hydratedVerified : {};
  const statuses = new Map(
    Array.isArray(verifiedLedger.cards)
      ? verifiedLedger.cards.filter(record).map((card) => [String(card.id ?? ''), String(card.status ?? '')])
      : [],
  );
  const verifiedCards = Array.isArray(verifiedLedger.cards) ? verifiedLedger.cards.filter(record) : [];
  for (const update of parsed.value.updates) {
    const card = verifiedCards.find((candidate) => String(candidate.id ?? '') === update.cardId);
    if (!card) return { ok: false, error: `Progress verification card not found: ${update.cardId}` };
    const expectedMarkdown = `${stripLegacyTaskProjection(update.markdown ?? renderMasterTaskProgressSections(update.sections ?? [])).trimEnd()}\n`;
    const comment = record(card.comment) ? card.comment : {};
    if (String(comment.what ?? '') !== expectedMarkdown) return { ok: false, error: `Progress content verification failed: ${update.cardId}` };
    if (update.title && String(card.title ?? '') !== update.title) return { ok: false, error: `Progress title verification failed: ${update.cardId}` };
    if (update.labels) {
      const canonicalLabel = update.cardId === parsed.value.masterCardId ? 'master-task' : 'subtask';
      const expectedLabels = [...new Set(update.labels.filter((label) => label !== 'master-task' && label !== 'subtask').concat(canonicalLabel))];
      if (JSON.stringify(labelsOf(card)) !== JSON.stringify(expectedLabels)) return { ok: false, error: `Progress label verification failed: ${update.cardId}` };
    }
  }
  const verifiedNotes = record(verifiedLedger.notes) ? verifiedLedger.notes : {};
  const threadNotes = verifiedNotes[`thread-${parsed.value.masterCardId}`];
  const notes = Array.isArray(threadNotes) ? threadNotes.filter(record) : [];
  if (!notes.some((note) => String(note.id ?? '') === noteId && String(note.message ?? note.body ?? '') === parsed.value.reply)) {
    return { ok: false, error: 'Progress reply verification failed.' };
  }
  const discrepancies = [...subtaskIds].filter((id) => statuses.get(id) !== 'done').map((id) => `linked_card_not_done:${id}`);
  return {
    ok: true,
    value: JSON.stringify({
      version: 2,
      masterCardId: parsed.value.masterCardId,
      updatedCardIds: parsed.value.updates.map((update) => update.cardId),
      verifiedSubtaskIds: parsed.value.verifiedSubtaskIds,
      replyNoteId: noteId,
      gate: { ready: discrepancies.length === 0, discrepancies },
    }, null, 2),
  };
}

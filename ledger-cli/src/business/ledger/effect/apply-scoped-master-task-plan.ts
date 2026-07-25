/**
 * WHAT: Applies an ID-free master-task plan as scoped causal Tasks mutations.
 * WHY: The prompt contract must remain stable after aggregate task writes are removed.
 */
import { randomUUID } from 'node:crypto';
import type { Result } from '../../../lib/types.js';
import {
  parseMasterTaskPlan,
  renderMasterTaskSections,
  type MasterTaskPlan,
} from '../helper/apply-master-task-plan.js';
import { hydrateLedgerCardContent } from '../helper/card-content-file.js';
import { canonicalSubtaskRelationships, isMasterCard, record } from '../helper/master-task-model.js';
import { readLedgerJson } from '../helper/read-ledger-json.js';
import { resolveCardZone } from '../helper/resolve-ledger-zone-context.js';
import { validateMasterTasks } from '../helper/validate-master-tasks.js';
import { submitTaskMutation } from './submit-task-mutation.js';

type JsonObject = Record<string, unknown>;
type PlannedSubtask = {
  cardId: string;
  relationshipId: string;
  activationNoteId: string;
  title: string;
  markdown: string;
  position: number;
};
type Geometry = { x: number; y: number; width: number; height: number };

function number(value: unknown, fallback = 0): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function planGeometry(ledger: JsonObject, zone: JsonObject, masterId: string, subtasks: PlannedSubtask[]): {
  cards: Record<string, Geometry>;
  zone: Geometry;
} {
  const graphIds = new Set([masterId, ...subtasks.map((subtask) => subtask.cardId)]);
  const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(record) : [];
  const annotations = Array.isArray(ledger.annotations) ? ledger.annotations.filter(record) : [];
  const occupied = [...cards.filter((card) => !graphIds.has(String(card.id ?? ''))), ...annotations.filter((entry) => String(entry.id ?? '') !== String(zone.id ?? ''))];
  const maxRight = occupied.reduce((maximum, entry) => Math.max(maximum, number(entry.x) + number(entry.w ?? entry.width)), 0);
  const zoneX = occupied.length > 0 ? maxRight + 200 : number(zone.x);
  const zoneY = number(zone.y);
  const padding = 60;
  const cardWidth = 340;
  const cardHeight = 380;
  const columnGap = 40;
  const rowGap = 30;
  const count = graphIds.size;
  const columns = Math.max(1, Math.min(3, count));
  const rows = Math.ceil(count / columns);
  const cardGeometry: Record<string, Geometry> = {};
  for (const [index, cardId] of [...graphIds].entries()) {
    cardGeometry[cardId] = {
      x: zoneX + padding + (index % columns) * (cardWidth + columnGap),
      y: zoneY + padding + Math.floor(index / columns) * (cardHeight + rowGap),
      width: cardWidth,
      height: cardHeight,
    };
  }
  return {
    cards: cardGeometry,
    zone: {
      x: zoneX,
      y: zoneY,
      width: padding * 2 + columns * cardWidth + (columns - 1) * columnGap,
      height: padding * 2 + rows * cardHeight + (rows - 1) * rowGap,
    },
  };
}

function preparedSubtasks(plan: MasterTaskPlan): PlannedSubtask[] {
  return plan.subtasks.map((subtask, position) => ({
    cardId: `card-${randomUUID()}`,
    relationshipId: `rel-${randomUUID()}`,
    activationNoteId: `note-agent-${Date.now()}-${randomUUID().slice(0, 12)}`,
    title: subtask.title,
    markdown: `${(subtask.markdown ?? renderMasterTaskSections(subtask.sections ?? [])).trimEnd()}\n`,
    position,
  }));
}

async function mutate(step: string, mutation: JsonObject): Promise<Result<JsonObject>> {
  const result = await submitTaskMutation(mutation);
  return result.ok ? result : { ok: false, error: `${step}: ${result.error}` };
}

export async function applyScopedMasterTaskPlan(input: { ledgerJsonFile: string; planJson: string }): Promise<Result<string>> {
  const parsed = parseMasterTaskPlan(input.planJson);
  if (!parsed.ok) return parsed;
  const current = await readLedgerJson(input.ledgerJsonFile);
  if (!current.ok) return current;
  if (!record(current.value)) return { ok: false, error: 'Master-task apply requires an object task projection.' };
  const ledger = current.value;
  const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(record) : [];
  const annotations = Array.isArray(ledger.annotations) ? ledger.annotations.filter(record) : [];
  const zones = annotations.filter((annotation) => String(annotation.variant ?? '') === 'zone' || String(annotation.variant ?? '') === '');
  const master = cards.find((card) => String(card.id ?? '') === parsed.value.masterCardId);
  if (!master) return { ok: false, error: `Card not found: ${parsed.value.masterCardId}` };
  const zone = resolveCardZone(master, zones);
  if (!zone) return { ok: false, error: `Owning zone not found: ${parsed.value.masterCardId}` };
  if (canonicalSubtaskRelationships(ledger, parsed.value.masterCardId).length > 0) {
    return { ok: false, error: 'master-task-apply requires a master without existing canonical subtasks.' };
  }

  const subtasks = preparedSubtasks(parsed.value);
  const geometry = planGeometry(ledger, zone, parsed.value.masterCardId, subtasks);
  const masterMarkdown = `${(parsed.value.masterMarkdown ?? renderMasterTaskSections(parsed.value.sections ?? [])).trimEnd()}\n`;
  const masterPatch = await mutate('patch-master', {
    action: 'patch-card',
    cardPatch: { id: parsed.value.masterCardId, title: parsed.value.title, description: masterMarkdown },
  });
  if (!masterPatch.ok) return masterPatch;

  const regionPatch = await mutate('patch-zone', {
    action: 'patch-region',
    region: { id: String(zone.id ?? ''), kind: 'zone', label: parsed.value.zoneTitle ?? parsed.value.title },
  });
  if (!regionPatch.ok) return regionPatch;

  const now = new Date().toISOString();
  for (const subtask of subtasks) {
    const cardGeometry = geometry.cards[subtask.cardId];
    const created = await mutate(`create-subtask:${subtask.position}`, {
      action: 'create-card',
      card: {
        id: subtask.cardId,
        title: subtask.title,
        cardType: 'note',
        domainId: String(master.domainId ?? 'tasks'),
        status: 'todo',
        lifecycle: { status: 'todo', changedAt: now, waitingAt: now, closedAt: null },
        createdAt: now,
        labels: ['subtask'],
        x: cardGeometry.x,
        y: cardGeometry.y,
        w: cardGeometry.width,
        h: cardGeometry.height,
        comment: { what: subtask.markdown },
        facts: [],
        fields: [],
      },
    });
    if (!created.ok) return created;
    const activated = await mutate(`activate-subtask:${subtask.position}`, {
      action: 'append-note',
      note: {
        id: subtask.activationNoteId,
        threadId: `thread-${subtask.cardId}`,
        role: 'agent',
        body: 'Created and activated by `master-task-apply` from the validated plan.',
      },
    });
    if (!activated.ok) return activated;
    const linked = await mutate(`link-subtask:${subtask.position}`, {
      action: 'create-relationship',
      relationship: {
        id: subtask.relationshipId,
        from: parsed.value.masterCardId,
        to: subtask.cardId,
        label: 'subtask',
        position: subtask.position,
      },
    });
    if (!linked.ok) return linked;
  }

  const geometryPatch = await mutate('patch-task-graph-geometry', {
    action: 'patch-geometry',
    geometry: {
      cards: geometry.cards,
      zones: { [String(zone.id ?? '')]: geometry.zone },
    },
  });
  if (!geometryPatch.ok) return geometryPatch;

  const verified = await readLedgerJson(input.ledgerJsonFile);
  if (!verified.ok) return verified;
  const hydratedVerified = await hydrateLedgerCardContent(verified.value, input.ledgerJsonFile);
  const validation = validateMasterTasks(hydratedVerified, parsed.value.masterCardId);
  if (validation.errors.length > 0) {
    return { ok: false, error: JSON.stringify({ version: 1, code: 'invalid_master_task', validation }) };
  }
  const verifiedLedger = record(hydratedVerified) ? hydratedVerified : {};
  const verifiedMaster = Array.isArray(verifiedLedger.cards)
    ? verifiedLedger.cards.filter(record).find((card) => String(card.id ?? '') === parsed.value.masterCardId)
    : undefined;
  if (!verifiedMaster || !isMasterCard(verifiedMaster)) return { ok: false, error: 'Master task verification failed.' };
  const verifiedMasterComment = record(verifiedMaster.comment) ? verifiedMaster.comment : {};
  if (String(verifiedMaster.title ?? '') !== parsed.value.title || String(verifiedMasterComment.what ?? '') !== masterMarkdown) {
    return { ok: false, error: 'Master task content verification failed.' };
  }
  const relationships = canonicalSubtaskRelationships(verifiedLedger, parsed.value.masterCardId);
  if (relationships.length !== subtasks.length || relationships.some((relationship, index) => Number(relationship.position) !== index)) {
    return { ok: false, error: 'Master task relationship order verification failed.' };
  }
  const verifiedCards = Array.isArray(verifiedLedger.cards) ? verifiedLedger.cards.filter(record) : [];
  const verifiedZones = Array.isArray(verifiedLedger.annotations)
    ? verifiedLedger.annotations.filter(record).filter((annotation) => String(annotation.variant ?? '') === 'zone' || String(annotation.variant ?? '') === '')
    : [];
  const verifiedZone = verifiedZones.find((candidate) => String(candidate.id ?? '') === String(zone.id ?? ''));
  if (!verifiedZone || String(verifiedZone.label ?? '') !== (parsed.value.zoneTitle ?? parsed.value.title)) {
    return { ok: false, error: 'Master task zone title verification failed.' };
  }
  const graphIds = new Set([parsed.value.masterCardId, ...subtasks.map((subtask) => subtask.cardId)]);
  const wrongZoneMembership = verifiedCards.filter((card) => {
    const cardId = String(card.id ?? '');
    const ownerId = String(resolveCardZone(card, verifiedZones)?.id ?? '');
    return graphIds.has(cardId) ? ownerId !== String(zone.id ?? '') : ownerId === String(zone.id ?? '');
  });
  if (wrongZoneMembership.length > 0) {
    return { ok: false, error: `Master task zone isolation verification failed: ${wrongZoneMembership.map((card) => String(card.id ?? '')).join(',')}` };
  }
  const verifiedNotes = record(verifiedLedger.notes) ? verifiedLedger.notes : {};
  for (const subtask of subtasks) {
    const card = verifiedCards.find((candidate) => String(candidate.id ?? '') === subtask.cardId);
    const comment = card && record(card.comment) ? card.comment : {};
    if (
      !card
      || String(card.title ?? '') !== subtask.title
      || String(card.status ?? '') !== 'todo'
      || !Array.isArray(card.labels)
      || !card.labels.map(String).includes('subtask')
      || String(comment.what ?? '') !== subtask.markdown
    ) {
      return { ok: false, error: `Subtask verification failed: ${subtask.cardId}` };
    }
    const threadNotes = verifiedNotes[`thread-${subtask.cardId}`];
    const notes = Array.isArray(threadNotes) ? threadNotes.filter(record) : [];
    if (!notes.some((note) => String(note.id ?? '') === subtask.activationNoteId && String(note.role ?? '') === 'agent')) {
      return { ok: false, error: `Subtask activation verification failed: ${subtask.cardId}` };
    }
  }

  return {
    ok: true,
    value: JSON.stringify({
      version: 2,
      operation: 'master-task-apply',
      outcome: 'verified',
      masterCardId: parsed.value.masterCardId,
      zoneId: String(zone.id ?? ''),
      subtasks: subtasks.map((subtask) => ({
        cardId: subtask.cardId,
        relationshipId: subtask.relationshipId,
        title: subtask.title,
        status: String(verifiedCards.find((card) => String(card.id ?? '') === subtask.cardId)?.status ?? ''),
        published: true,
        position: subtask.position,
        canonicalLink: `card:${subtask.cardId}`,
      })),
      verification: {
        authoritativeProjectionRead: true,
        masterContent: true,
        zoneTitle: true,
        zoneIsolation: true,
        relationshipOrder: true,
        subtaskContent: true,
        subtaskPublication: true,
        followUpRequired: false,
      },
    }, null, 2),
  };
}

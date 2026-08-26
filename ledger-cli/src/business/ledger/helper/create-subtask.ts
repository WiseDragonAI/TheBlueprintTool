/**
 * WHAT: Creates one blank Markdown-backed subtask under an ID-discovered master task.
 * WHY: callers need an editable server-owned document without constructing project, ledger, or graph mutations.
 */
import { randomUUID } from 'node:crypto';
import type { Result } from '../../../lib/types.js';
import { resolveMasterTaskOwner } from './resolve-master-task-owner.js';

type AnyRecord = Record<string, unknown>;

function record(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function createSubtask(input: {
  markdownFile?: string;
  masterCardId?: string;
  purpose?: string;
  title?: string;
}): Promise<Result<string>> {
  const title = String(input.title ?? '').trim();
  const purpose = String(input.purpose ?? '').trim();
  // WHAT: reject every Markdown-file input for subtask creation.
  // WHY: the command must create and return the canonical blank document instead of importing caller bytes.
  if (input.markdownFile !== undefined) return { ok: false, error: 'subtask-create does not accept --markdown-file.' };
  // WHAT: require a non-empty subtask title.
  // WHY: the created graph card needs a stable operator-visible identity.
  if (!title) return { ok: false, error: 'subtask-create requires --title.' };
  const owner = await resolveMasterTaskOwner(input.masterCardId);
  // WHAT: stop before mutation when master ownership is unresolved.
  // WHY: the master ID is the sole source of project and ledger context.
  if (!owner.ok) return owner;
  try {
    const projectionResponse = await fetch(
      `${owner.value.serverUrl}/api/task-state/projection?projectId=${encodeURIComponent(owner.value.projectId)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    // WHAT: preserve projection failure before constructing graph geometry.
    // WHY: the new card position and domain derive from current authoritative task state.
    if (!projectionResponse.ok) return { ok: false, error: `Task projection failed (${projectionResponse.status}): ${await projectionResponse.text()}` };
    const projection = await projectionResponse.json() as { ledger?: AnyRecord };
    const ledger = record(projection.ledger) ? projection.ledger : {};
    const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(record) : [];
    const master = cards.find((card) => String(card.id ?? '') === owner.value.masterCardId);
    // WHAT: reject a projection that no longer contains the discovered master.
    // WHY: ownership may have changed between catalog discovery and mutation preparation.
    if (!master) return { ok: false, error: `Master task not found: ${owner.value.masterCardId}` };
    const relationships = Array.isArray(ledger.relationships) ? ledger.relationships.filter(record) : [];
    const existingRelationship = relationships.find((relationship) => {
      if (String(relationship.from ?? '') !== owner.value.masterCardId || String(relationship.label ?? '') !== 'subtask') return false;
      const linked = cards.find((card) => String(card.id ?? '') === String(relationship.to ?? ''));
      return String(linked?.title ?? '').trim() === title;
    });
    if (existingRelationship) {
      const existing = cards.find((card) => String(card.id ?? '') === String(existingRelationship.to ?? ''));
      const cardId = String(existing?.id ?? '').trim();
      const contentFile = record(existing?.comment) ? String(existing.comment.contentFile ?? '').trim() : '';
      if (!cardId || !contentFile) return { ok: false, error: `Existing subtask has no canonical document: ${title}` };
      return { ok: true, value: JSON.stringify({ version: 1, operation: 'subtask-create', projectId: owner.value.projectId, ledgerId: owner.value.ledgerId, masterCardId: owner.value.masterCardId, assignedNodeId: owner.value.assignedNodeId, cardId, relationshipId: String(existingRelationship.id ?? ''), title, path: contentFile, created: false }, null, 2) };
    }
    const positions = relationships
      .filter((relationship) => String(relationship.from ?? '') === owner.value.masterCardId && String(relationship.label ?? '') === 'subtask')
      .map((relationship) => Number(relationship.position))
      .filter((position) => Number.isInteger(position) && position >= 0);
    const position = positions.reduce((maximum, candidate) => Math.max(maximum, candidate), -1) + 1;
    const cardId = `card-${randomUUID()}`;
    const relationshipId = `rel-${randomUUID()}`;
    const column = position % 2;
    const row = Math.floor(position / 2);
    const createdAt = new Date().toISOString();
    const contentFile = `.decision-os/cards/tasks/${cardId}.md`;
    const response = await fetch(
      `${owner.value.serverUrl}/p/${encodeURIComponent(owner.value.projectId)}/decision-os/${encodeURIComponent(owner.value.ledgerId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create-subtask',
          assignedNodeId: owner.value.assignedNodeId,
          masterTaskId: owner.value.masterCardId,
          card: {
            id: cardId,
            title,
            cardType: 'note',
            domainId: String(master.domainId ?? owner.value.ledgerId),
            status: 'todo',
            lifecycle: { status: 'todo', changedAt: createdAt, waitingAt: createdAt, closedAt: null },
            createdAt,
            labels: ['subtask'],
            x: Number(master.x ?? 0) + 450 + column * 350,
            y: Number(master.y ?? 0) + row * 220,
            w: 310,
            h: 180,
            comment: { what: purpose, contentFile },
            facts: [],
            fields: [],
          },
          relationship: {
            id: relationshipId,
            from: owner.value.masterCardId,
            to: cardId,
            label: 'subtask',
            position,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    // WHAT: preserve the scoped mutation failure without issuing a partial retry.
    // WHY: one accepted mutation owns both card and relationship creation.
    if (!response.ok) return { ok: false, error: `Subtask creation failed (${response.status}): ${await response.text()}` };
    const payload = await response.json() as { createdFiles?: Array<{ cardId?: unknown; kind?: unknown; path?: unknown }> };
    const created = (payload.createdFiles ?? []).find((entry) => String(entry.cardId ?? '') === cardId && String(entry.kind ?? '') === 'subtask');
    const path = String(created?.path ?? '').trim();
    // WHAT: reject success without the canonical Markdown document path.
    // WHY: the caller must edit the exact server-created subtask document.
    if (!path) return { ok: false, error: 'Subtask creation returned no Markdown document.' };
    return { ok: true, value: JSON.stringify({ version: 1, operation: 'subtask-create', projectId: owner.value.projectId, ledgerId: owner.value.ledgerId, masterCardId: owner.value.masterCardId, assignedNodeId: owner.value.assignedNodeId, cardId, relationshipId, title, path, created: true }, null, 2) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Subtask creation failed.' };
  }
}

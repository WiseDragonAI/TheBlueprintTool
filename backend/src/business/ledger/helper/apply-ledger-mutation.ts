/**
 * WHAT: Applies one client ledger mutation to an in-memory ledger document.
 * WHY: Real ledgers and the hidden ledgers canvas must share the same card, zone, group, note, and geometry behavior.
 */
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { relationshipReferencesCard } from './relationship-references-card.js';
import { deleteCardMarkdownImage, duplicateCardContentFile, externalizeCardContent, sameMarkdownImageSource, writeCardDescriptionFile } from './card-content-file.js';
import { hydrateLedgerThreadNotes, writeThreadNotesFile } from './thread-content-file.js';

export type LedgerMutation = {
  action?: string;
  card?: Record<string, unknown>;
  cardId?: string;
  imageSrc?: string;
  cardPatch?: { id?: string; status?: string; title?: string; description?: string; imageSizes?: Record<string, { width?: number; height?: number }> };
  annotation?: Record<string, unknown>;
  relationship?: Record<string, unknown>;
  zoneIds?: string[];
  groupIds?: string[];
  relationshipIds?: string[];
  geometry?: Record<string, Record<string, { x: number; y: number; width: number; height: number }>>;
  viewport?: { x?: number; y?: number; scale?: number };
  region?: { id?: string; kind?: string; label?: string; color?: string };
  note?: { id?: string; threadId?: string; body?: string; voiceFileRef?: string; status?: string; transcriptionStartedAt?: string; source?: string; error?: string; codexQueueStatus?: string; codexQueueRequestedAt?: string; codexQueueRunId?: string; codexQueueError?: string; imageSizes?: Record<string, { width?: number; height?: number }> };
  selection?: { cardIds?: string[]; zoneIds?: string[]; groupIds?: string[] };
  pasteSuffix?: string;
};

type MutationError = { statusCode: number; body: Record<string, unknown> };

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function applyLedgerMutation(input: {
  decisionOsRoot: string;
  ledgerPath: string;
  ledger: Record<string, unknown> & {
    cards?: Array<Record<string, unknown>>;
    annotations?: Array<Record<string, unknown>>;
    relationships?: Array<Record<string, unknown>>;
    notes?: Record<string, Array<Record<string, unknown>>>;
    deletedNoteIds?: Record<string, string[]>;
    threadFiles?: Record<string, string>;
  };
  mutation: LedgerMutation;
}): { ok: boolean; ledger: Record<string, unknown>; error?: MutationError } {
  const { decisionOsRoot, ledgerPath, ledger, mutation } = input;
  hydrateLedgerThreadNotes(ledger, decisionOsRoot);
  let mutationError: MutationError | undefined;

  const voiceMetadata = (note: Record<string, unknown> | undefined): Record<string, unknown> => ({
    voiceFileRef: note?.voiceFileRef ?? '',
    status: note?.status ?? '',
    transcriptionStartedAt: note?.transcriptionStartedAt ?? '',
    error: note?.error ?? '',
    codexQueueStatus: note?.codexQueueStatus ?? '',
    codexQueueRequestedAt: note?.codexQueueRequestedAt ?? '',
    codexQueueRunId: note?.codexQueueRunId ?? '',
    codexQueueError: note?.codexQueueError ?? ''
  });

  const patchVoiceMetadata = (target: Record<string, unknown>, note: Record<string, unknown> | undefined, options: { overwrite: boolean }): void => {
    for (const key of ['voiceFileRef', 'status', 'transcriptionStartedAt', 'error', 'codexQueueStatus', 'codexQueueRequestedAt', 'codexQueueRunId', 'codexQueueError']) {
      if (typeof note?.[key] === 'string' && (options.overwrite || !target[key])) target[key] = note[key];
    }
  };

  if ((mutation.action === 'create-zone' || mutation.action === 'create-group') && mutation.annotation?.id) {
    const id = String(mutation.annotation.id);
    ledger.annotations = (ledger.annotations ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.annotation);
  }
  if (mutation.action === 'create-card' && mutation.card?.id) {
    const id = String(mutation.card.id);
    externalizeCardContent({ decisionOsRoot, card: mutation.card, ledgerPath });
    writeThreadNotesFile({ decisionOsRoot, ledger, ledgerPath, threadId: `thread-${id}`, notes: [] });
    ledger.cards = (ledger.cards ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.card);
  }
  if (mutation.action === 'create-relationship' && mutation.relationship?.id) {
    const id = String(mutation.relationship.id);
    ledger.relationships = (ledger.relationships ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.relationship);
  }
  if (mutation.action === 'patch-card' && mutation.cardPatch?.id) {
    const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === mutation.cardPatch?.id);
    if (card && (mutation.cardPatch.status === 'todo' || mutation.cardPatch.status === 'done')) card.status = mutation.cardPatch.status;
    if (card && typeof mutation.cardPatch.title === 'string') card.title = mutation.cardPatch.title;
    if (card && typeof mutation.cardPatch.description === 'string') {
      writeCardDescriptionFile({ decisionOsRoot, card, description: mutation.cardPatch.description, ledgerPath });
    }
    if (card && mutation.cardPatch.imageSizes && typeof mutation.cardPatch.imageSizes === 'object') card.imageSizes = mutation.cardPatch.imageSizes;
  }
  if (mutation.action === 'delete-card' && mutation.cardId) {
    const cardId = String(mutation.cardId);
    ledger.cards = (ledger.cards ?? []).filter((entry) => String(entry.id ?? '') !== cardId);
    ledger.relationships = (ledger.relationships ?? []).filter((entry) => !relationshipReferencesCard(entry, cardId));
    const notesByThread = normalizeLedgerNotes(ledger);
    delete notesByThread[`thread-${cardId}`];
    ledger.notes = notesByThread;
    if (ledger.threadFiles && typeof ledger.threadFiles === 'object') delete ledger.threadFiles[`thread-${cardId}`];
  }
  if (mutation.action === 'delete-card-image' && mutation.cardId && mutation.imageSrc) {
    const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === mutation.cardId);
    const imageSrc = String(mutation.imageSrc);
    if (!card) {
      mutationError = { statusCode: 404, body: { ok: false, error: 'Card not found.', cardId: mutation.cardId } };
    } else {
      const deletion = deleteCardMarkdownImage({ decisionOsRoot, card, imageSrc, ledgerPath });
      if (!deletion.removedMarkdown) {
        mutationError = { statusCode: 404, body: { ok: false, error: 'Image source not found in card markdown.', cardId: mutation.cardId, imageSrc } };
      }
      const imageSizes = card.imageSizes && typeof card.imageSizes === 'object' && !Array.isArray(card.imageSizes)
        ? card.imageSizes as Record<string, unknown>
        : undefined;
      if (imageSizes) {
        for (const key of Object.keys(imageSizes)) {
          if (sameMarkdownImageSource(key, imageSrc)) delete imageSizes[key];
        }
      }
    }
  }
  if (mutation.action === 'delete-zones') {
    const zoneIds = new Set(mutation.zoneIds ?? []);
    const groupIds = new Set(mutation.groupIds ?? []);
    ledger.annotations = (ledger.annotations ?? []).filter((entry) => {
      const id = String(entry.id ?? '');
      return entry.variant === 'group' ? !groupIds.has(id) : !zoneIds.has(id);
    });
  }
  if (mutation.action === 'delete-relationships') {
    const ids = new Set(mutation.relationshipIds ?? []);
    ledger.relationships = (ledger.relationships ?? []).filter((entry) => !ids.has(String((entry as Record<string, unknown>).id ?? '')));
  }
  if (mutation.action === 'patch-geometry') {
    const cardGeometry = mutation.geometry?.cards ?? {};
    const zoneGeometry = mutation.geometry?.zones ?? {};
    const groupGeometry = mutation.geometry?.groups ?? {};
    for (const card of ledger.cards ?? []) {
      const record = cardGeometry[String(card.id ?? '')];
      if (!record) continue;
      card.x = record.x;
      card.y = record.y;
      card.w = record.width;
      card.h = record.height;
    }
    for (const annotation of ledger.annotations ?? []) {
      const id = String(annotation.id ?? '');
      const record = zoneGeometry[id] ?? groupGeometry[id];
      if (!record) continue;
      annotation.x = record.x;
      annotation.y = record.y;
      annotation.width = record.width;
      annotation.height = record.height;
    }
  }
  if (mutation.action === 'patch-viewport' && mutation.viewport) {
    ledger.viewport = {
      x: finiteNumber(mutation.viewport.x, 0),
      y: finiteNumber(mutation.viewport.y, 0),
      scale: finiteNumber(mutation.viewport.scale, 1)
    };
  }
  if (mutation.action === 'patch-region' && mutation.region?.id) {
    const annotation = (ledger.annotations ?? []).find((entry) => String(entry.id ?? '') === mutation.region?.id);
    if (annotation && typeof mutation.region.label === 'string') annotation.label = mutation.region.label;
    if (annotation && mutation.region.kind === 'zone' && typeof mutation.region.color === 'string') annotation.color = mutation.region.color;
  }
  if (mutation.action === 'append-note' && mutation.note?.threadId) {
    const notesByThread = normalizeLedgerNotes(ledger);
    const notes = notesByThread[mutation.note.threadId] ?? [];
    const noteId = String(mutation.note.id ?? `note-${Date.now()}`);
    const deletedNoteIds = ledger.deletedNoteIds?.[mutation.note.threadId] ?? [];
    if (deletedNoteIds.map((id) => String(id)).includes(noteId)) {
      notesByThread[mutation.note.threadId] = notes.filter((entry) => String(entry.id ?? '') !== noteId);
      ledger.notes = notesByThread;
      writeThreadNotesFile({ decisionOsRoot, ledger, ledgerPath, threadId: mutation.note.threadId, notes: notesByThread[mutation.note.threadId] });
      return { ok: true, ledger };
    }
    const existing = notes.find((entry) => String(entry.id ?? '') === noteId);
    const nextNote: Record<string, unknown> = { id: noteId, role: 'operator', message: mutation.note.body ?? '', timestamp: new Date().toISOString(), ...voiceMetadata(mutation.note) };
    if (mutation.note.imageSizes && typeof mutation.note.imageSizes === 'object') nextNote.imageSizes = mutation.note.imageSizes;
    if (existing) {
      if (!existing.message && nextNote.message) existing.message = nextNote.message;
      patchVoiceMetadata(existing, mutation.note, { overwrite: false });
      if (mutation.note.imageSizes && typeof mutation.note.imageSizes === 'object') existing.imageSizes = mutation.note.imageSizes;
      existing.updatedAt = new Date().toISOString();
    } else notes.push(nextNote);
    notesByThread[mutation.note.threadId] = notes;
    writeThreadNotesFile({ decisionOsRoot, ledger, ledgerPath, threadId: mutation.note.threadId, notes });
  }
  if (mutation.action === 'update-note' && mutation.note?.threadId) {
    const notesByThread = normalizeLedgerNotes(ledger);
    const notes = notesByThread[mutation.note.threadId] ?? [];
    const noteId = String(mutation.note.id ?? '');
    const deletedNoteIds = ledger.deletedNoteIds?.[mutation.note.threadId] ?? [];
    if (noteId && deletedNoteIds.map((id) => String(id)).includes(noteId)) {
      notesByThread[mutation.note.threadId] = notes.filter((entry) => String(entry.id ?? '') !== noteId);
      ledger.notes = notesByThread;
      writeThreadNotesFile({ decisionOsRoot, ledger, ledgerPath, threadId: mutation.note.threadId, notes: notesByThread[mutation.note.threadId] });
      return { ok: true, ledger };
    }
    let note = notes.find((entry) => String(entry.id ?? '') === noteId || String(entry.voiceFileRef ?? '') === mutation.note?.voiceFileRef);
    if (!note && noteId) {
      note = { id: noteId, role: 'operator', message: mutation.note.body ?? '', timestamp: new Date().toISOString(), ...voiceMetadata(mutation.note) };
      if (mutation.note.imageSizes && typeof mutation.note.imageSizes === 'object') note.imageSizes = mutation.note.imageSizes;
      notes.push(note);
    }
    if (note) {
      if (typeof mutation.note.body === 'string') note.message = mutation.note.body;
      patchVoiceMetadata(note, mutation.note, { overwrite: true });
      if (mutation.note.imageSizes && typeof mutation.note.imageSizes === 'object') note.imageSizes = mutation.note.imageSizes;
      note.updatedAt = new Date().toISOString();
    }
    notesByThread[mutation.note.threadId] = notes;
    writeThreadNotesFile({ decisionOsRoot, ledger, ledgerPath, threadId: mutation.note.threadId, notes });
  }
  if (mutation.action === 'delete-note' && mutation.note?.threadId) {
    const notesByThread = normalizeLedgerNotes(ledger);
    const notes = notesByThread[mutation.note.threadId] ?? [];
    const noteId = String(mutation.note.id ?? '');
    const tombstonedId = noteId || String(notes.at(-1)?.id ?? '');
    if (tombstonedId) {
      const deletedNoteIds = ledger.deletedNoteIds && typeof ledger.deletedNoteIds === 'object' ? ledger.deletedNoteIds : {};
      deletedNoteIds[mutation.note.threadId] = Array.from(new Set([...(deletedNoteIds[mutation.note.threadId] ?? []), tombstonedId]));
      ledger.deletedNoteIds = deletedNoteIds;
    }
    notesByThread[mutation.note.threadId] = noteId ? notes.filter((entry) => String(entry.id ?? '') !== noteId) : notes.slice(0, -1);
    writeThreadNotesFile({ decisionOsRoot, ledger, ledgerPath, threadId: mutation.note.threadId, notes: notesByThread[mutation.note.threadId] });
  }
  if (mutation.action === 'paste-selection' && mutation.selection) {
    const requestedSuffix = String(mutation.pasteSuffix ?? '').trim();
    // WHAT: Accept the frontend suffix only when it is a bounded safe ID segment.
    // WHY: Optimistic and server IDs must agree without admitting arbitrary path-like content.
    const suffix = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(requestedSuffix)
      ? requestedSuffix
      : `copy-${Date.now()}`;
    const cardIds = new Set(mutation.selection.cardIds ?? []);
    const zoneIds = new Set(mutation.selection.zoneIds ?? []);
    const groupIds = new Set(mutation.selection.groupIds ?? []);
    const copiedCards = (ledger.cards ?? []).filter((card) => cardIds.has(String(card.id ?? ''))).map((card) => {
      const copiedCard = {
        ...card,
        comment: card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
          ? { ...card.comment as Record<string, unknown> }
          : card.comment,
        id: `${String(card.id ?? 'card')}-${suffix}`,
        x: Number(card.x ?? 0) + 48,
        y: Number(card.y ?? 0) + 48
      };
      // WHAT: Remove the source Markdown ownership reference from the copied card.
      // WHY: Content duplication must assign a distinct externalized file to the copy.
      if (copiedCard.comment && typeof copiedCard.comment === 'object' && !Array.isArray(copiedCard.comment)) {
        delete (copiedCard.comment as Record<string, unknown>).contentFile;
      }
      duplicateCardContentFile({ decisionOsRoot, ledgerPath, sourceCard: card, targetCard: copiedCard });
      return copiedCard;
    });
    const copiedAnnotations = (ledger.annotations ?? []).filter((annotation) => zoneIds.has(String(annotation.id ?? '')) || groupIds.has(String(annotation.id ?? ''))).map((annotation) => ({
      ...annotation,
      id: `${String(annotation.id ?? 'region')}-${suffix}`,
      x: Number(annotation.x ?? 0) + 48,
      y: Number(annotation.y ?? 0) + 48
    }));
    ledger.cards = (ledger.cards ?? []).concat(copiedCards);
    ledger.annotations = (ledger.annotations ?? []).concat(copiedAnnotations);
  }

  return mutationError ? { ok: false, ledger, error: mutationError } : { ok: true, ledger };
}

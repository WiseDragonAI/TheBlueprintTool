/**
 * WHAT: Applies one client ledger mutation to an in-memory ledger document.
 * WHY: Real ledgers and the hidden ledgers canvas must share the same card, zone, group, note, and geometry behavior.
 */
import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
import { relationshipReferencesCard } from './relationship-references-card.js';
import { deleteCardMarkdownImage, duplicateCardContentFile, externalizeCardContent, readCardDescription, sameMarkdownImageSource, writeCardDescriptionFile } from './card-content-file.js';
import { hydrateLedgerThreadNotesFor, writeThreadNotesFile } from './thread-content-file.js';
import { codexEffortOptions, codexModelOptions, type CodexEffort, type CodexModel } from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { CardQuestionnaires } from '../../../../../shared/schemas/questionnaire-types.js';
import { normalizeGitReviewNotes, type GitReviewNote } from '../../../../../shared/schemas/git-review-types.js';

export type LedgerMutation = {
  action?: string;
  card?: Record<string, unknown>;
  cardId?: string;
  masterTaskId?: string;
  imageSrc?: string;
  cardPatch?: { id?: string; status?: string; title?: string; description?: string; imageSizes?: Record<string, { width?: number; height?: number }>; questionnaires?: CardQuestionnaires; gitReviewNotes?: GitReviewNote[]; codexRunModel?: CodexModel; codexRunEffort?: CodexEffort };
  annotation?: Record<string, unknown>;
  relationship?: Record<string, unknown>;
  zoneIds?: string[];
  groupIds?: string[];
  relationshipIds?: string[];
  geometry?: Record<string, Record<string, { x: number; y: number; width: number; height: number }>>;
  viewport?: { x?: number; y?: number; scale?: number };
  region?: { id?: string; kind?: string; label?: string; color?: string };
  note?: { id?: string; threadId?: string; body?: string; voiceFileRef?: string; reviewContext?: Record<string, string>; status?: string; transcriptionStartedAt?: string; uploadReceivedAt?: string; audioPersistedAt?: string; acceptedAt?: string; providerStartedAt?: string; providerSettledAt?: string; completedAt?: string; revision?: number; source?: string; error?: string; codexQueueStatus?: string; codexQueueRequestedAt?: string; codexQueueRunId?: string; codexQueueError?: string; imageSizes?: Record<string, { width?: number; height?: number }> };
  selection?: { cardIds?: string[]; zoneIds?: string[]; groupIds?: string[] };
  pasteSuffix?: string;
};

type MutationError = { statusCode: number; body: Record<string, unknown> };

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validQuestionnaires(value: unknown): value is CardQuestionnaires {
  if (!isRecord(value)) return false;
  for (const [questionnaireId, questionnaireValue] of Object.entries(value)) {
    if (!/^[A-Za-z0-9._-]+$/.test(questionnaireId) || !isRecord(questionnaireValue) || questionnaireValue.version !== 1 || typeof questionnaireValue.contextRevision !== 'string' || !questionnaireValue.contextRevision.trim() || !Array.isArray(questionnaireValue.questions) || !isRecord(questionnaireValue.responses)) return false;
    const questionIds = new Set<string>();
    for (const questionValue of questionnaireValue.questions) {
      if (!isRecord(questionValue) || typeof questionValue.id !== 'string' || !questionValue.id.trim() || questionIds.has(questionValue.id) || typeof questionValue.question !== 'string' || typeof questionValue.placeholder !== 'string' || !Array.isArray(questionValue.choices) || questionValue.choices.length !== 4) return false;
      questionIds.add(questionValue.id);
      if (questionValue.choices.some((choice) => !isRecord(choice) || typeof choice.emoji !== 'string' || typeof choice.text !== 'string' || !choice.text.trim())) return false;
    }
    if (questionnaireValue.currentQuestionId !== undefined && (typeof questionnaireValue.currentQuestionId !== 'string' || !questionIds.has(questionnaireValue.currentQuestionId))) return false;
    for (const [questionId, response] of Object.entries(questionnaireValue.responses)) {
      if (!questionIds.has(questionId) || !isRecord(response) || !['answered', 'rejected', 'skipped', 'pending'].includes(String(response.status)) || typeof response.updatedAt !== 'string') return false;
      if (response.choiceIndex !== undefined && (!Number.isInteger(Number(response.choiceIndex)) || Number(response.choiceIndex) < 0 || Number(response.choiceIndex) > 3)) return false;
      if (response.customAnswer !== undefined && typeof response.customAnswer !== 'string') return false;
    }
    if (questionnaireValue.voiceNotes !== undefined) {
      if (!isRecord(questionnaireValue.voiceNotes)) return false;
      for (const [questionId, voiceNotes] of Object.entries(questionnaireValue.voiceNotes)) {
        if (!questionIds.has(questionId) || !Array.isArray(voiceNotes)) return false;
        const voiceNoteIds = new Set<string>();
        for (const voiceNote of voiceNotes) {
          if (!isRecord(voiceNote) || typeof voiceNote.id !== 'string' || !voiceNote.id.trim() || voiceNoteIds.has(voiceNote.id) || typeof voiceNote.voiceFileRef !== 'string' || !voiceNote.voiceFileRef.trim() || typeof voiceNote.transcript !== 'string' || !['transcribed', 'failed'].includes(String(voiceNote.status)) || typeof voiceNote.createdAt !== 'string' || typeof voiceNote.updatedAt !== 'string') return false;
          if (voiceNote.error !== undefined && typeof voiceNote.error !== 'string') return false;
          voiceNoteIds.add(voiceNote.id);
        }
      }
    }
  }
  return true;
}

function revisedQuestionnairesCarryAnswers(card: Record<string, unknown> | undefined, next: CardQuestionnaires): boolean {
  if (!card || !isRecord(card.questionnaires)) return false;
  for (const [questionnaireId, questionnaire] of Object.entries(next)) {
    const previous = card.questionnaires[questionnaireId];
    if (!isRecord(previous) || String(previous.contextRevision ?? '') === questionnaire.contextRevision) continue;
    if (Object.values(questionnaire.responses).some((response) => response.status !== 'pending') || Object.values(questionnaire.voiceNotes ?? {}).some((voiceNotes) => voiceNotes.length > 0)) return true;
  }
  return false;
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
  if (['append-note', 'update-note', 'delete-note'].includes(String(mutation.action)) && mutation.note?.threadId) {
    hydrateLedgerThreadNotesFor(ledger, decisionOsRoot, mutation.note.threadId);
  }
  let mutationError: MutationError | undefined;

  const voiceMetadata = (note: Record<string, unknown> | undefined): Record<string, unknown> => ({
    voiceFileRef: note?.voiceFileRef ?? '',
    status: note?.status ?? '',
    transcriptionStartedAt: note?.transcriptionStartedAt ?? '',
    uploadReceivedAt: note?.uploadReceivedAt ?? '',
    audioPersistedAt: note?.audioPersistedAt ?? '',
    acceptedAt: note?.acceptedAt ?? '',
    providerStartedAt: note?.providerStartedAt ?? '',
    providerSettledAt: note?.providerSettledAt ?? '',
    completedAt: note?.completedAt ?? '',
    revision: Number.isFinite(Number(note?.revision)) ? Number(note?.revision) : 0,
    error: note?.error ?? '',
    codexQueueStatus: note?.codexQueueStatus ?? '',
    codexQueueRequestedAt: note?.codexQueueRequestedAt ?? '',
    codexQueueRunId: note?.codexQueueRunId ?? '',
    codexQueueError: note?.codexQueueError ?? '',
    reviewContext: note?.reviewContext ?? undefined
  });

  const patchVoiceMetadata = (target: Record<string, unknown>, note: Record<string, unknown> | undefined, options: { overwrite: boolean }): void => {
    for (const key of ['voiceFileRef', 'reviewContext', 'status', 'transcriptionStartedAt', 'uploadReceivedAt', 'audioPersistedAt', 'acceptedAt', 'providerStartedAt', 'providerSettledAt', 'completedAt', 'error', 'codexQueueStatus', 'codexQueueRequestedAt', 'codexQueueRunId', 'codexQueueError']) {
      if ((typeof note?.[key] === 'string' || (key === 'reviewContext' && typeof note?.[key] === 'object')) && (options.overwrite || !target[key])) target[key] = note[key];
    }
    if (Number.isFinite(Number(note?.revision)) && (options.overwrite || !target.revision)) target.revision = Number(note?.revision);
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
    const includesStatus = mutation.cardPatch.status !== undefined;
    const validStatus = mutation.cardPatch.status === 'todo' || mutation.cardPatch.status === 'done' || mutation.cardPatch.status === 'backlog';
    const includesCodexPreference = mutation.cardPatch.codexRunModel !== undefined || mutation.cardPatch.codexRunEffort !== undefined;
    const includesQuestionnaires = mutation.cardPatch.questionnaires !== undefined;
    const includesGitReviewNotes = mutation.cardPatch.gitReviewNotes !== undefined;
    const validCodexPreference = typeof mutation.cardPatch.codexRunModel === 'string'
      && (codexModelOptions as readonly string[]).includes(mutation.cardPatch.codexRunModel)
      && typeof mutation.cardPatch.codexRunEffort === 'string'
      && (codexEffortOptions as readonly string[]).includes(mutation.cardPatch.codexRunEffort);
    if (includesCodexPreference && !validCodexPreference) {
      mutationError = {
        statusCode: 400,
        body: { ok: false, error: 'Codex model and effort must be submitted together with allowed values.' },
      };
    }
    if (!mutationError && includesQuestionnaires && !validQuestionnaires(mutation.cardPatch.questionnaires)) {
      mutationError = {
        statusCode: 400,
        body: { ok: false, error: 'Card questionnaires must use the supported versioned question and response contract.' },
      };
    }
    if (!mutationError && includesGitReviewNotes && (!Array.isArray(mutation.cardPatch.gitReviewNotes) || normalizeGitReviewNotes(mutation.cardPatch.gitReviewNotes).length !== mutation.cardPatch.gitReviewNotes.length)) {
      mutationError = {
        statusCode: 400,
        body: { ok: false, error: 'Card Git review notes must use the supported review-note contract.' },
      };
    }
    if (!mutationError && includesQuestionnaires && revisedQuestionnairesCarryAnswers(card, mutation.cardPatch.questionnaires!)) {
      mutationError = {
        statusCode: 400,
        body: { ok: false, error: 'Changing a questionnaire context revision requires clearing its prior answers and voice notes.' },
      };
    }
    if (!mutationError && includesStatus && !validStatus) {
      mutationError = {
        statusCode: 400,
        body: { ok: false, error: 'Card status must be todo, backlog, or done.' },
      };
    }
    if (!mutationError) {
      if (card && validStatus) card.status = mutation.cardPatch.status;
      if (card && typeof mutation.cardPatch.title === 'string') card.title = mutation.cardPatch.title;
      if (card && typeof mutation.cardPatch.description === 'string') {
        writeCardDescriptionFile({ decisionOsRoot, card, description: mutation.cardPatch.description, ledgerPath });
      }
      if (card && mutation.cardPatch.imageSizes && typeof mutation.cardPatch.imageSizes === 'object') card.imageSizes = mutation.cardPatch.imageSizes;
      if (card && includesQuestionnaires) card.questionnaires = mutation.cardPatch.questionnaires;
      if (card && includesGitReviewNotes) card.gitReviewNotes = mutation.cardPatch.gitReviewNotes;
      if (card && validCodexPreference) {
        card.codexRunModel = mutation.cardPatch.codexRunModel;
        card.codexRunEffort = mutation.cardPatch.codexRunEffort;
      }
    }
  }
  if (mutation.action === 'complete-master-task') {
    const masterTaskId = String(mutation.masterTaskId ?? '');
    const masterTask = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === masterTaskId);
    if (!masterTask) {
      mutationError = { statusCode: 404, body: { ok: false, error: 'Master task not found.' } };
    } else {
      const markdown = readCardDescription({ decisionOsRoot, card: masterTask });
      const taskLabels = (card: Record<string, unknown>): string[] => Array.isArray(card.labels) ? card.labels.map(String) : [];
      const hasTaskLabel = (card: Record<string, unknown>): boolean => taskLabels(card).some((label) => label === 'master-task' || label === 'subtask');
      const subtaskIds = (ledger.relationships ?? [])
        .filter((relationship) => String(relationship.from ?? '') === masterTaskId && String(relationship.label ?? '') === 'subtask')
        .map((relationship) => String(relationship.to ?? ''));
      const linkedSubtasks = subtaskIds.map((id) => (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === id));
      const legacyMaster = /^\s*(?:#[a-z][a-z0-9-]*\s*)*#master-task\b/im.test(markdown);
      if (taskLabels(masterTask).includes('subtask') || (!taskLabels(masterTask).includes('master-task') && (hasTaskLabel(masterTask) || !legacyMaster))) {
        mutationError = { statusCode: 400, body: { ok: false, error: 'The requested card is not a canonical master task.' } };
      } else if (linkedSubtasks.some((card) => !card)) {
        mutationError = { statusCode: 400, body: { ok: false, error: 'Every canonical subtask relationship must resolve to a ledger card.' } };
      } else if (linkedSubtasks.some((card) => card && hasTaskLabel(card) && (!taskLabels(card).includes('subtask') || taskLabels(card).includes('master-task')))) {
        mutationError = { statusCode: 400, body: { ok: false, error: 'Every canonical subtask relationship must target a subtask-labeled card.' } };
      } else {
        masterTask.labels = [...new Set(taskLabels(masterTask).filter((label) => label !== 'subtask').concat('master-task'))];
        for (const subtask of linkedSubtasks) {
          subtask!.labels = [...new Set(taskLabels(subtask!).filter((label) => label !== 'master-task').concat('subtask'))];
          subtask!.status = 'done';
        }
        masterTask.status = 'done';
        const completedAt = new Date().toISOString();
        let completedMarkdown = markdown.replace(/(\(card:[^)]+\))\s+[—-]\s+Status:\s*[^\n]+/gi, '$1');
        completedMarkdown = completedMarkdown.split('\n').map((line) => /^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line)
          ? line.replace(/(?:^|\s+)#(?:master-task|task-(?:waiting|active|execution|complete))\b/gi, '').replace(/\s+/g, ' ').trim()
          : line).join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');
        if (/^\s*(?:\*\*)?Completed at(?:\*\*)?\s*:/im.test(completedMarkdown)) {
          completedMarkdown = completedMarkdown.replace(/^\s*(?:\*\*)?Completed at(?:\*\*)?\s*:.*$/im, `Completed at: ${completedAt}`);
        } else {
          const activeLine = /^\s*(?:\*\*)?Active since(?:\*\*)?\s*:.*$/im;
          completedMarkdown = activeLine.test(completedMarkdown)
            ? completedMarkdown.replace(activeLine, (line) => `${line}\nCompleted at: ${completedAt}`)
            : `Completed at: ${completedAt}\n\n${completedMarkdown}`;
        }
        writeCardDescriptionFile({
          decisionOsRoot,
          card: masterTask,
          description: completedMarkdown,
          ledgerPath,
        });
      }
    }
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

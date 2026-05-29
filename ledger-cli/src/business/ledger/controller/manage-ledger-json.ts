/**
 * WHAT: Ledger JSON command controller.
 * WHY: ledger edits must use committed ledger files as the work surface.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { readLedgerJson } from '../helper/read-ledger-json.js';
import { writeLedgerJson } from '../effect/write-ledger-json.js';
import { formatLedgerOverview } from '../helper/format-ledger-overview.js';
import { formatLedgerMarkdownExport } from '../helper/format-ledger-markdown-export.js';
import { appendThreadAnswer } from '../helper/append-thread-answer.js';
import { findUnansweredThreads } from '../helper/find-unanswered-threads.js';
import { formatUnansweredThreads } from '../helper/format-unanswered-threads.js';

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function applyLedgerMutationOperation(
  ledger: unknown,
  operation: {
    addCardFile?: string;
    addRelationships?: Array<{
      from?: string;
      id?: string;
      label?: string;
      to?: string;
    }>;
    cardComment?: string;
    cardCommentFile?: string;
    cardH?: number;
    cardId?: string;
    cardLabels?: string[];
    cardTitle?: string;
    cardW?: number;
    cardX?: number;
    cardY?: number;
    removeCardIds?: string[];
    removeRelationshipIds?: string[];
  } | undefined,
  fs?: FileSystemPort,
): Promise<Result<unknown>> {
  const hasCardLabels = (operation?.cardLabels ?? []).length > 0;
  const hasCardLayout = operation?.cardX !== undefined || operation?.cardY !== undefined || operation?.cardW !== undefined || operation?.cardH !== undefined;
  if (!operation || (!operation.addCardFile && operation.cardComment === undefined && !operation.cardCommentFile && !operation.cardId && !operation.cardTitle && !hasCardLabels && !hasCardLayout && (operation.removeCardIds ?? []).length === 0 && (operation.removeRelationshipIds ?? []).length === 0 && (operation.addRelationships ?? []).length === 0)) {
    return { ok: true, value: ledger };
  }

  if (!isRecord(ledger)) {
    return { ok: false, error: 'Ledger mutation operations require an object ledger.' };
  }

  const nextLedger: JsonObject = {
    ...ledger,
    cards: Array.isArray(ledger.cards) ? ledger.cards.map((card) => (isRecord(card) ? { ...card } : card)) : [],
    relationships: Array.isArray(ledger.relationships) ? ledger.relationships.map((relationship) => (isRecord(relationship) ? { ...relationship } : relationship)) : [],
  };

  if (operation.addCardFile) {
    const cardText = await (fs ? fs.readFile(operation.addCardFile) : readFileWithNode(operation.addCardFile));
    let card: unknown;
    try {
      card = JSON.parse(cardText);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid card JSON.' };
    }

    if (!isRecord(card) || typeof card.id !== 'string') {
      return { ok: false, error: 'Card mutation requires a JSON object with an id.' };
    }

    const cards = nextLedger.cards as unknown[];
    nextLedger.cards = cards.filter((entry) => !isRecord(entry) || entry.id !== card.id).concat(card);
  }

  const removeCardIds = new Set(operation.removeCardIds ?? []);
  if (removeCardIds.size > 0) {
    nextLedger.cards = (nextLedger.cards as unknown[]).filter((card) => {
      return !isRecord(card) || !removeCardIds.has(String(card.id ?? ''));
    });
    nextLedger.relationships = (nextLedger.relationships as unknown[]).filter((relationship) => {
      if (!isRecord(relationship)) return true;
      const from = String(relationship.from ?? '');
      const to = String(relationship.to ?? '');
      return !removeCardIds.has(from) && !removeCardIds.has(to);
    });
  }

  if (operation.cardComment !== undefined || operation.cardCommentFile || operation.cardTitle || hasCardLabels || hasCardLayout || operation.cardId) {
    if (!operation.cardId) {
      return { ok: false, error: 'Card mutation requires --card-id.' };
    }

    const cards = nextLedger.cards as unknown[];
    const card = cards.find((entry) => isRecord(entry) && entry.id === operation.cardId);
    if (!isRecord(card)) {
      return { ok: false, error: `Card not found: ${operation.cardId}` };
    }

    if (operation.cardTitle) {
      card.title = operation.cardTitle;
    }

    if (operation.cardX !== undefined) card.x = operation.cardX;
    if (operation.cardY !== undefined) card.y = operation.cardY;
    if (operation.cardW !== undefined) card.w = operation.cardW;
    if (operation.cardH !== undefined) card.h = operation.cardH;

    if (hasCardLabels) {
      const labels = (operation.cardLabels ?? []).map((label) => String(label).trim()).filter(Boolean);
      if (labels.length > 0) card.labels = labels;
      else delete card.labels;
    }

    if (operation.cardComment !== undefined || operation.cardCommentFile) {
      const commentText = operation.cardComment ?? await (fs ? fs.readFile(operation.cardCommentFile ?? '') : readFileWithNode(operation.cardCommentFile ?? ''));
      const comment = isRecord(card.comment) ? { ...card.comment } : {};
      comment.what = commentText.trimEnd();
      card.comment = comment;
    }
  }

  const removeRelationshipIds = new Set(operation.removeRelationshipIds ?? []);
  if (removeRelationshipIds.size > 0) {
    nextLedger.relationships = (nextLedger.relationships as unknown[]).filter((relationship) => {
      return !isRecord(relationship) || !removeRelationshipIds.has(String(relationship.id ?? ''));
    });
  }

  for (const relationship of operation.addRelationships ?? []) {
    if (!relationship.id || !relationship.from || !relationship.to) {
      return { ok: false, error: 'Relationship mutation requires id, from, and to.' };
    }

    const relationships = nextLedger.relationships as unknown[];
    const withoutExisting = relationships.filter((entry) => !isRecord(entry) || entry.id !== relationship.id);
    withoutExisting.push({
      id: relationship.id,
      from: relationship.from,
      to: relationship.to,
      ...(relationship.label ? { label: relationship.label } : {}),
    });
    nextLedger.relationships = withoutExisting;
  }

  return { ok: true, value: nextLedger };
}

async function readFileWithNode(path: string): Promise<string> {
  const { promises } = await import('node:fs');
  return promises.readFile(path, 'utf8');
}

async function writeFileWithNode(path: string, content: string): Promise<void> {
  const { promises } = await import('node:fs');
  await promises.writeFile(path, content, 'utf8');
}

function setLedgerCardStatus(ledger: unknown, operation: { cardId?: string; status?: 'todo' | 'done' } | undefined): Result<unknown> {
  if (!operation?.cardId) return { ok: false, error: 'Card status command requires --card-id.' };
  if (operation.status !== 'todo' && operation.status !== 'done') return { ok: false, error: 'Card status command requires todo or done.' };
  if (!isRecord(ledger)) return { ok: false, error: 'Card status command requires an object ledger.' };

  const cards = Array.isArray(ledger.cards) ? ledger.cards.map((card) => (isRecord(card) ? { ...card } : card)) : [];
  const card = cards.find((entry) => isRecord(entry) && entry.id === operation.cardId);
  if (!isRecord(card)) return { ok: false, error: `Card not found: ${operation.cardId}` };

  card.status = operation.status;
  return { ok: true, value: { ...ledger, cards } };
}

export async function manageLedgerJsonController(
  actionPayload: {
    ledgerCommand: 'answer' | 'done' | 'export' | 'inspect' | 'mutate' | 'overview' | 'todo' | 'unanswered';
    answerOperation?: { message?: string; messageFile?: string; threadId?: string };
    exportOperation?: { outputFile?: string };
    json?: boolean;
    ledgerJsonFile: string;
    mutation?: unknown;
    mutationFile?: string;
    mutationOperation?: {
      addCardFile?: string;
      addRelationships?: Array<{
        from?: string;
        id?: string;
        label?: string;
        to?: string;
      }>;
      cardH?: number;
      cardComment?: string;
      cardCommentFile?: string;
      cardId?: string;
      cardLabels?: string[];
      cardTitle?: string;
      cardW?: number;
      cardX?: number;
      cardY?: number;
      removeCardIds?: string[];
      removeRelationshipIds?: string[];
    };
    statusOperation?: { cardId?: string; status: 'todo' | 'done' };
  },
  fs?: FileSystemPort,
): Promise<Result<unknown>> {
  telemetry('read-ledger-json', { path: actionPayload.ledgerJsonFile });
  const ledger = await readLedgerJson(actionPayload.ledgerJsonFile, fs);

  // WHY: invalid JSON cannot be used as committed ledger truth.
  // WHAT: stop before any mutation write.
  if (!ledger.ok) {
    telemetry('manage-ledger-json-rejected', { error: ledger.error });
    return ledger;
  }

  if (actionPayload.ledgerCommand === 'overview') {
    telemetry('manage-ledger-json-completed');
    return { ok: true, value: formatLedgerOverview(ledger.value) };
  }

  if (actionPayload.ledgerCommand === 'export') {
    const outputFile = actionPayload.exportOperation?.outputFile;
    if (!outputFile) {
      const error = 'Ledger export requires --output <file.md>.';
      telemetry('manage-ledger-json-rejected', { error });
      return { ok: false, error };
    }
    if (!outputFile.endsWith('.md')) {
      const error = 'Ledger export output must be a .md file.';
      telemetry('manage-ledger-json-rejected', { error });
      return { ok: false, error };
    }

    const markdown = formatLedgerMarkdownExport(ledger.value);
    await (fs ? fs.writeFile(outputFile, markdown) : writeFileWithNode(outputFile, markdown));
    telemetry('write-ledger-markdown-export', { path: outputFile });
    telemetry('manage-ledger-json-completed');
    return { ok: true, value: `Exported markdown to ${outputFile}` };
  }

  if (actionPayload.ledgerCommand === 'unanswered') {
    telemetry('manage-ledger-json-completed');
    const threads = findUnansweredThreads(ledger.value, actionPayload.ledgerJsonFile);
    return { ok: true, value: formatUnansweredThreads(threads, Boolean(actionPayload.json)) };
  }

  if (actionPayload.ledgerCommand === 'answer') {
    const answered = await appendThreadAnswer(ledger.value, actionPayload.answerOperation, fs);
    if (!answered.ok) {
      telemetry('manage-ledger-json-rejected', { error: answered.error });
      return answered;
    }
    await writeLedgerJson(actionPayload.ledgerJsonFile, answered.value, fs);
    telemetry('write-ledger-json', { path: actionPayload.ledgerJsonFile });
    telemetry('manage-ledger-json-completed');
    return answered;
  }

  if (actionPayload.ledgerCommand === 'todo' || actionPayload.ledgerCommand === 'done') {
    const statusResult = setLedgerCardStatus(ledger.value, actionPayload.statusOperation);
    if (!statusResult.ok) {
      telemetry('manage-ledger-json-rejected', { error: statusResult.error });
      return statusResult;
    }
    await writeLedgerJson(actionPayload.ledgerJsonFile, statusResult.value, fs);
    telemetry('write-ledger-json', { path: actionPayload.ledgerJsonFile });
    telemetry('manage-ledger-json-completed');
    return statusResult;
  }

  // WHY: mutate mode is the only ledger command allowed to write.
  // WHAT: persist either the provided mutation object, mutation file, targeted operation, or current validated ledger.
  if (actionPayload.ledgerCommand === 'mutate') {
    const mutationFromFile = actionPayload.mutationFile ? await readLedgerJson(actionPayload.mutationFile, fs) : undefined;
    if (mutationFromFile && !mutationFromFile.ok) {
      telemetry('manage-ledger-json-rejected', { error: mutationFromFile.error });
      return mutationFromFile;
    }

    const baseMutation = actionPayload.mutation ?? mutationFromFile?.value ?? ledger.value;
    const operatedMutation = await applyLedgerMutationOperation(baseMutation, actionPayload.mutationOperation, fs);
    if (!operatedMutation.ok) {
      telemetry('manage-ledger-json-rejected', { error: operatedMutation.error });
      return operatedMutation;
    }

    await writeLedgerJson(actionPayload.ledgerJsonFile, operatedMutation.value, fs);
    telemetry('write-ledger-json', { path: actionPayload.ledgerJsonFile });
  }

  telemetry('manage-ledger-json-completed');
  return ledger;
}

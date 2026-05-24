/**
 * WHAT: Ledger JSON command controller.
 * WHY: CLI architecture edits must use committed ledger files as the work surface.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { readLedgerJson } from '../helper/read-ledger-json.js';
import { writeLedgerJson } from '../effect/write-ledger-json.js';

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
    cardCommentFile?: string;
    cardId?: string;
    cardTitle?: string;
    removeRelationshipIds?: string[];
  } | undefined,
  fs?: FileSystemPort,
): Promise<Result<unknown>> {
  if (!operation || (!operation.addCardFile && !operation.cardCommentFile && !operation.cardId && !operation.cardTitle && (operation.removeRelationshipIds ?? []).length === 0 && (operation.addRelationships ?? []).length === 0)) {
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

  if (operation.cardCommentFile || operation.cardTitle || operation.cardId) {
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

    if (operation.cardCommentFile) {
      const commentText = await (fs ? fs.readFile(operation.cardCommentFile) : readFileWithNode(operation.cardCommentFile));
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

export async function manageLedgerJsonController(
  actionPayload: {
    ledgerCommand: 'inspect' | 'mutate';
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
      cardCommentFile?: string;
      cardId?: string;
      cardTitle?: string;
      removeRelationshipIds?: string[];
    };
  },
  fs?: FileSystemPort,
): Promise<Result<unknown>> {
  telemetry('read-ledger-json', { path: actionPayload.ledgerJsonFile });
  const ledger = await readLedgerJson(actionPayload.ledgerJsonFile, fs);

  // WHY: invalid JSON cannot be used as committed architecture truth.
  // WHAT: stop before any mutation write.
  if (!ledger.ok) {
    telemetry('manage-ledger-json-rejected', { error: ledger.error });
    return ledger;
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

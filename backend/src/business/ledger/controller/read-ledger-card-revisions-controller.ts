/**
 * WHAT: Reads cursor history and immutable content for one identity-resolved card owner.
 * WHY: Card history must not accept or return physical paths.
 */
import {
  readAuthoredFileRevisionContent,
  readAuthoredFileRevisionHistory,
  readCurrentAuthoredFileRevisionContent,
} from '../../content-authoring/helper/authored-file-git-revisions.js';
import { resolveLedgerCardContentOwner } from '../helper/ledger-card-content-owner.js';

type AnyRecord = Record<string, unknown>;

export async function readLedgerCardRevisionHistoryController(input: {
  decisionOsRoot: string;
  ledger: AnyRecord;
  cardId: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<AnyRecord> {
  const owner = resolveLedgerCardContentOwner(input);
  if (!owner) return { ok: false, statusCode: 404, code: 'card_content_owner_not_found', error: 'The current card content owner was not found.' };
  try {
    const history = await readAuthoredFileRevisionHistory({
      file: owner.file,
      cursor: input.cursor,
      limit: input.limit,
      signal: input.signal,
    });
    return { ok: true, statusCode: 200, history };
  } catch (error) {
    return {
      ok: false,
      statusCode: 422,
      code: 'card_revision_history_invalid',
      error: error instanceof Error ? error.message : 'Card revision history could not be read.',
    };
  }
}

export async function readLedgerCardRevisionContentController(input: {
  decisionOsRoot: string;
  ledger: AnyRecord;
  cardId: string;
  commit: string;
  signal?: AbortSignal;
}): Promise<AnyRecord> {
  if (input.commit !== 'current' && !/^[a-f0-9]{40,64}$/.test(input.commit)) {
    return { ok: false, statusCode: 422, code: 'invalid_card_revision', error: 'A full Git commit is required.' };
  }
  const owner = resolveLedgerCardContentOwner(input);
  if (!owner) return { ok: false, statusCode: 404, code: 'card_content_owner_not_found', error: 'The current card content owner was not found.' };
  try {
    const revision = input.commit === 'current'
      ? await readCurrentAuthoredFileRevisionContent({ file: owner.file, signal: input.signal })
      : await readAuthoredFileRevisionContent({ file: owner.file, commit: input.commit, signal: input.signal });
    return { ok: true, statusCode: 200, revision };
  } catch (error) {
    return {
      ok: false,
      statusCode: 404,
      code: 'card_revision_not_found',
      error: error instanceof Error ? error.message : 'The requested card revision was not found.',
    };
  }
}

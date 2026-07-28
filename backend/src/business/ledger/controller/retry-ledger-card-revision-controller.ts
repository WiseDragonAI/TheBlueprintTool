/**
 * WHAT: Retries one pending card Git revision against exact current owner bytes.
 * WHY: Recovery must not issue a second authoritative card mutation.
 */
import {
  AuthoredFileGitError,
  retryAuthoredFileRevision,
} from '../../content-authoring/helper/authored-file-git-revisions.js';
import { RepositoryMutationLockError } from '../../content-authoring/helper/repository-mutation-lock.js';
import { resolveLedgerCardContentOwner } from '../helper/ledger-card-content-owner.js';

type AnyRecord = Record<string, unknown>;

export async function retryLedgerCardRevisionController(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
  projectRoot: string;
  decisionOsRoot: string;
  ledger: AnyRecord;
  recoveryToken: unknown;
  contentRevision: unknown;
  signal?: AbortSignal;
}): Promise<AnyRecord> {
  if (
    typeof input.recoveryToken !== 'string'
    || !input.recoveryToken
    || typeof input.contentRevision !== 'string'
    || !/^[a-f0-9]{64}$/.test(input.contentRevision)
  ) {
    return { ok: false, statusCode: 422, code: 'invalid_revision_retry', error: 'A recovery token and SHA-256 content revision are required.' };
  }
  const owner = resolveLedgerCardContentOwner(input);
  if (!owner) return { ok: false, statusCode: 404, code: 'card_content_owner_not_found', error: 'The current card content owner was not found.' };
  if (owner.contentRevision !== input.contentRevision) {
    return {
      ok: false,
      statusCode: 409,
      code: 'content_revision_conflict',
      error: 'The card changed after the pending Git revision was created.',
      currentRevision: owner.contentRevision,
    };
  }
  try {
    const gitRevision = await retryAuthoredFileRevision({
      repositoryRoot: input.projectRoot,
      ownerId: `ledger-card:${input.projectId}:${input.ledgerId}:${input.cardId}`,
      recoveryToken: input.recoveryToken,
      signal: input.signal,
    });
    return { ok: true, statusCode: 200, contentRevision: owner.contentRevision, gitRevision };
  } catch (error) {
    if (error instanceof RepositoryMutationLockError) {
      return { ok: false, statusCode: 423, code: error.code, error: error.message };
    }
    if (error instanceof AuthoredFileGitError) {
      return {
        ok: false,
        statusCode: error.statusCode,
        code: error.code === 'authored_owner_staged' ? 'authored_path_staged' : error.code,
        error: error.message,
        currentRevision: owner.contentRevision,
        recoveryToken: error.recoveryToken,
        incidentId: error.incidentId,
      };
    }
    return {
      ok: false,
      statusCode: 500,
      code: 'card_revision_retry_failed',
      error: error instanceof Error ? error.message : 'The card Git revision retry failed.',
    };
  }
}

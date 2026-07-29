/**
 * WHAT: Saves one card description through its authoritative scoped mutation and focused Git owner.
 * WHY: Browser-authored Markdown must preserve task clocks, content heads, staged work, and optimistic concurrency.
 */
import { randomUUID } from 'node:crypto';
import {
  AuthoredFileGitError,
  commitAuthoredFileRevision,
  sha256AuthoredBytes,
  type AuthoredGitFailurePoint,
} from '../../content-authoring/helper/authored-file-git-revisions.js';
import { RepositoryMutationLockError } from '../../content-authoring/helper/repository-mutation-lock.js';
import { assertSkillFileRevisionWritable } from '../../codex/helper/skill-git-revisions.js';
import { canonicalTaskContentResource } from '../../task-state/helper/task-content-resources.js';
import { resolveLedgerCardContentOwner } from '../helper/ledger-card-content-owner.js';

type AnyRecord = Record<string, unknown>;

export type LedgerCardPatchReceipt = {
  changedCard: AnyRecord | null;
  taskClock?: AnyRecord | null;
  receipt?: {
    mutationId?: unknown;
    clock?: unknown;
    entities?: unknown;
  } | null;
};

function taskCardContentEntityPresent(input: {
  entities: unknown;
  cardId: string;
  contentFile: unknown;
  decisionOsRoot: string;
}): boolean {
  const contentResource = typeof input.contentFile === 'string'
    ? canonicalTaskContentResource(input.decisionOsRoot, input.contentFile)
    : '';
  return Array.isArray(input.entities) && input.entities.some((entity) => (
    entity && typeof entity === 'object'
    && (
      (
        String((entity as AnyRecord).entityType ?? '') === 'card'
        && String((entity as AnyRecord).entityId ?? '') === input.cardId
      )
      || (
        Boolean(contentResource)
        && String((entity as AnyRecord).entityType ?? '') === 'resource'
        && String((entity as AnyRecord).entityId ?? '') === contentResource
      )
    )
  ));
}

function stableFailure(error: unknown, contentRevision: string): AnyRecord {
  if (error instanceof RepositoryMutationLockError) {
    return { ok: false, statusCode: 423, code: error.code, error: error.message };
  }
  if (error instanceof AuthoredFileGitError) {
    if (error.code === 'git_revision_pending_recovery') {
      return {
        ok: false,
        statusCode: 503,
        code: error.code,
        error: error.message,
        authoredBytesPreserved: true,
        gitRevisionCreated: false,
        contentRevision,
        recoveryToken: error.recoveryToken,
        incidentId: error.incidentId,
      };
    }
    return {
      ok: false,
      statusCode: error.statusCode,
      code: error.code === 'authored_owner_staged' ? 'authored_path_staged' : error.code,
      error: error.message,
      ...(error.code === 'content_revision_conflict' ? { currentRevision: contentRevision } : {}),
    };
  }
  return {
    ok: false,
    statusCode: 500,
    code: 'card_content_save_failed',
    error: error instanceof Error ? error.message : 'The card content save failed.',
  };
}

export async function saveLedgerCardContentController(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
  projectRoot: string;
  decisionOsRoot: string;
  ledger: AnyRecord;
  markdown: unknown;
  expectedContentRevision: unknown;
  patchCard: (input: { markdown: string; mutationId: string }) => Promise<LedgerCardPatchReceipt>;
  reloadLedger: () => AnyRecord;
  signal?: AbortSignal;
  /** Test-only first-boundary failure injection. Route callers never populate this field. */
  gitFailureAt?: AuthoredGitFailurePoint;
}): Promise<AnyRecord> {
  if (typeof input.markdown !== 'string' || typeof input.expectedContentRevision !== 'string') {
    return {
      ok: false,
      statusCode: 422,
      code: 'invalid_card_content_save',
      error: 'Markdown and expectedContentRevision are required.',
    };
  }
  if (Buffer.byteLength(input.markdown, 'utf8') > 1_000_000) {
    return { ok: false, statusCode: 413, code: 'content_too_large', error: 'Card Markdown exceeds the 1,000,000 byte limit.' };
  }
  const owner = resolveLedgerCardContentOwner(input);
  if (!owner) return { ok: false, statusCode: 404, code: 'card_content_owner_not_found', error: 'The current card content owner was not found.' };
  if (owner.contentRevision !== input.expectedContentRevision) {
    return {
      ok: false,
      statusCode: 409,
      code: 'content_revision_conflict',
      error: 'The card changed after it was loaded. Reload it and apply the edit again.',
      currentRevision: owner.contentRevision,
    };
  }
  if (owner.markdown === input.markdown) {
    return {
      ok: false,
      statusCode: 422,
      code: 'content_not_changed',
      error: 'The submitted Markdown is unchanged.',
      currentRevision: owner.contentRevision,
    };
  }

  const contentRevision = sha256AuthoredBytes(input.markdown);
  try {
    await assertSkillFileRevisionWritable({
      file: owner.file,
      repositoryRoot: input.projectRoot,
      signal: input.signal,
    });
    const mutationId = randomUUID();
    const patched = await input.patchCard({ markdown: input.markdown, mutationId });
    const changedCard = patched.changedCard;
    const changedMarkdown = changedCard?.comment && typeof changedCard.comment === 'object'
      ? String((changedCard.comment as AnyRecord).what ?? '')
      : '';
    if (
      !changedCard
      || String(changedCard.id ?? '') !== input.cardId
      || String(changedCard.contentRevision ?? '') !== contentRevision
      || changedMarkdown !== input.markdown
    ) {
      throw new Error('The authoritative card projection did not confirm the submitted Markdown.');
    }
    if (input.ledgerId === 'tasks') {
      const changedComment = changedCard.comment && typeof changedCard.comment === 'object'
        ? changedCard.comment as AnyRecord
        : {};
      if (
        !patched.taskClock
        || !patched.receipt
        || String(patched.receipt.mutationId ?? '') !== mutationId
        || JSON.stringify(patched.receipt.clock ?? null) !== JSON.stringify(patched.taskClock)
        || !taskCardContentEntityPresent({
          entities: patched.receipt.entities,
          cardId: input.cardId,
          contentFile: changedComment.contentFile,
          decisionOsRoot: input.decisionOsRoot,
        })
      ) {
        throw new Error('The authoritative task mutation receipt did not confirm the card change.');
      }
    }
    const confirmed = resolveLedgerCardContentOwner({
      decisionOsRoot: input.decisionOsRoot,
      ledger: input.reloadLedger(),
      cardId: input.cardId,
    });
    if (!confirmed || confirmed.file !== owner.file || confirmed.contentRevision !== contentRevision || confirmed.markdown !== input.markdown) {
      throw new Error('The reloaded card owner bytes do not match the accepted task mutation.');
    }
    const gitRevision = await commitAuthoredFileRevision({
      repositoryRoot: input.projectRoot,
      ownerId: `ledger-card:${input.projectId}:${input.ledgerId}:${input.cardId}`,
      subject: `Revise card ${input.cardId}`,
      confirmedFiles: [{ file: confirmed.file, contentRevision }],
      signal: input.signal,
      failureAt: input.gitFailureAt,
    });
    return {
      ok: true,
      statusCode: 200,
      card: changedCard,
      contentRevision,
      gitRevision,
      ...(patched.taskClock ? { taskClock: patched.taskClock } : {}),
      ...(patched.receipt ? { receipt: patched.receipt } : {}),
    };
  } catch (error) {
    return stableFailure(error, contentRevision);
  }
}

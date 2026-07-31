/**
 * WHAT: Validates the complete immutable identity and bytes used by the unified Markdown diff editor.
 * WHY: Diff work may enter CodeMirror only when every server-owned snapshot member is present and coherent.
 */
export type AuthoredFileRevisionSnapshot = {
  contentRevision: string;
  commit: string;
  olderCommit: string | null;
  baselineAvailability: 'available' | 'no_prior_revision';
  baseMarkdown: string;
  markdown: string;
};

const sha256 = /^[a-f0-9]{64}$/;
const commit = /^[a-f0-9]{40,64}$/;

export function authoredFileRevisionSnapshot(value: unknown): AuthoredFileRevisionSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.contentRevision !== 'string'
    || !sha256.test(record.contentRevision)
    || typeof record.commit !== 'string'
    || !commit.test(record.commit)
    || (record.olderCommit !== null && (typeof record.olderCommit !== 'string' || !commit.test(record.olderCommit)))
    || (record.baselineAvailability !== 'available' && record.baselineAvailability !== 'no_prior_revision')
    || typeof record.baseMarkdown !== 'string'
    || typeof record.markdown !== 'string'
  ) return null;
  // WHAT: Reject contradictory baseline identities.
  // WHY: Initialization-only history must never be admitted as a whole-document empty-base diff.
  if (
    (record.baselineAvailability === 'available' && record.olderCommit === null)
    || (record.baselineAvailability === 'no_prior_revision' && (record.olderCommit !== null || record.baseMarkdown !== ''))
  ) return null;
  return {
    contentRevision: record.contentRevision,
    commit: record.commit,
    olderCommit: record.olderCommit as string | null,
    baselineAvailability: record.baselineAvailability,
    baseMarkdown: record.baseMarkdown,
    markdown: record.markdown,
  };
}

export function sameAuthoredFileRevisionSnapshot(
  left: AuthoredFileRevisionSnapshot,
  right: AuthoredFileRevisionSnapshot,
): boolean {
  return left.contentRevision === right.contentRevision
    && left.commit === right.commit
    && left.olderCommit === right.olderCommit
    && left.baselineAvailability === right.baselineAvailability
    && left.baseMarkdown === right.baseMarkdown
    && left.markdown === right.markdown;
}

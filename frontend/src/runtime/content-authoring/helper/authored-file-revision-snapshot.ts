/**
 * WHAT: Validates the complete immutable identity and bytes used by the unified Markdown diff editor.
 * WHY: Diff work may enter CodeMirror only when every server-owned snapshot member is present and coherent.
 */
export type AuthoredFileRevisionSnapshot = {
  contentRevision: string;
  commit: string;
  olderCommit: string | null;
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
    || typeof record.baseMarkdown !== 'string'
    || typeof record.markdown !== 'string'
  ) return null;
  return {
    contentRevision: record.contentRevision,
    commit: record.commit,
    olderCommit: record.olderCommit as string | null,
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
    && left.baseMarkdown === right.baseMarkdown
    && left.markdown === right.markdown;
}

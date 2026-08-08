/**
 * WHAT: Maps untouched authored diff hunks through one CodeMirror transaction and withdraws touched hunks.
 * WHY: Git presentation must track unrelated edits while disappearing atomically for edited change regions.
 */
import type {
  NormalizedAuthoredFileDiff,
  NormalizedAuthoredFileDiffHunk,
} from './normalize-authored-file-diff.js';

export type AuthoredFileChangeMap = {
  mapPos(position: number, association?: number): number;
  touchesRange(from: number, to?: number): boolean | 'cover';
};

function touched(changes: AuthoredFileChangeMap, hunk: NormalizedAuthoredFileDiffHunk): boolean {
  return Boolean(
    changes.touchesRange(hunk.from, hunk.to)
    || hunk.deletions.some((deletion) => changes.touchesRange(deletion.anchor)),
  );
}

export function mapAuthoredFileDiff(
  diff: NormalizedAuthoredFileDiff,
  changes: AuthoredFileChangeMap,
  document: string,
): NormalizedAuthoredFileDiff {
  return {
    ...diff,
    document,
    hunks: diff.hunks
      .filter((hunk) => !touched(changes, hunk))
      .map((hunk) => ({
        ...hunk,
        from: changes.mapPos(hunk.from, 1),
        to: changes.mapPos(hunk.to, -1),
        deletions: hunk.deletions.map((deletion) => ({
          ...deletion,
          anchor: changes.mapPos(deletion.anchor, 1),
        })),
        additions: hunk.additions.map((range) => ({
          from: changes.mapPos(range.from, 1),
          to: changes.mapPos(range.to, -1),
        })),
      })),
  };
}

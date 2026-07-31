/**
 * WHAT: Converts complete Pierre line metadata into document ranges and deletion anchors.
 * WHY: CodeMirror state must receive validated positions without depending on Pierre renderer ownership.
 */
export type AuthoredFileDiffRange = { from: number; to: number };
export type AuthoredFileDiffDeletion = {
  anchor: number;
  text: string;
  order: number;
};

export type NormalizedAuthoredFileDiffHunk = {
  id: string;
  from: number;
  to: number;
  additions: AuthoredFileDiffRange[];
  deletions: AuthoredFileDiffDeletion[];
};

export type NormalizedAuthoredFileDiff = {
  identity: string;
  document: string;
  hunks: NormalizedAuthoredFileDiffHunk[];
};

type PierreChange = {
  type: 'change';
  deletions: number;
  deletionLineIndex: number;
  additions: number;
  additionLineIndex: number;
};

type PierreContext = { type: 'context'; lines: number };
type PierreHunk = {
  additionStart: number;
  deletionStart: number;
  hunkContent: Array<PierreChange | PierreContext>;
};
type PierreMetadata = {
  isPartial: boolean;
  additionLines: string[];
  deletionLines: string[];
  hunks: PierreHunk[];
};

function lineStarts(markdown: string): number[] {
  const starts = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === '\n') starts.push(index + 1);
  }
  return starts;
}

function lineOffset(starts: readonly number[], markdown: string, oneBasedLine: number): number {
  if (oneBasedLine <= 1) return 0;
  return starts[oneBasedLine - 1] ?? markdown.length;
}

function joinPierreLines(lines: readonly string[]): string {
  return lines.map((line, index) => (
    index < lines.length - 1 && !line.endsWith('\n') ? `${line}\n` : line
  )).join('');
}

function metadata(value: unknown): PierreMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (
    record.isPartial !== false
    || !Array.isArray(record.additionLines)
    || !record.additionLines.every((line) => typeof line === 'string')
    || !Array.isArray(record.deletionLines)
    || !record.deletionLines.every((line) => typeof line === 'string')
    || !Array.isArray(record.hunks)
  ) return null;
  return record as unknown as PierreMetadata;
}

export function normalizeAuthoredFileDiff(input: {
  identity: string;
  document: string;
  metadata: unknown;
}): NormalizedAuthoredFileDiff {
  const parsed = metadata(input.metadata);
  if (!parsed) throw new Error('Pierre returned incomplete authored-file diff metadata.');
  const starts = lineStarts(input.document);
  const hunks: NormalizedAuthoredFileDiffHunk[] = [];
  parsed.hunks.forEach((hunk, hunkIndex) => {
    if (
      !Number.isInteger(hunk.additionStart)
      || !Number.isInteger(hunk.deletionStart)
      || !Array.isArray(hunk.hunkContent)
    ) throw new Error('Pierre returned invalid hunk coordinates.');
    let newLine = hunk.additionStart;
    let oldLine = hunk.deletionStart;
    const additions: AuthoredFileDiffRange[] = [];
    const deletions: AuthoredFileDiffDeletion[] = [];
    for (const content of hunk.hunkContent) {
      if (content.type === 'context') {
        newLine += content.lines;
        oldLine += content.lines;
        continue;
      }
      if (content.type !== 'change') throw new Error('Pierre returned an unknown hunk segment.');
      const anchor = lineOffset(starts, input.document, newLine);
      if (content.additions > 0) {
        additions.push({
          from: anchor,
          to: lineOffset(starts, input.document, newLine + content.additions),
        });
      }
      if (content.deletions > 0) {
        deletions.push({
          anchor,
          order: deletions.length,
          text: joinPierreLines(parsed.deletionLines.slice(
          content.deletionLineIndex,
          content.deletionLineIndex + content.deletions,
          )),
        });
      }
      newLine += content.additions;
      oldLine += content.deletions;
    }
    const positions = additions.flatMap((range) => [range.from, range.to]);
    positions.push(...deletions.map((deletion) => deletion.anchor));
    // WHAT: Retain the hunk's new-file start when Pierre reports no visible range.
    // WHY: Empty or malformed position arrays must not produce infinite editor coordinates.
    if (positions.length === 0) positions.push(lineOffset(starts, input.document, hunk.additionStart));
    hunks.push({
      id: `${input.identity}:${hunkIndex}`,
      from: Math.min(...positions),
      to: Math.max(...positions),
      additions,
      deletions,
    });
  });
  return { identity: input.identity, document: input.document, hunks };
}

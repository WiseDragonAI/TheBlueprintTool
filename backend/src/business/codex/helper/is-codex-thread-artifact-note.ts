/**
 * WHAT: Identifies thread notes that are Codex run artifacts instead of operator/agent conversation.
 * WHY: Codex artifacts render in the thread, but they must not be fed back into Codex as human context.
 */
type AnyRecord = Record<string, unknown>;

export function isCodexThreadArtifactNote(note: AnyRecord): boolean {
  const id = String(note.id ?? '');
  return Boolean(
    note.codexRunId
      || note.codexKind
      || note.codexEventType
      || note.codexLine
      || note.codexTool
      || note.codexExitCode
      || id.startsWith('codex-')
  );
}

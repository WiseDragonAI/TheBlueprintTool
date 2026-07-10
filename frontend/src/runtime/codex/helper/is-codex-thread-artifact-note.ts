/**
 * WHAT: Identifies deterministic Codex lifecycle artifacts in a thread note collection.
 * WHY: Run diagnostics belong in Codex Log while direct operator and agent notes remain conversation.
 */
const codexLifecycleFields = [
  'codexRunId',
  'codexKind',
  'codexEventType',
  'codexLine',
  'codexTool',
  'codexExitCode',
] as const;

export function isCodexThreadArtifactNote(note: Record<string, unknown>): boolean {
  if (String(note.id ?? '').startsWith('codex-')) return true;
  return codexLifecycleFields.some((field) => String(note[field] ?? '').trim() !== '');
}

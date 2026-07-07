/**
 * WHAT: Builds the stdin prompt for resuming a Codex skill run with newer thread notes.
 * WHY: The resumed session needs one deterministic payload while preserving message boundaries.
 */
type AnyRecord = Record<string, unknown>;

function noteRole(note: AnyRecord): string {
  const role = String(note.role ?? '').toLowerCase();
  return role === 'agent' || role === 'assistant' ? 'AGENT' : 'OPERATOR';
}

function noteBody(note: AnyRecord): string {
  return String(note.message ?? note.body ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
}

function formatMessage(note: AnyRecord, index: number, total: number): string {
  const lines = [
    `--- Message ${index} of ${total} ---`,
    `Role: ${noteRole(note)}`,
  ];
  const timestamp = String(note.timestamp ?? '').trim();
  const id = String(note.id ?? '').trim();
  if (timestamp) lines.push(`Timestamp: ${timestamp}`);
  if (id) lines.push(`Thread note id: ${id}`);
  lines.push('', noteBody(note) || '(empty message)', `--- End Message ${index} ---`);
  return lines.join('\n');
}

export function buildCardSkillContinuePrompt(input: { messages: AnyRecord[] }): string {
  return [
    'Continue the session with the additional information:',
    '',
    input.messages.map((message, index) => formatMessage(message, index + 1, input.messages.length)).join('\n\n'),
  ].join('\n');
}

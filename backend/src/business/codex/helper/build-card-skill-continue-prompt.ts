/**
 * WHAT: Builds the stdin prompt for continuing a Codex skill run with newer thread notes.
 * WHY: Resumed and fresh sessions need one deterministic payload while preserving message boundaries.
 */
type AnyRecord = Record<string, unknown>;

type NewSessionContext = {
  workspaceRoot: string;
  ledgerFile: string;
  runId: string;
  cardId: string;
  cardTitle: string;
  outputFile: string;
  outputMarkdown: string;
  context: AnyRecord;
};

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

export function buildCardSkillContinuePrompt(input: { messages: AnyRecord[]; newSessionContext?: NewSessionContext }): string {
  const messages = input.messages.map((message, index) => formatMessage(message, index + 1, input.messages.length)).join('\n\n');
  if (input.newSessionContext) {
    const context = input.newSessionContext;
    return [
      'Start a new Codex session for an existing decision-os run.',
      'The previous Codex session is unavailable. Continue from the current Decision OS context below.',
      '',
      'Decision OS context:',
      '```json',
      JSON.stringify(context.context, null, 2),
      '```',
      '',
      'Use ledger-cli for ledger writes and persist the final thread reply with `answer --message-stdin`.',
    ].join('\n');
  }
  return [
    'Continue the session with the additional information:',
    '',
    messages,
  ].join('\n');
}

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
      'ledger-cli is on PATH; use $DECISION_OS_LEDGER_FILE and do not locate the CLI.',
      'The previous Codex session is intentionally unavailable. Reconstruct context from the durable workspace state below.',
      '',
      'Scope:',
      `Workspace root: ${context.workspaceRoot}`,
      `Ledger file: ${context.ledgerFile}`,
      `Codex run id: ${context.runId}`,
      `Output card id: ${context.cardId}`,
      `Output card title: ${context.cardTitle}`,
      `Output markdown file: ${context.outputFile}`,
      '',
      'Rules:',
      '1. Read the output markdown and inspect the linked source card in the ledger before acting.',
      '2. Treat the newer thread messages below as the operator request for this turn.',
      '3. Apply requested repo edits and update the output markdown with the useful final result.',
      '4. Do not edit ledger JSON manually.',
      '5. Keep unrelated files unchanged.',
      '6. Use English only.',
      '',
      'Current output markdown:',
      '```markdown',
      context.outputMarkdown,
      '```',
      '',
      'Newer thread messages:',
      messages,
    ].join('\n');
  }
  return [
    'Continue the session with the additional information:',
    '',
    messages,
  ].join('\n');
}

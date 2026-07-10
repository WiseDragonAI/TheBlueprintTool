/**
 * WHAT: Converts one physical Codex JSONL event into the stable thread-note event contract.
 * WHY: Status reads and live ingestion must interpret identical producer records identically.
 */
import {
  type NormalizedRunEvent,
  type ParsedRunLine
} from './card-skill-run-event-types.js';

type AnyRecord = Record<string, unknown>;

function commandText(command: unknown): string {
  // WHAT: Preserve argv boundaries as readable spaces for array-form commands.
  // WHY: Codex command events may represent the command as an array or a scalar.
  if (Array.isArray(command)) return command.map((entry) => String(entry)).join(' ');
  return String(command ?? '').trim();
}

function textBlock(value: unknown): string {
  // WHAT: Flatten structured text fragments into their readable message fields.
  // WHY: Agent messages and tool output arrive in both scalar and block-array forms.
  if (Array.isArray(value)) {
    return value.map((entry) => {
      // WHAT: Preserve primitive fragments without inventing a record shape.
      // WHY: Mixed producer arrays may contain both text objects and scalar values.
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return String(entry ?? '');
      const record = entry as AnyRecord;
      return String(record.text ?? record.summary ?? record.message ?? JSON.stringify(record));
    }).join('\n').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
  }
  // WHAT: Retain unknown structured payloads as formatted JSON.
  // WHY: Dropping object-shaped output would hide potentially useful lifecycle evidence.
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2).replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
}

function fencedTextBlock(output: string, language = 'text'): string {
  const runs = Array.from(output.matchAll(/`+/g), (match) => match[0].length);
  const fence = '`'.repeat(Math.max(3, ...runs) + 1);
  return `${fence}${language}\n${output}\n${fence}`;
}

function itemRecord(event: AnyRecord): AnyRecord {
  return event.item && typeof event.item === 'object' && !Array.isArray(event.item) ? event.item as AnyRecord : {};
}

function changesText(changes: unknown): string {
  // WHAT: Retain a non-array change payload through the generic text normalizer.
  // WHY: Older producers do not always emit the current change-list shape.
  if (!Array.isArray(changes)) return textBlock(changes) || 'File changes recorded.';
  return changes.map((change) => {
    // WHAT: Preserve malformed list entries as readable bullets.
    // WHY: One irregular change item must not discard the rest of the file-change event.
    if (!change || typeof change !== 'object' || Array.isArray(change)) return `- ${String(change)}`;
    const record = change as AnyRecord;
    const path = String(record.path ?? record.file ?? record.name ?? 'file');
    const action = String(record.kind ?? record.type ?? record.action ?? record.status ?? 'changed');
    return `- ${path}: ${action}`;
  }).join('\n');
}

export function normalizeCardSkillRunEvent(line: ParsedRunLine): NormalizedRunEvent {
  const event = line.event;
  const type = String(event.type ?? '');
  const item = itemRecord(event);
  const itemType = String(item.type ?? '');
  const itemId = String(item.id ?? event.id ?? '');
  const status = String(item.status ?? event.status ?? '');
  // WHAT: Map terminal turn lifecycle events to a stable run-status note.
  // WHY: Consumers should not depend on producer-specific fields for completion state.
  if (type === 'turn.completed') {
    return { line: line.line, type, kind: 'run_status', title: 'Turn completed', text: 'Codex turn completed.', status: 'complete', itemId, tool: '', exitCode: '', persist: true };
  }
  // WHAT: Map turn start lifecycle events to a stable running note.
  // WHY: The thread should show progress before agent content arrives.
  if (type === 'turn.started') {
    return { line: line.line, type, kind: 'run_status', title: 'Turn started', text: 'Codex turn started.', status: 'running', itemId, tool: '', exitCode: '', persist: true };
  }
  // WHAT: Map thread start lifecycle events to the same stable status vocabulary.
  // WHY: New sessions must surface their lifecycle even before a turn begins.
  if (type === 'thread.started') {
    return { line: line.line, type, kind: 'run_status', title: 'Thread started', text: 'Codex thread started.', status: 'running', itemId, tool: '', exitCode: '', persist: true };
  }
  // WHAT: Normalize agent output into a durable agent-message event.
  // WHY: Message payload shape varies across Codex versions.
  if (itemType === 'agent_message') {
    const text = textBlock(item.text ?? item.message ?? event.text);
    return { line: line.line, type, kind: 'agent_message', title: 'Codex message', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
  }
  // WHAT: Normalize reasoning-like producer item names into one thinking event kind.
  // WHY: Producer vocabulary has used multiple names for the same operator-facing content.
  if (/reason|thinking|thought/i.test(itemType)) {
    const text = textBlock(item.text ?? item.summary ?? item.message ?? event.text);
    return { line: line.line, type, kind: 'thinking', title: 'Codex thinking', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
  }
  // WHAT: Format command execution details as one Markdown tool-call note.
  // WHY: Commands, status, exit code, and output must remain readable without raw JSON inspection.
  if (itemType === 'command_execution') {
    const tool = commandText(item.command);
    const output = textBlock(item.aggregated_output ?? item.output ?? item.stderr ?? item.stdout);
    const exitCode = item.exit_code === undefined || item.exit_code === null ? '' : String(item.exit_code);
    const command = tool ? `\`${tool}\`` : 'command';
    const parts = [`**Tool call** ${command}`];
    if (status) parts.push(`Status: ${status}`);
    if (exitCode) parts.push(`Exit code: ${exitCode}`);
    if (output) parts.push('', fencedTextBlock(output));
    return { line: line.line, type, kind: 'tool_call', title: tool || 'Tool call', text: parts.join('\n'), status, itemId, tool, exitCode, persist: true };
  }
  // WHAT: Format file-change records as a stable change list.
  // WHY: Durable thread history should show what the run modified.
  if (itemType === 'file_change') {
    const text = changesText(item.changes);
    return { line: line.line, type, kind: 'file_change', title: 'File changes', text, status, itemId, tool: '', exitCode: '', persist: true };
  }
  const text = textBlock(item.text ?? item.message ?? event.text);
  return {
    line: line.line,
    type,
    kind: itemType || type || 'event',
    title: itemType || type || 'Codex event',
    text,
    status,
    itemId,
    tool: '',
    exitCode: '',
    persist: Boolean(text),
  };
}

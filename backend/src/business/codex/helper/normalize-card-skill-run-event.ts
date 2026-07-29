/**
 * WHAT: Converts one physical Codex JSONL event into the stable thread-note event contract.
 * WHY: Status reads and live ingestion must interpret identical producer records identically.
 */
import {
  type NormalizedRunEvent,
  type ParsedRunLine
} from './card-skill-run-event-types.js';
import { isAbsolute, relative } from 'node:path';

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
    const sourcePath = String(record.path ?? record.file ?? record.name ?? 'file');
    // WHAT: Display files relative to the workspace from which decision-os was launched.
    // WHY: Absolute host paths consume the mobile log without adding repository context.
    const workspacePath = isAbsolute(sourcePath) ? relative(process.cwd(), sourcePath) : sourcePath;
    const path = workspacePath && !workspacePath.startsWith('..') ? workspacePath : sourcePath;
    const action = String(record.kind ?? record.type ?? record.action ?? record.status ?? 'changed');
    return `- ${path}: ${action}`;
  }).join('\n');
}

function todoListItems(items: unknown): Array<{ text: string; completed: boolean }> {
  if (!Array.isArray(items)) return [];
  return items.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as AnyRecord;
    const text = String(record.text ?? '').trim();
    return text ? [{ text, completed: record.completed === true }] : [];
  });
}

function todoListStatus(type: string, status: string): string {
  if (status) return status;
  if (/\.completed$/i.test(type)) return 'completed';
  if (/\.(?:started|updated)$/i.test(type)) return 'in_progress';
  return '';
}

function normalizedJsonlEvent(line: number, event: Omit<NormalizedRunEvent, 'line' | 'source' | 'sourceLine'>): NormalizedRunEvent {
  return { line, source: 'jsonl', sourceLine: line, ...event };
}

function diagnosticKind(text: string, declaredKind = ''): 'diagnostic' | 'warning' | 'error' | 'transport' {
  // WHAT: Classify connectivity failures as transport degradation before generic errors.
  // WHY: Operators need to distinguish producer failures from delivery instability.
  if (/reconnect|websocket|https transport|transport degraded|request timed out|connection (?:closed|lost|failed)/i.test(text)) return 'transport';
  // WHAT: Preserve producer-declared and textual warning signals.
  // WHY: Warning counts must include both structured and stderr-shaped records.
  if (/warn(?:ing)?/i.test(declaredKind) || /\bwarn(?:ing)?\b/i.test(text)) return 'warning';
  // WHAT: Classify explicit failures and non-zero exit evidence as errors.
  // WHY: Error counts must not depend on one producer event vocabulary.
  if (/error|failed/i.test(declaredKind) || /\berror\b|\bfailed\b|\benoent\b|exit code [1-9]/i.test(text)) return 'error';
  return 'diagnostic';
}

function normalizedDiagnostic(input: { line: number; source: 'jsonl' | 'stderr'; type: string; text: string; declaredKind?: string; itemId?: string; persist?: boolean }): NormalizedRunEvent {
  const kind = diagnosticKind(input.text, input.declaredKind);
  const severity = kind === 'error' ? 'error' : kind === 'warning' || kind === 'transport' ? 'warning' : 'info';
  const title = kind === 'transport' ? 'Transport degraded' : kind === 'warning' ? 'Warning' : kind === 'error' ? 'Error' : 'Diagnostic';
  const status = kind === 'transport' ? 'degraded' : kind === 'warning' ? 'warning' : kind === 'error' ? 'error' : '';
  return {
    line: input.line,
    source: input.source,
    sourceLine: input.line,
    type: input.type,
    kind,
    title,
    text: input.text,
    status,
    itemId: input.itemId ?? '',
    tool: '',
    output: '',
    exitCode: '',
    severity,
    persist: input.persist ?? false,
  };
}

export function normalizeCardSkillRunDiagnostic(input: { line: number; text: string }): NormalizedRunEvent {
  return normalizedDiagnostic({ line: input.line, source: 'stderr', type: 'stderr', text: input.text });
}

export function normalizeCardSkillRunEvent(line: ParsedRunLine): NormalizedRunEvent {
  const event = line.event;
  const type = String(event.type ?? '');
  const item = itemRecord(event);
  const itemType = String(item.type ?? '');
  const itemId = String(item.id ?? event.id ?? '');
  const status = String(item.status ?? event.status ?? '');
  if (type === 'decision_os.developer_prompt') {
    return normalizedJsonlEvent(line.line, {
      type,
      kind: 'diagnostic',
      title: 'Developer prompt',
      text: textBlock(event.prompt),
      status: '',
      itemId: '',
      tool: '',
      output: '',
      exitCode: '',
      severity: 'info',
      persist: false,
    });
  }
  // WHAT: Map terminal turn lifecycle events to a stable run-status note.
  // WHY: Consumers should not depend on producer-specific fields for completion state.
  if (type === 'turn.completed') {
    return normalizedJsonlEvent(line.line, { type, kind: 'run_status', title: 'Turn completed', text: 'Codex turn completed.', status: 'complete', itemId, tool: '', output: '', exitCode: '', severity: 'info', persist: true });
  }
  // WHAT: Map turn start lifecycle events to a stable running note.
  // WHY: The thread should show progress before agent content arrives.
  if (type === 'turn.started') {
    return normalizedJsonlEvent(line.line, { type, kind: 'run_status', title: 'Turn started', text: 'Codex turn started.', status: 'running', itemId, tool: '', output: '', exitCode: '', severity: 'info', persist: true });
  }
  // WHAT: Map thread start lifecycle events to the same stable status vocabulary.
  // WHY: New sessions must surface their lifecycle even before a turn begins.
  if (type === 'thread.started') {
    return normalizedJsonlEvent(line.line, { type, kind: 'run_status', title: 'Thread started', text: 'Codex thread started.', status: 'running', itemId, tool: '', output: '', exitCode: '', severity: 'info', persist: true });
  }
  // WHAT: Normalize terminal producer failures into the run-status vocabulary.
  // WHY: Failure state must not depend on incidental error words inside ordinary messages.
  if (/^(?:thread|turn|run)\.failed$/i.test(type)) {
    const text = textBlock(item.text ?? item.message ?? event.message ?? event.text) || 'Codex run failed.';
    return normalizedJsonlEvent(line.line, { type, kind: 'run_status', title: 'Run failed', text, status: 'failed', itemId, tool: '', output: '', exitCode: '', severity: 'error', persist: true });
  }
  // WHAT: Normalize both producer spellings of cancelled lifecycle records.
  // WHY: Clients consume one stable cancellation status.
  if (/cancelled|canceled/i.test(type)) {
    const text = textBlock(item.text ?? item.message ?? event.message ?? event.text) || 'Codex run cancelled.';
    return normalizedJsonlEvent(line.line, { type, kind: 'run_status', title: 'Run cancelled', text, status: 'cancelled', itemId, tool: '', output: '', exitCode: '', severity: 'warning', persist: true });
  }
  // WHAT: Normalize agent output into a durable agent-message event.
  // WHY: Message payload shape varies across Codex versions.
  if (itemType === 'agent_message') {
    const text = textBlock(item.text ?? item.message ?? event.text);
    return normalizedJsonlEvent(line.line, { type, kind: 'agent_message', title: 'Codex message', text, status, itemId, tool: '', output: '', exitCode: '', severity: 'info', persist: Boolean(text) });
  }
  // WHAT: Preserve producer comments as their own execution-log event.
  // WHY: Comments are execution output, not thread notes and not agent messages.
  if (itemType === 'comment') {
    const text = textBlock(item.text ?? item.message ?? event.message ?? event.text);
    return normalizedJsonlEvent(line.line, { type, kind: 'comment', title: 'Codex comment', text, status, itemId, tool: '', output: '', exitCode: '', severity: 'info', persist: Boolean(text) });
  }
  // WHAT: Normalize reasoning-like producer item names into one thinking event kind.
  // WHY: Producer vocabulary has used multiple names for the same operator-facing content.
  if (/reason|thinking|thought/i.test(itemType)) {
    const text = textBlock(item.text ?? item.summary ?? item.message ?? event.text);
    return normalizedJsonlEvent(line.line, { type, kind: 'thinking', title: 'Codex thinking', text, status, itemId, tool: '', output: '', exitCode: '', severity: 'info', persist: Boolean(text) });
  }
  // WHAT: Preserve native TodoList snapshots as a dedicated lifecycle event.
  // WHY: The producer emits ordered boolean state rather than readable text or command output.
  if (itemType === 'todo_list') {
    const items = todoListItems(item.items);
    const text = items.map((entry) => `- [${entry.completed ? 'x' : ' '}] ${entry.text}`).join('\n');
    return normalizedJsonlEvent(line.line, {
      type,
      kind: 'todo_list',
      title: 'Todo list',
      text,
      status: todoListStatus(type, status),
      itemId,
      tool: 'TodoList',
      output: JSON.stringify(items),
      exitCode: '',
      severity: 'info',
      persist: items.length > 0,
    });
  }
  // WHAT: Format command execution details as one Markdown tool-call note.
  // WHY: Commands, status, exit code, and output must remain readable without raw JSON inspection.
  if (itemType === 'command_execution' || itemType === 'web_search' || /tool_call/i.test(itemType)) {
    const tool = commandText(item.command ?? item.query ?? item.name);
    const output = textBlock(item.aggregated_output ?? item.output ?? item.stderr ?? item.stdout);
    const exitCode = item.exit_code === undefined || item.exit_code === null ? '' : String(item.exit_code);
    const command = tool ? `\`${tool}\`` : 'command';
    const parts = [`**Tool call** ${command}`];
    if (status) parts.push(`Status: ${status}`);
    if (exitCode) parts.push(`Exit code: ${exitCode}`);
    if (output) parts.push('', fencedTextBlock(output));
    return normalizedJsonlEvent(line.line, { type, kind: 'tool_call', title: tool || (itemType === 'web_search' ? 'Web search' : 'Tool call'), text: parts.join('\n'), status, itemId, tool, output, exitCode, severity: status === 'failed' ? 'error' : 'info', persist: true });
  }
  // WHAT: Normalize file changes as tool calls with the same lifecycle identity as commands.
  // WHY: Started and completed records must coalesce inside the compact tool disclosure.
  if (itemType === 'file_change') {
    const text = changesText(item.changes);
    return normalizedJsonlEvent(line.line, { type, kind: 'tool_call', title: 'File changes', text, status, itemId, tool: text, output: text, exitCode: '', severity: status === 'failed' ? 'error' : 'info', persist: true });
  }
  const text = textBlock(item.text ?? item.message ?? event.message ?? event.text);
  // WHAT: Promote diagnostic-shaped fallback records into the diagnostic contract.
  // WHY: Unknown producer item types must still surface warning, error, and transport evidence.
  if (/warn(?:ing)?|error|failed/i.test(itemType || type) || diagnosticKind(text) !== 'diagnostic') {
    return normalizedDiagnostic({ line: line.line, source: 'jsonl', type, text, declaredKind: itemType || type, itemId, persist: Boolean(text) });
  }
  return normalizedJsonlEvent(line.line, { type, kind: itemType || type || 'event', title: itemType || type || 'Codex event', text, status, itemId, tool: '', output: '', exitCode: '', severity: 'info', persist: Boolean(text) });
}

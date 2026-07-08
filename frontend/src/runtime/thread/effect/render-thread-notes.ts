/**
 * WHAT: Renders the active thread notes from the current ledger into the inspector.
 * WHY: Voice and text notes must appear as conversation ledger entries, not only draft text.
 */
import { state } from '../../state.js';
import { renderLedgerCardMarkdown } from '../../ledger/component/render-ledger-card-markdown.js';
import { sendActiveLedgerMutation } from '../../ledger/effect/send-active-ledger-mutation.js';
import { deletedNoteIdSet } from '../../ledger/helper/normalize-deleted-note-ids.js';
import { expireStaleVoiceTranscription, scheduleVoiceTranscriptionTimeout } from '../../voice/helper/expire-stale-voice-transcription.js';

type ThreadImageSizes = Record<string, { width?: number; height?: number }>;

const pendingThreadImageSizeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function noteText(note: Record<string, unknown>): string {
  return String(note.message ?? note.body ?? '');
}

function normalizeCodexKind(note: Record<string, unknown>): string {
  return String(note.codexKind ?? '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
}

function imageSizeSignature(note: Record<string, unknown>): string {
  const sizes = threadImageSizes(note.imageSizes);
  const entries = Object.entries(sizes).sort(([left], [right]) => left.localeCompare(right));
  return entries.map(([source, dimensions]) => `${source}:${dimensions.width ?? ''}x${dimensions.height ?? ''}`).join(',');
}

function threadNotesSignature(threadId: string, notes: Array<Record<string, unknown>>): string {
  const parts = [threadId, String(notes.length)];
  for (const note of notes) {
    const text = noteText(note);
    parts.push([
      String(note.id ?? ''),
      String(note.role ?? 'operator'),
      String(note.status ?? ''),
      String(note.voiceFileRef ?? ''),
      String(note.transcriptionStartedAt ?? ''),
      String(note.optimistic ?? ''),
      codexNoteClass(note),
      String(note.codexTool ?? ''),
      String(note.codexExitCode ?? ''),
      imageSizeSignature(note),
      String(text.length),
      hashText(text)
    ].join(':'));
  }
  return hashText(parts.join('|'));
}

function noteListDataset(list: HTMLElement): DOMStringMap {
  const element = list as HTMLElement & { dataset?: DOMStringMap };
  if (!element.dataset) element.dataset = {} as DOMStringMap;
  return element.dataset;
}

function codexNoteClass(note: Record<string, unknown>): string {
  const kind = normalizeCodexKind(note);
  return kind ? `is-codex-run-event is-codex-${kind}` : '';
}

function isCodexToolCallNote(note: Record<string, unknown>): boolean {
  return normalizeCodexKind(note) === 'tool_call';
}

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) return trimmed.slice(1, -1).trim();
  return trimmed;
}

function stripShellWrapper(command: string): string {
  const normalized = command.replace(/\s+/g, ' ').trim();
  const shell = normalized.match(/^(?:\/usr\/bin\/env\s+)?(?:\/[^\s]+\/)?(?:zsh|bash|sh)\s+-lc\s+(.+)$/);
  return shell?.[1] ? stripOuterQuotes(shell[1]) : normalized;
}

function commandFromToolCallMessage(message: string): string {
  return message.match(/\*\*Tool call\*\*\s+`([^`]+)`/)?.[1]?.trim() ?? '';
}

function codexToolCommand(note: Record<string, unknown>): string {
  return stripShellWrapper(String(note.codexTool ?? '').trim() || commandFromToolCallMessage(noteText(note)) || 'command');
}

function commandHasToken(command: string, tokens: string[]): boolean {
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(^|[\\s;&|()])(?:${escaped})(?=\\s|$)`, 'i').test(command);
}

function codexToolAction(command: string): string {
  if (commandHasToken(command, ['git', 'gh'])) return 'Git';
  if (commandHasToken(command, ['rg', 'grep', 'find', 'fd'])) return 'Search';
  if (commandHasToken(command, ['apply_patch', 'tee', 'touch', 'mkdir', 'rm', 'mv', 'cp', 'chmod', 'chown'])) return 'Write';
  if (/(^|[\s;&|()])(?:cat|sed|nl|head|tail|less|wc)(?=\s|$)/i.test(command)) return 'Read';
  if (/(^|[\s;&|()])(?:npm|pnpm|yarn|node|tsx|tsc|vitest|jest|playwright|pytest)(?=\s|$)/i.test(command)) return 'Ran';
  return 'Ran';
}

function shortenText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  const headLength = Math.max(24, Math.floor(maxLength * 0.62));
  const tailLength = Math.max(12, maxLength - headLength - 5);
  return `${compact.slice(0, headLength).trimEnd()} ... ${compact.slice(-tailLength).trimStart()}`;
}

function codexToolStatus(note: Record<string, unknown>): string {
  const status = String(note.status ?? '').trim();
  const exitCode = String(note.codexExitCode ?? '').trim();
  if (status && exitCode) return `${status} / code ${exitCode}`;
  if (status) return status;
  if (exitCode) return `code ${exitCode}`;
  return '';
}

function renderCodexToolCallNote(note: Record<string, unknown>, body: HTMLElement): HTMLElement {
  const command = codexToolCommand(note);
  const action = codexToolAction(command);
  const details = document.createElement('details');
  details.className = 'codex-tool-call';
  details.dataset.codexToolAction = action.toLowerCase();

  const summary = document.createElement('summary');
  summary.className = 'codex-tool-call-summary';
  summary.title = command;

  const actionLabel = document.createElement('span');
  actionLabel.className = 'codex-tool-call-action';
  actionLabel.textContent = action;

  const commandLabel = document.createElement('span');
  commandLabel.className = 'codex-tool-call-command';
  commandLabel.textContent = shortenText(command, 118);

  const status = codexToolStatus(note);
  const statusLabel = document.createElement('span');
  statusLabel.className = 'codex-tool-call-status';
  statusLabel.textContent = status;
  statusLabel.setAttribute('aria-hidden', status ? 'false' : 'true');

  summary.append(actionLabel, commandLabel, statusLabel);
  body.classList.add('codex-tool-call-details');
  details.append(summary, body);
  return details;
}

function threadImageSizes(value: unknown): ThreadImageSizes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const sizes: ThreadImageSizes = {};
  for (const [source, dimensions] of Object.entries(value as Record<string, unknown>)) {
    if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) continue;
    const width = Number((dimensions as Record<string, unknown>).width);
    const height = Number((dimensions as Record<string, unknown>).height);
    sizes[source] = {
      width: Number.isFinite(width) && width > 0 ? width : undefined,
      height: Number.isFinite(height) && height > 0 ? height : undefined
    };
  }
  return sizes;
}

function persistThreadImageSize(input: { threadId: string; note: Record<string, unknown>; source: string; width: number; height: number }): void {
  const noteId = String(input.note.id ?? '');
  if (!input.threadId || !noteId) return;
  const imageSizes = threadImageSizes(input.note.imageSizes);
  const existing = imageSizes[input.source] ?? {};
  if (existing.width === input.width && existing.height === input.height) return;
  imageSizes[input.source] = { width: input.width, height: input.height };
  input.note.imageSizes = imageSizes;
  const timerKey = `${input.threadId}:${noteId}:${input.source}`;
  const pending = pendingThreadImageSizeTimers.get(timerKey);
  if (pending) clearTimeout(pending);
  pendingThreadImageSizeTimers.set(timerKey, setTimeout(() => {
    pendingThreadImageSizeTimers.delete(timerKey);
    void sendActiveLedgerMutation({
      action: 'update-note',
      note: { id: noteId, threadId: input.threadId, imageSizes: threadImageSizes(input.note.imageSizes) }
    });
  }, 240));
}

export function renderThreadNotes(): void {
  const existing = document.querySelector('.thread-note-list') as HTMLElement | null;
  const feed = document.querySelector('.thread-feed') as HTMLElement | null;
  if (!feed && !existing) return;
  const list = existing ?? document.createElement('ol');
  list.className = 'thread-note-list';
  if (!existing) feed?.append(list);
  const deletedIds = state.threadId && state.activeLedger ? deletedNoteIdSet(state.activeLedger, state.threadId) : new Set<string>();
  const notes = state.threadId ? (state.activeLedger?.notes?.[state.threadId] ?? []).filter((note: Record<string, unknown>) => !deletedIds.has(String(note.id ?? ''))) : [];
  for (const note of notes) {
    if (!expireStaleVoiceTranscription(note)) scheduleVoiceTranscriptionTimeout({ threadId: state.threadId, note });
  }
  const signature = threadNotesSignature(String(state.threadId ?? ''), notes);
  const dataset = noteListDataset(list);
  if (existing && dataset.threadId === String(state.threadId ?? '') && dataset.notesSignature === signature) return;
  dataset.threadId = String(state.threadId ?? '');
  dataset.notesSignature = signature;
  list.replaceChildren();
  for (const note of notes) {
    const status = String(note.status ?? '');
    const role = String(note.role ?? 'operator').toLowerCase();
    const agentOwned = role === 'agent' || role === 'assistant';
    const noteId = String(note.id ?? '');
    const normalizedStatus = status.toLowerCase();
    const busy = /committing|uploading|transcribing|retrying/.test(normalizedStatus);
    const retryable = Boolean(note.voiceFileRef) && /failed|not configured|unavailable/.test(normalizedStatus);
    const item = document.createElement('li');
    item.className = ['thread-note', note.voiceFileRef ? 'voice-note' : '', note.optimistic ? 'is-optimistic' : '', busy ? 'is-busy' : '', retryable ? 'is-retryable' : '', codexNoteClass(note), agentOwned ? 'is-agent' : 'is-operator'].filter(Boolean).join(' ');
    const body = renderLedgerCardMarkdown(noteText(note), {
      imageSizes: threadImageSizes(note.imageSizes),
      mediaSurface: 'thread',
      onImageResize: (source, dimensions) => {
        persistThreadImageSize({
          threadId: state.threadId,
          note,
          source,
          width: dimensions.width,
          height: dimensions.height
        });
      }
    });
    body.classList.add('thread-note-message');
    const noteBody = isCodexToolCallNote(note) ? renderCodexToolCallNote(note, body) : body;
    const meta = document.createElement('span');
    meta.className = 'thread-note-meta';
    meta.textContent = status;
    const deleteButton = document.createElement('button');
    deleteButton.className = 'thread-note-delete terminal-button terminal-button--compact';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'confirm-delete-note';
    deleteButton.dataset.threadId = state.threadId;
    deleteButton.dataset.noteId = noteId;
    deleteButton.title = 'Delete note';
    deleteButton.setAttribute('aria-label', 'Delete note');
    deleteButton.textContent = 'X';
    item.append(noteBody);
    if (status && !busy) item.append(meta);
    if (noteId) item.append(deleteButton);
    if (busy) {
      const spinner = document.createElement('span');
      spinner.className = 'thread-note-spinner';
      spinner.textContent = normalizedStatus || 'processing';
      item.append(spinner);
    }
    if (retryable) {
      const retry = document.createElement('button');
      retry.className = 'thread-note-retry terminal-button terminal-button--compact';
      retry.type = 'button';
      retry.dataset.action = 'voice-retry';
      retry.dataset.threadId = state.threadId;
      retry.dataset.noteId = String(note.id ?? '');
      retry.dataset.voiceFileRef = String(note.voiceFileRef ?? '');
      retry.textContent = 'Retry';
      item.append(retry);
    }
    list.append(item);
  }
}

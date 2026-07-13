/**
 * WHAT: Resolves the complete, bounded context for one card and its direct links.
 * WHY: Codex intake should need one read instead of repeated ledger and Markdown crawls.
 */
import { promises } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { resolveLedgerCardContext } from './resolve-ledger-zone-context.js';
import { resolveCardContentFile } from './card-content-file.js';
import { validateMasterTasks } from './validate-master-tasks.js';

type JsonObject = Record<string, unknown>;
function record(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
async function read(path: string, fs?: FileSystemPort): Promise<string> { return fs ? fs.readFile(path) : promises.readFile(path, 'utf8'); }

function scopeError(ledgerJsonFile: string): Result<never> | null {
  const rootValue = process.env.DECISION_OS_ROOT?.trim();
  if (!rootValue) return null;
  const root = resolve(rootValue);
  const ledger = resolve(ledgerJsonFile);
  const inner = relative(root, ledger);
  return !inner || inner.startsWith('..') || isAbsolute(inner)
    ? { ok: false, error: JSON.stringify({ version: 1, code: 'scope_mismatch' }) }
    : null;
}

export async function resolveSessionContext(input: { ledger: unknown; ledgerJsonFile: string; cardId?: string; fs?: FileSystemPort }): Promise<Result<string>> {
  const mismatch = scopeError(input.ledgerJsonFile);
  if (mismatch) return mismatch;
  const context = resolveLedgerCardContext(input);
  if (!context.ok) return { ok: false, error: JSON.stringify({ version: 1, code: 'not_found', message: context.error }) };
  if (!record(input.ledger)) return { ok: false, error: JSON.stringify({ version: 1, code: 'invalid_markdown' }) };
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards.filter(record) : [];
  const relationships = [...context.value.relationships.inbound, ...context.value.relationships.outbound];
  const linkedIds = new Set(relationships.flatMap((entry) => [text(entry.from), text(entry.to)]).filter((id) => id && id !== input.cardId));
  const selectedCards = cards.filter((card) => text(card.id) === input.cardId || linkedIds.has(text(card.id)));
  const selected: Array<{ metadata: JsonObject; contentFile: string; absoluteContentFile: string; markdown: string }> = [];
  for (const card of selectedCards) {
    const comment = record(card.comment) ? card.comment : {};
    const file = resolveCardContentFile(input.ledgerJsonFile, comment.contentFile);
    let markdown = text(comment.what);
    if (file) {
      try { markdown = await read(file, input.fs); } catch { return { ok: false, error: JSON.stringify({ version: 1, code: 'invalid_markdown', cardId: text(card.id) }) }; }
    }
    selected.push({ metadata: card, contentFile: text(comment.contentFile), absoluteContentFile: file ?? '', markdown });
  }
  const threadId = `thread-${input.cardId}`;
  const threadFiles = record(input.ledger.threadFiles) ? input.ledger.threadFiles : {};
  const threadRef = text(threadFiles[threadId]);
  const workspace = resolve(input.ledgerJsonFile, '../..');
  const threadFile = threadRef ? resolve(workspace, threadRef.replace(/^\.\//, '')) : '';
  let threadMarkdown = '';
  if (threadFile) {
    const inner = relative(workspace, threadFile);
    if (!inner || inner.startsWith('..') || isAbsolute(inner)) return { ok: false, error: JSON.stringify({ version: 1, code: 'scope_mismatch' }) };
    try { threadMarkdown = await read(threadFile, input.fs); } catch { return { ok: false, error: JSON.stringify({ version: 1, code: 'invalid_markdown', threadId }) }; }
  }
  const hydrated = { ...input.ledger, cards: selectedCards.map((card) => {
    const entry = selected.find((candidate) => text(candidate.metadata.id) === text(card.id));
    return { ...card, comment: { ...(record(card.comment) ? card.comment : {}), what: entry?.markdown ?? '' } };
  }) };
  const validation = validateMasterTasks(hydrated, input.cardId);
  return { ok: true, value: JSON.stringify({
    version: 1,
    projectId: process.env.DECISION_OS_PROJECT_ID ?? '',
    ledgerFile: resolve(input.ledgerJsonFile),
    decisionOsRoot: process.env.DECISION_OS_ROOT ?? '',
    serverUrl: process.env.DECISION_OS_SERVER_URL ?? '',
    card: selected.find((entry) => text(entry.metadata.id) === input.cardId),
    run: (() => {
      const target = selected.find((entry) => text(entry.metadata.id) === input.cardId)?.metadata ?? {};
      return { runId: text(target.codexThreadRunId) || text(target.codexPipelineRunId), outputFile: text(target.codexThreadRunOutputFile), model: text(target.codexRunModel), effort: text(target.codexRunEffort) };
    })(),
    thread: { id: threadId, contentFile: threadRef, absoluteContentFile: threadFile, markdown: threadMarkdown },
    zone: context.value.zone,
    relationships: context.value.relationships,
    linkedCards: selected.filter((entry) => text(entry.metadata.id) !== input.cardId),
    validation,
  }, null, 2) };
}

export async function resolveMasterTaskGate(input: { ledger: unknown; ledgerJsonFile: string; cardId?: string; fs?: FileSystemPort }): Promise<Result<string>> {
  const context = await resolveSessionContext(input);
  if (!context.ok) return context;
  const value = JSON.parse(context.value) as JsonObject;
  const linkedCards = Array.isArray(value.linkedCards) ? value.linkedCards.filter(record) : [];
  const validation = record(value.validation) ? value.validation : {};
  const discrepancies: string[] = [];
  if (Array.isArray(validation.errors) && validation.errors.length > 0) discrepancies.push('invalid_master_task');
  for (const linked of linkedCards) {
    const metadata = record(linked.metadata) ? linked.metadata : {};
    if (text(metadata.status) !== 'done') discrepancies.push(`linked_card_not_done:${text(metadata.id)}`);
  }
  const thread = record(value.thread) ? value.thread : {};
  const threadMarkdown = text(thread.markdown);
  const invalidRoles = threadMarkdown.split('\n').filter((line) => /^#\s+/.test(line) && !/^#\s+(?:OPERATOR|AGENT)\s*$/i.test(line));
  if (invalidRoles.length > 0) discrepancies.push('invalid_thread_role');
  const card = record(value.card) ? value.card : {};
  const masterMarkdown = text(card.markdown);
  const acceptanceTail = masterMarkdown.match(/^## [A-Z]\. Acceptance Criteria\s*$([\s\S]*)/m)?.[1] ?? '';
  const acceptanceSection = acceptanceTail.split(/\n---\s*\n|\n## [A-Z]\. /, 1)[0];
  const acceptanceCriteria = acceptanceSection.split('\n').map((line) => line.match(/^\s*\d+\.\s+(.+)$/)?.[1]).filter((line): line is string => Boolean(line));
  const staleProjections: string[] = [];
  for (const linked of linkedCards) {
    const metadata = record(linked.metadata) ? linked.metadata : {};
    const cardId = text(metadata.id);
    const projection = masterMarkdown.match(new RegExp(`\\(card:${cardId.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\)[^\\n]*Status:\\s*([^\\n]+)`, 'i'))?.[1]?.trim().toLowerCase();
    const expected = text(metadata.status) === 'done' ? 'complete' : 'pending';
    if (projection && projection !== expected) staleProjections.push(cardId);
  }
  if (staleProjections.length > 0) discrepancies.push(...staleProjections.map((id) => `stale_subtask_projection:${id}`));
  return { ok: true, value: JSON.stringify({ version: 1, ready: discrepancies.length === 0, discrepancies, threadRolesValid: invalidRoles.length === 0, acceptanceCriteria: acceptanceCriteria.map((criterion) => ({ criterion, state: 'reported' })), staleProjections, context: value }, null, 2) };
}

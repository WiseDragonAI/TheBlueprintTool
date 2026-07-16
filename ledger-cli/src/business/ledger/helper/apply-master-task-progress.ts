/**
 * WHAT: Atomically persists one complete master-task progress report.
 * WHY: Agents need one preflighted write for content, labels, verified statuses, and the thread reply.
 */
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Result } from '../../../lib/types.js';
import { canonicalSubtaskRelationships, isMasterCard, record, stripLegacyTaskProjection, withCanonicalTaskLabel } from './master-task-model.js';
import { validateMasterTasks } from './validate-master-tasks.js';

type JsonObject = Record<string, unknown>;
type Section = { title: string; markdown: string };
type Update = { cardId: string; title?: string; markdown?: string; sections?: Section[]; labels?: string[] };
type Plan = { masterCardId: string; updates: Update[]; verifiedSubtaskIds: string[]; reply: string };

function sections(value: unknown): Section[] {
  return Array.isArray(value) ? value.filter(record).map((item) => ({ title: String(item.title ?? '').trim(), markdown: String(item.markdown ?? '').trim() })).filter((item) => item.title && item.markdown) : [];
}

function renderSections(value: Section[]): string {
  return value.map((section, index) => `## ${String.fromCharCode(65 + index)}. ${section.title}\n\n${section.markdown}`).join('\n\n---\n\n');
}

function projectSubtaskLinks(markdown: string, links: string): string {
  const source = stripLegacyTaskProjection(markdown).trimEnd();
  const lines = source.split('\n');
  const headingIndex = lines.findIndex((line) => /^##\s+(?:[A-Z]\.\s+)?Subtasks\s*$/i.test(line));
  if (headingIndex < 0) {
    const sectionCount = lines.filter((line) => /^##\s+/.test(line)).length;
    const letter = String.fromCharCode(65 + Math.min(sectionCount, 25));
    return `${source}\n\n---\n\n## ${letter}. Subtasks\n\n${links}\n`;
  }
  const nextHeading = lines.findIndex((line, index) => index > headingIndex && /^##\s+/.test(line));
  const before = lines.slice(0, headingIndex + 1).join('\n').trimEnd();
  if (nextHeading < 0) return `${before}\n\n${links}\n`;
  const after = lines.slice(nextHeading).join('\n').replace(/^\n+/, '');
  return `${before}\n\n${links}\n\n---\n\n${after.trimEnd()}\n`;
}

function parsePlan(value: string): Result<Plan> {
  try {
    const source = JSON.parse(value) as JsonObject;
    const updates = Array.isArray(source.updates) ? source.updates.filter(record).map((item) => ({
      cardId: String(item.cardId ?? '').trim(),
      title: String(item.title ?? '').trim() || undefined,
      markdown: String(item.markdown ?? '').trim() || undefined,
      sections: sections(item.sections),
      labels: Array.isArray(item.labels) ? item.labels.map(String).map((label) => label.trim()).filter(Boolean) : undefined,
    })) : [];
    const plan = {
      masterCardId: String(source.masterCardId ?? '').trim(),
      updates,
      verifiedSubtaskIds: Array.isArray(source.verifiedSubtaskIds) ? source.verifiedSubtaskIds.map(String).map((id) => id.trim()).filter(Boolean) : [],
      reply: String(source.reply ?? '').trim(),
    };
    if (!plan.masterCardId || !plan.reply || updates.some((update) => !update.cardId || (!update.markdown && update.sections?.length === 0))) {
      return { ok: false, error: 'master-task-progress requires masterCardId, complete updates, verifiedSubtaskIds, and one reply.' };
    }
    return { ok: true, value: plan };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Invalid progress JSON.' }; }
}

function contentPath(ledgerFile: string, card: JsonObject): string | null {
  const comment = record(card.comment) ? card.comment : {};
  const ref = String(comment.contentFile ?? '').trim();
  if (!ref) return null;
  const workspace = resolve(ledgerFile, '../..');
  const file = resolve(workspace, ref);
  const inner = relative(workspace, file);
  return inner && !inner.startsWith('..') && !isAbsolute(inner) ? file : null;
}

export function applyMasterTaskProgress(input: { ledgerJsonFile: string; planJson: string }): Result<string> {
  const parsed = parsePlan(input.planJson);
  if (!parsed.ok) return parsed;
  const plan = parsed.value;
  const scopedRoot = process.env.DECISION_OS_LEDGER_ROOT?.trim();
  if (scopedRoot) {
    const inner = relative(resolve(scopedRoot), resolve(input.ledgerJsonFile));
    if (!inner || inner.startsWith('..') || isAbsolute(inner)) return { ok: false, error: JSON.stringify({ version: 1, code: 'scope_mismatch' }) };
  }
  const ledgerText = readFileSync(input.ledgerJsonFile, 'utf8');
  const ledger = JSON.parse(ledgerText) as JsonObject;
  const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(record).map((card) => ({ ...card })) : [];
  const masterIndex = cards.findIndex((card) => String(card.id ?? '') === plan.masterCardId);
  if (masterIndex < 0) return { ok: false, error: `Card not found: ${plan.masterCardId}` };
  const masterFile = contentPath(input.ledgerJsonFile, cards[masterIndex]);
  const masterMarkdown = masterFile && existsSync(masterFile) ? readFileSync(masterFile, 'utf8') : '';
  if (!isMasterCard(cards[masterIndex], masterMarkdown)) return { ok: false, error: `Card is not a master task: ${plan.masterCardId}` };

  const relationships = canonicalSubtaskRelationships(ledger, plan.masterCardId);
  const subtaskIds = new Set(relationships.map((entry) => String(entry.to ?? '')));
  const affected = new Set([plan.masterCardId, ...subtaskIds]);
  if (new Set(plan.updates.map((update) => update.cardId)).size !== plan.updates.length) return { ok: false, error: 'Progress updates contain duplicate card ids.' };
  if (plan.updates.some((update) => !affected.has(update.cardId))) return { ok: false, error: 'Progress updates may only target the master and canonical subtasks.' };
  if (plan.verifiedSubtaskIds.some((id) => !subtaskIds.has(id))) return { ok: false, error: 'Every verified subtask id must belong to the master.' };
  if (relationships.some((relationship) => !cards.some((card) => String(card.id ?? '') === String(relationship.to ?? '')))) return { ok: false, error: 'Every canonical subtask relationship must resolve to a card.' };

  cards[masterIndex] = withCanonicalTaskLabel(cards[masterIndex], 'master-task');
  for (const id of subtaskIds) {
    const index = cards.findIndex((card) => String(card.id ?? '') === id);
    cards[index] = withCanonicalTaskLabel(cards[index], 'subtask');
  }
  for (const id of plan.verifiedSubtaskIds) cards[cards.findIndex((card) => String(card.id ?? '') === id)].status = 'done';

  const files = new Map<string, string>();
  for (const update of plan.updates) {
    const index = cards.findIndex((card) => String(card.id ?? '') === update.cardId);
    const file = contentPath(input.ledgerJsonFile, cards[index]);
    if (!file) return { ok: false, error: `Card has no canonical content file: ${update.cardId}` };
    if (update.title) cards[index].title = update.title;
    if (update.labels) cards[index].labels = [...new Set(update.labels.filter((label) => label !== 'master-task' && label !== 'subtask').concat(update.cardId === plan.masterCardId ? 'master-task' : 'subtask'))];
    files.set(file, `${stripLegacyTaskProjection(update.markdown ?? renderSections(update.sections ?? [])).trimEnd()}\n`);
  }
  const canonicalLinks = relationships.map((relationship, index) => {
    const childId = String(relationship.to ?? '');
    const child = cards.find((card) => String(card.id ?? '') === childId)!;
    return `${index + 1}. [${String(child.title ?? childId)}](card:${childId})`;
  }).join('\n');
  if (!masterFile) return { ok: false, error: `Card has no canonical content file: ${plan.masterCardId}` };
  const pendingMasterMarkdown = files.get(masterFile) ?? masterMarkdown;
  files.set(masterFile, projectSubtaskLinks(pendingMasterMarkdown, canonicalLinks));

  const threadId = `thread-${plan.masterCardId}`;
  const threadFiles = record(ledger.threadFiles) ? ledger.threadFiles : {};
  const threadRef = String(threadFiles[threadId] ?? '').trim();
  const workspace = resolve(input.ledgerJsonFile, '../..');
  const threadFile = threadRef ? resolve(workspace, threadRef) : '';
  const threadInner = threadFile ? relative(workspace, threadFile) : '';
  if (!threadFile || !threadInner || threadInner.startsWith('..') || isAbsolute(threadInner) || !existsSync(threadFile)) return { ok: false, error: `Master thread not found: ${threadId}` };
  const threadText = readFileSync(threadFile, 'utf8');
  const invalidThreadHeadings = `${threadText}\n${plan.reply}`.split('\n').filter((line) => /^#\s+/.test(line) && !/^#\s+(?:OPERATOR|AGENT)\s*$/i.test(line));
  if (invalidThreadHeadings.length > 0) return { ok: false, error: 'Thread content contains an invalid top-level role heading.' };
  const nextThread = `${threadText.trimEnd()}\n\n# AGENT\n<!-- decision-os:note ${JSON.stringify({ id: `note-agent-${Date.now()}-${randomUUID().slice(0, 12)}`, timestamp: new Date().toISOString() })} -->\n\n${plan.reply}\n`;
  const nextLedger = { ...ledger, cards };
  const hydrated = { ...nextLedger, cards: cards.map((card) => {
    const file = contentPath(input.ledgerJsonFile, card);
    const markdown = file ? files.get(file) ?? (existsSync(file) ? readFileSync(file, 'utf8') : '') : '';
    return { ...card, comment: { ...(record(card.comment) ? card.comment : {}), what: markdown } };
  }) };
  const validation = validateMasterTasks(hydrated, plan.masterCardId);
  if (validation.errors.length > 0) return { ok: false, error: JSON.stringify({ version: 1, code: 'invalid_master_task', validation }) };

  const snapshots = new Map<string, string | null>([[input.ledgerJsonFile, ledgerText], [threadFile, threadText], ...[...files.keys()].map((file) => [file, existsSync(file) ? readFileSync(file, 'utf8') : null] as const)]);
  try {
    for (const [file, content] of files) writeFileSync(file, content, 'utf8');
    writeFileSync(threadFile, nextThread, 'utf8');
    writeFileSync(input.ledgerJsonFile, JSON.stringify(nextLedger, null, 2), 'utf8');
  } catch (error) {
    for (const [file, content] of snapshots) { if (content === null) rmSync(file, { force: true }); else writeFileSync(file, content, 'utf8'); }
    return { ok: false, error: error instanceof Error ? error.message : 'Master-task progress transaction failed.' };
  }
  const statuses = new Map(cards.map((card) => [String(card.id ?? ''), String(card.status ?? '')]));
  const discrepancies = [...subtaskIds].filter((id) => statuses.get(id) !== 'done').map((id) => `linked_card_not_done:${id}`);
  return { ok: true, value: JSON.stringify({ version: 1, masterCardId: plan.masterCardId, updatedCardIds: plan.updates.map((update) => update.cardId), verifiedSubtaskIds: plan.verifiedSubtaskIds, gate: { ready: discrepancies.length === 0, discrepancies } }, null, 2) };
}

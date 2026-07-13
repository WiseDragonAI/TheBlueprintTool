/**
 * WHAT: Applies one complete master-task projection with infrastructure-owned identities.
 * WHY: Planning must not require temporary card files, UUID calls, or partial ledger mutations.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { Result } from '../../../lib/types.js';
import { resolveCardZone } from './resolve-ledger-zone-context.js';
import { validateMasterTasks } from './validate-master-tasks.js';

type JsonObject = Record<string, unknown>;
type Subtask = { title: string; markdown: string };
type Plan = { masterCardId: string; title: string; zoneTitle?: string; masterMarkdown: string; subtasks: Subtask[] };
function record(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function id(prefix: 'card' | 'rel'): string { return `${prefix}-${randomUUID()}`; }
function safe(value: string): string { return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'; }

function parsePlan(value: string): Result<Plan> {
  try {
    const plan = JSON.parse(value) as JsonObject;
    const subtasks = Array.isArray(plan.subtasks) ? plan.subtasks.filter(record).map((item) => ({ title: String(item.title ?? '').trim(), markdown: String(item.markdown ?? '') })) : [];
    if (!String(plan.masterCardId ?? '').trim() || !String(plan.title ?? '').trim() || !String(plan.masterMarkdown ?? '').trim() || subtasks.some((item) => !item.title || !item.markdown.trim())) {
      return { ok: false, error: 'master-task-apply requires masterCardId, title, masterMarkdown, and complete subtasks.' };
    }
    return { ok: true, value: { masterCardId: String(plan.masterCardId), title: String(plan.title), zoneTitle: String(plan.zoneTitle ?? plan.title), masterMarkdown: String(plan.masterMarkdown), subtasks } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Invalid plan JSON.' }; }
}

export function applyMasterTaskPlan(input: { ledgerJsonFile: string; planJson: string }): Result<string> {
  const scopedRoot = process.env.DECISION_OS_ROOT?.trim();
  if (scopedRoot) {
    const inner = relative(resolve(scopedRoot), resolve(input.ledgerJsonFile));
    if (!inner || inner.startsWith('..') || isAbsolute(inner)) return { ok: false, error: JSON.stringify({ version: 1, code: 'scope_mismatch' }) };
  }
  const parsed = parsePlan(input.planJson);
  if (!parsed.ok) return parsed;
  const plan = parsed.value;
  const ledgerText = readFileSync(input.ledgerJsonFile, 'utf8');
  const ledger = JSON.parse(ledgerText) as JsonObject;
  const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(record).map((card) => ({ ...card })) : [];
  const relationships = Array.isArray(ledger.relationships) ? ledger.relationships.filter(record).map((entry) => ({ ...entry })) : [];
  const annotations = Array.isArray(ledger.annotations) ? ledger.annotations.filter(record).map((entry) => ({ ...entry })) : [];
  const master = cards.find((card) => String(card.id ?? '') === plan.masterCardId);
  if (!master) return { ok: false, error: `Card not found: ${plan.masterCardId}` };
  const zone = resolveCardZone(master, annotations);
  if (!zone) return { ok: false, error: `Owning zone not found: ${plan.masterCardId}` };
  const existingIds = new Set([...cards, ...relationships].map((entry) => String(entry.id ?? '')));
  const nextId = (prefix: 'card' | 'rel'): string => { let value = id(prefix); while (existingIds.has(value)) value = id(prefix); existingIds.add(value); return value; };
  const created = plan.subtasks.map((subtask, index) => ({ id: nextId('card'), relationshipId: nextId('rel'), ...subtask, index }));
  const links = created.map((item, index) => `${index + 1}. [${item.title}](card:${item.id}) — Status: pending`).join('\n');
  const masterMarkdown = /(?:^|\n)## [A-Z]\. Subtasks\s*\n[\s\S]*$/m.test(plan.masterMarkdown)
    ? plan.masterMarkdown.replace(/((?:^|\n)## [A-Z]\. Subtasks\s*\n)[\s\S]*$/m, `$1\n${links}\n`)
    : `${plan.masterMarkdown.trimEnd()}\n\n---\n\n## Z. Subtasks\n\n${links}\n`;
  master.title = plan.title;
  zone.label = plan.zoneTitle || plan.title;
  const domainId = String(master.domainId ?? 'specs');
  const baseX = Number(master.x ?? 0) + Number(master.w ?? 360) + 30;
  const baseY = Number(master.y ?? 0);
  const files = new Map<string, string>();
  const masterComment = record(master.comment) ? master.comment : {};
  const masterRef = String(masterComment.contentFile ?? `.decision-os/cards/${safe(domainId)}/${safe(plan.masterCardId)}.md`);
  files.set(resolve(input.ledgerJsonFile, '../..', masterRef), masterMarkdown);
  master.comment = { ...masterComment, contentFile: masterRef };
  for (const item of created) {
    const contentFile = `.decision-os/cards/${safe(domainId)}/${item.id}.md`;
    cards.push({ id: item.id, title: item.title, cardType: 'note', domainId, status: 'todo', x: baseX + (item.index % 2) * 380, y: baseY + Math.floor(item.index / 2) * 410, w: 340, h: 380, comment: { contentFile }, facts: [], fields: [] });
    relationships.push({ id: item.relationshipId, from: plan.masterCardId, to: item.id, label: 'subtask' });
    files.set(resolve(input.ledgerJsonFile, '../..', contentFile), item.markdown.trimEnd() + '\n');
  }
  const nextLedger = { ...ledger, cards, relationships, annotations };
  const validationLedger = { ...nextLedger, cards: cards.map((card) => {
    const comment = record(card.comment) ? card.comment : {};
    const contentFile = String(comment.contentFile ?? '');
    const markdown = [...files.entries()].find(([file]) => file === resolve(input.ledgerJsonFile, '../..', contentFile))?.[1];
    return markdown === undefined ? card : { ...card, comment: { ...comment, what: markdown } };
  }) };
  const validation = validateMasterTasks(validationLedger, plan.masterCardId);
  if (validation.errors.length > 0) return { ok: false, error: JSON.stringify({ version: 1, code: 'invalid_master_task', validation }) };
  const snapshots = new Map<string, string | null>([[input.ledgerJsonFile, ledgerText], ...[...files.keys()].map((file) => [file, existsSync(file) ? readFileSync(file, 'utf8') : null] as const)]);
  try {
    for (const [file, content] of files) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content, 'utf8'); }
    writeFileSync(input.ledgerJsonFile, JSON.stringify(nextLedger, null, 2), 'utf8');
  } catch (error) {
    for (const [file, content] of snapshots) { if (content === null) rmSync(file, { force: true }); else writeFileSync(file, content, 'utf8'); }
    return { ok: false, error: error instanceof Error ? error.message : 'Master-task transaction failed.' };
  }
  return { ok: true, value: JSON.stringify({ version: 1, masterCardId: plan.masterCardId, zoneId: zone.id, subtasks: created.map(({ id: cardId, relationshipId, title }) => ({ cardId, relationshipId, title, canonicalLink: `card:${cardId}` })) }, null, 2) };
}

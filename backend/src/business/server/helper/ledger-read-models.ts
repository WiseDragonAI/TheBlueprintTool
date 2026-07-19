/**
 * WHAT: Produces consumer-scoped ledger, card, thread, navigation, and search read models.
 * WHY: Each surface should receive only the bodies it renders while ledger JSON and Markdown remain authoritative.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hydrateLedgerCardContent, readCardDescription } from '../../ledger/helper/card-content-file.js';
import { parseThreadMarkdown, resolveThreadContentFile } from '../../ledger/helper/thread-content-file.js';
import { readCanonicalDecisionOsState } from '../../ledger/helper/read-canonical-decision-os-state.js';

type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function overlapArea(card: AnyRecord, zone: AnyRecord): number {
  const left = Number(card.x ?? 0), top = Number(card.y ?? 0), width = Number(card.w ?? card.width ?? 280), height = Number(card.h ?? card.height ?? 132);
  const zoneLeft = Number(zone.x ?? 0), zoneTop = Number(zone.y ?? 0), zoneWidth = Number(zone.width ?? zone.w ?? 0), zoneHeight = Number(zone.height ?? zone.h ?? 0);
  if (![left, top, width, height, zoneLeft, zoneTop, zoneWidth, zoneHeight].every(Number.isFinite)) return 0;
  return Math.max(0, Math.min(left + width, zoneLeft + zoneWidth) - Math.max(left, zoneLeft))
    * Math.max(0, Math.min(top + height, zoneTop + zoneHeight) - Math.max(top, zoneTop));
}

export function readLedgerSource(input: { decisionOsRoot: string; ledgerId: string }): { ledger: AnyRecord; ledgerPath: string } | null {
  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') } });
  const entry = state.ledgers.find((ledger) => ledger.id === input.ledgerId);
  if (!entry) return null;
  const ledgerPath = resolve(input.decisionOsRoot, String(entry.ledgerFile).replace(/^\.decision-os\//, ''));
  if (!existsSync(ledgerPath)) return null;
  return { ledger: JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord, ledgerPath };
}

function projectionSource(input: { decisionOsRoot: string; ledgerId: string; ledger?: AnyRecord }): { ledger: AnyRecord; ledgerPath: string } | null {
  return input.ledger ? { ledger: structuredClone(input.ledger), ledgerPath: '' } : readLedgerSource(input);
}

export function ledgerCanvasProjection(input: { decisionOsRoot: string; ledgerId: string; ledger?: AnyRecord }): AnyRecord | null {
  const source = projectionSource(input);
  if (!source) return null;
  const ledger = hydrateLedgerCardContent(source.ledger, input.decisionOsRoot);
  if (!ledger.notes || typeof ledger.notes !== 'object') ledger.notes = {};
  return ledger;
}

export function ledgerNavigationProjection(input: { decisionOsRoot: string; ledgerId: string; ledger?: AnyRecord }): AnyRecord | null {
  const source = projectionSource(input);
  if (!source) return null;
  const cards = records(source.ledger.cards).map((card) => ({
    id: card.id,
    title: card.title,
    status: card.status,
    labels: card.labels,
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
    codexActiveRunId: card.codexActiveRunId ?? null,
    codexThreadRunId: card.codexThreadRunId ?? null,
    codexThreadRunIds: card.codexThreadRunIds ?? null,
    codexRunId: card.codexRunId ?? null,
    codexRunModel: card.codexRunModel ?? null,
    codexRunEffort: card.codexRunEffort ?? null,
  }));
  return { id: source.ledger.id ?? input.ledgerId, annotations: source.ledger.annotations ?? [], relationships: source.ledger.relationships ?? [], cards };
}

export function ledgerCardProjection(input: { decisionOsRoot: string; ledgerId: string; cardId: string; ledger?: AnyRecord }): AnyRecord | null {
  const source = projectionSource(input);
  if (!source) return null;
  const card = records(source.ledger.cards).find((entry) => String(entry.id) === input.cardId);
  if (!card) return null;
  return { ...card, comment: { ...(card.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {}), what: readCardDescription({ decisionOsRoot: input.decisionOsRoot, card }) } };
}

export function ledgerThreadProjection(input: { decisionOsRoot: string; ledgerId: string; threadId: string; ledger?: AnyRecord }): AnyRecord | null {
  const source = projectionSource(input);
  if (!source) return null;
  const threadFiles = source.ledger.threadFiles && typeof source.ledger.threadFiles === 'object' ? source.ledger.threadFiles as AnyRecord : {};
  const contentFile = String(threadFiles[input.threadId] ?? '');
  if (!contentFile) return null;
  const file = resolveThreadContentFile(input.decisionOsRoot, contentFile);
  const notes = file && existsSync(file) ? parseThreadMarkdown(readFileSync(file, 'utf8')) : [];
  const deleted = source.ledger.deletedNoteIds && typeof source.ledger.deletedNoteIds === 'object' ? source.ledger.deletedNoteIds as AnyRecord : {};
  const deletedIds = Array.isArray(deleted[input.threadId]) ? (deleted[input.threadId] as unknown[]).map(String) : [];
  return { ledgerId: input.ledgerId, threadId: input.threadId, contentFile, threadFiles: { [input.threadId]: contentFile }, notes: { [input.threadId]: notes }, deletedNoteIds: { [input.threadId]: deletedIds } };
}

export function ledgerSearchProjection(input: { decisionOsRoot: string; ledgerId: string; zoneId: string; query: string; ledger?: AnyRecord }): AnyRecord | null {
  const source = projectionSource(input);
  if (!source) return null;
  const query = input.query.trim().toLocaleLowerCase();
  const zone = records(source.ledger.annotations).find((entry) => String(entry.id ?? '') === input.zoneId);
  const matches = records(source.ledger.cards).flatMap((card) => {
    if (input.zoneId && input.zoneId !== 'ungrouped' && (!zone || overlapArea(card, zone) <= 0)) return [];
    const body = readCardDescription({ decisionOsRoot: input.decisionOsRoot, card });
    return !query || [card.title, body].some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
      ? [{ id: card.id, title: card.title, status: card.status, serverMatch: true }]
      : [];
  });
  return { ledgerId: input.ledgerId, zoneId: input.zoneId, query: input.query, matches };
}

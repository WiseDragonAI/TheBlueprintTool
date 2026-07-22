import { state } from '../../state.js';
import { clampReadableHsvColor } from '../../card/effect/render-card-zone-colors.js';
import { resolveLedgerCardZone } from './resolve-ledger-card-zone.js';
import { taskFamilyCardIds } from './task-family-accent.js';

export type ZoneAttribution = {
  zoneId: string;
  zoneColor: string;
  readableColor: string;
  colorSource?: 'project' | 'zone';
};

export type ZoneAttributionCache = {
  activeTab: string;
  ledger: unknown;
  projectColor: string;
  cardById: Record<string, ZoneAttribution | null>;
  zoneById: Record<string, { color: string; readableColor: string; geometrySignature: string }>;
  cardIdsByZoneId: Record<string, string[]>;
};

function regularZones(annotations: unknown): Array<Record<string, unknown>> {
  return Array.isArray(annotations)
    ? (annotations as Array<Record<string, unknown>>).filter((zone) => zone.variant !== 'group' && typeof zone.color === 'string')
    : [];
}

function zoneGeometrySignature(zone: Record<string, unknown>): string {
  return [zone.x, zone.y, zone.width ?? zone.w, zone.height ?? zone.h, zone.color].map((value) => String(value ?? '')).join(':');
}

function readableColorFor(color: string): string {
  return clampReadableHsvColor(color) ?? color;
}

export function buildZoneAttributionCache(ledger: Record<string, unknown> | null, activeTab: string, projectColor = String(state.projectColor ?? '')): ZoneAttributionCache {
  const cards = Array.isArray(ledger?.cards) ? ledger.cards as Array<Record<string, unknown>> : [];
  const zones = regularZones(ledger?.annotations);
  const projectTaskIds = taskFamilyCardIds(ledger);
  const normalizedProjectColor = projectColor.trim();
  const zoneById: ZoneAttributionCache['zoneById'] = {};
  const cardById: ZoneAttributionCache['cardById'] = {};
  const cardIdsByZoneId: ZoneAttributionCache['cardIdsByZoneId'] = {};

  for (const zone of zones) {
    const zoneId = String(zone.id ?? '');
    if (!zoneId) continue;
    const color = String(zone.color ?? '');
    zoneById[zoneId] = {
      color,
      readableColor: readableColorFor(color),
      geometrySignature: zoneGeometrySignature(zone)
    };
    cardIdsByZoneId[zoneId] = [];
  }

  for (const card of cards) {
    const cardId = String(card.id ?? '');
    if (!cardId) continue;
    const zone = resolveLedgerCardZone(card, zones);
    const zoneId = String(zone?.id ?? '');
    const zoneRecord = zoneId ? zoneById[zoneId] : undefined;
    if (projectTaskIds.has(cardId) && normalizedProjectColor) {
      cardById[cardId] = {
        zoneId,
        zoneColor: normalizedProjectColor,
        readableColor: readableColorFor(normalizedProjectColor),
        colorSource: 'project'
      };
      continue;
    }
    if (!zoneRecord) {
      cardById[cardId] = null;
      continue;
    }
    const attribution = {
      zoneId,
      zoneColor: zoneRecord.color,
      readableColor: zoneRecord.readableColor,
      colorSource: 'zone' as const
    };
    cardById[cardId] = attribution;
    cardIdsByZoneId[zoneId].push(cardId);
  }

  return { activeTab, ledger, projectColor: normalizedProjectColor, cardById, zoneById, cardIdsByZoneId };
}

export function refreshZoneAttributionCache(reason = 'refresh'): ZoneAttributionCache | null {
  if (!state.activeLedger) {
    state.zoneAttributionCache = null;
    return null;
  }
  const cache = buildZoneAttributionCache(state.activeLedger, state.activeTab);
  state.zoneAttributionCache = cache;
  const host = globalThis as any;
  const telemetry = host.__coreZoneAttributionTelemetry ??= [];
  telemetry.push({ reason, activeTab: state.activeTab, cards: Object.keys(cache.cardById).length, zones: Object.keys(cache.zoneById).length });
  if (telemetry.length > 40) telemetry.shift();
  return cache;
}

export function ensureZoneAttributionCache(reason = 'ensure'): ZoneAttributionCache | null {
  const cache = state.zoneAttributionCache as ZoneAttributionCache | null;
  const projectColor = String(state.projectColor ?? '').trim();
  if (cache && cache.activeTab === state.activeTab && cache.ledger === state.activeLedger && cache.projectColor === projectColor) return cache;
  return refreshZoneAttributionCache(reason);
}

export function applyZoneAttributionToCardElement(element: HTMLElement, attribution: ZoneAttribution | null | undefined): void {
  if (!attribution) {
    delete element.dataset.cardZoneId;
    delete element.dataset.cardZoneColor;
    delete element.dataset.cardAccentSource;
    element.style.removeProperty('--card-zone-color');
    element.style.removeProperty('--card-code-color');
    element.style.removeProperty('--card-readable-color');
    return;
  }
  element.dataset.cardZoneId = attribution.zoneId;
  element.dataset.cardZoneColor = attribution.zoneColor;
  element.dataset.cardAccentSource = attribution.colorSource ?? 'zone';
  element.style.setProperty('--card-zone-color', attribution.zoneColor);
  element.style.setProperty('--card-code-color', attribution.readableColor);
  element.style.setProperty('--card-readable-color', attribution.readableColor);
}

export function normalizeZoneAttribution(input: ZoneAttribution | Record<string, unknown> | null | undefined): ZoneAttribution | null {
  if (!input) return null;
  const record = input as Record<string, unknown>;
  if (typeof record.zoneColor === 'string') return input as ZoneAttribution;
  if (typeof record.id !== 'string' || typeof record.color !== 'string') return null;
  return {
    zoneId: record.id,
    zoneColor: record.color,
    readableColor: readableColorFor(record.color),
    colorSource: 'zone'
  };
}

export function previewCachedZoneColor(zoneId: string, color: string): void {
  const cache = ensureZoneAttributionCache('preview-zone-color');
  if (!cache?.zoneById[zoneId]) return;
  const readableColor = readableColorFor(color);
  cache.zoneById[zoneId] = { ...cache.zoneById[zoneId], color, readableColor };
  const cardIds = cache.cardIdsByZoneId[zoneId] ?? [];
  for (const cardId of cardIds) {
    const attribution = { zoneId, zoneColor: color, readableColor, colorSource: 'zone' as const };
    cache.cardById[cardId] = attribution;
    const element = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"].ledger-node`) as HTMLElement | null;
    if (element) applyZoneAttributionToCardElement(element, attribution);
  }
}

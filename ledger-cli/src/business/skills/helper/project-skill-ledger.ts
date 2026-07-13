/**
 * WHAT: Builds one stable Skills-ledger projection from a validated package.
 * WHY: Skill files need deterministic zones, tagged cards, reference links, and exact mirror paths.
 */
import { createHash } from 'node:crypto';
import type { OpenAiSkillPackage } from './read-openai-skill-package.js';

type RecordValue = Record<string, any>;

export type SkillProjection = {
  cardFiles: Array<{ content: string; file: string }>;
  ledger: RecordValue;
  primaryCardId: string;
  referenceCardIds: string[];
  removedCardFiles: string[];
  removedThreadFiles: string[];
  threadFiles: Array<{ content: string; file: string }>;
  zoneId: string;
};

function identity(prefix: string, value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'skill';
  return `${prefix}-${slug}-${createHash('sha256').update(value).digest('hex').slice(0, 10)}`;
}

function cardFile(cardId: string): string {
  return `.decision-os/cards/skills/${cardId}.md`;
}

function threadFile(cardId: string): string {
  return `.decision-os/threads/skills/thread-${cardId}.md`;
}

function nextZoneOrigin(annotations: RecordValue[]): { x: number; y: number } {
  const zones = annotations.filter((entry) => entry?.variant === 'zone');
  const right = zones.reduce((maximum, zone) => Math.max(maximum, Number(zone.x ?? 0) + Number(zone.width ?? 0)), 0);
  const top = zones.reduce((minimum, zone) => Math.min(minimum, Number(zone.y ?? 0)), 0);
  return { x: right + 120, y: top };
}

function geometry(zone: RecordValue, index: number): Pick<RecordValue, 'x' | 'y' | 'w' | 'h'> {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return { x: zone.x + 40 + column * 560, y: zone.y + 90 + row * 330, w: 520, h: 280 };
}

export function projectSkillLedger(input: {
  ledger: RecordValue;
  operation: 'create' | 'update';
  skill: OpenAiSkillPackage;
}): SkillProjection {
  const ledger = structuredClone(input.ledger);
  ledger.cards = Array.isArray(ledger.cards) ? ledger.cards : [];
  ledger.annotations = Array.isArray(ledger.annotations) ? ledger.annotations : [];
  ledger.relationships = Array.isArray(ledger.relationships) ? ledger.relationships : [];
  ledger.threadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' ? ledger.threadFiles : {};
  const mappedCards = ledger.cards.filter((card: RecordValue) => card.skillName === input.skill.name);
  const mappedMain = mappedCards.find((card: RecordValue) => card.skillRole === 'main');
  if (input.operation === 'create' && mappedCards.length > 0) throw new Error(`Skill ${input.skill.name} already exists in the Skills ledger.`);
  if (input.operation === 'update' && !mappedMain) throw new Error(`Skill ${input.skill.name} is not registered in the Skills ledger.`);
  const priorByFile = new Map(mappedCards.map((card: RecordValue) => [String(card.skillFile), card]));
  const priorZone = ledger.annotations.find((zone: RecordValue) => zone.skillName === input.skill.name);
  const origin = priorZone ?? nextZoneOrigin(ledger.annotations);
  const zoneId = String(priorZone?.id ?? identity('zone-skill', input.skill.name));
  const zone: RecordValue = {
    ...(priorZone ?? {}), id: zoneId, label: input.skill.name, variant: 'zone', color: priorZone?.color ?? '#38d9e8',
    x: Number(origin.x), y: Number(origin.y), width: 1200,
    height: Math.max(430, 130 + Math.ceil((input.skill.references.length + 1) / 2) * 330), skillName: input.skill.name,
  };
  const definitions = [
    { role: 'main', relativePath: 'SKILL.md', content: input.skill.skillMarkdown },
    ...input.skill.references.map((reference) => ({ role: 'reference', relativePath: reference.relativePath, content: reference.text })),
  ];
  const cards = definitions.map((definition, index) => {
    const skillFile = `.skills/${input.skill.name}/${definition.relativePath}`;
    const prior = priorByFile.get(skillFile) as RecordValue | undefined;
    const cardId = String(prior?.id ?? identity('card-skill', `${input.skill.name}:${definition.relativePath}`));
    return {
      ...(prior ?? {}), id: cardId,
      title: definition.role === 'main' ? `Skill / ${input.skill.name}` : `Skill / ${input.skill.name} / ${definition.relativePath}`,
      cardType: 'note', domainId: 'skills', status: prior?.status ?? 'todo', ...geometry(zone, index),
      labels: ['skill', input.skill.name, definition.role === 'main' ? 'skill-main' : 'skill-reference'],
      comment: { contentFile: cardFile(cardId) }, skillName: input.skill.name, skillRole: definition.role, skillFile,
      mirrorContent: definition.content,
    };
  });
  const currentIds = new Set(cards.map((card) => card.id));
  const staleCards = mappedCards.filter((card: RecordValue) => !currentIds.has(String(card.id)));
  const mappedIds = new Set(mappedCards.map((card: RecordValue) => String(card.id)));
  ledger.cards = [...ledger.cards.filter((card: RecordValue) => !mappedIds.has(String(card.id))), ...cards.map(({ mirrorContent: _content, ...card }) => card)];
  ledger.annotations = [...ledger.annotations.filter((entry: RecordValue) => entry.skillName !== input.skill.name), zone];
  ledger.relationships = ledger.relationships.filter((relationship: RecordValue) => !mappedIds.has(String(relationship.from)) && !mappedIds.has(String(relationship.to)));
  const primary = cards[0];
  for (const reference of cards.slice(1)) {
    ledger.relationships.push({
      id: identity('rel-skill', `${input.skill.name}:${reference.skillFile}`), from: primary.id, to: reference.id,
      label: String(reference.skillFile).replace(`.skills/${input.skill.name}/`, ''),
    });
  }
  for (const stale of staleCards) delete ledger.threadFiles[`thread-${stale.id}`];
  for (const card of cards) ledger.threadFiles[`thread-${card.id}`] = threadFile(card.id);
  return {
    ledger, zoneId, primaryCardId: primary.id, referenceCardIds: cards.slice(1).map((card) => card.id),
    cardFiles: cards.map((card) => ({ file: card.comment.contentFile, content: card.mirrorContent })),
    threadFiles: cards.map((card) => ({ file: threadFile(card.id), content: '' })),
    removedCardFiles: staleCards.map((card: RecordValue) => String(card.comment?.contentFile ?? '')).filter(Boolean),
    removedThreadFiles: staleCards.map((card: RecordValue) => threadFile(String(card.id))),
  };
}

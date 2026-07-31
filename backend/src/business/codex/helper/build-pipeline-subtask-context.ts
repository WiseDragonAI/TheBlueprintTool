/**
 * WHAT: Renders every canonical direct subtask as deterministic Markdown for pipeline prompt injection.
 * WHY: authored gates need the complete positioned task breakdown without additional ledger reads.
 */
type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is AnyRecord => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function oneLine(value: unknown): string {
  return text(value).replace(/\s+/g, ' ').trim();
}

function relationshipPosition(relationship: AnyRecord): number | null {
  const position = Number(relationship.position);
  return Number.isSafeInteger(position) && position >= 0 ? position : null;
}

function cardBody(card: AnyRecord | undefined): string {
  const comment = card?.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
    ? card.comment as AnyRecord
    : {};
  return text(comment.what ?? comment.body ?? comment.description).trim();
}

function cardFacts(card: AnyRecord | undefined): string[] {
  return Array.isArray(card?.facts)
    ? card.facts.filter((fact): fact is string => typeof fact === 'string').map((fact) => fact.trim()).filter(Boolean)
    : [];
}

export function buildPipelineSubtasks(input: {
  ledger: unknown;
  masterTaskId: string;
}): string {
  const ledger = input.ledger && typeof input.ledger === 'object' && !Array.isArray(input.ledger)
    ? input.ledger as AnyRecord
    : {};
  const cards = records(ledger.cards);
  const cardsById = new Map(cards.map((card) => [text(card.id), card]));
  const relationships = records(ledger.relationships)
    .filter((relationship) => (
      text(relationship.from) === input.masterTaskId
      && text(relationship.label) === 'subtask'
    ))
    .sort((left, right) => (
      (relationshipPosition(left) ?? Number.MAX_SAFE_INTEGER)
      - (relationshipPosition(right) ?? Number.MAX_SAFE_INTEGER)
      || text(left.id).localeCompare(text(right.id))
    ));
  return relationships.map((relationship) => {
    const card = cardsById.get(text(relationship.to));
    const title = oneLine(card?.title) || 'Missing subtask';
    return [`## ${title}`, ...cardFacts(card).map((fact) => `- ${fact}`)].join('\n');
  }).join('\n\n---\n\n');
}

export function buildPipelineSubtaskContext(input: {
  ledger: unknown;
  masterTaskId: string;
}): string {
  const ledger = input.ledger && typeof input.ledger === 'object' && !Array.isArray(input.ledger)
    ? input.ledger as AnyRecord
    : {};
  const cards = records(ledger.cards);
  const cardsById = new Map(cards.map((card) => [text(card.id), card]));
  const relationships = records(ledger.relationships)
    .filter((relationship) => (
      text(relationship.from) === input.masterTaskId
      && text(relationship.label) === 'subtask'
    ))
    .sort((left, right) => (
      (relationshipPosition(left) ?? Number.MAX_SAFE_INTEGER)
      - (relationshipPosition(right) ?? Number.MAX_SAFE_INTEGER)
      || text(left.id).localeCompare(text(right.id))
    ));
  if (relationships.length === 0) return '_No canonical subtasks are linked to this task._';

  return relationships.map((relationship, index) => {
    const cardId = text(relationship.to);
    const card = cardsById.get(cardId);
    const title = oneLine(card?.title) || (card ? cardId : `Missing card ${cardId}`);
    const status = oneLine(card?.status) || 'unspecified';
    const position = relationshipPosition(relationship);
    const body = cardBody(card) || (card
      ? '_No subtask body._'
      : '_The subtask relationship target is missing from the ledger projection._');
    return [
      `## Subtask ${index + 1}: ${title}`,
      '',
      `1. **Card ID:** \`${cardId}\``,
      `2. **Status:** \`${status}\``,
      `3. **Position:** ${position === null ? '`unpositioned`' : position}`,
      '',
      body,
    ].join('\n');
  }).join('\n\n---\n\n');
}

/**
 * WHAT: Builds the single Decision OS state payload injected into a new Codex card session.
 * WHY: A new session needs current card state once, without a second session-context round trip.
 */
type AnyRecord = Record<string, unknown>;

function record(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cardReferences(markdown: string): string[] {
  const values = new Set<string>();
  for (const match of markdown.matchAll(/(?:card:|\/cards\/)(card-[a-zA-Z0-9-]+)/g)) values.add(match[1]);
  return [...values];
}

function owningZone(card: AnyRecord, annotations: AnyRecord[]): AnyRecord | null {
  const x = number(card.x);
  const y = number(card.y);
  const w = number(card.w);
  const h = number(card.h);
  return annotations.find((entry) => {
    if (String(entry.variant ?? '') !== 'zone') return false;
    const left = number(entry.x);
    const top = number(entry.y);
    return x >= left && y >= top && x + w <= left + number(entry.width) && y + h <= top + number(entry.height);
  }) ?? null;
}

function compactCard(card: AnyRecord): AnyRecord {
  return {
    id: String(card.id ?? ''),
    title: String(card.title ?? ''),
    status: String(card.status ?? ''),
    domainId: String(card.domainId ?? ''),
    cardType: String(card.cardType ?? ''),
    runId: String(card.codexThreadRunId ?? card.codexPipelineRunId ?? ''),
    runOutputFile: String(card.codexThreadRunOutputFile ?? ''),
  };
}

export function buildCardLaunchContext(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
  threadId: string;
  ledger: AnyRecord;
  cardMarkdown: string;
  threadMarkdown: string;
}): AnyRecord {
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards.filter(record) : [];
  const target = cards.find((card) => String(card.id ?? '') === input.cardId) ?? {};
  const relationships = Array.isArray(input.ledger.relationships) ? input.ledger.relationships.filter(record) : [];
  const directRelationships = relationships.filter((entry) => String(entry.from ?? '') === input.cardId || String(entry.to ?? '') === input.cardId);
  const linkedIds = new Set(directRelationships.flatMap((entry) => [String(entry.from ?? ''), String(entry.to ?? '')]).filter((id) => id && id !== input.cardId));
  const referencedIds = cardReferences(input.threadMarkdown).filter((id) => id !== input.cardId && !linkedIds.has(id));
  const annotations = Array.isArray(input.ledger.annotations) ? input.ledger.annotations.filter(record) : [];
  return {
    version: 2,
    projectId: input.projectId,
    ledgerId: input.ledgerId,
    card: { ...compactCard(target), markdown: input.cardMarkdown },
    thread: { id: input.threadId, markdown: input.threadMarkdown },
    zone: owningZone(target, annotations),
    relationships: directRelationships,
    linkedCards: cards.filter((card) => linkedIds.has(String(card.id ?? ''))).map(compactCard),
    referencedCards: cards.filter((card) => referencedIds.includes(String(card.id ?? ''))).map(compactCard),
    actions: {
      executionProfile: {
        command: 'ledger-cli execution-profile --ledger "$DECISION_OS_LEDGER_FILE" --json',
      },
      masterTaskApply: {
        command: 'ledger-cli master-task-apply --ledger "$DECISION_OS_LEDGER_FILE" --plan-stdin',
        input: {
          masterCardId: input.cardId,
          title: 'string',
          zoneTitle: 'string',
          sections: [{ title: 'string', markdown: 'string' }],
          subtasks: [{ title: 'string', sections: [{ title: 'string', markdown: 'string' }] }],
        },
        generated: ['cardIds', 'relationshipIds', 'lifecycleHeader', 'subtaskLinks'],
      },
    },
  };
}

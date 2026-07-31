/**
 * WHAT: Discovers up to 30 catalog-owned cards and renders their bodies plus complete threads as Markdown.
 * WHY: pipeline agents need bounded ID-only batch reads instead of repeated project, ledger, card, and thread round trips.
 */
import type { Result } from '../../../lib/types.js';

type JsonObject = Record<string, unknown>;
type CatalogLedger = { id: string; title: string };
type CatalogProject = { id: string; name: string; ledgers: CatalogLedger[] };
type CardOwner = { project: CatalogProject; ledger: CatalogLedger };

const requestDeadlineMs = 10_000;
const discoveryConcurrency = 8;
const maximumCardReads = 30;

function record(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function oneLine(value: unknown): string {
  return text(value).replace(/\s+/g, ' ').trim();
}

function serverUrl(): Result<string> {
  const value = text(process.env.DECISION_OS_SERVER_URL).trim().replace(/\/$/, '');
  return value
    ? { ok: true, value }
    : { ok: false, error: 'card-read requires DECISION_OS_SERVER_URL.' };
}

async function fetchJson(url: string, allowNotFound = false): Promise<Result<unknown | null>> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(requestDeadlineMs) });
    if (allowNotFound && response.status === 404) return { ok: true, value: null };
    if (!response.ok) {
      return { ok: false, error: `Request failed (${response.status}) for ${url}: ${await response.text()}` };
    }
    return { ok: true, value: await response.json() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Request failed for ${url}.` };
  }
}

function catalogProjects(value: unknown): CatalogProject[] {
  if (!record(value) || !Array.isArray(value.projects)) return [];
  return value.projects.flatMap((entry) => {
    if (!record(entry)) return [];
    const id = text(entry.id).trim();
    const name = oneLine(entry.name) || id;
    const ledgers = Array.isArray(entry.ledgers)
      ? entry.ledgers.flatMap((ledger) => {
          if (!record(ledger)) return [];
          const ledgerId = text(ledger.id).trim();
          return ledgerId ? [{ id: ledgerId, title: oneLine(ledger.title) || ledgerId }] : [];
        })
      : [];
    return id ? [{ id, name, ledgers }] : [];
  });
}

async function boundedMap<T, R>(
  values: readonly T[],
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(discoveryConcurrency, values.length) },
    async () => {
      // WHAT: claim the next unprocessed value until the bounded worker pool drains the input.
      // WHY: card hydration must limit concurrent network work while preserving result positions.
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await worker(values[index], index);
      }
    },
  );
  await Promise.all(runners);
  return output;
}

async function discoverCardOwners(
  server: string,
  cardIds: readonly string[],
): Promise<Result<CardOwner[]>> {
  const catalog = await fetchJson(`${server}/api/control-room?localOnly=1`);
  if (!catalog.ok) return catalog;
  const owners = catalogProjects(catalog.value).flatMap((project) =>
    project.ledgers.map((ledger) => ({ project, ledger })));
  // WHAT: reject discovery when the local catalog exposes no searchable ledgers.
  // WHY: an empty owner set cannot prove that any requested card is absent.
  if (owners.length === 0) return { ok: false, error: 'Card discovery found no local ledgers.' };

  const requestedIds = new Set(cardIds);
  const observations = await boundedMap(owners, async (owner) => {
    const url = `${server}/p/${encodeURIComponent(owner.project.id)}/api/ledgers/${encodeURIComponent(owner.ledger.id)}/navigation`;
    const navigation = await fetchJson(url);
    // WHAT: retain a failed ledger observation without aborting discovery in healthy ledgers.
    // WHY: a requested card found elsewhere remains resolvable despite an unrelated ledger failure.
    if (!navigation.ok) return { owner, error: navigation.error, cardIds: [] as string[] };
    const cards = record(navigation.value) && Array.isArray(navigation.value.cards)
      ? navigation.value.cards.filter(record)
      : [];
    return {
      owner,
      error: '',
      cardIds: cards.map((card) => text(card.id)).filter((cardId) => requestedIds.has(cardId)),
    };
  });
  const failures = observations.filter((observation) => observation.error);
  const resolvedOwners: CardOwner[] = [];
  for (const cardId of cardIds) {
    const matches = observations
      .filter((observation) => observation.cardIds.includes(cardId))
      .map((observation) => observation.owner);
    // WHAT: reject a card id that resolves to more than one local ledger.
    // WHY: card id alone cannot select a deterministic document when ownership is ambiguous.
    if (matches.length > 1) {
      return {
        ok: false,
        error: `Card id ${cardId} is ambiguous across ${matches.map((owner) =>
          `${owner.project.id}/${owner.ledger.id}`).join(', ')}.`,
      };
    }
    // WHAT: preserve the caller's card order after catalog-wide discovery.
    // WHY: batch Markdown output must be deterministic and follow argument order.
    if (matches.length === 1) {
      resolvedOwners.push(matches[0]);
      continue;
    }
    // WHAT: report incomplete discovery instead of declaring a missing card.
    // WHY: failed ledger navigation leaves ownership unresolved.
    if (failures.length > 0) {
      return {
        ok: false,
        error: `Card discovery for ${cardId} was incomplete across ${failures.map((observation) =>
          `${observation.owner.project.id}/${observation.owner.ledger.id}`).join(', ')}.`,
      };
    }
    return { ok: false, error: `Card not found: ${cardId}` };
  }
  return { ok: true, value: resolvedOwners };
}

function threadMarkdown(value: unknown, threadId: string): string {
  if (!record(value) || !record(value.notes) || !Array.isArray(value.notes[threadId])) {
    return '_No thread content._';
  }
  const notes = value.notes[threadId].filter(record);
  if (notes.length === 0) return '_No thread content._';
  return notes.map((note) => {
    const role = text(note.role).toLowerCase() === 'agent' ? 'AGENT' : 'OPERATOR';
    const message = text(note.message).trim() || '_Empty message._';
    return `### ${role}\n\n${message}`;
  }).join('\n\n');
}

function cardMarkdown(input: {
  card: JsonObject;
  cardId: string;
  owner: CardOwner;
  thread: unknown;
}): string {
  const comment = record(input.card.comment) ? input.card.comment : {};
  const title = oneLine(input.card.title) || input.cardId;
  const body = text(comment.what).trim() || '_No card body._';
  const threadId = `thread-${input.cardId}`;
  return [
    `# Card: ${title}`,
    '',
    `- Card ID: \`${input.cardId}\``,
    `- Project: ${input.owner.project.name} (\`${input.owner.project.id}\`)`,
    `- Ledger: ${input.owner.ledger.title} (\`${input.owner.ledger.id}\`)`,
    '',
    '## Body',
    '',
    body,
    '',
    '---',
    '',
    '## Full thread',
    '',
    threadMarkdown(input.thread, threadId),
    '',
  ].join('\n');
}

async function readOwnedCardMarkdown(input: {
  cardId: string;
  owner: CardOwner;
  server: string;
}): Promise<Result<string>> {
  const project = encodeURIComponent(input.owner.project.id);
  const ledger = encodeURIComponent(input.owner.ledger.id);
  const encodedCard = encodeURIComponent(input.cardId);
  const threadId = `thread-${input.cardId}`;
  const [card, thread] = await Promise.all([
    fetchJson(`${input.server}/p/${project}/api/ledgers/${ledger}/cards/${encodedCard}`),
    fetchJson(`${input.server}/p/${project}/api/ledgers/${ledger}/threads/${encodeURIComponent(threadId)}`, true),
  ]);
  // WHAT: fail the owned read when the card request fails.
  // WHY: a thread without its authoritative card body is not a valid document.
  if (!card.ok) return card;
  // WHAT: reject a successful response whose card payload is not an object.
  // WHY: Markdown rendering requires a validated card document.
  if (!record(card.value)) return { ok: false, error: `Card read returned an invalid document for ${input.cardId}.` };
  // WHAT: fail the owned read when its thread request fails.
  // WHY: card-read promises the complete available thread with each card body.
  if (!thread.ok) return thread;
  return {
    ok: true,
    value: cardMarkdown({ card: card.value, cardId: input.cardId, owner: input.owner, thread: thread.value }),
  };
}

export async function readCardMarkdown(input: { cardIds?: string[] }): Promise<Result<string>> {
  const cardIds = (input.cardIds ?? []).map((cardId) => text(cardId).trim()).filter(Boolean);
  // WHAT: require at least one concrete card identity.
  // WHY: discovery without a target has no bounded result.
  if (cardIds.length === 0) return { ok: false, error: 'card-read requires --card-id.' };
  // WHAT: reject reads beyond the documented batch limit.
  // WHY: card and thread hydration must retain a finite request boundary.
  if (cardIds.length > maximumCardReads) {
    return { ok: false, error: `card-read accepts at most ${maximumCardReads} --card-id values.` };
  }
  const server = serverUrl();
  // WHAT: stop before discovery when the running server address is unavailable.
  // WHY: ID-only ownership resolution depends on the local Decision OS catalog.
  if (!server.ok) return server;
  const owners = await discoverCardOwners(server.value, cardIds);
  // WHAT: stop before hydration when any requested owner cannot be resolved deterministically.
  // WHY: card and thread requests require exact project and ledger identities.
  if (!owners.ok) return owners;
  const documents = await boundedMap(cardIds, (cardId, index) => readOwnedCardMarkdown({
    cardId,
    owner: owners.value[index],
    server: server.value,
  }));
  const markdown: string[] = [];
  for (const document of documents) {
    // WHAT: withhold the entire batch when one card or thread cannot be hydrated.
    // WHY: callers must not mistake partial stdout for a complete requested context set.
    if (!document.ok) return document;
    markdown.push(document.value);
  }
  return { ok: true, value: markdown.join('\n---\n\n') };
}

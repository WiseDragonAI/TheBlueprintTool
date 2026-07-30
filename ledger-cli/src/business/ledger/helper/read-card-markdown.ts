/**
 * WHAT: Discovers one catalog-owned card and renders its body plus complete thread as Markdown.
 * WHY: pipeline agents need one ID-only read instead of project, ledger, card, and thread round trips.
 */
import type { Result } from '../../../lib/types.js';

type JsonObject = Record<string, unknown>;
type CatalogLedger = { id: string; title: string };
type CatalogProject = { id: string; name: string; ledgers: CatalogLedger[] };
type CardOwner = { project: CatalogProject; ledger: CatalogLedger };

const requestDeadlineMs = 10_000;
const discoveryConcurrency = 8;

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
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(discoveryConcurrency, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await worker(values[index]);
      }
    },
  );
  await Promise.all(runners);
  return output;
}

async function discoverCardOwner(
  server: string,
  cardId: string,
): Promise<Result<CardOwner>> {
  const catalog = await fetchJson(`${server}/api/control-room?localOnly=1`);
  if (!catalog.ok) return catalog;
  const owners = catalogProjects(catalog.value).flatMap((project) =>
    project.ledgers.map((ledger) => ({ project, ledger })));
  if (owners.length === 0) return { ok: false, error: 'Card discovery found no local ledgers.' };

  const observations = await boundedMap(owners, async (owner) => {
    const url = `${server}/p/${encodeURIComponent(owner.project.id)}/api/ledgers/${encodeURIComponent(owner.ledger.id)}/navigation`;
    const navigation = await fetchJson(url);
    if (!navigation.ok) return { owner, error: navigation.error, found: false };
    const cards = record(navigation.value) && Array.isArray(navigation.value.cards)
      ? navigation.value.cards.filter(record)
      : [];
    return { owner, error: '', found: cards.some((card) => text(card.id) === cardId) };
  });
  const matches = observations.filter((observation) => observation.found).map((observation) => observation.owner);
  if (matches.length > 1) {
    return {
      ok: false,
      error: `Card id ${cardId} is ambiguous across ${matches.map((owner) =>
        `${owner.project.id}/${owner.ledger.id}`).join(', ')}.`,
    };
  }
  if (matches.length === 1) return { ok: true, value: matches[0] };

  const failures = observations.filter((observation) => observation.error);
  return failures.length > 0
    ? {
        ok: false,
        error: `Card discovery was incomplete across ${failures.map((observation) =>
          `${observation.owner.project.id}/${observation.owner.ledger.id}`).join(', ')}.`,
      }
    : { ok: false, error: `Card not found: ${cardId}` };
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

export async function readCardMarkdown(input: { cardId?: string }): Promise<Result<string>> {
  const cardId = text(input.cardId).trim();
  if (!cardId) return { ok: false, error: 'card-read requires --card-id.' };
  const server = serverUrl();
  if (!server.ok) return server;
  const owner = await discoverCardOwner(server.value, cardId);
  if (!owner.ok) return owner;

  const project = encodeURIComponent(owner.value.project.id);
  const ledger = encodeURIComponent(owner.value.ledger.id);
  const encodedCard = encodeURIComponent(cardId);
  const threadId = `thread-${cardId}`;
  const [card, thread] = await Promise.all([
    fetchJson(`${server.value}/p/${project}/api/ledgers/${ledger}/cards/${encodedCard}`),
    fetchJson(`${server.value}/p/${project}/api/ledgers/${ledger}/threads/${encodeURIComponent(threadId)}`, true),
  ]);
  if (!card.ok) return card;
  if (!record(card.value)) return { ok: false, error: `Card read returned an invalid document for ${cardId}.` };
  if (!thread.ok) return thread;
  return {
    ok: true,
    value: cardMarkdown({ card: card.value, cardId, owner: owner.value, thread: thread.value }),
  };
}

/**
 * WHAT: Renders aggregate ledgers, compact ledger/card resources, settings, skills, and pipelines.
 * WHY: Important non-canvas views must remain reachable from the unified frontend entry.
 */
import { projectPath, readProjects, requestJson } from '../../../data/decision-os-api.js';
import type { RouteScope } from '../../../runtime/navigation/helper/route-scope.js';
import { openCompactThread } from '../../threads/controller/open-compact-thread.js';

function cardsFrom(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')) : [];
}

export async function renderAggregateLedgers(container: HTMLElement): Promise<void> {
  const projects = await readProjects();
  container.innerHTML = '<header class="application-title"><div><p>Directory</p><h1>Ledgers</h1></div></header><section class="project-grid"></section>';
  const entries = projects.flatMap((project) => project.ledgers.map((ledger) => ({ project, ledger })));
  (container.querySelector('.project-grid') as HTMLElement).replaceChildren(...entries.map(({ project, ledger }) => {
    const article = document.createElement('article');
    article.className = 'application-card';
    article.innerHTML = '<div><h2></h2><p></p></div><a>Open</a>';
    (article.querySelector('h2') as HTMLElement).textContent = ledger.title;
    (article.querySelector('p') as HTMLElement).textContent = project.name;
    (article.querySelector('a') as HTMLAnchorElement).href = `/p/${encodeURIComponent(project.id)}/ledgers/${encodeURIComponent(ledger.id)}`;
    return article;
  }));
}

export async function renderCompactResource(container: HTMLElement, scope: RouteScope): Promise<void> {
  const project = (await readProjects()).find((entry) => entry.id === scope.projectId);
  if (!project) throw new Error('Unknown project id.');
  if (scope.view === 'ledgers') {
    container.innerHTML = '<header class="application-title"><div><p>Project</p><h1></h1></div></header><section class="project-grid"></section>';
    (container.querySelector('h1') as HTMLElement).textContent = project.name;
    (container.querySelector('.project-grid') as HTMLElement).replaceChildren(...project.ledgers.map((ledger) => {
      const link = document.createElement('a');
      link.className = 'application-card';
      link.href = `/p/${encodeURIComponent(project.id)}/ledgers/${encodeURIComponent(ledger.id)}`;
      link.textContent = ledger.title;
      return link;
    }));
    return;
  }
  if (scope.view === 'card') {
    const card = await requestJson<Record<string, unknown>>(projectPath(scope.projectId, `/api/ledgers/${encodeURIComponent(scope.ledgerId)}/cards/${encodeURIComponent(scope.cardId)}`));
    const body = String((card.comment as Record<string, unknown> | undefined)?.what ?? '');
    container.innerHTML = '<a class="back-link">← Ledger</a><article class="resource-card"><header><h1></h1><button class="open-thread-button" type="button">Open thread</button></header><pre></pre></article>';
    (container.querySelector('.back-link') as HTMLAnchorElement).href = `/p/${encodeURIComponent(scope.projectId)}/ledgers/${encodeURIComponent(scope.ledgerId)}`;
    (container.querySelector('h1') as HTMLElement).textContent = String(card.title ?? scope.cardId);
    (container.querySelector('pre') as HTMLElement).textContent = body;
    container.querySelector('.open-thread-button')?.addEventListener('click', () => {
      void openCompactThread({ projectId: scope.projectId, ledgerId: scope.ledgerId, cardId: scope.cardId });
    });
    return;
  }
  const navigation = await requestJson<Record<string, unknown>>(projectPath(scope.projectId, `/api/ledgers/${encodeURIComponent(scope.ledgerId)}/navigation`));
  container.innerHTML = '<header class="application-title"><div><p>Ledger</p><h1></h1></div><a class="primary-link">Open canvas</a></header><section class="project-grid"></section>';
  (container.querySelector('h1') as HTMLElement).textContent = project.ledgers.find((ledger) => ledger.id === scope.ledgerId)?.title ?? scope.ledgerId;
  (container.querySelector('.primary-link') as HTMLAnchorElement).href = `/p/${encodeURIComponent(scope.projectId)}/ledgers/${encodeURIComponent(scope.ledgerId)}`;
  (container.querySelector('.project-grid') as HTMLElement).replaceChildren(...cardsFrom(navigation.cards).map((card) => {
    const link = document.createElement('a');
    link.className = 'application-card';
    link.href = `/p/${encodeURIComponent(scope.projectId)}/ledgers/${encodeURIComponent(scope.ledgerId)}/zones/ungrouped/cards/${encodeURIComponent(String(card.id ?? ''))}`;
    link.textContent = String(card.title ?? card.id ?? 'Card');
    return link;
  }));
}

export async function renderSettings(container: HTMLElement): Promise<void> {
  const settings = await requestJson<{ maxConcurrentCodexProcesses: number }>('/api/settings/codex-processes');
  container.innerHTML = '<header class="application-title"><div><p>Runtime</p><h1>Settings</h1></div></header><form class="application-form"><label>Maximum concurrent Codex processes<input name="limit" type="number" min="1" max="32"></label><button>Save</button><p role="status"></p></form>';
  const form = container.querySelector('form') as HTMLFormElement;
  (form.elements.namedItem('limit') as HTMLInputElement).value = String(settings.maxConcurrentCodexProcesses);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const limit = Number((form.elements.namedItem('limit') as HTMLInputElement).value);
    await requestJson('/api/settings/codex-processes', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxConcurrentCodexProcesses: limit }) });
    (form.querySelector('[role="status"]') as HTMLElement).textContent = 'Saved.';
  });
}

export async function renderLibrary(container: HTMLElement, kind: 'skills' | 'pipelines'): Promise<void> {
  const payload = await requestJson<Record<string, unknown>>(`/api/codex/${kind}`);
  const entries = cardsFrom(payload[kind]);
  container.innerHTML = `<header class="application-title"><div><p>Codex</p><h1>${kind[0].toUpperCase()}${kind.slice(1)}</h1></div></header><section class="project-grid"></section>`;
  (container.querySelector('.project-grid') as HTMLElement).replaceChildren(...entries.map((entry) => {
    const article = document.createElement('article');
    article.className = 'application-card';
    article.innerHTML = '<div><h2></h2><p></p></div>';
    (article.querySelector('h2') as HTMLElement).textContent = String(entry.name ?? entry.title ?? entry.id ?? 'Untitled');
    (article.querySelector('p') as HTMLElement).textContent = String(entry.description ?? entry.summary ?? '');
    return article;
  }));
}

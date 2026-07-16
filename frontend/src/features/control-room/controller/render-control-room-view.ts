/**
 * WHAT: Renders the shared Control Room projection with filters, task actions, ordering, diagnostics, and live refresh.
 * WHY: Operational work must be available on desktop and compact surfaces from the same feature controller.
 */
import { mutateLedger, readProjects, requestJson, type ProjectSummary } from '../../../data/decision-os-api.js';

type ControlTask = {
  projectId: string; projectName: string; projectColor: string; ledgerId: string; ledger: string;
  cardId: string; title: string; status: string; queueRank?: number | null; waitingSince?: string; activeSince?: string;
  diagnostics?: string[]; subtasks?: Array<{ title: string; status: string }>;
};

type ControlProjection = {
  queue: ControlTask[]; active: ControlTask[]; backlog: ControlTask[]; allTasks?: ControlTask[];
  diagnostics?: Array<{ message?: string; diagnostics?: string[] }>; stale?: boolean; revision?: number;
};

let eventSource: EventSource | null = null;

function taskRoute(task: ControlTask): string {
  return `/p/${encodeURIComponent(task.projectId)}/ledgers/${encodeURIComponent(task.ledgerId)}`;
}

async function persistQueue(tasks: ControlTask[]): Promise<void> {
  await Promise.all(tasks.map((task, index) => mutateLedger(task.projectId, task.ledgerId, {
    action: 'patch-card', cardPatch: { id: task.cardId, queueRank: index + 1 },
  })));
}

function taskRow(task: ControlTask, tab: string, onChanged: () => void): HTMLElement {
  const article = document.createElement('article');
  article.className = 'application-card control-task';
  article.draggable = tab === 'queue';
  article.dataset.cardId = task.cardId;
  article.innerHTML = `<div><h2></h2><p></p><small></small></div><div class="task-actions"><a>Open</a></div>`;
  (article.querySelector('h2') as HTMLElement).textContent = task.title;
  (article.querySelector('p') as HTMLElement).textContent = `${task.projectName} · ${task.ledger}`;
  (article.querySelector('small') as HTMLElement).textContent = task.diagnostics?.join(' · ') || `${task.subtasks?.length ?? 0} subtasks`;
  (article.querySelector('a') as HTMLAnchorElement).href = taskRoute(task);
  const actions = article.querySelector('.task-actions') as HTMLElement;
  const mutationButton = (label: string, mutation: Record<string, unknown>): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await mutateLedger(task.projectId, task.ledgerId, mutation);
        onChanged();
      } catch (error) {
        button.disabled = false;
        button.title = error instanceof Error ? error.message : 'Task mutation failed.';
      }
    });
    return button;
  };
  if (tab === 'backlog') actions.append(mutationButton('Restore', { action: 'patch-card', cardPatch: { id: task.cardId, status: 'todo' } }));
  else actions.append(mutationButton('Backlog', { action: 'patch-card', cardPatch: { id: task.cardId, status: 'backlog' } }));
  actions.append(
    mutationButton('Complete', { action: 'complete-master-task', masterTaskId: task.cardId }),
    mutationButton('Delete', { action: 'delete-card', cardId: task.cardId }),
  );
  return article;
}

export async function renderControlRoomView(container: HTMLElement): Promise<void> {
  const [projection, projects] = await Promise.all([
    requestJson<ControlProjection>('/api/control-room'),
    readProjects(),
  ]);
  const query = new URLSearchParams(location.search);
  const tab = ['queue', 'active', 'backlog'].includes(query.get('tab') ?? '') ? String(query.get('tab')) : 'queue';
  const projectId = query.get('project') ?? 'all';
  const ledgerId = query.get('ledger') ?? 'all';
  const source = (projection[tab as 'queue' | 'active' | 'backlog'] ?? []).filter((task) =>
    (projectId === 'all' || task.projectId === projectId) && (ledgerId === 'all' || task.ledgerId === ledgerId));
  container.innerHTML = `<header class="application-title"><div><p>Operations</p><h1>Control Room</h1></div><a class="primary-link" href="/projects">Projects</a></header><section class="control-toolbar"><div class="control-tabs"></div><label>Project<select name="project"></select></label><label>Ledger<select name="ledger"></select></label></section><section class="control-list"></section><section class="control-diagnostics"></section>`;
  const navigateFilter = (next: Record<string, string>): void => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(next)) value === 'all' ? params.delete(key) : params.set(key, value);
    location.assign(`/?${params.toString()}`);
  };
  const tabs = container.querySelector('.control-tabs') as HTMLElement;
  for (const key of ['queue', 'active', 'backlog']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${key[0].toUpperCase()}${key.slice(1)} (${projection[key as 'queue' | 'active' | 'backlog']?.length ?? 0})`;
    button.setAttribute('aria-pressed', String(tab === key));
    button.addEventListener('click', () => navigateFilter({ tab: key }));
    tabs.append(button);
  }
  const projectSelect = container.querySelector('select[name="project"]') as HTMLSelectElement;
  projectSelect.replaceChildren(new Option('All projects', 'all'), ...projects.map((project: ProjectSummary) => new Option(project.name, project.id)));
  projectSelect.value = projectId;
  projectSelect.addEventListener('change', () => navigateFilter({ project: projectSelect.value, ledger: 'all' }));
  const selectedProject = projects.find((project) => project.id === projectId);
  const ledgerSelect = container.querySelector('select[name="ledger"]') as HTMLSelectElement;
  ledgerSelect.replaceChildren(new Option('All ledgers', 'all'), ...(selectedProject?.ledgers ?? []).map((ledger) => new Option(ledger.title, ledger.id)));
  ledgerSelect.value = ledgerId;
  ledgerSelect.disabled = !selectedProject;
  ledgerSelect.addEventListener('change', () => navigateFilter({ ledger: ledgerSelect.value }));
  const list = container.querySelector('.control-list') as HTMLElement;
  const refresh = (): void => { void renderControlRoomView(container); };
  list.replaceChildren(...source.map((task) => taskRow(task, tab, refresh)));
  if (!source.length) list.innerHTML = '<p class="application-empty">No tasks in this view.</p>';
  if (tab === 'queue') {
    let dragged = '';
    list.addEventListener('dragstart', (event) => { dragged = (event.target as HTMLElement).closest<HTMLElement>('[data-card-id]')?.dataset.cardId ?? ''; });
    list.addEventListener('dragover', (event) => event.preventDefault());
    list.addEventListener('drop', async (event) => {
      event.preventDefault();
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-card-id]')?.dataset.cardId ?? '';
      if (!dragged || !target || dragged === target) return;
      const reordered = [...source];
      const from = reordered.findIndex((task) => task.cardId === dragged);
      const to = reordered.findIndex((task) => task.cardId === target);
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      list.replaceChildren(...reordered.map((task) => taskRow(task, tab, refresh)));
      try { await persistQueue(reordered); } catch { await renderControlRoomView(container); }
    });
  }
  const diagnostics = container.querySelector('.control-diagnostics') as HTMLElement;
  const messages = [
    ...(projection.stale ? [`Showing cached revision ${projection.revision ?? 0}.`] : []),
    ...(projection.diagnostics ?? []).map((entry) => entry.diagnostics?.join(' · ') || entry.message || '').filter(Boolean),
  ];
  diagnostics.replaceChildren(...messages.map((message) => Object.assign(document.createElement('p'), { textContent: message })));
  if (!eventSource && typeof EventSource !== 'undefined') {
    eventSource = new EventSource('/api/control-room-events');
    const liveRefresh = (): void => { if (location.pathname === '/') void renderControlRoomView(container); };
    eventSource.addEventListener('ledger-content-change', liveRefresh);
    eventSource.addEventListener('card-content-change', liveRefresh);
  }
}

/**
 * WHAT: Renders shared project catalog, registration, creation, metadata, relink, and unregister workflows.
 * WHY: Project lifecycle must be available outside the compact-only frontend.
 */
import { createOrRegisterProject, mutateProject, readProjects, type ProjectSummary } from '../../../data/decision-os-api.js';

function projectCard(project: ProjectSummary): HTMLElement {
  const article = document.createElement('article');
  article.className = `application-card project-summary${project.available ? '' : ' is-unavailable'}`;
  article.style.setProperty('--project-color', project.color);
  article.innerHTML = `<span class="project-color"></span><div><h2></h2><p></p><small></small></div><a>Open</a>`;
  (article.querySelector('h2') as HTMLElement).textContent = project.name;
  (article.querySelector('p') as HTMLElement).textContent = project.description || project.relativePath;
  (article.querySelector('small') as HTMLElement).textContent = project.available
    ? `${project.ledgers.length} ledgers · ${project.relativePath}`
    : project.diagnostic;
  const link = article.querySelector('a') as HTMLAnchorElement;
  link.href = `/projects/${encodeURIComponent(project.id)}`;
  return article;
}

function lifecycleForm(kind: 'create' | 'register', onSaved: () => void): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'application-form';
  form.innerHTML = kind === 'create'
    ? `<h2>Create project</h2><label>Name<input name="name" required maxlength="120"></label><label>Description<textarea name="description" maxlength="1000"></textarea></label><button>Create</button><p role="status"></p>`
    : `<h2>Register existing project</h2><label>Path below server root<input name="path" required></label><button>Register</button><p role="status"></p>`;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const status = form.querySelector('[role="status"]') as HTMLElement;
    try {
      await createOrRegisterProject(kind === 'create'
        ? { name: String(data.get('name') ?? ''), description: String(data.get('description') ?? '') }
        : { path: String(data.get('path') ?? '') });
      onSaved();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Project operation failed.';
    }
  });
  return form;
}

export async function renderProjectsIndex(container: HTMLElement): Promise<void> {
  const projects = await readProjects();
  container.innerHTML = `<header class="application-title"><div><p>Workspaces</p><h1>Projects</h1></div></header><section class="project-grid"></section><section class="lifecycle-grid"></section>`;
  (container.querySelector('.project-grid') as HTMLElement).replaceChildren(...projects.map(projectCard));
  const reload = (): void => { void renderProjectsIndex(container); };
  (container.querySelector('.lifecycle-grid') as HTMLElement).replaceChildren(lifecycleForm('create', reload), lifecycleForm('register', reload));
}

export async function renderProjectDetail(container: HTMLElement, projectId: string): Promise<void> {
  const project = (await readProjects()).find((entry) => entry.id === projectId);
  if (!project) throw new Error('Unknown project id.');
  container.innerHTML = `<a class="back-link" href="/projects">← Projects</a><header class="application-title"><div><p>Project</p><h1></h1><span></span></div><a class="primary-link">Open canvas</a></header><form class="application-form project-settings"><label>Name<input name="name" required maxlength="120"></label><label>Description<textarea name="description" maxlength="1000"></textarea></label><label>Color<input name="color" type="color"></label><button>Save metadata</button><p role="status"></p></form><form class="application-form project-relink"><label>New path below server root<input name="relativePath" required></label><button>Relink</button></form><button class="danger-button" type="button">Unregister project</button>`;
  (container.querySelector('h1') as HTMLElement).textContent = project.name;
  (container.querySelector('.application-title span') as HTMLElement).textContent = project.available ? project.relativePath : project.diagnostic;
  (container.querySelector('.primary-link') as HTMLAnchorElement).href = `/p/${encodeURIComponent(project.id)}/ledgers`;
  const settings = container.querySelector('.project-settings') as HTMLFormElement;
  (settings.elements.namedItem('name') as HTMLInputElement).value = project.name;
  (settings.elements.namedItem('description') as HTMLTextAreaElement).value = project.description;
  (settings.elements.namedItem('color') as HTMLInputElement).value = project.color;
  settings.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(settings);
    await mutateProject(project.id, 'PATCH', { name: data.get('name'), description: data.get('description'), color: data.get('color') });
    await renderProjectDetail(container, project.id);
  });
  const relink = container.querySelector('.project-relink') as HTMLFormElement;
  relink.addEventListener('submit', async (event) => {
    event.preventDefault();
    await mutateProject(project.id, 'PATCH', { relativePath: new FormData(relink).get('relativePath') });
    await renderProjectDetail(container, project.id);
  });
  container.querySelector('.danger-button')?.addEventListener('click', async () => {
    if (!confirm(`Unregister ${project.name}? Project files will be preserved.`)) return;
    await mutateProject(project.id, 'DELETE');
    location.assign('/projects');
  });
}

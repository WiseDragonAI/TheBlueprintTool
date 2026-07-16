/**
 * WHAT: Mounts the shared non-canvas application shell.
 * WHY: Projects, Control Room, settings, and compact resources need one frontend entry and navigation frame.
 */
export function renderApplicationShell(): HTMLElement {
  document.body.className = 'application-body';
  document.body.replaceChildren();
  const shell = document.createElement('div');
  shell.className = 'application-shell';
  shell.innerHTML = `
    <header class="application-header">
      <a class="application-brand" href="/">Decision OS</a>
      <nav aria-label="Application">
        <a href="/">Control Room</a><a href="/projects">Projects</a><a href="/ledgers">Ledgers</a>
        <a href="/skills">Skills</a><a href="/pipelines">Pipelines</a><a href="/settings">Settings</a>
      </nav>
    </header>
    <main class="application-content" tabindex="-1">
      <section class="application-loading" aria-live="polite">Loading…</section>
    </main>`;
  document.body.append(shell);
  return shell.querySelector('.application-content') as HTMLElement;
}

export function renderApplicationError(container: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : 'The requested view could not be loaded.';
  container.innerHTML = `<section class="application-empty"><h1>Unable to load</h1><p></p><button type="button">Retry</button></section>`;
  (container.querySelector('p') as HTMLElement).textContent = message;
  container.querySelector('button')?.addEventListener('click', () => location.reload());
}

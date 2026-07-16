/**
 * WHAT: Mounts the complete responsive application structure stored in the unified entry document.
 * WHY: Every non-canvas route needs the same semantic controls and dialogs at mobile and desktop widths.
 */
export function renderResponsiveApplicationShell(): HTMLElement {
  const template = document.querySelector<HTMLTemplateElement>('#responsive-application-shell');
  if (!template) throw new Error('Responsive application shell template is unavailable.');
  document.body.className = 'responsive-application-body';
  document.body.replaceChildren(template.content.cloneNode(true));
  const shell = document.querySelector<HTMLElement>('.app-shell');
  if (!shell) throw new Error('Responsive application shell could not be mounted.');
  return shell;
}

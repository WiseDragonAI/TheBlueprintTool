/**
 * WHAT: Mounts the canvas component from its inert document template.
 * WHY: Canvas DOM must exist only after route selection explicitly chooses the canvas surface.
 */
export function renderCanvasSurfaceShell(): HTMLElement {
  const template = document.querySelector<HTMLTemplateElement>('#canvas-surface-shell');
  if (!template) throw new Error('Canvas surface shell template is unavailable.');
  document.body.className = 'canvas-surface-body';
  document.body.replaceChildren(template.content.cloneNode(true));
  const shell = document.querySelector<HTMLElement>('.shell');
  if (!shell) throw new Error('Canvas surface shell could not be mounted.');
  return shell;
}

/**
 * WHAT: Creates the shared Skill view/edit workspace shell.
 * WHY: Reading and authoring must use one responsive content/controls architecture instead of parallel mobile implementations.
 */
export type SkillWorkspace = {
  root: HTMLElement;
  content: HTMLElement;
  rail: HTMLElement;
  railBody: HTMLElement;
  railFooter: HTMLElement;
  menu: HTMLButtonElement;
  backdrop: HTMLButtonElement;
  setRailOpen: (open: boolean) => void;
};

export function createSkillWorkspace(input: {
  mode: 'view' | 'edit';
  railTitle: string;
  menuLabel: string;
  closeLabel: string;
  rootClassName?: string;
  contentClassName?: string;
  railClassName?: string;
  onRailOpenChange?: (open: boolean) => void;
}): SkillWorkspace {
  const root = document.createElement('section');
  root.className = `skill-workspace skill-workspace-${input.mode}${input.rootClassName ? ` ${input.rootClassName}` : ''}`;
  const content = document.createElement('section');
  content.className = `skill-workspace-content${input.contentClassName ? ` ${input.contentClassName}` : ''}`;
  const rail = document.createElement('aside');
  rail.className = `skill-workspace-rail codex-side-panel codex-control-rail${input.railClassName ? ` ${input.railClassName}` : ''}`;
  rail.setAttribute('aria-label', input.railTitle);
  const railHeader = document.createElement('header');
  railHeader.className = 'skill-workspace-rail-header';
  const title = document.createElement('h3');
  title.textContent = input.railTitle;
  title.id = `skill-workspace-title-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'plain-close';
  close.textContent = '×';
  close.setAttribute('aria-label', input.closeLabel);
  railHeader.append(title, close);
  const railBody = document.createElement('div');
  railBody.className = 'skill-workspace-rail-body';
  const railFooter = document.createElement('footer');
  railFooter.className = 'skill-workspace-rail-footer';
  rail.append(railHeader, railBody, railFooter);
  rail.setAttribute('role', 'dialog');
  rail.setAttribute('aria-labelledby', title.id);
  rail.tabIndex = -1;
  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'ghost-button skill-workspace-menu';
  menu.textContent = '⋮';
  menu.setAttribute('aria-label', input.menuLabel);
  menu.setAttribute('aria-expanded', 'false');
  rail.id = `skill-workspace-rail-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
  menu.setAttribute('aria-controls', rail.id);
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'skill-workspace-backdrop codex-side-panel-backdrop';
  backdrop.setAttribute('aria-label', input.closeLabel);
  backdrop.tabIndex = -1;
  const setRailOpen = (open: boolean): void => {
    root.classList.toggle('is-control-rail-open', open);
    menu.setAttribute('aria-expanded', String(open));
    content.inert = open;
    input.onRailOpenChange?.(open);
    if (open) close.focus();
    else if (document.activeElement === close || rail.contains(document.activeElement)) menu.focus();
  };
  menu.addEventListener('click', () => setRailOpen(!root.classList.contains('is-control-rail-open')));
  close.addEventListener('click', () => setRailOpen(false));
  backdrop.addEventListener('click', () => setRailOpen(false));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-control-rail-open')) {
      event.preventDefault();
      setRailOpen(false);
    }
  });
  root.append(menu, backdrop, content, rail);
  return { root, content, rail, railBody, railFooter, menu, backdrop, setRailOpen };
}

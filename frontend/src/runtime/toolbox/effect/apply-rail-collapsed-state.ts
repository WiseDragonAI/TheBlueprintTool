import { state } from '../../state.js';

export function applyRailCollapsedState(collapsed: boolean, button?: HTMLElement | null): void {
  state.railCollapsed = collapsed;
  const shell = document.querySelector('.shell') as HTMLElement | null;
  shell?.classList.toggle('rail-collapsed', collapsed);
  const railToggle = button ?? document.querySelector('[data-action="toggle-rail"]') as HTMLElement | null;
  if (!railToggle) return;
  railToggle.setAttribute('aria-expanded', String(!collapsed));
  railToggle.setAttribute('title', collapsed ? 'Expand toolbox' : 'Collapse toolbox');
  const icon = railToggle.querySelector('span:first-child');
  if (icon) icon.textContent = collapsed ? '›' : '‹';
  const label = railToggle.querySelector('.rail-toggle-label');
  if (label) label.textContent = collapsed ? 'Expand' : 'Collapse';
}

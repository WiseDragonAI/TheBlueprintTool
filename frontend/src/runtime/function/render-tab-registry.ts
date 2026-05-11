import { state } from '../state.js';
import { telemetry } from './telemetry.js';

export function renderTabRegistry(): void {
  document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === state.activeTab));
  telemetry('render-tab-registry', { activeTab: state.activeTab });
}

import { state } from '../../state.js';

export function renderRelationshipLabelVisibility(): void {
  document.querySelectorAll('.relationships').forEach((overlay) => {
    overlay.classList.toggle('hide-labels', state.activeTab === 'runtime');
  });
}

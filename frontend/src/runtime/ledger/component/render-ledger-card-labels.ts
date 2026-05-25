export function renderLedgerCardLabels(labels: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'ledger-card-labels';
  wrapper.dataset.spec = 'aa42ff94';
  for (const labelText of labels) {
    const label = document.createElement('span');
    label.className = 'ledger-card-label';
    label.textContent = labelText;
    wrapper.appendChild(label);
  }
  return wrapper;
}

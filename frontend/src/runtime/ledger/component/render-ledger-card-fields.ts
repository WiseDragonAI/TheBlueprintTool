import { type LedgerCardField } from '../helper/card-fields.js';

export function renderLedgerCardFields(fields: LedgerCardField[]): HTMLElement {
  const list = document.createElement('dl');
  list.className = 'ledger-card-fields';
  for (const field of fields) {
    const name = document.createElement('dt');
    name.textContent = field.name || 'Unnamed';
    const type = document.createElement('dd');
    type.textContent = field.type || 'unknown';
    list.append(name, type);
  }
  return list;
}

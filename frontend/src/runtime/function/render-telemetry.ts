import { telemetryList } from '../dom.js';
import { state } from '../state.js';

export function renderTelemetry(): void {
  telemetryList.replaceChildren(...state.telemetry.slice(-16).map((trace: { name: string }) => {
    const item = document.createElement('li');
    item.textContent = trace.name;
    return item;
  }));
}

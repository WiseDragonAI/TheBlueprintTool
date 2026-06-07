import { canvas, content } from '../../dom.js';
import { state } from '../../state.js';
import {
  currentRenderDensity,
  effectiveViewportScale,
  lowZoomRenderDensityThreshold
} from '../../canvas/helper/render-density.js';

let enabledCache: boolean | null = null;

function canvasDebugEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  const search = globalThis.window?.location?.search ?? '';
  const params = new URLSearchParams(search);
  enabledCache = params.has('canvasDebug') || params.get('debug') === 'canvas' || params.get('debugCanvas') === '1';
  return enabledCache;
}

function ensureOverlay(): HTMLElement | null {
  if (!globalThis.document?.body) return null;
  const existing = document.querySelector('.canvas-debug-overlay') as HTMLElement | null;
  if (existing) return existing;
  const overlay = document.createElement('aside');
  overlay.className = 'canvas-debug-overlay';
  overlay.setAttribute('aria-label', 'Canvas debug');
  document.body.append(overlay);
  return overlay;
}

function formatNumber(value: unknown, digits = 3): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : 'n/a';
}

function count(selector: string): number {
  return content?.querySelectorAll(selector).length ?? 0;
}

function detailMode(): string {
  if (!canvas) return 'n/a';
  if (canvas.classList.contains('overview-detail')) return 'overview';
  if (canvas.classList.contains('low-detail')) return 'low';
  return 'normal';
}

function row(label: string, value: string): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  const td = document.createElement('td');
  th.scope = 'row';
  th.textContent = label;
  td.textContent = value;
  tr.append(th, td);
  return tr;
}

function ledgerArrayLength(key: 'cards' | 'annotations' | 'relationships'): number {
  const value = state.activeLedger?.[key];
  return Array.isArray(value) ? value.length : 0;
}

export function renderCanvasDebugOverlay(reason = 'render'): void {
  if (!canvasDebugEnabled()) return;
  const overlay = ensureOverlay();
  if (!overlay) return;

  const table = document.createElement('table');
  table.append(
    row('reason', reason),
    row('tab', String(state.activeTab ?? '')),
    row('ledger', state.activeLedger ? 'active' : 'static'),
    row('raw zoom', formatNumber(state.viewport.scale, 4)),
    row('effective zoom', formatNumber(effectiveViewportScale(), 4)),
    row('render density', String(currentRenderDensity())),
    row('density threshold', String(lowZoomRenderDensityThreshold)),
    row('detail mode', detailMode()),
    row('viewport x', formatNumber(state.viewport.x, 1)),
    row('viewport y', formatNumber(state.viewport.y, 1)),
    row('dpr', formatNumber(globalThis.window?.devicePixelRatio ?? 1, 2)),
    row('ledger cards', String(ledgerArrayLength('cards'))),
    row('ledger zones', String(ledgerArrayLength('annotations'))),
    row('ledger relationships', String(ledgerArrayLength('relationships'))),
    row('dom cards', String(count(':scope > .card[data-card-id]'))),
    row('detail DOM', String(count(':scope > .card .ledger-card-detail-layer'))),
    row('detail visible', String(count(':scope > .card.detail-visible'))),
    row('controls', String(canvas.querySelectorAll(':scope > .canvas-control-overlay .canvas-control').length)),
    row('media overlays', String(canvas.querySelectorAll(':scope > .canvas-media-overlay > *').length)),
    row('transform', content?.style.transform || 'none')
  );

  const title = document.createElement('h2');
  title.textContent = 'Canvas Debug';
  overlay.replaceChildren(title, table);
}

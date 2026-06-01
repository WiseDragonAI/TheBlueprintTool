#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectPage } from './function/connect-page.mjs';
import { wait } from './function/wait.mjs';
import { waitLiveCanvasReady } from './function/wait-live-canvas-ready.mjs';

const url = process.env.COREV2_URL ?? 'http://127.0.0.1:4173/ardaria-game-design';
const cdpJsonUrl = process.env.COREV2_CDP_JSON ?? 'http://127.0.0.1:9223/json';
const outputDir = process.env.COREV2_DRAG_TRACE_OUTPUT_DIR ?? `/tmp/corev2-card-drag-trace-${Date.now()}`;
const targetCardId = process.env.COREV2_DRAG_TRACE_CARD_ID ?? 'prep_ui_implementation_surfaces_5b947d58';
const scale = Number(process.env.COREV2_DRAG_TRACE_SCALE ?? 0.5);
const runsPerCase = Math.max(1, Number(process.env.COREV2_DRAG_TRACE_RUNS ?? 1));
const moveSteps = Math.max(1, Number(process.env.COREV2_DRAG_TRACE_MOVES ?? 12));
const moveIntervalMs = Math.max(0, Number(process.env.COREV2_DRAG_TRACE_MOVE_INTERVAL_MS ?? 16));
const dragDx = Number(process.env.COREV2_DRAG_TRACE_DX ?? 144);
const dragDy = Number(process.env.COREV2_DRAG_TRACE_DY ?? 4);
const longEventThresholdMs = Number(process.env.COREV2_DRAG_TRACE_LONG_EVENT_MS ?? 8);
const enableDomReadProbes = process.env.COREV2_DRAG_TRACE_DOM_READ_PROBES === '1';
const mockGeometryCommit = process.env.COREV2_DRAG_TRACE_MOCK_GEOMETRY_COMMIT !== '0';
const variants = parseList(process.env.COREV2_DRAG_TRACE_VARIANTS, [
  'baseline',
  'preselected',
  'skip-zone-labels',
  'no-hover-controls',
  'no-hover-tabs',
  'cheap-visuals',
  'no-images',
  'no-release-render',
  'block-pointerup'
]);
const hoverModes = parseList(process.env.COREV2_DRAG_TRACE_HOVER_MODES, ['cold', 'warm']);

const traceCategories = [
  'toplevel',
  'input',
  'latencyInfo',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.invalidationTracking',
  'blink',
  'blink.user_timing',
  'blink_style',
  'cc',
  'gpu',
  'v8'
].join(',');

function parseList(value, fallback) {
  if (!value) return fallback;
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function round(value) {
  return Number(value.toFixed(3));
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function summarize(values) {
  if (!values.length) return { count: 0, totalMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    totalMs: round(total),
    avgMs: round(total / values.length),
    p50Ms: round(percentile(values, 50)),
    p95Ms: round(percentile(values, 95)),
    maxMs: round(Math.max(...values))
  };
}

function topByTotal(items, count = 16) {
  return [...items.values()]
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, count)
    .map((entry) => ({ ...entry, totalMs: round(entry.totalMs), maxMs: round(entry.maxMs) }));
}

function addDuration(map, key, ms, extra = {}) {
  const current = map.get(key) ?? { key, count: 0, totalMs: 0, maxMs: 0, ...extra };
  current.count += 1;
  current.totalMs += ms;
  current.maxMs = Math.max(current.maxMs, ms);
  map.set(key, current);
}

function eventArgType(event) {
  return event.args?.data?.type
    ?? event.args?.beginData?.type
    ?? event.args?.data?.name
    ?? event.args?.frame
    ?? '';
}

function completeTraceEvents(events) {
  return events.filter((event) => event.ph === 'X' && typeof event.dur === 'number' && event.dur > 0);
}

function groupDurations(events, names) {
  const wanted = new Set(names);
  return summarize(events.filter((event) => wanted.has(event.name)).map((event) => event.dur / 1000));
}

function childrenForEvent(parent, events) {
  const start = parent.ts;
  const end = parent.ts + parent.dur;
  return events.filter((event) => (
    event !== parent
    && event.pid === parent.pid
    && event.tid === parent.tid
    && event.ts >= start
    && event.ts + event.dur <= end
  ));
}

function summarizeChildren(parent, completeEvents) {
  const byName = new Map();
  for (const child of childrenForEvent(parent, completeEvents)) {
    addDuration(byName, child.name, child.dur / 1000, { name: child.name });
  }
  return topByTotal(byName, 8).map((entry) => ({
    name: entry.name,
    count: entry.count,
    totalMs: entry.totalMs,
    maxMs: entry.maxMs
  }));
}

function summarizeTrace(traceEvents) {
  const completeEvents = completeTraceEvents(traceEvents);
  const byName = new Map();
  const byEventDispatchType = new Map();
  for (const event of completeEvents) {
    const ms = event.dur / 1000;
    addDuration(byName, event.name, ms, { name: event.name });
    if (event.name === 'EventDispatch') {
      const type = String(eventArgType(event) || 'unknown');
      addDuration(byEventDispatchType, type, ms, { type });
    }
  }
  const longEvents = completeEvents
    .filter((event) => event.dur / 1000 >= longEventThresholdMs)
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 28)
    .map((event) => ({
      name: event.name,
      ms: round(event.dur / 1000),
      cat: event.cat,
      argType: eventArgType(event),
      children: summarizeChildren(event, completeEvents)
    }));
  return {
    eventCount: traceEvents.length,
    completeEventCount: completeEvents.length,
    topNames: topByTotal(byName, 24).map((entry) => ({
      name: entry.name,
      count: entry.count,
      totalMs: entry.totalMs,
      maxMs: entry.maxMs
    })),
    eventDispatchByType: topByTotal(byEventDispatchType, 16).map((entry) => ({
      type: entry.type,
      count: entry.count,
      totalMs: entry.totalMs,
      maxMs: entry.maxMs
    })),
    longEvents,
    groups: {
      input: groupDurations(completeEvents, ['EventDispatch', 'WebFrameWidgetImpl::HandleInputEvent', 'EventHandler::handleMouseMoveEvent', 'EventHandler::handleMousePressEvent', 'EventHandler::handleMouseReleaseEvent', 'LayoutView::HitTest']),
      scripting: groupDurations(completeEvents, ['FunctionCall', 'v8.callFunction', 'EvaluateScript', 'RunTask', 'TimerFire']),
      forcedStyleLayout: groupDurations(completeEvents, ['Document::UpdateStyleAndLayout', 'LocalFrameView::UpdateStyleAndLayout', 'Blink.ForcedStyleAndLayout.UpdateTime', 'UpdateLayoutTree', 'Document::recalcStyle', 'Document::updateStyle', 'Layout', 'LocalFrameView::layout']),
      paintLayer: groupDurations(completeEvents, ['PrePaint', 'Paint', 'PaintImage', 'Layerize', 'UpdateLayerTree', 'LocalFrameView::RunPaintLifecyclePhase', 'LocalFrameView::pushPaintArtifactToCompositor']),
      rasterComposite: groupDurations(completeEvents, ['RasterTask', 'RasterizerTaskImpl::RunOnWorkerThread', 'TaskGraphRunner::RunTask', 'ZeroCopyRasterBuffer::Playback', 'DisplayItemList::Raster', 'ProxyMain::BeginMainFrame', 'LayerTreeHost::WaitForCommitCompletion', 'CompositeLayers', 'DrawFrame'])
    }
  };
}

function pageExpression(source) {
  return `(${source})()`;
}

function setupPageExpression(input) {
  return pageExpression(async function setupCardDragTracePage() {
    const input = window.__corev2DragTraceInput;
    const { state } = await import('/src/runtime/state.js');
    const { applyViewportTransform } = await import('/src/runtime/canvas/effect/apply-viewport-transform.js');
    const { renderSelectionState } = await import('/src/runtime/selection/effect/render-selection-state.js');
    const canvas = document.querySelector('.canvas');
    const content = document.querySelector('.canvas-content');
    let target = document.querySelector(`[data-card-id="${CSS.escape(input.targetCardId)}"]`);
    if (!target) target = document.querySelector('.canvas-content > .card[data-card-id]');
    if (!canvas || !content || !target) throw new Error('CoreV2 drag trace target is not available');

    document.querySelector('[data-corev2-drag-trace-style]')?.remove();
    const style = document.createElement('style');
    style.dataset.corev2DragTraceStyle = input.variant;
    const css = [];
    if (input.variant === 'no-hover-tabs') {
      css.push('.ledger-card-tabs{display:none!important}.card:hover .ledger-card-tabs,.card:has(.ledger-card-tab:focus-visible) .ledger-card-tabs{opacity:0!important;pointer-events:none!important}');
    }
    if (input.variant === 'cheap-visuals') {
      css.push('.card,.regular-zone,.ledger-card-label,.card-status-indicator,.ledger-card-tabs,.ledger-card-tab{box-shadow:none!important;filter:none!important;text-shadow:none!important}.grid{display:none!important}');
    }
    if (input.variant === 'no-images') {
      css.push('.ledger-card-media-shell,.ledger-card-inline-image-frame,.canvas-media-overlay{display:none!important}');
    }
    style.textContent = css.join('\n');
    document.head.append(style);

    state.viewport = {
      x: Math.round(window.innerWidth / 2 - (target.offsetLeft + target.offsetWidth / 2) * input.scale),
      y: Math.round(window.innerHeight / 2 - (target.offsetTop + Math.min(80, target.offsetHeight / 2)) * input.scale),
      scale: input.scale
    };
    state.threadPanelOpen = false;
    state.activeTool = 'select';
    document.querySelector('.thread-panel')?.setAttribute('hidden', '');
    state.selection = input.variant === 'preselected'
      ? { cardIds: [target.dataset.cardId], zoneIds: [], groupIds: [] }
      : { cardIds: [], zoneIds: [], groupIds: [] };
    applyViewportTransform();
    renderSelectionState();

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    if (input.variant === 'skip-zone-labels') {
      for (const title of document.querySelectorAll('.zone-title')) title.classList.add('editing');
      document.querySelector('.zone-label-overlay')?.replaceChildren();
    }
    if (input.variant === 'no-hover-controls') {
      const stopHover = (event) => event.stopImmediatePropagation();
      canvas.addEventListener('mouseover', stopHover, { capture: true });
      canvas.addEventListener('mouseout', stopHover, { capture: true });
      canvas.addEventListener('pointerover', stopHover, { capture: true });
      canvas.addEventListener('pointerout', stopHover, { capture: true });
    }
    if (input.variant === 'block-pointerup') {
      canvas.addEventListener('pointerup', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true });
      canvas.addEventListener('mouseup', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true });
    }

    const rect = target.getBoundingClientRect();
    const targetCardId = target.dataset.cardId;
    const candidatePoints = [];
    const xFractions = [0.18, 0.32, 0.5, 0.68, 0.82];
    const yOffsets = [18, 28, 42, 64, 88, Math.min(rect.height - 14, 120)];
    for (const yOffset of yOffsets) {
      for (const xFraction of xFractions) {
        candidatePoints.push({
          x: Math.round(rect.left + rect.width * xFraction),
          y: Math.round(rect.top + Math.max(8, yOffset))
        });
      }
    }
    let hitPoint = null;
    for (const point of candidatePoints) {
      const stack = document.elementsFromPoint(point.x, point.y);
      const firstCard = stack.find((node) => node instanceof HTMLElement && node.matches?.('.canvas-content > .card[data-card-id]'));
      if (firstCard?.dataset.cardId === targetCardId) {
        hitPoint = point;
        break;
      }
    }
    if (!hitPoint) {
      hitPoint = {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + Math.min(28, rect.height / 4))
      };
    }
    const hitStack = document.elementsFromPoint(hitPoint.x, hitPoint.y)
      .filter((node) => node instanceof HTMLElement)
      .slice(0, 8)
      .map((node) => ({
        tag: node.tagName.toLowerCase(),
        cardId: node.dataset.cardId ?? '',
        zoneId: node.dataset.zoneId ?? '',
        className: String(node.className ?? '').split(/\s+/).filter(Boolean).slice(0, 4).join(' ')
      }));
    return {
      route: location.pathname,
      activeTab: state.activeTab,
      variant: input.variant,
      hoverMode: input.hoverMode,
      scale: state.viewport.scale,
      targetCardId,
      targetRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      startX: hitPoint.x,
      startY: hitPoint.y,
      hitStack,
      offscreenX: 8,
      offscreenY: 8,
      counts: {
        cards: document.querySelectorAll('.canvas-content > .card[data-card-id]').length,
        zones: document.querySelectorAll('.canvas-content > .zone[data-zone-id]').length,
        relationships: document.querySelectorAll('.ledger-relationships [data-relationship-id]').length,
        images: document.querySelectorAll('img').length
      }
    };
  }).replace('const input = window.__corev2DragTraceInput;', `const input = ${JSON.stringify(input)};`);
}

function installInstrumentationExpression(input) {
  return pageExpression(async function installCardDragTraceInstrumentation() {
    const input = window.__corev2DragTraceInput;
    const canvas = document.querySelector('.canvas');
    const content = document.querySelector('.canvas-content');
    const target = document.querySelector(`[data-card-id="${CSS.escape(input.targetCardId)}"]`) || document.querySelector('.canvas-content > .card[data-card-id]');
    if (!canvas || !content || !target) throw new Error('CoreV2 drag trace instrumentation target is not available');

    window.__corev2DragTrace?.restore?.();

    const state = {
      startedAt: performance.now(),
      activeEvent: 'idle',
      marks: [],
      frames: [],
      mutations: [],
      longTasks: [],
      domReadsByKind: new Map(),
      domReadsByEvent: new Map(),
      domReadsByTarget: new Map(),
      slowDomReads: [],
      telemetryStart: (window.__coreTelemetry ?? []).length,
      eventAbort: new AbortController(),
      restoreFns: [],
      frameActive: true
    };
    const round = (value) => Number(value.toFixed(3));
    const now = () => round(performance.now() - state.startedAt);
    const describe = (node) => {
      if (!node || node.nodeType !== 1) return String(node);
      const element = node;
      const id = element.dataset?.cardId ? `[card=${element.dataset.cardId}]`
        : element.dataset?.zoneId ? `[zone=${element.dataset.zoneId}]`
          : element.dataset?.groupId ? `[group=${element.dataset.groupId}]`
            : element.id ? `#${element.id}` : '';
      const cls = String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      return `${element.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ''}`;
    };
    const mark = (label, extra = {}) => {
      performance.mark(`corev2-drag:${input.variant}:${input.hoverMode}:${label}`);
      state.marks.push({ label, t: now(), activeEvent: state.activeEvent, ...extra });
    };
    const addRead = (map, key, row, durationMs) => {
      const current = map.get(key) ?? { ...row, count: 0, totalMs: 0, maxMs: 0 };
      current.count += 1;
      current.totalMs += durationMs;
      current.maxMs = Math.max(current.maxMs, durationMs);
      map.set(key, current);
    };
    const recordRead = (kind, node, durationMs) => {
      const targetDescription = describe(node);
      const roundedDuration = round(durationMs);
      addRead(state.domReadsByKind, kind, { kind }, durationMs);
      addRead(state.domReadsByEvent, `${state.activeEvent} / ${kind}`, { key: `${state.activeEvent} / ${kind}`, activeEvent: state.activeEvent, kind }, durationMs);
      addRead(state.domReadsByTarget, `${kind} / ${targetDescription}`, { key: `${kind} / ${targetDescription}`, kind, target: targetDescription }, durationMs);
      if (roundedDuration >= 0.25) {
        state.slowDomReads.push({ kind, target: targetDescription, t: now(), durationMs: roundedDuration, activeEvent: state.activeEvent });
        state.slowDomReads.sort((a, b) => b.durationMs - a.durationMs);
        state.slowDomReads.length = Math.min(state.slowDomReads.length, 32);
      }
    };

    if (input.enableDomReadProbes) {
      const originalGetComputedStyle = window.getComputedStyle.bind(window);
      window.getComputedStyle = function tracedGetComputedStyle(element, pseudo) {
        const startedAt = performance.now();
        const result = originalGetComputedStyle(element, pseudo);
        recordRead('getComputedStyle', element, performance.now() - startedAt);
        return result;
      };
      state.restoreFns.push(() => { window.getComputedStyle = originalGetComputedStyle; });

      const originalRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function tracedGetBoundingClientRect() {
        const startedAt = performance.now();
        const result = originalRect.call(this);
        recordRead('getBoundingClientRect', this, performance.now() - startedAt);
        return result;
      };
      state.restoreFns.push(() => { Element.prototype.getBoundingClientRect = originalRect; });

      for (const property of ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight']) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property);
        if (!descriptor?.get) continue;
        Object.defineProperty(HTMLElement.prototype, property, {
          configurable: true,
          get() {
            const startedAt = performance.now();
            const value = descriptor.get.call(this);
            recordRead(property, this, performance.now() - startedAt);
            return value;
          }
        });
        state.restoreFns.push(() => Object.defineProperty(HTMLElement.prototype, property, descriptor));
      }
    }

    if (input.mockGeometryCommit || input.variant === 'no-release-render') {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async function tracedFetch(resource, options = {}) {
        const method = String(options?.method ?? '').toUpperCase();
        const body = typeof options?.body === 'string' ? options.body : '';
        if (method === 'PATCH' && body.includes('"action":"patch-geometry"')) {
          mark('mock-patch-geometry-commit');
          if (input.variant === 'no-release-render') {
            return new Response('', { status: 204 });
          }
          return new Response(JSON.stringify(window.__coreState?.activeLedger ?? {}), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return originalFetch(resource, options);
      };
      state.restoreFns.push(() => { window.fetch = originalFetch; });
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        state.mutations.push({
          t: now(),
          activeEvent: state.activeEvent,
          type: record.type,
          attributeName: record.attributeName,
          target: describe(record.target),
          style: record.attributeName === 'style' ? record.target.getAttribute('style') : undefined,
          className: record.attributeName === 'class' ? record.target.getAttribute('class') : undefined
        });
      }
    });
    observer.observe(target, { attributes: true, attributeFilter: ['style', 'class'] });
    observer.observe(canvas, { attributes: true, attributeFilter: ['class'] });
    observer.observe(content, { attributes: true, attributeFilter: ['style', 'class'] });
    state.restoreFns.push(() => observer.disconnect());

    if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.longTasks.push({ name: entry.name, startTime: round(entry.startTime - state.startedAt), durationMs: round(entry.duration) });
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
      state.restoreFns.push(() => longTaskObserver.disconnect());
    }

    const eventTypes = ['mouseover', 'mouseout', 'pointerover', 'pointerout', 'pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup'];
    for (const type of eventTypes) {
      canvas.addEventListener(type, (event) => {
        state.activeEvent = `${type}:capture`;
        mark(`${type}:capture`, { x: event.clientX, y: event.clientY });
      }, { capture: true, signal: state.eventAbort.signal });
      canvas.addEventListener(type, (event) => {
        mark(`${type}:bubble`, { x: event.clientX, y: event.clientY });
        state.activeEvent = 'idle';
      }, { signal: state.eventAbort.signal });
    }
    state.restoreFns.push(() => state.eventAbort.abort());

    function frameLoop() {
      if (!state.frameActive) return;
      state.frames.push(now());
      requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);

    window.__corev2DragTrace = {
      state,
      mark,
      restore() {
        state.frameActive = false;
        for (const restore of [...state.restoreFns].reverse()) restore();
      },
      finish() {
        state.frameActive = false;
        const frameGaps = state.frames.slice(1).map((t, index) => round(t - state.frames[index]));
        const sortRows = (rows) => [...rows.values()]
          .sort((a, b) => b.totalMs - a.totalMs)
          .slice(0, 24)
          .map((entry) => ({ ...entry, totalMs: round(entry.totalMs), maxMs: round(entry.maxMs) }));
        return {
          marks: state.marks,
          frames: state.frames,
          frameGaps,
          frameGapsSummary: {
            count: frameGaps.length,
            maxMs: round(Math.max(0, ...frameGaps)),
            p95Ms: round((() => {
              const sorted = [...frameGaps].sort((a, b) => a - b);
              return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
            })())
          },
          mutations: state.mutations,
          longTasks: state.longTasks,
          domReads: {
            total: [...state.domReadsByKind.values()].reduce((sum, entry) => sum + entry.count, 0),
            byKind: sortRows(state.domReadsByKind),
            byEvent: sortRows(state.domReadsByEvent),
            byTarget: sortRows(state.domReadsByTarget),
            slowest: state.slowDomReads
          },
          telemetry: (window.__coreTelemetry ?? []).slice(state.telemetryStart)
        };
      }
    };
    mark('instrumentation-installed', { variant: input.variant, hoverMode: input.hoverMode });
    return true;
  }).replace('const input = window.__corev2DragTraceInput;', `const input = ${JSON.stringify(input)};`);
}

function finishInstrumentationExpression() {
  return pageExpression(function finishCardDragTraceInstrumentation() {
    const output = window.__corev2DragTrace?.finish?.();
    window.__corev2DragTrace?.restore?.();
    return output;
  });
}

async function evaluate(send, expression, timeoutMs = 30000) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: timeoutMs });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description ?? response.result.exceptionDetails.text ?? JSON.stringify(response.result.exceptionDetails));
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? JSON.stringify(response.exceptionDetails));
  return response.result.result.value;
}

async function dispatchMouse(send, type, x, y) {
  await send('Input.dispatchMouseEvent', {
    type,
    x: Math.round(x),
    y: Math.round(y),
    button: 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount: 1
  });
}

async function runTraceCase({ socket, send, variant, hoverMode, runIndex }) {
  await send('Page.navigate', { url });
  await wait(1200);
  await waitLiveCanvasReady(send);

  const input = { targetCardId, scale, variant, hoverMode, runIndex, enableDomReadProbes, mockGeometryCommit };
  const setup = await evaluate(send, setupPageExpression(input));
  await evaluate(send, installInstrumentationExpression({ ...input, targetCardId: setup.targetCardId }));

  if (hoverMode === 'warm') {
    await dispatchMouse(send, 'mouseMoved', setup.startX, setup.startY);
    await wait(180);
  } else {
    await dispatchMouse(send, 'mouseMoved', setup.offscreenX, setup.offscreenY);
    await wait(80);
  }

  const traceEvents = [];
  const tracingComplete = new Promise((resolve) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Tracing.dataCollected') traceEvents.push(...message.params.value);
      if (message.method === 'Tracing.tracingComplete') {
        socket.removeEventListener('message', onMessage);
        resolve(true);
      }
    };
    socket.addEventListener('message', onMessage);
  });

  await send('Tracing.start', { categories: traceCategories, options: 'record-as-much-as-possible' });
  await wait(50);
  await evaluate(send, `window.__corev2DragTrace?.mark(${JSON.stringify('trace-input-start')})`);
  if (hoverMode === 'cold') {
    await dispatchMouse(send, 'mouseMoved', setup.startX, setup.startY);
    await wait(24);
  }
  await dispatchMouse(send, 'mousePressed', setup.startX, setup.startY);
  for (let step = 1; step <= moveSteps; step += 1) {
    await wait(moveIntervalMs);
    await dispatchMouse(
      send,
      'mouseMoved',
      setup.startX + (dragDx * step) / moveSteps,
      setup.startY + (dragDy * step) / moveSteps
    );
  }
  await wait(120);
  await dispatchMouse(send, 'mouseReleased', setup.startX + dragDx, setup.startY + dragDy);
  await wait(320);
  await evaluate(send, `window.__corev2DragTrace?.mark(${JSON.stringify('trace-input-end')})`);
  await send('Tracing.end');
  await tracingComplete;

  const page = await evaluate(send, finishInstrumentationExpression(), 30000);
  const traceSummary = summarizeTrace(traceEvents);
  const baseName = `${variant}-${hoverMode}-run${runIndex + 1}`;
  const tracePath = join(outputDir, `${baseName}.trace.json`);
  const reportPath = join(outputDir, `${baseName}.report.json`);
  await writeFile(tracePath, JSON.stringify({ traceEvents }));

  const report = {
    case: { variant, hoverMode, runIndex, url, scale, targetCardId: setup.targetCardId },
    setup,
    input: { moveSteps, moveIntervalMs, dragDx, dragDy },
    tracePath,
    trace: traceSummary,
    page
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  return { ...report, reportPath };
}

function mutationTime(page, attributeName = 'style') {
  return page.mutations.find((mutation) => mutation.attributeName === attributeName && mutation.target.includes('[card='))?.t ?? 0;
}

function markTime(page, label) {
  return page.marks.find((mark) => mark.label === label)?.t ?? 0;
}

function markTimeAfter(page, label, afterMs) {
  return page.marks.find((mark) => mark.label === label && mark.t > afterMs)?.t ?? 0;
}

function mutationTimeAfter(page, attributeName, afterMs) {
  return page.mutations.find((mutation) => (
    mutation.attributeName === attributeName
    && mutation.target.includes('[card=')
    && mutation.t > afterMs
  ))?.t ?? 0;
}

function telemetryCounts(page) {
  const counts = new Map();
  for (const entry of page.telemetry ?? []) {
    counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([name, count]) => ({ name, count }));
}

function pointerDownTelemetry(page) {
  const entry = (page.telemetry ?? []).find((telemetryEntry) => telemetryEntry.name === 'canvas-pointer-down');
  return entry?.args ?? {};
}

function summarizeCase(report) {
  const moveCapture = markTime(report.page, 'pointermove:capture');
  const pointerDown = markTime(report.page, 'pointerdown:capture');
  const firstDragMove = markTimeAfter(report.page, 'pointermove:capture', pointerDown);
  const firstCardStyle = mutationTimeAfter(report.page, 'style', firstDragMove);
  const release = markTime(report.page, 'pointerup:capture');
  const traceInputEnd = markTime(report.page, 'trace-input-end') || Number.POSITIVE_INFINITY;
  const frameGapRows = report.page.frames.slice(1).map((t, index) => ({ start: report.page.frames[index], end: t, gap: round(t - report.page.frames[index]) }));
  const maxGapInWindow = (start, end) => round(Math.max(0, ...frameGapRows.filter((row) => row.start >= start && row.start <= end).map((row) => row.gap)));
  return {
    case: `${report.case.variant}/${report.case.hoverMode}#${report.case.runIndex + 1}`,
    targetCardId: report.case.targetCardId,
    pointerDown: pointerDownTelemetry(report.page),
    counts: report.setup.counts,
    pointerDownMs: round(pointerDown),
    firstMoveMs: round(firstDragMove || moveCapture),
    firstCardStyleMutationMs: round(firstCardStyle),
    pointerDownToFirstMoveMs: round((firstDragMove || moveCapture) - pointerDown),
    moveToStyleMutationMs: round(firstCardStyle - (firstDragMove || moveCapture)),
    releaseMs: round(release),
    maxFrameGapMs: report.page.frameGapsSummary.maxMs,
    p95FrameGapMs: report.page.frameGapsSummary.p95Ms,
    maxFrameGapBeforeDragMs: maxGapInWindow(0, pointerDown),
    maxFrameGapDuringDragMs: maxGapInWindow(pointerDown, release),
    maxFrameGapAfterReleaseMs: maxGapInWindow(release, traceInputEnd),
    domReadsByKind: report.page.domReads.byKind.slice(0, 8),
    domReadsByEvent: report.page.domReads.byEvent.slice(0, 8),
    telemetryCounts: telemetryCounts(report.page),
    eventDispatchByType: report.trace.eventDispatchByType.slice(0, 8),
    traceGroups: report.trace.groups,
    topTraceNames: report.trace.topNames.slice(0, 10),
    topLongEvents: report.trace.longEvents.slice(0, 8),
    reportPath: report.reportPath,
    tracePath: report.tracePath
  };
}

function formatSuiteSummary(summaries) {
  const lines = [
    `Card drag CDP trace suite`,
    `url=${url}`,
    `outputDir=${outputDir}`,
    `scale=${scale} variants=${variants.join(',')} hoverModes=${hoverModes.join(',')} runs=${runsPerCase} domReadProbes=${enableDomReadProbes} mockGeometryCommit=${mockGeometryCommit}`,
    ''
  ];
  for (const summary of summaries) {
    lines.push(`${summary.case}: cards=${summary.counts.cards} zones=${summary.counts.zones} rel=${summary.counts.relationships} images=${summary.counts.images}`);
    lines.push(`  target=${summary.targetCardId} pointerDown=${summary.pointerDown.targetKind ?? '?'}:${summary.pointerDown.targetId ?? '?'}`);
    lines.push(`  down->firstMove=${summary.pointerDownToFirstMoveMs}ms move->style=${summary.moveToStyleMutationMs}ms release=${summary.releaseMs}ms frameGap before/during/after=${summary.maxFrameGapBeforeDragMs}/${summary.maxFrameGapDuringDragMs}/${summary.maxFrameGapAfterReleaseMs}ms p95=${summary.p95FrameGapMs}ms`);
    lines.push(`  trace input total=${summary.traceGroups.input.totalMs}ms max=${summary.traceGroups.input.maxMs}ms style/layout total=${summary.traceGroups.forcedStyleLayout.totalMs}ms max=${summary.traceGroups.forcedStyleLayout.maxMs}ms raster total=${summary.traceGroups.rasterComposite.totalMs}ms max=${summary.traceGroups.rasterComposite.maxMs}ms`);
    const reads = summary.domReadsByEvent.slice(0, 4).map((entry) => `${entry.activeEvent}/${entry.kind}:${entry.count}`).join(', ');
    lines.push(`  dom reads: ${reads || 'none'}`);
    const dispatch = summary.eventDispatchByType.slice(0, 4).map((entry) => `${entry.type}:${entry.totalMs}ms/${entry.maxMs}ms`).join(', ');
    lines.push(`  event dispatch: ${dispatch || 'none'}`);
    const telemetry = summary.telemetryCounts.slice(0, 6).map((entry) => `${entry.name}:${entry.count}`).join(', ');
    lines.push(`  telemetry: ${telemetry || 'none'}`);
    lines.push(`  report=${summary.reportPath}`);
  }
  return lines.join('\n');
}

await mkdir(outputDir, { recursive: true });
const { socket, send } = await connectPage(cdpJsonUrl);

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 920, deviceScaleFactor: 1, mobile: false });

  const reports = [];
  for (const variant of variants) {
    for (const hoverMode of hoverModes) {
      for (let runIndex = 0; runIndex < runsPerCase; runIndex += 1) {
        reports.push(await runTraceCase({ socket, send, variant, hoverMode, runIndex }));
      }
    }
  }

  const summaries = reports.map(summarizeCase);
  const suiteReport = {
    generatedAt: new Date().toISOString(),
    config: { url, cdpJsonUrl, outputDir, targetCardId, scale, variants, hoverModes, runsPerCase, moveSteps, moveIntervalMs, dragDx, dragDy, longEventThresholdMs, enableDomReadProbes, mockGeometryCommit },
    summaries,
    reports: reports.map((report) => report.reportPath)
  };
  await writeFile(join(outputDir, 'suite-summary.json'), JSON.stringify(suiteReport, null, 2));
  await writeFile(join(outputDir, 'suite-summary.txt'), formatSuiteSummary(summaries));
  console.log(formatSuiteSummary(summaries));
} finally {
  socket.close();
}

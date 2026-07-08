#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectPage } from './function/connect-page.mjs';
import { wait } from './function/wait.mjs';
import { waitLiveCanvasReady } from './function/wait-live-canvas-ready.mjs';

const url = process.env.DECISION_OS_URL ?? 'http://127.0.0.1:50150/orders-2';
const cdpJsonUrl = process.env.DECISION_OS_CDP_JSON ?? 'http://127.0.0.1:9223/json';
const outputDir = process.env.DECISION_OS_MANUAL_TRACE_OUTPUT_DIR ?? `/tmp/decision-os-manual-commit-trace-${Date.now()}`;
const durationMs = Math.max(1000, Number(process.env.DECISION_OS_MANUAL_TRACE_DURATION_MS ?? 20000));
const armDelayMs = Math.max(0, Number(process.env.DECISION_OS_MANUAL_TRACE_ARM_DELAY_MS ?? 3000));
const navigate = process.env.DECISION_OS_MANUAL_TRACE_NAVIGATE !== '0';
const enableDomReadProbes = process.env.DECISION_OS_MANUAL_TRACE_DOM_READ_PROBES === '1';
const slowFrameThresholdMs = Number(process.env.DECISION_OS_MANUAL_TRACE_SLOW_FRAME_MS ?? 33);
const frameOffenderThresholdMs = Number(process.env.DECISION_OS_MANUAL_TRACE_FRAME_OFFENDER_MS ?? 10);

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

function round(value, digits = 3) {
  return Number(Number(value || 0).toFixed(digits));
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

function addDuration(map, key, ms, extra = {}) {
  const current = map.get(key) ?? { key, count: 0, totalMs: 0, maxMs: 0, ...extra };
  current.count += 1;
  current.totalMs += ms;
  current.maxMs = Math.max(current.maxMs, ms);
  map.set(key, current);
}

function topByTotal(map, count = 16) {
  return [...map.values()]
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, count)
    .map((entry) => ({ ...entry, totalMs: round(entry.totalMs), maxMs: round(entry.maxMs) }));
}

function eventArgType(event) {
  return event.args?.data?.type
    ?? event.args?.beginData?.type
    ?? event.args?.data?.name
    ?? event.args?.frame
    ?? '';
}

function eventLabel(event) {
  const argType = eventArgType(event);
  return argType ? `${event.name}:${argType}` : event.name;
}

function completeTraceEvents(events) {
  return events.filter((event) => event.ph === 'X' && typeof event.dur === 'number' && event.dur > 0);
}

function intervalOverlapUs(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function traceMarks(traceEvents) {
  return traceEvents
    .filter((event) => event.cat?.includes('blink.user_timing') && String(event.name ?? '').startsWith('decision-os-manual:'))
    .map((event) => ({ label: String(event.name).replace(/^decision-os-manual:/, ''), ts: event.ts }))
    .filter((mark) => mark.label && typeof mark.ts === 'number');
}

function traceAlignmentOffsetUs(traceEvents, page) {
  const marks = traceMarks(traceEvents);
  const byLabel = new Map();
  for (const mark of marks) {
    if (!byLabel.has(mark.label)) byLabel.set(mark.label, mark);
  }
  for (const pageMark of page?.marks ?? []) {
    const traceMark = byLabel.get(pageMark.label);
    if (traceMark) return traceMark.ts - pageMark.t * 1000;
  }
  return 0;
}

function framePhase(page, startMs, endMs) {
  const marks = page?.marks ?? [];
  const pointerDown = marks.find((mark) => mark.label === 'pointerdown:capture')?.t ?? Number.POSITIVE_INFINITY;
  const pointerUp = marks.find((mark) => mark.label === 'pointerup:capture')?.t ?? Number.POSITIVE_INFINITY;
  const fetchStart = marks.find((mark) => mark.label === 'fetch:start' && String(mark.method ?? '').toUpperCase() === 'PATCH')?.t ?? Number.POSITIVE_INFINITY;
  const fetchEnd = marks.find((mark) => mark.label === 'fetch:end' && String(mark.method ?? '').toUpperCase() === 'PATCH')?.t ?? Number.POSITIVE_INFINITY;
  if (endMs <= pointerDown) return 'before-input';
  if (startMs >= pointerDown && endMs <= pointerUp) return 'during-pointer';
  if (startMs >= pointerUp && startMs <= fetchStart) return 'after-release-before-patch';
  if (startMs >= fetchStart && startMs <= fetchEnd) return 'patch-network';
  if (startMs >= fetchEnd) return 'post-patch-render';
  return 'boundary';
}

function summarizeFrameEvents(events, frameStartUs, frameEndUs) {
  const byLabel = new Map();
  const byGroup = new Map();
  const offenders = [];
  const groups = [
    { group: 'input', names: new Set(['EventDispatch', 'WebFrameWidgetImpl::HandleInputEvent', 'EventHandler::handleMouseMoveEvent', 'EventHandler::handleMousePressEvent', 'EventHandler::handleMouseReleaseEvent', 'LayoutView::HitTest']) },
    { group: 'style-layout', names: new Set(['Document::UpdateStyleAndLayout', 'LocalFrameView::UpdateStyleAndLayout', 'Blink.ForcedStyleAndLayout.UpdateTime', 'UpdateLayoutTree', 'Document::recalcStyle', 'Document::updateStyle', 'Document::rebuildLayoutTree', 'Layout', 'LocalFrameView::layout', 'LocalFrameView::RunStyleAndLayoutLifecyclePhases']) },
    { group: 'paint-layer', names: new Set(['PrePaint', 'Paint', 'PaintImage', 'Layerize', 'UpdateLayerTree', 'LocalFrameView::RunPaintLifecyclePhase', 'LocalFrameView::pushPaintArtifactToCompositor']) },
    { group: 'commit-raster-composite', names: new Set(['RasterTask', 'RasterizerTaskImpl::RunOnWorkerThread', 'TaskGraphRunner::RunTask', 'ZeroCopyRasterBuffer::Playback', 'DisplayItemList::Raster', 'ProxyMain::BeginMainFrame', 'ProxyMain::BeginMainFrame::commit', 'LayerTreeHost::WaitForCommitCompletion', 'Commit', 'CompositeLayers', 'DrawFrame', 'ActivateLayerTree']) },
    { group: 'scripting', names: new Set(['FunctionCall', 'v8.callFunction', 'EvaluateScript', 'RunTask', 'TimerFire']) }
  ];
  const wrapperNames = new Set([
    'RunTask',
    'ThreadControllerImpl::RunTask',
    'ThreadPool_RunTask',
    'LatencyInfo.Flow',
    'FunctionCall',
    'v8.callFunction'
  ]);
  for (const event of events) {
    const eventStart = event.ts;
    const eventEnd = event.ts + event.dur;
    const overlapMs = intervalOverlapUs(frameStartUs, frameEndUs, eventStart, eventEnd) / 1000;
    if (overlapMs <= 0) continue;
    const label = eventLabel(event);
    addDuration(byLabel, label, overlapMs, { name: event.name, label, argType: eventArgType(event), cat: event.cat });
    for (const group of groups) {
      if (group.names.has(event.name)) addDuration(byGroup, group.group, overlapMs, { group: group.group });
    }
    if (overlapMs >= frameOffenderThresholdMs) {
      offenders.push({
        name: event.name,
        label,
        argType: eventArgType(event),
        cat: event.cat,
        overlapMs: round(overlapMs),
        durationMs: round(event.dur / 1000)
      });
    }
  }
  return {
    top: topByTotal(byLabel, 16).map((entry) => ({
      label: entry.label,
      name: entry.name,
      argType: entry.argType,
      count: entry.count,
      totalMs: entry.totalMs,
      maxMs: entry.maxMs
    })),
    offenders: offenders.sort((a, b) => b.overlapMs - a.overlapMs).slice(0, 16),
    actionableOffenders: offenders
      .filter((event) => !wrapperNames.has(event.name))
      .sort((a, b) => b.overlapMs - a.overlapMs)
      .slice(0, 16),
    groups: topByTotal(byGroup, 8).map((entry) => ({
      group: entry.group,
      count: entry.count,
      totalMs: entry.totalMs,
      maxMs: entry.maxMs
    }))
  };
}

function analyzeSlowFrames(traceEvents, page) {
  const frames = page?.frames ?? [];
  if (frames.length < 2) return { thresholdMs: slowFrameThresholdMs, count: 0, worst: [], frames: [], byPhase: [] };
  const completeEvents = completeTraceEvents(traceEvents);
  const offsetUs = traceAlignmentOffsetUs(traceEvents, page);
  const byPhase = new Map();
  const slowFrames = [];
  for (let index = 0; index < frames.length - 1; index += 1) {
    const startMs = frames[index];
    const endMs = frames[index + 1];
    const durationMs = round(endMs - startMs);
    if (durationMs < slowFrameThresholdMs) continue;
    const phase = framePhase(page, startMs, endMs);
    const summary = summarizeFrameEvents(completeEvents, offsetUs + startMs * 1000, offsetUs + endMs * 1000);
    addDuration(byPhase, phase, durationMs, { phase });
    slowFrames.push({
      index,
      phase,
      startMs: round(startMs),
      endMs: round(endMs),
      durationMs,
      groups: summary.groups,
      offenders: summary.offenders,
      actionableOffenders: summary.actionableOffenders,
      topOverlappingEvents: summary.top
    });
  }
  return {
    thresholdMs: slowFrameThresholdMs,
    offenderThresholdMs: frameOffenderThresholdMs,
    alignment: { offsetUs: round(offsetUs) },
    count: slowFrames.length,
    worst: slowFrames.slice().sort((a, b) => b.durationMs - a.durationMs).slice(0, 24),
    frames: slowFrames,
    byPhase: topByTotal(byPhase, 8).map((entry) => ({
      phase: entry.phase,
      count: entry.count,
      totalMs: entry.totalMs,
      maxMs: entry.maxMs
    }))
  };
}

function groupDurations(completeEvents, names) {
  const wanted = new Set(names);
  return summarize(completeEvents.filter((event) => wanted.has(event.name)).map((event) => event.dur / 1000));
}

function summarizeTrace(traceEvents, page) {
  const completeEvents = completeTraceEvents(traceEvents);
  const byName = new Map();
  const byDispatchType = new Map();
  for (const event of completeEvents) {
    const ms = event.dur / 1000;
    addDuration(byName, event.name, ms, { name: event.name });
    if (event.name === 'EventDispatch') {
      const type = String(eventArgType(event) || 'unknown');
      addDuration(byDispatchType, type, ms, { type });
    }
  }
  const longEvents = completeEvents
    .filter((event) => event.dur / 1000 >= frameOffenderThresholdMs)
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 48)
    .map((event) => ({ name: event.name, label: eventLabel(event), ms: round(event.dur / 1000), cat: event.cat, argType: eventArgType(event) }));
  return {
    eventCount: traceEvents.length,
    completeEventCount: completeEvents.length,
    topNames: topByTotal(byName, 32).map((entry) => ({ name: entry.name, count: entry.count, totalMs: entry.totalMs, maxMs: entry.maxMs })),
    eventDispatchByType: topByTotal(byDispatchType, 16).map((entry) => ({ type: entry.type, count: entry.count, totalMs: entry.totalMs, maxMs: entry.maxMs })),
    groups: {
      input: groupDurations(completeEvents, ['EventDispatch', 'WebFrameWidgetImpl::HandleInputEvent', 'EventHandler::handleMouseMoveEvent', 'EventHandler::handleMousePressEvent', 'EventHandler::handleMouseReleaseEvent', 'LayoutView::HitTest']),
      scripting: groupDurations(completeEvents, ['FunctionCall', 'v8.callFunction', 'EvaluateScript', 'RunTask', 'TimerFire']),
      styleLayout: groupDurations(completeEvents, ['Document::UpdateStyleAndLayout', 'LocalFrameView::UpdateStyleAndLayout', 'Blink.ForcedStyleAndLayout.UpdateTime', 'UpdateLayoutTree', 'Document::recalcStyle', 'Document::updateStyle', 'Document::rebuildLayoutTree', 'Layout', 'LocalFrameView::layout', 'LocalFrameView::RunStyleAndLayoutLifecyclePhases']),
      paintLayer: groupDurations(completeEvents, ['PrePaint', 'Paint', 'PaintImage', 'Layerize', 'UpdateLayerTree', 'LocalFrameView::RunPaintLifecyclePhase', 'LocalFrameView::pushPaintArtifactToCompositor']),
      commitRasterComposite: groupDurations(completeEvents, ['RasterTask', 'RasterizerTaskImpl::RunOnWorkerThread', 'TaskGraphRunner::RunTask', 'ZeroCopyRasterBuffer::Playback', 'DisplayItemList::Raster', 'ProxyMain::BeginMainFrame', 'ProxyMain::BeginMainFrame::commit', 'LayerTreeHost::WaitForCommitCompletion', 'Commit', 'CompositeLayers', 'DrawFrame', 'ActivateLayerTree'])
    },
    longEvents,
    slowFrames: analyzeSlowFrames(traceEvents, page)
  };
}

function pageExpression(source) {
  return `(${source})()`;
}

function installInstrumentationExpression(input) {
  return pageExpression(function installManualCommitTraceInstrumentation() {
    const input = window.__decisionOsManualTraceInput;
    window.__decisionOsManualTrace?.restore?.();

    const session = {
      startedAt: performance.now(),
      marks: [],
      frames: [],
      longTasks: [],
      telemetryStart: (window.__coreTelemetry ?? []).length,
      fetches: [],
      domReadsByKind: new Map(),
      domReadsByEvent: new Map(),
      slowDomReads: [],
      restoreFns: [],
      eventAbort: new AbortController(),
      frameActive: true,
      activeEvent: 'idle'
    };
    const round = (value) => Number(Number(value || 0).toFixed(3));
    const now = () => round(performance.now() - session.startedAt);
    const mark = (label, extra = {}) => {
      performance.mark(`decision-os-manual:${label}`);
      session.marks.push({ label, t: now(), activeEvent: session.activeEvent, ...extra });
    };
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
    const addRead = (map, key, row, durationMs) => {
      const current = map.get(key) ?? { ...row, count: 0, totalMs: 0, maxMs: 0 };
      current.count += 1;
      current.totalMs += durationMs;
      current.maxMs = Math.max(current.maxMs, durationMs);
      map.set(key, current);
    };
    const recordRead = (kind, node, durationMs) => {
      const target = describe(node);
      addRead(session.domReadsByKind, kind, { kind }, durationMs);
      addRead(session.domReadsByEvent, `${session.activeEvent} / ${kind}`, { key: `${session.activeEvent} / ${kind}`, activeEvent: session.activeEvent, kind }, durationMs);
      const roundedDuration = round(durationMs);
      if (roundedDuration >= 0.25) {
        session.slowDomReads.push({ kind, target, t: now(), durationMs: roundedDuration, activeEvent: session.activeEvent });
        session.slowDomReads.sort((a, b) => b.durationMs - a.durationMs);
        session.slowDomReads.length = Math.min(session.slowDomReads.length, 64);
      }
    };

    const eventTypes = ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'click', 'wheel', 'keydown', 'keyup'];
    for (const type of eventTypes) {
      window.addEventListener(type, (event) => {
        session.activeEvent = `${type}:capture`;
        mark(`${type}:capture`, { x: event.clientX, y: event.clientY, key: event.key });
      }, { capture: true, signal: session.eventAbort.signal });
      window.addEventListener(type, (event) => {
        mark(`${type}:bubble`, { x: event.clientX, y: event.clientY, key: event.key });
        session.activeEvent = 'idle';
      }, { signal: session.eventAbort.signal });
    }
    session.restoreFns.push(() => session.eventAbort.abort());

    const telemetryListener = (event) => {
      const detail = event.detail || {};
      mark(`telemetry:${detail.name || 'unknown'}`, { args: detail.args || {} });
    };
    window.addEventListener('core:telemetry', telemetryListener);
    session.restoreFns.push(() => window.removeEventListener('core:telemetry', telemetryListener));

    const originalFetch = window.fetch.bind(window);
    window.fetch = async function tracedFetch(resource, options = {}) {
      const method = String(options?.method ?? 'GET').toUpperCase();
      const url = String(resource?.url ?? resource ?? '');
      const body = typeof options?.body === 'string' ? options.body : '';
      const action = body.match(/"action"\s*:\s*"([^"]+)"/)?.[1] ?? '';
      const record = { method, url, action, startMs: now(), endMs: 0, ok: null, status: 0, jsonStartMs: 0, jsonEndMs: 0, jsonOk: null };
      session.fetches.push(record);
      mark('fetch:start', { method, url, action });
      try {
        const response = await originalFetch(resource, options);
        record.endMs = now();
        record.ok = response.ok;
        record.status = response.status;
        mark('fetch:end', { method, url, action, ok: response.ok, status: response.status });
        const originalJson = response.json.bind(response);
        response.json = async function tracedJson() {
          record.jsonStartMs = now();
          mark('fetch-json:start', { method, url, action });
          try {
            const value = await originalJson();
            record.jsonEndMs = now();
            record.jsonOk = true;
            mark('fetch-json:end', { method, url, action, ok: true });
            return value;
          } catch (error) {
            record.jsonEndMs = now();
            record.jsonOk = false;
            mark('fetch-json:end', { method, url, action, ok: false, error: String(error?.message ?? error) });
            throw error;
          }
        };
        return response;
      } catch (error) {
        record.endMs = now();
        record.ok = false;
        mark('fetch:end', { method, url, action, ok: false, error: String(error?.message ?? error) });
        throw error;
      }
    };
    session.restoreFns.push(() => { window.fetch = originalFetch; });

    if (input.enableDomReadProbes) {
      const originalGetComputedStyle = window.getComputedStyle.bind(window);
      window.getComputedStyle = function tracedGetComputedStyle(element, pseudo) {
        const startedAt = performance.now();
        const result = originalGetComputedStyle(element, pseudo);
        recordRead('getComputedStyle', element, performance.now() - startedAt);
        return result;
      };
      session.restoreFns.push(() => { window.getComputedStyle = originalGetComputedStyle; });

      const originalRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function tracedGetBoundingClientRect() {
        const startedAt = performance.now();
        const result = originalRect.call(this);
        recordRead('getBoundingClientRect', this, performance.now() - startedAt);
        return result;
      };
      session.restoreFns.push(() => { Element.prototype.getBoundingClientRect = originalRect; });

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
        session.restoreFns.push(() => Object.defineProperty(HTMLElement.prototype, property, descriptor));
      }
    }

    if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          session.longTasks.push({ name: entry.name, startTime: round(entry.startTime - session.startedAt), durationMs: round(entry.duration) });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
      session.restoreFns.push(() => observer.disconnect());
    }

    function frameLoop() {
      if (!session.frameActive) return;
      session.frames.push(now());
      requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);

    const sortRows = (rows) => [...rows.values()]
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 32)
      .map((entry) => ({ ...entry, totalMs: round(entry.totalMs), maxMs: round(entry.maxMs) }));

    window.__decisionOsManualTrace = {
      mark,
      restore() {
        session.frameActive = false;
        for (const restore of [...session.restoreFns].reverse()) restore();
      },
      finish() {
        session.frameActive = false;
        const frameGaps = session.frames.slice(1).map((t, index) => round(t - session.frames[index]));
        const sorted = [...frameGaps].sort((a, b) => a - b);
        const coreState = window.__coreState || {};
        return {
          location: { href: location.href, path: location.pathname, search: location.search },
          state: {
            activeTab: coreState.activeTab,
            canvasMode: coreState.canvasMode,
            viewport: coreState.viewport,
            selection: coreState.selection,
            activeLedgerCounts: {
              cards: Array.isArray(coreState.activeLedger?.cards) ? coreState.activeLedger.cards.length : 0,
              annotations: Array.isArray(coreState.activeLedger?.annotations) ? coreState.activeLedger.annotations.length : 0,
              relationships: Array.isArray(coreState.activeLedger?.relationships) ? coreState.activeLedger.relationships.length : 0
            }
          },
          domCounts: {
            cards: document.querySelectorAll('.canvas-content > .card[data-card-id]').length,
            detailCards: document.querySelectorAll('.canvas-content > .card.detail-visible').length,
            detailLayers: document.querySelectorAll('.canvas-content > .card .ledger-card-detail-layer').length,
            relationships: document.querySelectorAll('.ledger-relationships [data-relationship-id]').length,
            images: document.querySelectorAll('img').length
          },
          marks: session.marks,
          frames: session.frames,
          frameGaps,
          frameGapsSummary: {
            count: frameGaps.length,
            maxMs: round(Math.max(0, ...frameGaps)),
            p95Ms: round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0),
            over33ms: frameGaps.filter((gap) => gap > 33).length,
            over50ms: frameGaps.filter((gap) => gap > 50).length,
            over100ms: frameGaps.filter((gap) => gap > 100).length,
            over500ms: frameGaps.filter((gap) => gap > 500).length
          },
          longTasks: session.longTasks,
          fetches: session.fetches,
          domReads: {
            enabled: input.enableDomReadProbes,
            byKind: sortRows(session.domReadsByKind),
            byEvent: sortRows(session.domReadsByEvent),
            slowest: session.slowDomReads
          },
          telemetry: (window.__coreTelemetry ?? []).slice(session.telemetryStart)
        };
      }
    };
    mark('instrumentation-installed', { enableDomReadProbes: input.enableDomReadProbes });
    return true;
  }).replace('const input = window.__decisionOsManualTraceInput;', `const input = ${JSON.stringify(input)};`);
}

function finishInstrumentationExpression() {
  return pageExpression(function finishManualCommitTraceInstrumentation() {
    window.__decisionOsManualTrace?.mark?.('trace-end');
    const output = window.__decisionOsManualTrace?.finish?.();
    window.__decisionOsManualTrace?.restore?.();
    return output;
  });
}

async function evaluate(send, expression, timeoutMs = 30000) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: timeoutMs });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description ?? response.result.exceptionDetails.text ?? JSON.stringify(response.result.exceptionDetails));
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? JSON.stringify(response.exceptionDetails));
  return response.result.result.value;
}

function telemetryCounts(page) {
  const counts = new Map();
  for (const entry of page.telemetry ?? []) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([name, count]) => ({ name, count }));
}

function formatSummary(report) {
  const lines = [
    'Decision OS manual commit trace',
    `url=${report.page.location.href}`,
    `outputDir=${report.outputDir}`,
    `duration=${durationMs}ms domReadProbes=${enableDomReadProbes}`,
    `activeTab=${report.page.state.activeTab} mode=${report.page.state.canvasMode} viewport=${JSON.stringify(report.page.state.viewport)}`,
    `ledger cards=${report.page.state.activeLedgerCounts.cards} annotations=${report.page.state.activeLedgerCounts.annotations} relationships=${report.page.state.activeLedgerCounts.relationships}`,
    `dom cards=${report.page.domCounts.cards} detail=${report.page.domCounts.detailCards}/${report.page.domCounts.detailLayers} relationships=${report.page.domCounts.relationships} images=${report.page.domCounts.images}`,
    '',
    `RAF gaps: count=${report.page.frameGapsSummary.count} p95=${report.page.frameGapsSummary.p95Ms}ms max=${report.page.frameGapsSummary.maxMs}ms over33=${report.page.frameGapsSummary.over33ms} over50=${report.page.frameGapsSummary.over50ms} over100=${report.page.frameGapsSummary.over100ms} over500=${report.page.frameGapsSummary.over500ms}`,
    `Trace groups: input max=${report.trace.groups.input.maxMs}ms style/layout max=${report.trace.groups.styleLayout.maxMs}ms paint/layer max=${report.trace.groups.paintLayer.maxMs}ms commit/raster max=${report.trace.groups.commitRasterComposite.maxMs}ms scripting max=${report.trace.groups.scripting.maxMs}ms`,
    `Slow frames >=${report.trace.slowFrames.thresholdMs}ms: count=${report.trace.slowFrames.count} phases=${report.trace.slowFrames.byPhase.map((entry) => `${entry.phase}:${entry.count}/max${entry.maxMs}ms`).join(', ') || 'none'}`,
    ''
  ];

  lines.push('Fetches:');
  if (!report.page.fetches.length) lines.push('- none captured');
  for (const fetchRecord of report.page.fetches.slice(0, 12)) {
    const networkMs = fetchRecord.endMs ? round(fetchRecord.endMs - fetchRecord.startMs) : 0;
    const jsonMs = fetchRecord.jsonEndMs ? round(fetchRecord.jsonEndMs - fetchRecord.jsonStartMs) : 0;
    lines.push(`- ${fetchRecord.method} ${fetchRecord.action || fetchRecord.url}: status=${fetchRecord.status} network=${networkMs}ms json=${jsonMs}ms`);
  }

  lines.push('', 'Telemetry counts:');
  for (const entry of telemetryCounts(report.page).slice(0, 10)) lines.push(`- ${entry.name}: ${entry.count}`);
  if (!telemetryCounts(report.page).length) lines.push('- none');

  lines.push('', 'Worst frames:');
  for (const frame of report.trace.slowFrames.worst.slice(0, 8)) {
    const groups = frame.groups.slice(0, 4).map((entry) => `${entry.group} ${entry.totalMs}ms`).join(', ');
    const offenders = frame.actionableOffenders.slice(0, 4).map((entry) => `${entry.label} ${entry.overlapMs}ms`).join(', ');
    const fallback = frame.topOverlappingEvents.slice(0, 4).map((entry) => `${entry.label} ${entry.totalMs}ms`).join(', ');
    lines.push(`- frame#${frame.index} ${frame.phase} ${frame.durationMs}ms groups=${groups || 'none'} offenders=${offenders || fallback || 'none'}`);
  }
  if (!report.trace.slowFrames.worst.length) lines.push('- none');

  lines.push('', 'Top long trace events:');
  for (const event of report.trace.longEvents.slice(0, 12)) lines.push(`- ${event.label}: ${event.ms}ms (${event.cat})`);
  if (!report.trace.longEvents.length) lines.push('- none');

  lines.push('', `report=${report.reportPath}`, `trace=${report.tracePath}`);
  return lines.join('\n');
}

await mkdir(outputDir, { recursive: true });
const { socket, send } = await connectPage(cdpJsonUrl);

try {
  await send('Page.enable');
  await send('Runtime.enable');
  if (navigate) {
    await send('Page.navigate', { url });
    await wait(1200);
  }
  await waitLiveCanvasReady(send);
  await evaluate(send, installInstrumentationExpression({ enableDomReadProbes }));

  if (armDelayMs) {
    console.log(`Manual trace armed for ${url}. Capture starts in ${armDelayMs}ms.`);
    await wait(armDelayMs);
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
  await evaluate(send, `window.__decisionOsManualTrace?.mark(${JSON.stringify('trace-start')})`);
  console.log(`TRACE ACTIVE for ${durationMs}ms. Reproduce the slow commit now.`);
  await wait(durationMs);
  await send('Tracing.end');
  await tracingComplete;

  const page = await evaluate(send, finishInstrumentationExpression(), 30000);
  const trace = { traceEvents };
  const tracePath = join(outputDir, 'manual-commit.trace.json');
  const reportPath = join(outputDir, 'manual-commit.report.json');
  const summaryPath = join(outputDir, 'manual-commit.summary.txt');
  await writeFile(tracePath, JSON.stringify(trace));
  const report = {
    generatedAt: new Date().toISOString(),
    config: { url, cdpJsonUrl, outputDir, durationMs, armDelayMs, navigate, enableDomReadProbes, slowFrameThresholdMs, frameOffenderThresholdMs },
    outputDir,
    tracePath,
    reportPath,
    summaryPath,
    page,
    trace: summarizeTrace(traceEvents, page)
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  const summary = formatSummary(report);
  await writeFile(summaryPath, summary);
  console.log(summary);
} finally {
  socket.close();
}

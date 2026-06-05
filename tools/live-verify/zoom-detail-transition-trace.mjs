#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectPage } from './function/connect-page.mjs';
import { wait } from './function/wait.mjs';
import { waitLiveCanvasReady } from './function/wait-live-canvas-ready.mjs';

const url = process.env.COREV2_URL ?? 'http://127.0.0.1:4173/ardaria-game-design';
const cdpJsonUrl = process.env.COREV2_CDP_JSON ?? 'http://127.0.0.1:9223/json';
const outputDir = process.env.COREV2_ZOOM_DETAIL_TRACE_OUTPUT_DIR ?? `/tmp/corev2-zoom-detail-transition-${Date.now()}`;
const cases = parseList(process.env.COREV2_ZOOM_DETAIL_CASES, ['normal-to-low', 'low-to-normal', 'low-to-overview', 'overview-to-low']);
const variants = parseList(process.env.COREV2_ZOOM_DETAIL_VARIANTS, ['baseline', 'no-grid', 'no-detail-layer', 'no-overview-layer', 'no-counter-scale']);
const slowFrameThresholdMs = Number(process.env.COREV2_ZOOM_DETAIL_SLOW_FRAME_MS ?? 16.7);
const offenderThresholdMs = Number(process.env.COREV2_ZOOM_DETAIL_OFFENDER_MS ?? 8);

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

const caseScales = {
  'normal-to-low': { before: 0.365, after: 0.34 },
  'low-to-normal': { before: 0.34, after: 0.365 },
  'low-to-overview': { before: 0.19, after: 0.17 },
  'overview-to-low': { before: 0.17, after: 0.19 }
};

function parseList(value, fallback) {
  if (!value) return fallback;
  const parsed = value.split(',').map((part) => part.trim()).filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function round(value) {
  return Number(value.toFixed(3));
}

function wheelDeltaForScale(before, after) {
  return -Math.log(after / before) / 0.0015;
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

function intervalOverlapUs(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function addDuration(map, key, ms, extra = {}) {
  const current = map.get(key) ?? { key, count: 0, totalMs: 0, maxMs: 0, ...extra };
  current.count += 1;
  current.totalMs += ms;
  current.maxMs = Math.max(current.maxMs, ms);
  map.set(key, current);
}

function topByTotal(items, count = 12) {
  return [...items.values()]
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, count)
    .map((entry) => ({ ...entry, totalMs: round(entry.totalMs), maxMs: round(entry.maxMs) }));
}

function traceMarks(traceEvents) {
  return traceEvents
    .filter((event) => event.cat?.includes('blink.user_timing') && event.ph === 'I' && String(event.name ?? '').startsWith('corev2-zoom-detail:'))
    .map((event) => ({ label: String(event.name).split(':').slice(3).join(':'), ts: event.ts }))
    .filter((mark) => mark.label && typeof mark.ts === 'number');
}

function alignmentOffsetUs(traceEvents, page) {
  const traceByLabel = new Map(traceMarks(traceEvents).map((mark) => [mark.label, mark]));
  for (const label of ['trace-start', 'wheel:capture']) {
    const pageMark = (page?.marks ?? []).find((mark) => mark.label === label);
    const traceMark = traceByLabel.get(label);
    if (pageMark && traceMark) return traceMark.ts - pageMark.t * 1000;
  }
  return 0;
}

function summarizeFrameEvents(events, frameStartUs, frameEndUs) {
  const byLabel = new Map();
  const byGroup = new Map();
  const offenders = [];
  const groups = [
    { group: 'input', names: new Set(['EventDispatch', 'WebFrameWidgetImpl::HandleInputEvent', 'LayoutView::HitTest']) },
    { group: 'style-layout', names: new Set(['Document::UpdateStyleAndLayout', 'LocalFrameView::UpdateStyleAndLayout', 'Blink.ForcedStyleAndLayout.UpdateTime', 'UpdateLayoutTree', 'Document::recalcStyle', 'Document::updateStyle', 'Layout', 'LocalFrameView::layout', 'LocalFrameView::RunStyleAndLayoutLifecyclePhases']) },
    { group: 'paint-layer', names: new Set(['PrePaint', 'Paint', 'PaintImage', 'Layerize', 'UpdateLayerTree', 'LocalFrameView::RunPaintLifecyclePhase', 'LocalFrameView::pushPaintArtifactToCompositor']) },
    { group: 'raster-composite', names: new Set(['RasterTask', 'RasterizerTaskImpl::RunOnWorkerThread', 'TaskGraphRunner::RunTask', 'DisplayItemList::Raster', 'ProxyMain::BeginMainFrame', 'ProxyMain::BeginMainFrame::commit', 'LayerTreeHost::WaitForCommitCompletion', 'Commit', 'CompositeLayers', 'DrawFrame']) }
  ];
  for (const event of events) {
    const start = event.ts;
    const end = event.ts + event.dur;
    const overlapMs = intervalOverlapUs(frameStartUs, frameEndUs, start, end) / 1000;
    if (overlapMs <= 0) continue;
    const label = eventLabel(event);
    addDuration(byLabel, label, overlapMs, { label, name: event.name, argType: eventArgType(event), cat: event.cat });
    for (const group of groups) {
      if (group.names.has(event.name)) addDuration(byGroup, group.group, overlapMs, { group: group.group });
    }
    if (overlapMs >= offenderThresholdMs) {
      offenders.push({ label, name: event.name, argType: eventArgType(event), cat: event.cat, overlapMs: round(overlapMs), durationMs: round(event.dur / 1000) });
    }
  }
  return {
    offenders: offenders.sort((a, b) => b.overlapMs - a.overlapMs).slice(0, 10),
    groups: topByTotal(byGroup, 8),
    top: topByTotal(byLabel, 10)
  };
}

function analyzeTrace(traceEvents, page) {
  const completeEvents = traceEvents.filter((event) => event.ph === 'X' && typeof event.dur === 'number' && event.dur > 0);
  const offsetUs = alignmentOffsetUs(traceEvents, page);
  const wheelStart = (page.marks ?? []).find((mark) => mark.label === 'wheel:capture')?.t ?? 0;
  const traceEnd = (page.marks ?? []).find((mark) => mark.label === 'trace-end')?.t ?? Number.POSITIVE_INFINITY;
  const frames = [];
  for (let index = 0; index < (page.frames ?? []).length - 1; index += 1) {
    const startMs = page.frames[index];
    const endMs = page.frames[index + 1];
    if (endMs < wheelStart || startMs > traceEnd) continue;
    const durationMs = round(endMs - startMs);
    if (durationMs < slowFrameThresholdMs) continue;
    frames.push({
      index,
      startMs: round(startMs),
      endMs: round(endMs),
      durationMs,
      ...summarizeFrameEvents(completeEvents, offsetUs + startMs * 1000, offsetUs + endMs * 1000)
    });
  }
  return {
    slowFrameThresholdMs,
    offenderThresholdMs,
    count: frames.length,
    worst: frames.sort((a, b) => b.durationMs - a.durationMs).slice(0, 8)
  };
}

function setupExpression(input) {
  return `(${async function setupZoomDetailTrace() {
    const input = window.__zoomDetailTraceInput;
    const { state } = await import('/src/runtime/state.js');
    const { applyViewportTransform } = await import('/src/runtime/canvas/effect/apply-viewport-transform.js');
    const canvas = document.querySelector('.canvas');
    if (!canvas) throw new Error('Canvas not found');
    document.querySelector('[data-zoom-detail-variant]')?.remove();
    const style = document.createElement('style');
    style.dataset.zoomDetailVariant = input.variant;
    const css = [];
    const variantHas = (flag) => input.variant === flag || input.variant.split('+').includes(flag);
    if (variantHas('no-grid')) css.push('.grid{display:none!important}');
    if (variantHas('no-detail-layer')) css.push('.ledger-card-detail-layer{display:none!important}');
    if (variantHas('no-overview-layer')) css.push('.ledger-card-overview-layer{display:none!important}');
    if (variantHas('no-counter-scale')) css.push('.ledger-card-overview-title,.zone-title,.zone-label-proxy{transform:none!important;max-width:100%!important}');
    style.textContent = css.join('\\n');
    document.head.append(style);
    state.viewport = { x: -820, y: -360, scale: input.beforeScale };
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    state.threadPanelOpen = false;
    document.querySelector('.thread-panel')?.setAttribute('hidden', '');
    applyViewportTransform();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = canvas.getBoundingClientRect();
    return {
      route: location.pathname,
      activeTab: state.activeTab,
      beforeScale: state.viewport.scale,
      lowDetail: canvas.classList.contains('low-detail'),
      overviewDetail: canvas.classList.contains('overview-detail'),
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
      counts: {
        cards: document.querySelectorAll('.ledger-node[data-card-id]').length,
        zones: document.querySelectorAll('.ledger-node[data-zone-id]').length,
        relationships: document.querySelectorAll('.ledger-relationships [data-relationship-id]').length,
        images: document.querySelectorAll('img').length
      }
    };
  }}).call(null)`.replace('const input = window.__zoomDetailTraceInput;', `const input = ${JSON.stringify(input)};`);
}

function installInstrumentationExpression(input) {
  return `(${function installZoomDetailTrace() {
    const input = window.__zoomDetailTraceInput;
    const canvas = document.querySelector('.canvas');
    const state = {
      startedAt: performance.now(),
      frames: [],
      marks: [],
      frameActive: true,
      telemetryStart: (window.__coreTelemetry ?? []).length,
      eventAbort: new AbortController()
    };
    const now = () => Number((performance.now() - state.startedAt).toFixed(3));
    const mark = (label, extra = {}) => {
      performance.mark(`corev2-zoom-detail:${input.caseName}:${input.variant}:${label}`);
      state.marks.push({ label, t: now(), ...extra });
    };
    for (const type of ['wheel']) {
      canvas.addEventListener(type, (event) => mark(`${type}:capture`, { x: event.clientX, y: event.clientY, deltaY: event.deltaY }), { capture: true, signal: state.eventAbort.signal });
      canvas.addEventListener(type, (event) => mark(`${type}:bubble`, { x: event.clientX, y: event.clientY, deltaY: event.deltaY }), { signal: state.eventAbort.signal });
    }
    function frameLoop() {
      if (!state.frameActive) return;
      state.frames.push(now());
      requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);
    window.__zoomDetailTrace = {
      mark,
      finish() {
        state.frameActive = false;
        state.eventAbort.abort();
        return {
          marks: state.marks,
          frames: state.frames,
          telemetry: (window.__coreTelemetry ?? []).slice(state.telemetryStart),
          final: {
            scale: window.__coreState.viewport.scale,
            lowDetail: canvas.classList.contains('low-detail'),
            overviewDetail: canvas.classList.contains('overview-detail')
          }
        };
      }
    };
    mark('instrumentation-installed', { caseName: input.caseName, variant: input.variant });
    return true;
  }}).call(null)`.replace('const input = window.__zoomDetailTraceInput;', `const input = ${JSON.stringify(input)};`);
}

async function evaluate(send, expression, timeoutMs = 30000) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: timeoutMs });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text ?? JSON.stringify(response.result.exceptionDetails));
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? JSON.stringify(response.exceptionDetails));
  return response.result.result.value;
}

async function runCase({ socket, send, caseName, variant }) {
  const scales = caseScales[caseName];
  if (!scales) throw new Error(`Unknown zoom detail case: ${caseName}`);
  await send('Page.navigate', { url });
  await wait(1200);
  await waitLiveCanvasReady(send);
  const input = { caseName, variant, beforeScale: scales.before, afterScale: scales.after };
  const setup = await evaluate(send, setupExpression(input));
  await evaluate(send, installInstrumentationExpression(input));

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
  await wait(60);
  await evaluate(send, `window.__zoomDetailTrace.mark(${JSON.stringify('trace-start')})`);
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: setup.x,
    y: setup.y,
    deltaX: 0,
    deltaY: wheelDeltaForScale(scales.before, scales.after)
  });
  await wait(640);
  await evaluate(send, `window.__zoomDetailTrace.mark(${JSON.stringify('trace-end')})`);
  await send('Tracing.end');
  await tracingComplete;

  const page = await evaluate(send, 'window.__zoomDetailTrace.finish()');
  const safeName = `${caseName}-${variant}`.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const tracePath = join(outputDir, `${safeName}.trace.json`);
  const reportPath = join(outputDir, `${safeName}.report.json`);
  await writeFile(tracePath, JSON.stringify({ traceEvents }));
  const report = {
    caseName,
    variant,
    url,
    setup,
    target: scales,
    wheelDeltaY: round(wheelDeltaForScale(scales.before, scales.after)),
    page,
    trace: analyzeTrace(traceEvents, page),
    tracePath,
    reportPath
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  return report;
}

function formatReport(reports) {
  const lines = [
    'Zoom detail transition CDP trace suite',
    `url=${url}`,
    `outputDir=${outputDir}`,
    `cases=${cases.join(',')} variants=${variants.join(',')}`,
    ''
  ];
  for (const report of reports) {
    const worst = report.trace.worst[0];
    const offenders = worst?.offenders?.slice(0, 4).map((entry) => `${entry.label} ${entry.overlapMs}ms`).join(', ') || 'none>=threshold';
    const groups = worst?.groups?.slice(0, 4).map((entry) => `${entry.group} ${entry.totalMs}ms/max${entry.maxMs}`).join(', ') || 'none';
    lines.push(`${report.caseName}/${report.variant}: ${report.setup.beforeScale}->${report.page.final.scale.toFixed(3)} low=${report.page.final.lowDetail} overview=${report.page.final.overviewDetail} cards=${report.setup.counts.cards} zones=${report.setup.counts.zones} rel=${report.setup.counts.relationships}`);
    lines.push(`  slowFrames=${report.trace.count} worst=${worst?.durationMs ?? 0}ms groups=${groups}`);
    lines.push(`  offenders=${offenders}`);
    lines.push(`  report=${report.reportPath}`);
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
  for (const caseName of cases) {
    for (const variant of variants) {
      reports.push(await runCase({ socket, send, caseName, variant }));
    }
  }
  await writeFile(join(outputDir, 'suite-summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));
  await writeFile(join(outputDir, 'suite-summary.txt'), formatReport(reports));
  console.log(formatReport(reports));
} finally {
  socket.close();
}

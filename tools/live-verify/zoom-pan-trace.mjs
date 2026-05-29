#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { connectPage } from './function/connect-page.mjs';
import { wait } from './function/wait.mjs';
import { waitLiveCanvasReady } from './function/wait-live-canvas-ready.mjs';

const url = process.env.COREV2_URL ?? 'http://127.0.0.1:4173/ardaria-game-design';
const cdpJsonUrl = process.env.COREV2_CDP_JSON ?? 'http://127.0.0.1:9223/json';
const scale = Number(process.env.COREV2_TRACE_SCALE ?? 0.12);
const durationMs = Number(process.env.COREV2_TRACE_DURATION_MS ?? 4200);
const outputPath = process.env.COREV2_TRACE_OUTPUT ?? `/tmp/corev2-zoom-pan-trace-${Date.now()}.json`;
const hideGrid = process.env.COREV2_TRACE_HIDE_GRID === '1';
const disableCardShadows = process.env.COREV2_TRACE_DISABLE_CARD_SHADOWS === '1';

const traceCategories = [
  'toplevel',
  'input',
  'latencyInfo',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.invalidationTracking',
  'blink',
  'cc',
  'gpu'
].join(',');

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function round(value) {
  return Number(value.toFixed(2));
}

function summarize(values) {
  if (!values.length) return { count: 0, totalMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
  return {
    count: values.length,
    totalMs: round(values.reduce((sum, value) => sum + value, 0)),
    p50Ms: round(percentile(values, 50)),
    p95Ms: round(percentile(values, 95)),
    maxMs: round(Math.max(...values))
  };
}

function sumDurations(events, names) {
  const wanted = new Set(names);
  return summarize(events.filter((event) => wanted.has(event.name) && typeof event.dur === 'number').map((event) => event.dur / 1000));
}

function topDurationEvents(events, count = 20) {
  return events
    .filter((event) => typeof event.dur === 'number' && event.dur > 0)
    .sort((a, b) => b.dur - a.dur)
    .slice(0, count)
    .map((event) => ({
      name: event.name,
      cat: event.cat,
      ms: round(event.dur / 1000)
    }));
}

function topDurationNames(events, count = 20) {
  const totals = new Map();
  for (const event of events) {
    if (typeof event.dur !== 'number' || event.dur <= 0) continue;
    const current = totals.get(event.name) ?? { name: event.name, count: 0, totalMs: 0, maxMs: 0 };
    const ms = event.dur / 1000;
    current.count += 1;
    current.totalMs += ms;
    current.maxMs = Math.max(current.maxMs, ms);
    totals.set(event.name, current);
  }
  return [...totals.values()]
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, count)
    .map((entry) => ({
      name: entry.name,
      count: entry.count,
      totalMs: round(entry.totalMs),
      maxMs: round(entry.maxMs)
    }));
}

function parseTrace(trace) {
  const events = trace.traceEvents ?? [];
  const completeEvents = events.filter((event) => event.ph === 'X');
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = 0;
  for (const event of events) {
    if (typeof event.ts !== 'number') continue;
    minTs = Math.min(minTs, event.ts);
    maxTs = Math.max(maxTs, event.ts);
  }
  const frameEvents = completeEvents.filter((event) => [
    'DrawFrame',
    'BeginMainThreadFrame',
    'PipelineReporter',
    'Graphics.Pipeline'
  ].includes(event.name));
  const inputEvents = completeEvents.filter((event) => /EventDispatch|Mouse|Pointer|Input|Latency/i.test(event.name));
  const longEvents = completeEvents.filter((event) => typeof event.dur === 'number' && event.dur >= 16000);

  return {
    eventCount: events.length,
    completeEventCount: completeEvents.length,
    traceSpanMs: events.length && Number.isFinite(minTs) ? round((maxTs - minTs) / 1000) : 0,
    longEventCount: longEvents.length,
    frameDurations: summarize(frameEvents.filter((event) => typeof event.dur === 'number').map((event) => event.dur / 1000)),
    inputDurations: summarize(inputEvents.filter((event) => typeof event.dur === 'number').map((event) => event.dur / 1000)),
    scripting: sumDurations(completeEvents, ['EventDispatch', 'FunctionCall', 'EvaluateScript', 'RunTask', 'TimerFire']),
    styleLayout: sumDurations(completeEvents, ['UpdateLayoutTree', 'RecalculateStyles', 'Layout', 'InvalidateLayout', 'HitTest']),
    paint: sumDurations(completeEvents, ['PrePaint', 'Paint', 'PaintImage', 'Layerize', 'UpdateLayerTree']),
    rasterCompositeGpu: sumDurations(completeEvents, ['RasterTask', 'RasterizerTask', 'CompositeLayers', 'DrawFrame', 'GPUTask', 'SubmitCompositorFrame', 'ActivateLayerTree', 'Commit']),
    topNames: topDurationNames(completeEvents),
    topEvents: topDurationEvents(completeEvents)
  };
}

function formatReport(report) {
  const lines = [
    `Trace saved: ${report.outputPath}`,
    `Route: ${report.route} scale=${report.scale} cards=${report.cardCount} zones=${report.zoneCount} relationships=${report.relationshipCount}`,
    `Flags: hideGrid=${report.flags.hideGrid} disableCardShadows=${report.flags.disableCardShadows}`,
    `Pan: ${report.pan.dx}px x ${report.pan.dy}px over ${report.pan.durationMs}ms with ${report.pan.moves} CDP mouse moves`,
    `Trace capture~=${report.pan.durationMs + 700}ms events=${report.summary.eventCount} complete=${report.summary.completeEventCount} longEvents>=16ms=${report.summary.longEventCount}`,
    '',
    `Frame events: count=${report.summary.frameDurations.count} p95=${report.summary.frameDurations.p95Ms}ms max=${report.summary.frameDurations.maxMs}ms total=${report.summary.frameDurations.totalMs}ms`,
    `Input events: count=${report.summary.inputDurations.count} p95=${report.summary.inputDurations.p95Ms}ms max=${report.summary.inputDurations.maxMs}ms total=${report.summary.inputDurations.totalMs}ms`,
    `Scripting: count=${report.summary.scripting.count} p95=${report.summary.scripting.p95Ms}ms max=${report.summary.scripting.maxMs}ms total=${report.summary.scripting.totalMs}ms`,
    `Style/layout: count=${report.summary.styleLayout.count} p95=${report.summary.styleLayout.p95Ms}ms max=${report.summary.styleLayout.maxMs}ms total=${report.summary.styleLayout.totalMs}ms`,
    `Paint/layer: count=${report.summary.paint.count} p95=${report.summary.paint.p95Ms}ms max=${report.summary.paint.maxMs}ms total=${report.summary.paint.totalMs}ms`,
    `Raster/composite/gpu: count=${report.summary.rasterCompositeGpu.count} p95=${report.summary.rasterCompositeGpu.p95Ms}ms max=${report.summary.rasterCompositeGpu.maxMs}ms total=${report.summary.rasterCompositeGpu.totalMs}ms`,
    '',
    'Top duration names:'
  ];
  for (const entry of report.summary.topNames.slice(0, 12)) {
    lines.push(`- ${entry.name}: total=${entry.totalMs}ms count=${entry.count} max=${entry.maxMs}ms`);
  }
  lines.push('', 'Top individual events:');
  for (const entry of report.summary.topEvents.slice(0, 12)) {
    lines.push(`- ${entry.name}: ${entry.ms}ms (${entry.cat})`);
  }
  return lines.join('\n');
}

const { socket, send } = await connectPage(cdpJsonUrl);

try {
  const traceEvents = [];
  const tracingComplete = new Promise((resolve) => {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method === 'Tracing.dataCollected') {
        traceEvents.push(...message.params.value);
      }
      if (message.method === 'Tracing.tracingComplete') {
        resolve(true);
      }
    });
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 920, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await wait(1200);
  await waitLiveCanvasReady(send);

  const setup = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(async function setupTraceViewport() {
      const canvas = document.querySelector('.canvas');
      const grid = document.querySelector('.grid');
      const { applyViewportTransform } = await import('/src/runtime/canvas/effect/apply-viewport-transform.js');
      const style = document.createElement('style');
      style.dataset.traceOverride = 'true';
      style.textContent = [
        ${JSON.stringify(hideGrid)} ? '.grid { display: none !important; }' : '',
        ${JSON.stringify(disableCardShadows)} ? '.card, .ledger-node { box-shadow: none !important; filter: none !important; }' : ''
      ].filter(Boolean).join('\\n');
      document.head.append(style);
      window.__coreState.viewport = { x: -820, y: -360, scale: ${JSON.stringify(scale)} };
      window.__coreState.selection = { cardIds: [], zoneIds: [], groupIds: [] };
      window.__coreState.threadPanelOpen = false;
      document.querySelector('.thread-panel')?.setAttribute('hidden', '');
      applyViewportTransform();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = canvas.getBoundingClientRect();
      return {
        route: location.pathname,
        activeTab: window.__coreState.activeTab,
        scale: window.__coreState.viewport.scale,
        cardCount: document.querySelectorAll('.ledger-node[data-card-id]').length,
        zoneCount: document.querySelectorAll('.ledger-node[data-zone-id]').length,
        relationshipCount: document.querySelectorAll('.ledger-relationships [data-relationship-id]').length,
        startX: Math.round(rect.left + rect.width * 0.52),
        startY: Math.round(rect.top + rect.height * 0.52),
        gridExists: Boolean(grid)
      };
    })()`
  });

  if (setup.exceptionDetails) {
    throw new Error(setup.exceptionDetails.text ?? JSON.stringify(setup.exceptionDetails));
  }

  const setupValue = setup.result.result.value;
  const startX = setupValue.startX;
  const startY = setupValue.startY;
  const dx = Number(process.env.COREV2_TRACE_DX ?? 760);
  const dy = Number(process.env.COREV2_TRACE_DY ?? 180);
  const moves = Math.max(1, Math.round(durationMs / 16));

  await send('Tracing.start', {
    categories: traceCategories,
    options: 'record-as-much-as-possible'
  });

  await wait(200);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', buttons: 1, clickCount: 1 });
  for (let index = 1; index <= moves; index += 1) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(startX + (dx * index) / moves),
      y: Math.round(startY + (dy * index) / moves),
      button: 'left',
      buttons: 1
    });
    await wait(16);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX + dx, y: startY + dy, button: 'left', buttons: 0, clickCount: 1 });
  await wait(500);
  await send('Tracing.end');
  await tracingComplete;

  const trace = { traceEvents };
  await writeFile(outputPath, JSON.stringify(trace));
  const report = {
    outputPath,
    route: setupValue.route,
    activeTab: setupValue.activeTab,
    scale: setupValue.scale,
    cardCount: setupValue.cardCount,
    zoneCount: setupValue.zoneCount,
    relationshipCount: setupValue.relationshipCount,
    flags: { hideGrid, disableCardShadows },
    pan: { dx, dy, durationMs, moves },
    summary: parseTrace(trace)
  };
  console.log(formatReport(report));
  if (process.env.COREV2_TRACE_SUMMARY_JSON === '1') {
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  socket.close();
}

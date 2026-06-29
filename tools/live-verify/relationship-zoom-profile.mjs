#!/usr/bin/env node
import { connectPage } from './function/connect-page.mjs';
import { wait } from './function/wait.mjs';
import { waitLiveCanvasReady } from './function/wait-live-canvas-ready.mjs';

const cdpJsonUrl = process.env.DECISION_OS_CDP_JSON ?? 'http://127.0.0.1:9223/json';
const scenarioInput = process.env.DECISION_OS_REL_PROFILE_SCENARIOS;
const scales = parseNumberList(process.env.DECISION_OS_REL_PROFILE_SCALES, [0.12, 0.5, 1, 1.5]);
const directIterations = Number(process.env.DECISION_OS_REL_PROFILE_DIRECT_ITERATIONS ?? 7);
const wheelIterations = Number(process.env.DECISION_OS_REL_PROFILE_WHEEL_ITERATIONS ?? 10);
const enableTrace = process.env.DECISION_OS_REL_PROFILE_TRACE === '1';
const navigationWaitMs = Number(process.env.DECISION_OS_REL_PROFILE_NAV_WAIT_MS ?? 1200);

const defaultScenarios = [
  ['ardaria-data-model', 'http://127.0.0.1:4173/ardaria-data-model'],
  ['moh-s3', 'http://127.0.0.1:4174/s3']
];

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

function parseNumberList(value, fallback) {
  if (!value) return fallback;
  return value.split(',').map((part) => Number(part.trim())).filter((value) => Number.isFinite(value));
}

function parseScenarios(value) {
  if (!value) return defaultScenarios.map(([name, url]) => ({ name, url }));
  return value.split(',').map((entry) => {
    const [name, url] = entry.split('=');
    if (!name || !url) throw new Error(`Invalid scenario "${entry}". Expected name=url.`);
    return { name: name.trim(), url: url.trim() };
  });
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function round(value) {
  return Number(value.toFixed(3));
}

function summarize(values) {
  if (!values.length) return { count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, totalMs: 0 };
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    avgMs: round(total / values.length),
    p50Ms: round(percentile(values, 50)),
    p95Ms: round(percentile(values, 95)),
    maxMs: round(Math.max(...values)),
    totalMs: round(total)
  };
}

function summarizeTrace(events) {
  const completeEvents = events.filter((event) => event.ph === 'X' && typeof event.dur === 'number' && event.dur > 0);
  const byName = new Map();
  for (const event of completeEvents) {
    const ms = event.dur / 1000;
    const current = byName.get(event.name) ?? { name: event.name, count: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    current.totalMs += ms;
    current.maxMs = Math.max(current.maxMs, ms);
    byName.set(event.name, current);
  }
  const take = (names) => summarize(completeEvents.filter((event) => names.includes(event.name)).map((event) => event.dur / 1000));
  return {
    eventCount: events.length,
    completeEventCount: completeEvents.length,
    scripting: take(['EventDispatch', 'FunctionCall', 'EvaluateScript', 'RunTask', 'TimerFire']),
    styleLayout: take(['UpdateLayoutTree', 'RecalculateStyles', 'Layout', 'InvalidateLayout', 'HitTest']),
    paintLayer: take(['PrePaint', 'Paint', 'PaintImage', 'Layerize', 'UpdateLayerTree']),
    rasterCompositeGpu: take(['RasterTask', 'RasterizerTask', 'CompositeLayers', 'DrawFrame', 'GPUTask', 'SubmitCompositorFrame', 'ActivateLayerTree', 'Commit']),
    topNames: [...byName.values()]
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 12)
      .map((entry) => ({ ...entry, totalMs: round(entry.totalMs), maxMs: round(entry.maxMs) }))
  };
}

async function waitReadyWithTimeout(send, timeoutMs = 8000) {
  await Promise.race([
    waitLiveCanvasReady(send),
    wait(timeoutMs).then(() => {
      throw new Error(`Canvas did not become ready within ${timeoutMs}ms`);
    })
  ]);
}

function pageProfileExpression(input) {
  return `(async function profileRelationshipZoom() {
    const { state } = await import('/src/runtime/state.js');
    const { applyViewportTransform } = await import('/src/runtime/canvas/effect/apply-viewport-transform.js');
    const { renderRelationshipOverlay } = await import('/src/runtime/relationship/effect/render-relationship-overlay.js');
    const canvas = document.querySelector('.canvas');
    const overlay = document.querySelector('.ledger-relationships');
    if (!canvas || !overlay || !state) throw new Error('decision-os canvas runtime is not ready');

    const directIterations = ${JSON.stringify(input.directIterations)};
    const wheelIterations = ${JSON.stringify(input.wheelIterations)};
    const scales = ${JSON.stringify(input.scales)};
    const summarize = ${summarize.toString()};
    const percentile = ${percentile.toString()};
    const round = ${round.toString()};
    const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const routeVersions = () => [...overlay.querySelectorAll('path[data-relationship-id]')]
      .map((path) => Number(path.dataset.routeVersion || 0));
    const routeVersionTotal = () => routeVersions().reduce((sum, value) => sum + value, 0);
    const telemetryCountsSince = (startIndex) => (window.__coreTelemetry ?? []).slice(startIndex).reduce((counts, entry) => {
      counts[entry.name] = (counts[entry.name] ?? 0) + 1;
      return counts;
    }, {});
    const setScale = async (scale) => {
      state.viewport = { x: -720, y: -260, scale };
      applyViewportTransform();
      await waitFrame();
    };
    const dispatchWheel = (deltaY) => {
      const rect = canvas.getBoundingClientRect();
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: Math.round(rect.left + rect.width * 0.52),
        clientY: Math.round(rect.top + rect.height * 0.52),
        deltaY
      });
      const startedAt = performance.now();
      canvas.dispatchEvent(event);
      return performance.now() - startedAt;
    };
    const directRender = (count) => {
      const values = [];
      for (let index = 0; index < count; index += 1) {
        const startedAt = performance.now();
        renderRelationshipOverlay();
        values.push(performance.now() - startedAt);
      }
      return values;
    };

    const output = [];
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    document.querySelector('.thread-panel')?.setAttribute('hidden', '');

    for (const scale of scales) {
      overlay.removeAttribute('hidden');
      await setScale(scale);
      directRender(1);
      const telemetryBeforeDirect = (window.__coreTelemetry ?? []).length;
      const routeBeforeDirect = routeVersionTotal();
      const direct = directRender(directIterations);
      const routeAfterDirect = routeVersionTotal();
      const directTelemetry = telemetryCountsSince(telemetryBeforeDirect);

      const telemetryBeforeWheelVisible = (window.__coreTelemetry ?? []).length;
      const routeBeforeWheelVisible = routeVersionTotal();
      const wheelVisible = [];
      for (let index = 0; index < wheelIterations; index += 1) {
        wheelVisible.push(dispatchWheel(index % 2 === 0 ? -90 : 90));
      }
      const routeAfterWheelVisible = routeVersionTotal();
      const wheelVisibleTelemetry = telemetryCountsSince(telemetryBeforeWheelVisible);

      await setScale(scale);
      overlay.setAttribute('hidden', '');
      await waitFrame();
      const telemetryBeforeWheelHidden = (window.__coreTelemetry ?? []).length;
      const routeBeforeWheelHidden = routeVersionTotal();
      const wheelHidden = [];
      for (let index = 0; index < wheelIterations; index += 1) {
        wheelHidden.push(dispatchWheel(index % 2 === 0 ? -90 : 90));
      }
      const routeAfterWheelHidden = routeVersionTotal();
      const wheelHiddenTelemetry = telemetryCountsSince(telemetryBeforeWheelHidden);
      overlay.removeAttribute('hidden');

      const visibleSummary = summarize(wheelVisible);
      const hiddenSummary = summarize(wheelHidden);
      output.push({
        scale,
        direct: summarize(direct),
        wheelVisible: visibleSummary,
        wheelHidden: hiddenSummary,
        avgVisibleMinusHiddenMs: round(visibleSummary.avgMs - hiddenSummary.avgMs),
        p95VisibleMinusHiddenMs: round(visibleSummary.p95Ms - hiddenSummary.p95Ms),
        routeVersionDelta: {
          direct: routeAfterDirect - routeBeforeDirect,
          wheelVisible: routeAfterWheelVisible - routeBeforeWheelVisible,
          wheelHidden: routeAfterWheelHidden - routeBeforeWheelHidden
        },
        telemetry: {
          direct: directTelemetry,
          wheelVisible: wheelVisibleTelemetry,
          wheelHidden: wheelHiddenTelemetry
        }
      });
    }

    return {
      route: location.pathname,
      activeTab: state.activeTab,
      cards: document.querySelectorAll('.ledger-node[data-card-id]').length,
      zones: document.querySelectorAll('.ledger-node[data-zone-id]').length,
      relationships: overlay.querySelectorAll('path[data-relationship-id]').length,
      labels: overlay.querySelectorAll('[data-relationship-label]').length,
      scales,
      directIterations,
      wheelIterations,
      results: output
    };
  })()`;
}

function formatScenario(report) {
  const lines = [
    `Scenario ${report.name}: ${report.route} activeTab=${report.activeTab}`,
    `cards=${report.cards} zones=${report.zones} relationships=${report.relationships} labels=${report.labels}`,
    `iterations direct=${report.directIterations} wheel=${report.wheelIterations}`
  ];
  for (const row of report.results) {
    lines.push(
      `scale=${row.scale}: direct avg=${row.direct.avgMs}ms p95=${row.direct.p95Ms}ms max=${row.direct.maxMs}ms; ` +
      `wheel visible avg=${row.wheelVisible.avgMs}ms p95=${row.wheelVisible.p95Ms}ms max=${row.wheelVisible.maxMs}ms; ` +
      `hidden avg=${row.wheelHidden.avgMs}ms p95=${row.wheelHidden.p95Ms}ms max=${row.wheelHidden.maxMs}ms; ` +
      `rel overhead avg=${row.avgVisibleMinusHiddenMs}ms p95=${row.p95VisibleMinusHiddenMs}ms; ` +
      `routeDelta visible=${row.routeVersionDelta.wheelVisible}`
    );
  }
  return lines.join('\n');
}

const scenarios = parseScenarios(scenarioInput);
const { socket, send: rawSend } = await connectPage(cdpJsonUrl);
const send = Object.assign((...args) => rawSend(...args), { socket });

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 920, deviceScaleFactor: 1, mobile: false });

  const reports = [];
  for (const scenario of scenarios) {
    await send('Page.navigate', { url: scenario.url });
    await wait(navigationWaitMs);
    await waitReadyWithTimeout(send);

    const result = await send('Runtime.evaluate', {
      returnByValue: true,
      awaitPromise: true,
      expression: pageProfileExpression({ scales, directIterations, wheelIterations })
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? JSON.stringify(result.exceptionDetails));
    }
    const report = { name: scenario.name, ...result.result.result.value };

    if (enableTrace) {
      const traceEvents = [];
      const tracingComplete = new Promise((resolve) => {
        const onMessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.method === 'Tracing.dataCollected') {
            traceEvents.push(...message.params.value);
          }
          if (message.method === 'Tracing.tracingComplete') {
            socket.removeEventListener('message', onMessage);
            resolve(true);
          }
        };
        socket.addEventListener('message', onMessage);
      });
      await send('Tracing.start', { categories: traceCategories, options: 'record-as-much-as-possible' });
      await send('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async function traceRelationshipWheelBurst() {
          const canvas = document.querySelector('.canvas');
          const rect = canvas.getBoundingClientRect();
          for (let index = 0; index < ${JSON.stringify(wheelIterations)}; index += 1) {
            canvas.dispatchEvent(new WheelEvent('wheel', {
              bubbles: true,
              cancelable: true,
              clientX: Math.round(rect.left + rect.width * 0.52),
              clientY: Math.round(rect.top + rect.height * 0.52),
              deltaY: index % 2 === 0 ? -90 : 90
            }));
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return true;
        })()`
      });
      await send('Tracing.end');
      await tracingComplete;
      report.trace = summarizeTrace(traceEvents);
    }

    reports.push(report);
    console.log(formatScenario(report));
    if (report.trace) {
      console.log(`trace events=${report.trace.eventCount} scripting total=${report.trace.scripting.totalMs}ms style/layout total=${report.trace.styleLayout.totalMs}ms paint/layer total=${report.trace.paintLayer.totalMs}ms raster/composite/gpu total=${report.trace.rasterCompositeGpu.totalMs}ms`);
      console.log(`trace top=${report.trace.topNames.map((entry) => `${entry.name}:${entry.totalMs}ms/${entry.count}`).join(', ')}`);
    }
    console.log('');
  }

  console.log(JSON.stringify({ scenarios: reports }, null, 2));
} finally {
  socket.close();
}

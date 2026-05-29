#!/usr/bin/env node
import { connectPage } from './function/connect-page.mjs';
import { wait } from './function/wait.mjs';
import { waitLiveCanvasReady } from './function/wait-live-canvas-ready.mjs';

const url = process.env.COREV2_URL ?? 'http://127.0.0.1:4173/ardaria-game-design';
const cdpJsonUrl = process.env.COREV2_CDP_JSON ?? 'http://127.0.0.1:9223/json';
const seed = Number(process.env.COREV2_STRESS_SEED ?? 20260529);
const cyclesPerDirection = Number(process.env.COREV2_STRESS_CYCLES ?? 12);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarize(label, values) {
  return {
    label,
    count: values.length,
    totalMs: Number(values.reduce((sum, value) => sum + value, 0).toFixed(2)),
    avgMs: Number((values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(2)),
    p50Ms: Number(percentile(values, 50).toFixed(2)),
    p95Ms: Number(percentile(values, 95).toFixed(2)),
    maxMs: Number(Math.max(0, ...values).toFixed(2))
  };
}

function formatSummary(report) {
  const lines = [
    `Zoom/pan stress on ${report.route}`,
    `seed=${report.seed} cyclesPerDirection=${report.cyclesPerDirection} cards=${report.cardCount} zones=${report.zoneCount} relationships=${report.relationshipCount}`,
    `scale ${report.initialScale} -> ${report.finalScale}`,
    ''
  ];
  for (const row of report.summary) {
    lines.push(`${row.label}: count=${row.count} avg=${row.avgMs}ms p50=${row.p50Ms}ms p95=${row.p95Ms}ms max=${row.maxMs}ms total=${row.totalMs}ms`);
  }
  lines.push('');
  lines.push(`worst first pan: ${report.worstFirstPan.direction}#${report.worstFirstPan.cycle} firstMove=${report.worstFirstPan.firstMoveMs}ms total=${report.worstFirstPan.totalMs}ms scale=${report.worstFirstPan.scaleAfterCycle} after ${report.worstFirstPan.preZoomEvents} mixed zoom events`);
  lines.push(`worst first pan visual frame: ${report.worstFirstPanFrame.direction}#${report.worstFirstPanFrame.cycle} firstFrame=${report.worstFirstPanFrame.firstMoveFrameMs}ms firstMove=${report.worstFirstPanFrame.firstMoveMs}ms scale=${report.worstFirstPanFrame.scaleAfterCycle}`);
  lines.push(`worst large pan: ${report.worstLargePan.direction}#${report.worstLargePan.cycle} firstMove=${report.worstLargePan.firstMoveMs}ms total=${report.worstLargePan.totalMs}ms scale=${report.worstLargePan.scaleAfterCycle} after ${report.worstLargePan.directionalZoomEvents} directional zoom events`);
  lines.push(`worst large pan visual frame: ${report.worstLargePanFrame.direction}#${report.worstLargePanFrame.cycle} firstFrame=${report.worstLargePanFrame.firstMoveFrameMs}ms firstMove=${report.worstLargePanFrame.firstMoveMs}ms scale=${report.worstLargePanFrame.scaleAfterCycle}`);
  lines.push(`pan telemetry slow frames: ${report.panTelemetrySlowFrames.length}`);
  if (report.panTelemetrySlowFrames.length) {
    for (const frame of report.panTelemetrySlowFrames.slice(0, 8)) {
      lines.push(`  ${frame.direction}#${frame.cycle} frame=${frame.frame} duration=${frame.durationMs}ms firstFrameDelay=${frame.firstFrameDelayMs}ms`);
    }
  }
  return lines.join('\n');
}

const { socket, send } = await connectPage(cdpJsonUrl);
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 920, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await wait(1200);
  await waitLiveCanvasReady(send);

  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(async function runZoomPanStressJson() {
      const report = await (async function runZoomPanStress() {
      const seed = ${JSON.stringify(seed)};
      const cyclesPerDirection = ${JSON.stringify(cyclesPerDirection)};
      const waitNextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = document.querySelector('.canvas');
      const grid = document.querySelector('.grid');
      if (!canvas || !grid || !window.__coreState) throw new Error('CoreV2 canvas runtime is not ready');
      const { applyViewportTransform } = await import('/src/runtime/canvas/effect/apply-viewport-transform.js');

      function lcg(initialSeed) {
        let value = initialSeed >>> 0;
        return function random() {
          value = (1664525 * value + 1013904223) >>> 0;
          return value / 0x100000000;
        };
      }

      const random = lcg(seed);
      const randomBetween = (min, max) => min + random() * (max - min);
      const randomInt = (min, max) => Math.floor(randomBetween(min, max + 1));
      const round = (value) => Number(value.toFixed(2));

      function sampleViewportPoint() {
        const rect = canvas.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width * randomBetween(0.35, 0.65)),
          y: Math.round(rect.top + rect.height * randomBetween(0.35, 0.65))
        };
      }

      function dispatchTimed(target, event) {
        const startedAt = performance.now();
        target.dispatchEvent(event);
        return performance.now() - startedAt;
      }

      function wheelBurst(input) {
        const events = [];
        const point = sampleViewportPoint();
        const telemetryStart = window.__coreTelemetry.length;
        const startedAt = performance.now();
        for (let index = 0; index < input.count; index += 1) {
          const directionSign = input.direction === 'mixed' ? (random() > 0.5 ? 1 : -1) : input.direction === 'out' ? 1 : -1;
          const deltaY = directionSign * randomBetween(input.minDelta, input.maxDelta);
          const event = new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            clientX: point.x + randomBetween(-24, 24),
            clientY: point.y + randomBetween(-24, 24),
            deltaY
          });
          events.push({
            deltaY: round(deltaY),
            durationMs: round(dispatchTimed(canvas, event)),
            scaleAfter: Number(window.__coreState.viewport.scale.toFixed(4))
          });
        }
        return {
          direction: input.direction,
          count: input.count,
          totalMs: round(performance.now() - startedAt),
          events,
          telemetry: window.__coreTelemetry.slice(telemetryStart)
            .filter((entry) => entry.name === 'pan-frame-performance' || entry.name === 'render-relationship-overlay')
            .map((entry) => ({ name: entry.name, args: entry.args }))
        };
      }

      async function panGesture(input) {
        const start = sampleViewportPoint();
        const pointerId = input.pointerId;
        const stepX = input.dx / input.steps;
        const stepY = input.dy / input.steps;
        const telemetryStart = window.__coreTelemetry.length;
        const startedAt = performance.now();
        let syncTotalMs = 0;
        let firstMoveFrameMs = 0;
        const downMs = dispatchTimed(grid, new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'mouse',
          button: 0,
          buttons: 1,
          clientX: start.x,
          clientY: start.y
        }));
        syncTotalMs += downMs;
        const moveDurations = [];
        for (let step = 1; step <= input.steps; step += 1) {
          const moveDuration = dispatchTimed(canvas, new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            clientX: Math.round(start.x + stepX * step),
            clientY: Math.round(start.y + stepY * step)
          }));
          moveDurations.push(moveDuration);
          syncTotalMs += moveDuration;
          if (step === 1) {
            const frameStartedAt = performance.now();
            await waitNextFrame();
            firstMoveFrameMs = performance.now() - frameStartedAt;
          }
        }
        const upMs = dispatchTimed(canvas, new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'mouse',
          button: 0,
          buttons: 0,
          clientX: Math.round(start.x + input.dx),
          clientY: Math.round(start.y + input.dy)
        }));
        syncTotalMs += upMs;
        return {
          kind: input.kind,
          steps: input.steps,
          dx: round(input.dx),
          dy: round(input.dy),
          totalMs: round(syncTotalMs),
          elapsedMs: round(performance.now() - startedAt),
          downMs: round(downMs),
          firstMoveMs: round(moveDurations[0] ?? 0),
          firstMoveFrameMs: round(firstMoveFrameMs),
          moveTotalMs: round(moveDurations.reduce((sum, value) => sum + value, 0)),
          moveAvgMs: round(moveDurations.reduce((sum, value) => sum + value, 0) / Math.max(1, moveDurations.length)),
          moveP95Ms: round([...moveDurations].sort((a, b) => a - b)[Math.min(moveDurations.length - 1, Math.ceil(moveDurations.length * 0.95) - 1)] ?? 0),
          moveMaxMs: round(Math.max(0, ...moveDurations)),
          upMs: round(upMs),
          telemetry: window.__coreTelemetry.slice(telemetryStart)
            .filter((entry) => entry.name === 'pan-frame-performance')
            .map((entry) => ({ name: entry.name, args: entry.args }))
        };
      }

      window.__coreState.viewport = { x: -820, y: -360, scale: 0.12 };
      window.__coreState.selection = { cardIds: [], zoneIds: [], groupIds: [] };
      applyViewportTransform();
      await waitFrame();

      const initialScale = Number(window.__coreState.viewport.scale.toFixed(4));
      const results = [];
      let pointerId = 4000;
      for (const direction of ['out', 'in']) {
        for (let cycle = 1; cycle <= cyclesPerDirection; cycle += 1) {
          const mixedZoom = wheelBurst({
            direction: 'mixed',
            count: randomInt(3, 8),
            minDelta: 24,
            maxDelta: 140
          });
          const immediatePan = await panGesture({
            kind: 'immediate-after-mixed-zoom',
            pointerId: pointerId++,
            steps: randomInt(4, 8),
            dx: randomBetween(-80, 80),
            dy: randomBetween(-60, 60)
          });
          await waitFrame();
          const directionalZoom = wheelBurst({
            direction,
            count: randomInt(5, 12),
            minDelta: 32,
            maxDelta: 180
          });
          const largePan = await panGesture({
            kind: 'large-after-directional-zoom',
            pointerId: pointerId++,
            steps: randomInt(12, 22),
            dx: direction === 'out' ? randomBetween(360, 760) : randomBetween(-760, -360),
            dy: randomBetween(-320, 320)
          });
          await waitFrame();
          results.push({
            direction,
            cycle,
            mixedZoom,
            immediatePan,
            directionalZoom,
            largePan,
            scaleAfterCycle: Number(window.__coreState.viewport.scale.toFixed(4))
          });
        }
      }

      const allTelemetry = [];
      for (const result of results) {
        for (const entry of result.immediatePan.telemetry) allTelemetry.push({ direction: result.direction, cycle: result.cycle, ...entry.args });
        for (const entry of result.largePan.telemetry) allTelemetry.push({ direction: result.direction, cycle: result.cycle, ...entry.args });
      }

      const cards = [...document.querySelectorAll('.ledger-node[data-card-id]')];
      const zones = [...document.querySelectorAll('.ledger-node[data-zone-id]')];
      const relationships = [...document.querySelectorAll('.ledger-relationships [data-relationship-id]')];
      return {
        seed,
        cyclesPerDirection,
        route: location.pathname,
        activeTab: window.__coreState.activeTab,
        cardCount: cards.length,
        zoneCount: zones.length,
        relationshipCount: relationships.length,
        initialScale,
        finalScale: Number(window.__coreState.viewport.scale.toFixed(4)),
        lowDetail: canvas.classList.contains('low-detail'),
        overviewDetail: canvas.classList.contains('overview-detail'),
        results,
        panTelemetrySlowFrames: allTelemetry.filter((entry) => Number(entry.durationMs) >= 8 || Number(entry.firstFrameDelayMs) >= 16)
      };
      })();
      return JSON.stringify(report);
    })()`
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? JSON.stringify(result.exceptionDetails));
  }

  const reportJson = result.result.result.value;
  if (typeof reportJson !== 'string') {
    throw new Error(`CDP did not return inline JSON: ${JSON.stringify(result.result.result)}`);
  }
  const report = JSON.parse(reportJson);
  const firstPanFirstMoves = report.results.map((row) => row.immediatePan.firstMoveMs);
  const firstPanFirstFrames = report.results.map((row) => row.immediatePan.firstMoveFrameMs);
  const firstPanTotals = report.results.map((row) => row.immediatePan.totalMs);
  const largePanFirstMoves = report.results.map((row) => row.largePan.firstMoveMs);
  const largePanFirstFrames = report.results.map((row) => row.largePan.firstMoveFrameMs);
  const largePanTotals = report.results.map((row) => row.largePan.totalMs);
  const mixedZoomEvents = report.results.flatMap((row) => row.mixedZoom.events.map((event) => event.durationMs));
  const directionalZoomEvents = report.results.flatMap((row) => row.directionalZoom.events.map((event) => event.durationMs));
  report.summary = [
    summarize('mixed zoom event', mixedZoomEvents),
    summarize('directional zoom event', directionalZoomEvents),
    summarize('first pan after mixed zoom first move', firstPanFirstMoves),
    summarize('first pan after mixed zoom visual frame', firstPanFirstFrames),
    summarize('first pan after mixed zoom total', firstPanTotals),
    summarize('large pan after directional zoom first move', largePanFirstMoves),
    summarize('large pan after directional zoom visual frame', largePanFirstFrames),
    summarize('large pan after directional zoom total', largePanTotals)
  ];
  report.worstFirstPan = report.results
    .map((row) => ({
      direction: row.direction,
      cycle: row.cycle,
      firstMoveMs: row.immediatePan.firstMoveMs,
      firstMoveFrameMs: row.immediatePan.firstMoveFrameMs,
      totalMs: row.immediatePan.totalMs,
      preZoomEvents: row.mixedZoom.count,
      scaleAfterCycle: row.scaleAfterCycle
    }))
    .sort((a, b) => b.firstMoveMs - a.firstMoveMs)[0];
  report.worstFirstPanFrame = report.results
    .map((row) => ({
      direction: row.direction,
      cycle: row.cycle,
      firstMoveMs: row.immediatePan.firstMoveMs,
      firstMoveFrameMs: row.immediatePan.firstMoveFrameMs,
      totalMs: row.immediatePan.totalMs,
      preZoomEvents: row.mixedZoom.count,
      scaleAfterCycle: row.scaleAfterCycle
    }))
    .sort((a, b) => b.firstMoveFrameMs - a.firstMoveFrameMs)[0];
  report.worstLargePan = report.results
    .map((row) => ({
      direction: row.direction,
      cycle: row.cycle,
      firstMoveMs: row.largePan.firstMoveMs,
      firstMoveFrameMs: row.largePan.firstMoveFrameMs,
      totalMs: row.largePan.totalMs,
      directionalZoomEvents: row.directionalZoom.count,
      scaleAfterCycle: row.scaleAfterCycle
    }))
    .sort((a, b) => b.firstMoveMs - a.firstMoveMs)[0];
  report.worstLargePanFrame = report.results
    .map((row) => ({
      direction: row.direction,
      cycle: row.cycle,
      firstMoveMs: row.largePan.firstMoveMs,
      firstMoveFrameMs: row.largePan.firstMoveFrameMs,
      totalMs: row.largePan.totalMs,
      directionalZoomEvents: row.directionalZoom.count,
      scaleAfterCycle: row.scaleAfterCycle
    }))
    .sort((a, b) => b.firstMoveFrameMs - a.firstMoveFrameMs)[0];

  console.log(formatSummary(report));
  if (process.env.COREV2_STRESS_JSON === '1') {
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  socket.close();
}

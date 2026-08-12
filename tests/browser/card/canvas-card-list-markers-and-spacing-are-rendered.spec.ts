/**
 * WHAT: Verifies computed canvas-card list markers and adjacent-item spacing in Chromium.
 * WHY: Source assertions cannot prove that the browser restores native list rendering after the reset.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const chromiumExecutablePath = '/snap/bin/chromium';
const markerColor = 'rgb(35, 171, 255)';
const canvasCss = readFileSync(resolve(repoRoot, 'frontend/assets/canvas/objects.css'), 'utf8');

function fixtureHtml(): string {
  return `<!doctype html>
<html><head><style>
ul, ol { margin: 0; padding: 0; list-style: none; }
${canvasCss}
</style></head><body>
<article class="card detail-visible" style="--card-code-color: ${markerColor}">
  <section class="ledger-card-detail-layer">
    <div class="ledger-card-body">
      <ul><li>unordered first</li><li>unordered second</li></ul>
      <ol><li>ordered first</li><li>ordered second</li></ol>
    </div>
  </section>
</article>
</body></html>`;
}

function closeFixtureServer(server: Server | undefined): Promise<void> {
  // WHAT: Skip shutdown when setup failed before a fixture listener existed.
  // WHY: Browser cleanup still has to settle after a server-start failure.
  if (!server) return Promise.resolve();

  return new Promise((resolveClose, rejectClose) => {
    let settled = false;
    const settle = (failure?: Error): void => {
      // WHAT: Ignore duplicate close signals after the first terminal result.
      // WHY: The deadline and close callback can race during a stalled shutdown.
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      // WHAT: Reject a failed listener close.
      // WHY: Cleanup failures must remain visible in the test result.
      if (failure) {
        rejectClose(failure);
        return;
      }
      resolveClose();
    };
    const deadline = setTimeout(() => settle(new Error('Fixture server close exceeded 2 seconds.')), 2_000);
    server.close((failure) => settle(failure ?? undefined));
    server.closeAllConnections();
  });
}

function startFixtureServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(fixtureHtml());
  });

  return new Promise((resolveServer, rejectServer) => {
    let settled = false;
    const settle = (failure?: Error): void => {
      // WHAT: Ignore the listener event that arrives after this startup attempt settles.
      // WHY: A deadline and an operating-system error can arrive in either order.
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      server.off('error', onError);
      // WHAT: Close a failed listener before returning its original startup error.
      // WHY: Setup failures must not leak the owned loopback server.
      if (failure) {
        void closeFixtureServer(server).then(
          () => rejectServer(failure),
          () => rejectServer(failure),
        );
        return;
      }
      const address = server.address();
      // WHAT: Reject a listener that did not expose a TCP port.
      // WHY: The browser test requires a concrete loopback URL.
      if (!address || typeof address === 'string') {
        void closeFixtureServer(server).then(
          () => rejectServer(new Error('Fixture server did not bind a TCP address.')),
          () => rejectServer(new Error('Fixture server did not bind a TCP address.')),
        );
        return;
      }
      resolveServer({ server, url: `http://127.0.0.1:${address.port}` });
    };
    const onError = (failure: Error): void => settle(failure);
    const deadline = setTimeout(() => settle(new Error('Fixture server startup exceeded 2 seconds.')), 2_000);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => settle());
  });
}

function closeBrowserWithinDeadline(browser: Browser | undefined): Promise<void> {
  // WHAT: Skip shutdown when Chromium failed before returning an owned browser.
  // WHY: Loopback-server cleanup still has to settle after a browser-launch failure.
  if (!browser) return Promise.resolve();

  return new Promise((resolveClose, rejectClose) => {
    const deadline = setTimeout(() => rejectClose(new Error('Chromium close exceeded 2 seconds.')), 2_000);
    void browser.close().then(
      () => {
        clearTimeout(deadline);
        resolveClose();
      },
      (failure: unknown) => {
        clearTimeout(deadline);
        rejectClose(failure);
      },
    );
  });
}

test('canvas card list markers and spacing are rendered in Chromium', { timeout: 30_000 }, async () => {
  let server: Server | undefined;
  let browser: Browser | undefined;
  const failures: unknown[] = [];
  try {
    const fixture = await startFixtureServer();
    server = fixture.server;
    browser = await chromium.launch({
      headless: true,
      executablePath: chromiumExecutablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      timeout: 10_000,
    });
    const page = await browser.newPage({ viewport: { width: 720, height: 480 } });
    const response = await page.goto(fixture.url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    assert.equal(response?.status(), 200);
    const rendering = await page.evaluate(() => {
      const lists = Array.from(document.querySelectorAll<HTMLUListElement | HTMLOListElement>('.ledger-card-detail-layer .ledger-card-body > ul, .ledger-card-detail-layer .ledger-card-body > ol'));
      return lists.map((list) => {
        const [first, second] = Array.from(list.querySelectorAll<HTMLLIElement>(':scope > li'));
        // WHAT: Fail the fixture when either adjacent list item is missing.
        // WHY: Computed marker and spacing assertions require the declared pair.
        if (!first || !second) throw new Error('Fixture list requires two direct list items.');
        const firstRect = first.getBoundingClientRect();
        const secondRect = second.getBoundingClientRect();
        return {
          listStyleType: getComputedStyle(list).listStyleType,
          displays: [getComputedStyle(first).display, getComputedStyle(second).display],
          markerColors: [getComputedStyle(first, '::marker').color, getComputedStyle(second, '::marker').color],
          adjacentGap: secondRect.top - firstRect.bottom,
        };
      });
    });
    assert.deepEqual(rendering.map((list) => list.listStyleType), ['disc', 'decimal']);
    assert.deepEqual(rendering.flatMap((list) => list.displays), ['list-item', 'list-item', 'list-item', 'list-item']);
    assert.deepEqual(rendering.flatMap((list) => list.markerColors), [markerColor, markerColor, markerColor, markerColor]);
    assert.deepEqual(rendering.map((list) => list.adjacentGap), [9, 9]);
  } catch (failure) {
    failures.push(failure);
  } finally {
    const cleanupResults = await Promise.allSettled([
      closeBrowserWithinDeadline(browser),
      closeFixtureServer(server),
    ]);
    for (const result of cleanupResults) {
      // WHAT: Append each rejected cleanup result after the primary test failure.
      // WHY: One cleanup failure must not hide the browser or fixture-server evidence.
      if (result.status === 'rejected') failures.push(result.reason);
    }
  }
  // WHAT: Fail once with every primary and cleanup error in causal order.
  // WHY: The regression is unproven when rendering or owned-resource cleanup fails.
  if (failures.length > 0) throw new AggregateError(failures);
});

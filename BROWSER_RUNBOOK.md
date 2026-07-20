# Decision OS browser runbook

## Purpose

Use the browser workflow selected by the `platform` instruction injected into
the Codex developer prompt. Decision OS supports these runtime values:

1. `platform: linux` uses the repository Playwright dependency and the Linux
   Chromium executable.
2. `platform: termux` uses the shared Puppeteer Core helper and Termux
   Chromium.

The injected value is authoritative. Do not infer the platform from a path and
do not run commands from the other platform's section.

## Shared server boundary

Chromium is a separate client process. Browser preparation must not restart,
stop, replace, or launch the Decision OS server. Use the already served
operator route unless the operator explicitly requests a server restart. Keep
browser output separate from the server log.

## Linux workflow

### Verified components

1. Node platform: `linux`.
2. Chromium: `/snap/bin/chromium`.
3. Browser API: root dependency `@playwright/test`.
4. Existing launch examples: `tests/browser/**/*.spec.ts`.

Use these read-only checks before a Linux browser run:

```sh
node -p "process.platform"
test -x /snap/bin/chromium
/snap/bin/chromium --version
node -e "console.log(require.resolve('@playwright/test/package.json'))"
```

If a dependency restore is required, run `npm install` from the repository
root. Do not install the Termux `x11-repo` or `chromium` packages on Linux.

### Linux launch contract

Launch Playwright's Chromium controller with the existing system executable
and these arguments:

```text
executablePath: /snap/bin/chromium
--no-sandbox
--disable-dev-shm-usage
--disable-gpu
```

Do not add the Android-only `--no-zygote` and `--single-process` arguments to
the Linux workflow.

### Inspect an already served route

Set `DECISION_OS_URL` to the complete operator-facing route, then run this
smoke capture from the repository root:

```sh
DECISION_OS_URL=http://127.0.0.1:50150/ node --input-type=module <<'NODE'
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/snap/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const response = await page.goto(process.env.DECISION_OS_URL, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: '/tmp/decision-os-linux-smoke.png', fullPage: true });
  console.log(JSON.stringify({
    platform: process.platform,
    status: response?.status() ?? null,
    title: await page.title(),
    url: page.url(),
    screenshot: '/tmp/decision-os-linux-smoke.png',
  }));
} finally {
  await browser.close();
}
NODE
```

Use the server URL reported by the current execution profile. The example port
is the documented workspace default, not permission to start another server.
Store disposable screenshots under `/tmp`.

### Run an existing Linux browser test

Run browser tests through the repository verification lease. Select one direct
test file while iterating:

```sh
node bin/decision-os-verify.mjs -- node --test --import ./frontend/node_modules/tsx/dist/esm/index.mjs tests/browser/application/the-application-is-one-responsive-frontend.spec.ts
```

Repository browser tests may own an isolated test server internally. They must
not restart or replace the operator server.

### Linux troubleshooting

#### Browser executable not found

Run `command -v chromium chromium-browser google-chrome` and inspect the
installed executable. Update the automation only after the replacement path
has been verified on the workstation.

#### Snap Chromium does not launch

Confirm `/snap/bin/chromium --version`, preserve `--no-sandbox` and
`--disable-dev-shm-usage`, and inspect the launch exception. Do not switch to
the Termux helper.

#### Navigation timeout or certificate/network error

Inspect the exact target without changing server state:

```sh
curl -I "$DECISION_OS_URL"
```

## Termux workflow

### Verified components

1. Chromium: `/data/data/com.termux/files/usr/bin/chromium-browser`.
2. Browser helper: `../tool/browser/browse.js`.
3. Puppeteer Core installation: `../tool/browser/node_modules/puppeteer-core`.
4. Dependency lock: `../tool/browser/package-lock.json`.

The helper is shared from the parent workspace. Do not copy its
`node_modules`, screenshots, browser profiles, downloads, or logs into this
repository.

### Install or restore on Termux

From the `decision-os` repository root:

```sh
pkg install -y x11-repo
pkg install -y chromium
npm --prefix ../tool/browser ci
```

### Run a Termux browser capture

```sh
node ../tool/browser/browse.js https://example.com /tmp/decision-os-example.png
```

To select a different verified Chromium-compatible executable:

```sh
CHROMIUM_PATH=/path/to/chromium node ../tool/browser/browse.js https://example.com /tmp/decision-os-example.png
```

The command prints JSON containing the page title, final URL, and absolute
screenshot path. Store disposable screenshots under `/tmp`.

### Required Termux launch contract

Every Puppeteer automation on Termux must preserve these arguments from
`../tool/browser/browse.js`:

```text
--no-sandbox
--no-zygote
--single-process
--disable-dev-shm-usage
--disable-gpu
```

Android prevents normal Chromium child processes from loading Termux's
execution shim. Do not globally unset `LD_PRELOAD`; Termux needs the shim to
launch Chromium from app-private storage. The reduced process isolation means
this browser must open only sites appropriate for an automation environment.

### Verify the Termux installation

```sh
command -v chromium-browser
chromium-browser --version
test -f ../tool/browser/browse.js
test -d ../tool/browser/node_modules/puppeteer-core
```

Run the shared smoke test only when a browser launch is required:

```sh
npm --prefix ../tool/browser test
```

The smoke test writes `../tool/browser/test-screenshot.png`; treat it as
generated output.

### Termux troubleshooting

#### `Unsupported platform: android`

The automation imported Playwright. Use `puppeteer-core` through
`../tool/browser/browse.js`.

#### Browser executable not found

Restore Chromium with `pkg install chromium`, then retry. Set `CHROMIUM_PATH`
only when a different executable has been verified.

#### `CANNOT LINK EXECUTABLE /proc/self/exe` or repeated network crashes

Confirm `--no-zygote` and `--single-process` are present and `LD_PRELOAD` has
not been globally unset.

#### Navigation timeout or certificate/network error

Inspect connectivity without changing server state:

```sh
curl -I https://example.com
```

## Operational boundaries

Browser automation can navigate, inspect, click, type, download, and capture
pages. Logins, messages, purchases, financial actions, account changes, and
CAPTCHA handling require explicit operator direction. Never commit cookies,
credentials, browser profiles, private downloads, or screenshots containing
secrets.

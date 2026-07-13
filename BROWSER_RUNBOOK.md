# Mobile Chromium runbook

## Purpose

Use this procedure for browser tests and screenshots when `decision-os` is
running in Termux on Android. The shared browser helper uses Puppeteer Core and
the Chromium package supplied by the Termux X11 repository.

Playwright Core is not used because it rejects Node.js when
`process.platform` is `android`. Puppeteer Core drives the Chromium DevTools
Protocol while allowing the Termux Chromium executable to be selected
explicitly.

## Verified components

- Chromium: `/data/data/com.termux/files/usr/bin/chromium-browser`
- Browser helper: `../tool/browser/browse.js`
- Puppeteer Core installation: `../tool/browser/node_modules/puppeteer-core`
- Dependency lock: `../tool/browser/package-lock.json`

The helper is shared from the parent workspace. Do not copy its
`node_modules/`, screenshots, browser profiles, downloads, or logs into this
repository.

## Install or restore

From the `decision-os` repository root:

```sh
pkg install -y x11-repo
pkg install -y chromium
npm --prefix ../tool/browser ci
```

`npm ci` restores the dependency versions recorded in the shared browser
helper's lock file.

## Run a browser test or screenshot

From the `decision-os` repository root:

```sh
node ../tool/browser/browse.js https://example.com /tmp/decision-os-example.png
```

The command prints JSON containing the page title, final URL, and absolute
screenshot path. Store disposable screenshots under `/tmp`; do not commit
generated screenshots.

To select a different Chromium-compatible executable:

```sh
CHROMIUM_PATH=/path/to/chromium node ../tool/browser/browse.js https://example.com /tmp/decision-os-example.png
```

## Required Android launch contract

Every Puppeteer automation created for this Termux environment must reuse these
launch arguments from `../tool/browser/browse.js`:

```text
--no-sandbox
--no-zygote
--single-process
--disable-dev-shm-usage
--disable-gpu
```

Do not remove `--no-zygote` or `--single-process` without a successful browser
test on this phone. Android prevents normal Chromium child processes from
loading Termux's execution shim; these arguments prevent the resulting network
service crash. The reduced process isolation means this browser must only open
sites appropriate for an automation environment.

Do not globally unset `LD_PRELOAD`. Termux needs its execution shim to launch
Chromium from app-private storage.

## Decision OS server boundary

Browser automation is a separate client process. It must not restart, stop,
replace, or launch the Decision OS server. Use the already served operator route
for interaction checks unless the operator explicitly requests a server
restart. Keep browser output separate from the server log.

## Verify the installation

Verify paths without starting the browser:

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

## Troubleshooting

### `Unsupported platform: android`

The automation imports Playwright. Use `puppeteer-core` with the explicit
Chromium executable, as implemented by `../tool/browser/browse.js`.

### Browser executable not found

```sh
command -v chromium-browser
chromium-browser --version
```

Restore it with `pkg install chromium`, then retry. Set `CHROMIUM_PATH` only
when a different verified executable is required.

### `CANNOT LINK EXECUTABLE /proc/self/exe` or repeated network crashes

Confirm that `--no-zygote` and `--single-process` are present. Confirm that
`LD_PRELOAD` has not been globally unset.

### Navigation timeout or certificate/network error

First inspect connectivity without changing server state:

```sh
curl -I https://example.com
```

Then retry with a known public page. The shared helper uses a 30-second
navigation timeout.

## Operational boundaries

Browser automation can navigate, inspect, click, type, download, and capture
pages. Logins, messages, purchases, financial actions, account changes, and
CAPTCHA handling require explicit operator direction. Never commit cookies,
credentials, browser profiles, private downloads, or screenshots containing
secrets.

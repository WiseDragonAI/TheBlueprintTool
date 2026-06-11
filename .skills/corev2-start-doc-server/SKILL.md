---
name: corev2-start-doc-server
description: Use when the user asks to "start server", "restart server", "start doc server", "launch CoreV2", "open Blueprinttool", or run the CoreV2 Blueprinttool documentation server. Start from the agent cwd by default, choose or validate a free port, verify HTTP, and print the complete clickable URL.
---

# CoreV2 Start Doc Server

## Purpose

Start the CoreV2 Blueprinttool documentation server for the active workspace. The target workspace is the current shell working directory unless the user explicitly names another directory. That workspace owns `.blueprinttool/` state, ledgers, cards, threads, images, and settings.

## Topology

Resolve the CoreV2 runtime repo before launching:

```bash
if [ -n "${COREV2_REPO:-}" ]; then
  COREV2_REPO="$COREV2_REPO"
elif [ -x "bin/blueprinttool-server.mjs" ]; then
  COREV2_REPO="$(pwd)"
elif git rev-parse --show-toplevel >/dev/null 2>&1 && [ -x "$(git rev-parse --show-toplevel)/bin/blueprinttool-server.mjs" ]; then
  COREV2_REPO="$(git rev-parse --show-toplevel)"
else
  printf 'Unable to resolve CoreV2 repo. Set COREV2_REPO or run from a CoreV2 checkout.\n' >&2
  exit 1
fi
LAUNCHER="$COREV2_REPO/bin/blueprinttool-server.mjs"
```

The server resolves the active `.blueprinttool` workspace from process cwd. Start the launcher from the target workspace cwd. If the current cwd is the CoreV2 repo, then CoreV2 is the target workspace.

The launcher derives CoreV2 runtime paths from its own location and sets the frontend root and backend TypeScript config. Do not reimplement the underlying server command unless debugging the launcher.

To inspect the underlying command without starting the server:

```bash
node "$LAUNCHER" --print-command
```

## Default Target

Use the agent shell cwd as the target workspace by default. Confirm that `.blueprinttool/` exists in cwd. If the user gives another workspace, `cd` there and run all checks from that directory.

## Choose A Free Port

Do not hardcode a port in the skill or assume a default is free. If the user provides a port, verify it is free before launching. If no port is provided, choose a free loopback port at runtime.

One acceptable dynamic picker:

```bash
PORT=$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)
```

Verify the selected or requested port before starting:

```bash
ss -ltnp | rg ":${PORT}\\b" || true
```

If the port is occupied, identify the process. Only stop a process when it is clearly the matching CoreV2 Blueprinttool server for the same workspace and the user asked for restart. Otherwise choose another free port.

## Start In Background

Use a durable background launch from the target workspace:

```bash
WORKSPACE=$(pwd)
WORKSPACE_NAME=$(basename "$WORKSPACE" | tr -c 'A-Za-z0-9._-' '-')
LOG="/tmp/${WORKSPACE_NAME}-corev2-blueprinttool-${PORT}.log"
setsid sh -c 'cd "$1" && exec env PORT="$2" "$3" >> "$4" 2>&1' sh "$WORKSPACE" "$PORT" "$LAUNCHER" "$LOG" </dev/null >/dev/null 2>&1 &
```

Do not rely on a foreground server command for an operator-facing session. Do not report the URL until process and HTTP verification succeed.

## Resolve Routes

Read `.blueprinttool/state.json` when present to identify available routes/tabs. If routes are unclear, inspect the server output or try the known route paths from state before reporting.

The final URL must include the selected port and a real route, for example:

```text
http://127.0.0.1:${PORT}/<route>
```

## Verify

Verify the process:

```bash
ps -ef | rg "blueprinttool-server|server.ts|${PORT}" | rg -v rg
```

Verify HTTP with the selected route:

```bash
curl -sS -I "http://127.0.0.1:${PORT}/<route>"
```

If the route returns a successful HTTP response, print the complete clickable URL in chat. Include workspace cwd, port, route URL, and log path. If verification fails, read the log and fix the launch before reporting.

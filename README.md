# decision-os

Migrating existing workspaces: see [MIGRATE_RUNBOOK.md](MIGRATE_RUNBOOK.md).

decision-os is a browser canvas, a backend ledger server, and workspace-local `.decision-os` data.

## Run From Any Workspace CWD

Use the repo launcher instead of spelling out the Node loader and environment variables by hand.

From the decision-os repo:

```bash
cd /home/jbb/dev/EditorBP/decision-os
/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs
```

Then open the ledger route:

```text
http://127.0.0.1:4173/specs
http://127.0.0.1:4173/data
```

The launcher derives decision-os paths from its own location and automatically sets:

```bash
DECISION_OS_FRONTEND_ROOT=/home/jbb/dev/EditorBP/decision-os/frontend
TSX_TSCONFIG_PATH=/home/jbb/dev/EditorBP/decision-os/backend/tsconfig.json
```

It then starts:

```bash
node --import /home/jbb/dev/EditorBP/decision-os/backend/node_modules/tsx/dist/loader.mjs \
  /home/jbb/dev/EditorBP/decision-os/backend/src/server.ts
```

To inspect what would run without starting the server:

```bash
/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs --print-command
```

From the decision-os repo itself, this is equivalent:

```bash
npm run start:workspace
```

## Run In The Background

For operator-facing document sessions, run the server as a detached background process from the
target workspace cwd.

Example for this decision-os workspace:

```bash
cd /home/jbb/dev/EditorBP/decision-os
setsid sh -c 'cd /home/jbb/dev/EditorBP/decision-os && exec env PORT=4174 /home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs >> /tmp/decision-os-4174.log 2>&1' </dev/null >/dev/null 2>&1 &
```

Then verify the process and route before reporting the URL:

```bash
ps -ef | rg 'decision-os-server|server.ts|4174' | rg -v rg
curl -sS -I http://127.0.0.1:4174/specs
```

decision-os document routes:

```text
http://127.0.0.1:4174/specs
http://127.0.0.1:4174/data
http://127.0.0.1:4174/performances
http://127.0.0.1:4174/tasks-system
```

Do not use a plain foreground command for operator-facing sessions. Do not assume a returned
background PID means the server stayed alive; always verify the HTTP route.

## Workspace Discovery

The backend resolves the active `.decision-os` directory by walking upward from the process cwd. That means the launcher should be run from the target workspace or a child directory of that workspace.

The repo's own workspace shape:

```text
decision-os/
  .decision-os/
    state.json
    .settings.json
    specs.json
    data.json
```

`state.json` defines available tabs and ledger files:

```json
{
  "tabs": [
    {
      "id": "specs",
      "title": "Specs",
      "ledgerFile": ".decision-os/specs.json"
    },
    {
      "id": "data",
      "title": "Data",
      "ledgerFile": ".decision-os/data.json"
    }
  ]
}
```

## Operator Keys

The in-app Keys panel is the operator-facing source for keyboard shortcuts:

```text
A       Open or focus the thread panel.
X       Start or stop the active voice note.
Esc     Cancel voice capture, close thread tooling, or clear selection.
Del     Confirm deletion for the selected card, zone, or group.
Ctrl+C  Copy the selected cards, zones, and groups.
Ctrl+V  Paste the copied selection.
Ctrl+D  Resize selected cards to their content.
```

## Ledger CLI

Ledger JSON editing is owned by the separate `ledger-cli` package, not by `generator-cli`.

```bash
cd /home/jbb/dev/EditorBP/decision-os/ledger-cli
npm run cli -- help
npm run cli -- overview --ledger ../.decision-os/specs.json
npm run cli -- mutate --ledger ../.decision-os/specs.json --card-id 60000006 --card-title "Cards can resize"
npm run cli -- export --ledger ../.decision-os/specs.json --output ../ledger-export.md
npm run cli -- unanswered --ledger ../.decision-os/specs.json
npm run cli -- answer --ledger ../.decision-os/specs.json --thread-id thread-60000006 --message "Implemented."
```

`generator-cli` is reserved for scaffold generation from the MasterLedger and related generation checks.

## Termux Home Master Server

Launch Decision OS from the Termux home to recursively discover every nested project directory that contains `.decision-os/state.json`:

```bash
setsid sh -c 'cd /data/data/com.termux/files/home && exec env PORT=50150 DECISION_OS_FRONTEND_ROOT=/data/data/com.termux/files/home/decision-os/frontend-mobile /data/data/com.termux/files/home/decision-os/bin/decision-os-server.mjs >> /tmp/decision-os-home-50150.log 2>&1' </dev/null >/dev/null 2>&1 &
```

Verify the process, project catalog, and Control Room route:

```bash
ps -ef | rg 'decision-os-server|server.ts|50150' | rg -v rg
curl -sS http://127.0.0.1:50150/decision-os/projects
curl -sS -I http://127.0.0.1:50150/
```

The server scans through intermediate directories without Decision OS data. Each project retains its relative nested path for request isolation and displays the basename of its project directory. Project colors are stored in the master scope at `/data/data/com.termux/files/home/.decision-os/projects.json`.

## Card Markdown Images

Card markdown supports image syntax in descriptions and field tabs:

```markdown
![Campaign UI Summary](.decision-os/ui-mockups/campaign-ui-3-summary.png)
```

Image assets under the active workspace `.decision-os` directory are served by the backend from the matching `/.decision-os/...` URL. The asset route is intentionally limited to image extensions (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`) and rejects path traversal outside the active workspace.

Standalone adjacent images are wrapped into an in-card carousel automatically, including image-only lines separated by blank lines. Each image frame preserves the card form factor with `object-fit: contain`, is resized by width inside the card, derives height from the loaded image aspect ratio, and persists its dimensions by markdown source URL:

```json
{
  "imageSizes": {
    ".decision-os/ui-mockups/campaign-ui-3-summary.png": {
      "width": 320,
      "height": 180
    }
  }
}
```

The persistence path stores layout pixels from `offsetWidth` and `offsetHeight`, so canvas zoom does not shrink the saved size.

## Transcription Setup

Voice transcription is configured per workspace through `.decision-os/.settings.json`.

Minimal settings:

```json
{
  "decisionOsFrontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "transcriptionModel": "gpt-4o-mini-transcribe",
  "openaiApiKey": "sk-..."
}
```

Supported aliases:

```json
{
  "frontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "DECISION_OS_FRONTEND_ROOT": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "OPENAI_API_KEY": "sk-...",
  "OPENAI_TRANSCRIPTION_MODEL": "gpt-4o-mini-transcribe"
}
```

Optional switch:

```json
{
  "transcriptionEnabled": true
}
```

If `transcriptionEnabled` is `false`, decision-os still uploads and persists the voice note/audio, but the transcript step is reported as not configured.

Do not commit real API keys. Keep `.decision-os/.settings.json` workspace-local.

## Voice Notes

Voice notes are created optimistically in the active thread, then reconciled into the active ledger file through:

```text
PATCH /decision-os/<active-tab>
```

Captured browser audio is encoded as mono PCM WAV before upload so provider transcription receives a conservative supported audio container. Uploaded audio is cached under:

```text
.decision-os/voice-uploads/
```

If transcription fails, the note and `voiceFileRef` remain in the ledger so the UI can offer retry.

The waveform accumulates the full recording envelope instead of shifting through a rolling buffer, and the displayed peak uses 95% of the graph height. Press `X` to start or stop recording, and `Esc` to cancel an active capture.

## Useful Checks

Backend typecheck:

```bash
npm run typecheck:backend
```

Frontend typecheck:

```bash
npm run typecheck:frontend
```

Launcher test:

```bash
node --test tests/launcher/decision-os-server-launcher.spec.mjs
```

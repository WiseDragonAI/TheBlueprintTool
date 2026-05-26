# CoreV2

CoreV2 is the Blueprint Tool runtime: a browser canvas, a backend ledger server, and workspace-local `.blueprinttool` data.

## Run From Any Workspace CWD

Use the repo launcher instead of spelling out the Node loader and environment variables by hand.

From a project workspace such as Ardaria:

```bash
cd /media/jbb/57af6506-cd41-47dd-bcb1-5280ec4da1e7/Ardaria_57
/home/jbb/dev/EditorBP/CoreV2/bin/corev2-server.mjs
```

Then open the ledger route:

```text
http://127.0.0.1:4173/ardaria-game-design
```

The launcher derives CoreV2 paths from its own location and automatically sets:

```bash
COREV2_FRONTEND_ROOT=/home/jbb/dev/EditorBP/CoreV2/frontend
TSX_TSCONFIG_PATH=/home/jbb/dev/EditorBP/CoreV2/backend/tsconfig.json
```

It then starts:

```bash
node --import /home/jbb/dev/EditorBP/CoreV2/backend/node_modules/tsx/dist/loader.mjs \
  /home/jbb/dev/EditorBP/CoreV2/backend/src/server.ts
```

To inspect what would run without starting the server:

```bash
/home/jbb/dev/EditorBP/CoreV2/bin/corev2-server.mjs --print-command
```

From the CoreV2 repo itself, this is equivalent:

```bash
npm run start:workspace
```

## Workspace Discovery

The backend resolves the active `.blueprinttool` directory by walking upward from the process cwd. That means the launcher should be run from the target workspace or a child directory of that workspace.

Expected workspace shape:

```text
Ardaria_57/
  .blueprinttool/
    state.json
    .settings.json
    ardaria-game-design.json
    ardaria-data-model.json
```

`state.json` defines available tabs and ledger files:

```json
{
  "tabs": [
    {
      "id": "ardaria-game-design",
      "title": "Ardaria Game Design",
      "ledgerFile": ".blueprinttool/ardaria-game-design.json"
    }
  ]
}
```

## Transcription Setup

Voice transcription is configured per workspace through `.blueprinttool/.settings.json`.

Minimal settings:

```json
{
  "corev2FrontendRoot": "/home/jbb/dev/EditorBP/CoreV2/frontend",
  "transcriptionModel": "gpt-4o-mini-transcribe",
  "openaiApiKey": "sk-..."
}
```

Supported aliases:

```json
{
  "frontendRoot": "/home/jbb/dev/EditorBP/CoreV2/frontend",
  "COREV2_FRONTEND_ROOT": "/home/jbb/dev/EditorBP/CoreV2/frontend",
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

If `transcriptionEnabled` is `false`, CoreV2 still uploads and persists the voice note/audio, but the transcript step is reported as not configured.

Do not commit real API keys. Keep `.blueprinttool/.settings.json` workspace-local.

## Voice Notes

Voice notes are created optimistically in the active thread, then reconciled into the active ledger file through:

```text
PATCH /blueprinttool/<active-tab>
```

Captured browser audio is encoded as mono PCM WAV before upload so provider transcription receives a conservative supported audio container. Uploaded audio is cached under:

```text
.blueprinttool/voice-uploads/
```

If transcription fails, the note and `voiceFileRef` remain in the ledger so the UI can offer retry.

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
node --test tests/launcher/corev2-server-launcher.spec.mjs
```

# CoreV2 Agent Instructions

## Codebase Rules

- Follow the local runtime convention of one function per implementation file. Split helpers/effects/controllers into separate files instead of grouping several functions in one module.
- Group private helper/effect files under a feature directory such as `runtime/debug/zoom-debug/...`; do not dump feature-specific helpers into broad shared folders that will accumulate unrelated files.
- Start implementation files with the existing `WHAT` / `WHY` comment block that explains the file responsibility and reason.
- Add `// Branch:` comments for meaningful conditional branches so control-flow intent remains explicit.
- Preserve these conventions when adding debug or measurement code; temporary instrumentation must obey the same structure as product code unless the operator explicitly asks for a throwaway script outside the repo.

## Blueprint Tool Server Procedure

CoreV2 serves the active `.blueprinttool` workspace by resolving the workspace root from the process
current working directory. Always start the server from the target project workspace, not from the
CoreV2 repo, unless the operator explicitly wants to inspect CoreV2's own ledgers.

For the MOH workspace:

```bash
cd /home/jbb/dev/MOH
setsid sh -c 'cd /home/jbb/dev/MOH && exec env PORT=4174 /home/jbb/dev/EditorBP/CoreV2/bin/blueprinttool-server.mjs >> /tmp/moh-corev2-blueprinttool-4174.log 2>&1' </dev/null >/dev/null 2>&1 &
```

Then verify both the process and HTTP route:

```bash
ps -ef | rg 'blueprinttool-server|server.ts|4174' | rg -v rg
curl -sS -I http://127.0.0.1:4174/ses
```

Expected routes for MOH:

```text
http://127.0.0.1:4174/ses
http://127.0.0.1:4174/s3
```

## Background Launch Rules

- Use the repo launcher: `/home/jbb/dev/EditorBP/CoreV2/bin/blueprinttool-server.mjs`.
- Run it from the target workspace cwd so `.blueprinttool/state.json` resolves correctly.
- Use `setsid sh -c 'cd <workspace> && exec env PORT=<port> <launcher> >> <log> 2>&1' </dev/null >/dev/null 2>&1 &`
  for a real background server.
- Redirect stdout and stderr to a workspace-specific log under `/tmp`.
- Verify with `curl -I` before reporting the URL.
- Do not rely on a plain foreground command for operator-facing server sessions.
- Do not rely on a fragile one-liner that only backgrounds the wrapper without verifying the child server stayed alive.

## Launcher Notes

The launcher derives CoreV2 runtime paths from its own location and sets:

```bash
COREV2_FRONTEND_ROOT=/home/jbb/dev/EditorBP/CoreV2/frontend
TSX_TSCONFIG_PATH=/home/jbb/dev/EditorBP/CoreV2/backend/tsconfig.json
```

To inspect the underlying command without starting the server:

```bash
/home/jbb/dev/EditorBP/CoreV2/bin/blueprinttool-server.mjs --print-command
```

## Voice Transcription

Voice transcription is configured per target workspace through:

```text
<workspace>/.blueprinttool/.settings.json
```

Minimal settings:

```json
{
  "corev2FrontendRoot": "/home/jbb/dev/EditorBP/CoreV2/frontend",
  "transcriptionModel": "gpt-4o-mini-transcribe",
  "openaiApiKey": "sk-..."
}
```

Supported aliases are also accepted:

```json
{
  "frontendRoot": "/home/jbb/dev/EditorBP/CoreV2/frontend",
  "COREV2_FRONTEND_ROOT": "/home/jbb/dev/EditorBP/CoreV2/frontend",
  "OPENAI_API_KEY": "sk-...",
  "OPENAI_TRANSCRIPTION_MODEL": "gpt-4o-mini-transcribe"
}
```

Keep this file local and ignored. Do not commit API keys or uploaded voice files.

## Operator Keys

The in-app Keys panel should list the current keyboard contract:

```text
A       Open or focus the thread panel.
X       Start or stop the active voice note.
Esc     Cancel voice capture, close thread tooling, or clear selection.
Del     Confirm deletion for the selected card, zone, or group.
Ctrl+C  Copy the selected cards, zones, and groups.
Ctrl+V  Paste the copied selection.
Ctrl+D  Resize selected cards to their content and selected zones to contained cards.
```

## Commit Hygiene

- Never finish a feature with implementation changes left uncommitted.
- After implementing and verifying a feature, create focused commits before reporting the feature complete.
- When the operator asks to push committed work, push with the Wise SSH key:

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_jb_wise -o IdentitiesOnly=yes' git push
```

## Card Image Assets

Markdown image assets can be referenced from the active workspace `.blueprinttool` directory:

```markdown
![Campaign UI Summary](.blueprinttool/ui-mockups/campaign-ui-3-summary.png)
```

The backend serves image files from `/.blueprinttool/...` for the active workspace only. Adjacent standalone images, including image-only lines separated by blank lines, render as a carousel. Image frames resize by width, derive height from the loaded image aspect ratio, and persist dimensions in the card JSON under `imageSizes`, keyed by the markdown image URL.

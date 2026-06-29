# decision-os Migration Runbook

This runbook migrates an existing workspace from the former storage and command namespace to `decision-os`.

## 1. Prepare

1. Commit or back up the target project before migrating.
2. Stop any existing workspace server processes.
3. Confirm the target workspace path:

```bash
cd /path/to/workspace
pwd
```

## 2. Preview

Run a dry run from the target workspace or pass `--root` explicitly:

```bash
/home/jbb/dev/EditorBP/decision-os/bin/ledger-cli.mjs migrate-decision-os --root /path/to/workspace --dry-run
```

For automation:

```bash
/home/jbb/dev/EditorBP/decision-os/bin/ledger-cli.mjs migrate-decision-os --root /path/to/workspace --dry-run --json
```

Review the report:

1. **Moved directories** should show the legacy workspace directory moving to `.decision-os`.
2. **Changed files** should list ledger JSON, card Markdown, thread Markdown, and settings files that contain old refs.
3. **Manual follow-up files** are files outside the decision-os storage directory that still mention old commands, env vars, or paths.
4. **Skipped binary files** should only be media or other non-text files.

## 3. Apply

Apply the workspace storage migration:

```bash
/home/jbb/dev/EditorBP/decision-os/bin/ledger-cli.mjs migrate-decision-os --root /path/to/workspace --write
```

If the workspace intentionally has dirty tracked files:

```bash
/home/jbb/dev/EditorBP/decision-os/bin/ledger-cli.mjs migrate-decision-os --root /path/to/workspace --write --allow-dirty
```

The command does not rewrite arbitrary project source files outside the decision-os storage directory. Edit every manual follow-up file reported by the dry run.

## 4. Local Settings

Settings remain local and ignored. After migration, the settings file is:

```text
<workspace>/.decision-os/.settings.json
```

Use the new keys:

```json
{
  "decisionOsFrontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "transcriptionModel": "gpt-4o-mini-transcribe",
  "openaiApiKey": "sk-..."
}
```

Environment variables now use:

```bash
DECISION_OS_FRONTEND_ROOT=/home/jbb/dev/EditorBP/decision-os/frontend
DECISION_OS_ROOT=/path/to/workspace/.decision-os
DECISION_OS_VOICE_UPLOAD_ROOT=/path/to/workspace/.decision-os/voice-uploads
```

## 5. Commands

Start the server with:

```bash
cd /path/to/workspace
setsid sh -c 'cd "$1" && exec env PORT="$2" /home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs >> "$3" 2>&1' sh "$PWD" 4174 /tmp/decision-os-4174.log </dev/null >/dev/null 2>&1 &
```

Verify:

```bash
ps -ef | rg 'decision-os-server|server.ts|4174' | rg -v rg
curl -sS -I http://127.0.0.1:4174/<tab>
curl -sS -I http://127.0.0.1:4174/decision-os/state
```

## 6. Browser State

The browser now stores state under `decision-os.*` keys. If old viewport or draft state causes confusion, clear local storage for the workspace origin.

## 7. Acceptance Checks

Run these checks after migration:

```bash
rg -n 'CoreV2|corev2|COREV2|Blueprinttool|BlueprintTool|Blueprint Tool|blueprinttool|blueprint-tool|blueprint_tool|\\.blueprinttool|BLUEPRINTTOOL' /path/to/workspace
curl -sS -I http://127.0.0.1:4174/<tab>
curl -sS -I http://127.0.0.1:4174/decision-os/state
```

The `rg` command should return no matches except historical notes that the project owner explicitly decides to keep.

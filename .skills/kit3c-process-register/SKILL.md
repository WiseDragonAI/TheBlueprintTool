---
name: kit3c-process-register
description: Use when an agent needs to start, persist, or restore a background development process for kit3c. Requires registering the process by cwd, command, port, URL, and description through the kit3c-process CLI instead of launching it manually.
---

# kit3c Process Register

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

Use this skill whenever you need to start a background server/process that should be visible in kit3c and restored when kit3c is relaunched.

## Required Tool

Always use:

```bash
kit3c-process register --cwd <directory> --cmd '<command>' --port <port> --url <url> --description '<what this process is for>' [--name <label>]
```

Do not start a persistent background server with ad hoc `cmd &`, `nohup`, `setsid`, `npm run ... &`, or similar shell launches when it should survive kit3c restarts.

## Workflow

1. Resolve the intended cwd and verify it exists.
2. Choose the command exactly as it should run from that cwd.
3. Specify the port the process is expected to bind.
4. Specify the URL the user should open for that process.
5. Add a short human description for the kit3c control room.
6. Register and launch through `kit3c-process register`.
7. If the CLI reports the port is already listening, do not overwrite it. Inspect the existing listener first.

## Examples

```bash
kit3c-process register \
  --cwd /home/jbb/dev/EditorBP/CoreV2 \
  --cmd 'npm run dev -- --host 127.0.0.1 --port 5173' \
  --port 5173 \
  --url http://127.0.0.1:5173 \
  --description 'CoreV2 development server' \
  --name CoreV2
```

```bash
kit3c-process register \
  --cwd /home/jbb/Ardaria_57 \
  --cmd 'python3 -m http.server 4188 --bind 127.0.0.1' \
  --port 4188 \
  --url http://127.0.0.1:4188 \
  --description 'Static preview server for Ardaria assets' \
  --name Ardaria57-static
```

## Inspection

List registered processes:

```bash
kit3c-process list
```

Restore registered processes whose ports are free:

```bash
kit3c-process restore
```

# decision-os Agent Instructions

## Language Policy

- All agent responses MUST be written in English only.
- The operator may speak or write in French; do not mirror the operator's language.
- decision-os `# AGENT` thread replies must be in English, even when the corresponding `# OPERATOR` note is French.
- Do not write French acknowledgements such as `Traité`; use English equivalents such as `Treated`.

## KNOWLEDGE

### Anti Specs

- **Rule.** Never write anti-specs: generic process claims that spend operator tokens and attention without adding a concrete requirement, constraint, decision, evidence, or action.
- **Don't.** `Good PRDs do not exist to create paperwork. They align teams around the customer problem, goals, requirements, risks, constraints, dependencies, and success measures before execution.`
- **Do.** `Card purpose: give the operator the verified information needed to understand the current state and make the next decision.`

### No Suppositions

- **Rule.** Never write suppositions when the answer can be verified from the repo, tools, CLI, docs, runtime state, or available evidence. Search, inspect, run the relevant command, and report the finding.
- **Don't.** `If ledger-cli does not expose that query, then the missing piece is a CLI contract.`
- **Do.** `Finding: ledger-cli exposes no zone-context query. Evidence: rg found no command handler or help entry for zone context under cli/. Required action: add the ledger-cli query contract.`
- **Blocker.** When evidence cannot be obtained, state the verified blocker and ask one concrete operator question. Do not replace missing evidence with conditional analysis.

### No Or In Plans

- **Rule.** Never leave unresolved alternatives with `or` in a final implementation plan, recommendation, acceptance criteria, or `# AGENT` answer. Pick the single best solution from the evidence. Options are valid only inside explicit questions to the operator.
- **Don't.** `Add headers or query params: x-ledger-id, x-thread-id, x-card-id, x-note-id, x-queue-codex.`
- **Do.** `Add required headers to /api/voice-upload: x-ledger-id, x-thread-id, x-card-id, x-note-id, x-queue-codex.`

### Reference Component Fidelity

- **Trigger.** When the operator names an existing widget or component as the visual reference, inspect that component's rendered structure and every CSS rule controlling its surface, icon, label, casing, spacing, and states before implementation.
- **Requirement.** Copy the reference component's styling boundary exactly. When the reference applies accent color only to its icon and label, keep the button surface, border, shadow, and container on the reference component's shared styling.
- **Verification.** Compare computed foreground, background, label casing, SVG structure, and dimensions between the changed control and the named reference on the served target surface.

### Behavior-Only Component Changes

- **Trigger.** When the operator requests a behavior change to an existing validated component, preserve that component's implementation, rendered structure, styling, and interaction model.
- **Boundary.** Fix the data, hydration, state, or event transition responsible for the behavior. Do not replace the component, introduce a substitute library, or redesign its editing surface without explicit operator authorization.
- **Escalation.** If the existing component cannot satisfy the requested behavior, present the verified limitation and ask the operator before changing the component boundary.

### Complex Interaction Library Gate

- **Trigger.** Before implementing touch gestures, drag-and-drop sorting, carousels, rich-text editing, virtualized lists, focus traps, collision detection, or another interaction with a multi-event browser state machine, inspect maintained framework-free libraries and the existing dependency stack.
- **Decision.** Prefer a mature library when it owns input normalization, cancellation, animation, scrolling, accessibility, and cleanup. Write custom interaction code only when verified requirements are materially outside the library contract.
- **Operator visibility.** State the selected library, license, pinned version, runtime delivery method, and the concrete reason for selecting it before implementation. When custom code is selected, state the evidence that rules out the library path.
- **Boundary.** Keep application-specific state and persistence outside the library. Consume the library's stable completion event, update local state optimistically, then persist.

### Interaction Verification and Claims

- **Behavioral evidence.** Source-pattern assertions, syntax checks, and unit tests do not prove a touch, pointer, scroll, focus, animation, or drag interaction works. Verify the complete gesture on the served target surface with representative browser input.
- **Persistence evidence.** For optimistic UI, verify three distinct moments: the UI changes before the request resolves, successful persistence survives a fresh reload, and a rejected request reconciles to server-confirmed state.
- **Target evidence.** Confirm the operator-facing route serves the changed files and pinned assets. Record the route, HTTP result, and behavioral observation without restarting the server unless the operator requested it.
- **Claim calibration.** Use `implemented; automated checks pass; device interaction not yet verified` when target-surface verification is unavailable. Do not write `works`, `fixed`, `complete`, or mark the related ledger card `done` without behavioral evidence for the affected interaction.
- **Operator gate.** When only the operator can exercise the required device path, keep the task active and ask for one focused validation step instead of declaring success.

### Contradicted Success RCA

- **Stop condition.** After the operator reports that a claimed interaction fix still fails, stop incremental patching and reopen the affected subtask.
- **Evidence.** Capture the exact route, device and browser, gesture sequence, screenshot or recording, DOM state, request sequence, and persisted state before editing again.
- **RCA.** Identify the first incorrect transition in the event-to-DOM-to-local-state-to-request-to-server-state chain. Record evidence for the cause in the card and add a regression that exercises that boundary.
- **Escalation.** After one contradicted success claim, reassess the implementation approach, including a maintained library replacement. Do not issue a second success claim from the same class of static evidence.

### Formatting Contract

1. **Content:** include only verified information needed for the next operator decision; use task-specific section titles, never a default schema.
2. **Headings:** use letter-prefixed `H2` card sections.
3. **Dividers:** put `---` between sections.
4. **Lists:** use numbered list items.
5. **Emphasis:** use **bold** for key points and `backticks` for exact literals.

## Mobile Chromium Procedure

- **Mandatory runbook:** Before installing, running, debugging, or modifying
  browser automation on the phone, and before using Chromium for a mobile test
  or screenshot, read and follow [`BROWSER_RUNBOOK.md`](BROWSER_RUNBOOK.md).
- **Verified helper:** Use `../tool/browser/browse.js` with the Termux Chromium
  executable at `/data/data/com.termux/files/usr/bin/chromium-browser`.
- **Required flags:** Preserve `--no-sandbox`, `--no-zygote`,
  `--single-process`, `--disable-dev-shm-usage`, and `--disable-gpu`.
- **Server boundary:** Chromium is a separate client process. Do not restart,
  stop, replace, or launch the Decision OS server while preparing a browser test
  unless the operator explicitly requests a server restart.

## decision-os Server Procedure

### Server Restart Ownership

- **Do not restart or stop the server unless the operator explicitly asks.**

decision-os serves every discovered `.decision-os` project below the server launch directory. The
Control Room is always `/`, all projects remain simultaneously accessible, and project-owned resources
use canonical `/p/:projectId/...` URLs. Start the master server from the directory whose descendants
form the project catalog.

For this decision-os repo workspace, use port `50150`. Port `4174` is registered to
`Ardaria_57` in multiterm state; do not start this repo on `4174`.

```bash
cd /home/jbb/dev/EditorBP/decision-os
setsid sh -c 'cd /home/jbb/dev/EditorBP/decision-os && exec env PORT=50150 /home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs >> /tmp/decision-os-50150.log 2>&1' </dev/null >/dev/null 2>&1 &
```

Then verify both the process and HTTP route:

```bash
ps -ef | rg 'decision-os-server|server.ts|50150' | rg -v rg
curl -sS -I http://127.0.0.1:50150/
```

Expected routes for decision-os:

```text
http://127.0.0.1:50150/
http://127.0.0.1:50150/projects
http://127.0.0.1:50150/ledgers
http://127.0.0.1:50150/p/<project-id>/ledgers/<ledger-id>
```

## Background Launch Rules

- Use the repo launcher: `/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs`.
- Run it from the target workspace cwd so `.decision-os/state.json` resolves correctly.
- Use `setsid sh -c 'cd <workspace> && exec env PORT=<port> <launcher> >> <log> 2>&1' </dev/null >/dev/null 2>&1 &`
  for a real background server.
- Redirect stdout and stderr to a workspace-specific log under `/tmp`.
- Verify with `curl -I` before reporting the URL.
- Do not rely on a plain foreground command for operator-facing server sessions.
- Do not rely on a fragile one-liner that only backgrounds the wrapper without verifying the child server stayed alive.

## Launcher Notes

The launcher derives decision-os runtime paths from its own location and sets:

```bash
DECISION_OS_FRONTEND_ROOT=/home/jbb/dev/EditorBP/decision-os/frontend
TSX_TSCONFIG_PATH=/home/jbb/dev/EditorBP/decision-os/backend/tsconfig.json
```

To inspect the underlying command without starting the server:

```bash
/home/jbb/dev/EditorBP/decision-os/bin/decision-os-server.mjs --print-command
```

## Voice Transcription

Voice transcription is configured per target workspace through:

```text
<workspace>/.decision-os/.settings.json
```

Minimal settings:

```json
{
  "decisionOsFrontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "transcriptionModel": "gpt-4o-mini-transcribe",
  "openaiApiKey": "sk-..."
}
```

Supported aliases are also accepted:

```json
{
  "frontendRoot": "/home/jbb/dev/EditorBP/decision-os/frontend",
  "DECISION_OS_FRONTEND_ROOT": "/home/jbb/dev/EditorBP/decision-os/frontend",
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
- When work changes server files or launches tests, create an isolated worktree under `<repo>/.worktrees/` before editing or testing. Commit the completed change in that worktree, merge the feature branch into the primary checkout with a merge commit, then remove the worktree and delete the merged feature branch. Never leave test worktrees or their build artifacts behind.
- When the operator asks to push committed work, push with the Wise SSH key:

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_jb_wise -o IdentitiesOnly=yes' git push
```

## Debugging

- Solve one problem at a time instead of trying to fix everything.
- List all possible options.
- Find what is wrong in the chain at a fundamental level.
- Choose one thing with the most yield, the least effort, the smallest amount of LOC, and the most structurally correcting change.
- After choosing a direction, expand your knowledge and check everything related so you do not miss critical elements.
- Correcting means fixing the technical debt.
- Do not propose hiding, disabling, or bypassing the behavior under investigation as an optimization. That is avoiding the bug, not solving it, unless the operator explicitly asks for a degraded-mode tradeoff.

## Code Smells

- It is a code smell to do expensive operations for many more elements than are needed in the end.

## Test Admission

Before typecheck or test suite:

```bash
node bin/decision-os-workload-status.mjs
```

- `GO`: start verification.
- `WAIT`: `sleep 5`; retry check. Do not start verification.
- No lock. Simultaneous `GO` remains possible.

## Verification Hygiene

- During implementation: run smallest relevant test files.
- Add and fix change-specific tests first.
- Typecheck once after code stabilizes. Scope changed package.
- Full suite once after implementation and focused tests pass.
- Failure: rerun smallest failing scope.
- Passing check: do not repeat after docs-only edits.

## Card Image Assets

Markdown image assets can be referenced from the active workspace `.decision-os` directory:

```markdown
![Campaign UI Summary](.decision-os/ui-mockups/campaign-ui-3-summary.png)
```

The backend serves image files from `/.decision-os/...` for the active workspace only. Adjacent standalone images, including image-only lines separated by blank lines, render as a carousel. Image frames resize by width, derive height from the loaded image aspect ratio, and persist dimensions in the card JSON under `imageSizes`, keyed by the markdown image URL.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-1","timestamp":"2026-07-07T18:25:59.179Z","status":"running","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"1","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-2","timestamp":"2026-07-07T18:25:59.179Z","status":"running","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"2","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-3","timestamp":"2026-07-07T17:00:47.694Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"3","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’ll use the `product-analysis` skill for this card, then inspect only codebase evidence plus the provided source card. I’ll write the analysis directly to the requested task-system card and leave ledgers/source cards alone.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-4","timestamp":"2026-07-07T17:00:47.695Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"4","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/.codex/skills/product-analysis/SKILL.md && pwd && rg --files -g '\"'!README*'\"' -g '\"'!**/.decision-os/**'\"' -g '\"'!**/docs/**'\"' -g '\"'!**/generated/**'\"' -g '\"'!**/dist/**'\"' -g '\"'!**/node_modules/**'\"' | sed -n '1,200p'\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/.codex/skills/product-analysis/SKILL.md && pwd && rg --files -g '"'!README*'"' -g '"'!**/.decision-os/**'"' -g '"'!**/docs/**'"' -g '"'!**/generated/**'"' -g '"'!**/dist/**'"' -g '"'!**/node_modules/**'"' | sed -n '1,200p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-5","timestamp":"2026-07-07T17:00:47.696Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"5","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/.codex/skills/product-analysis/SKILL.md && pwd && rg --files -g '\"'!README*'\"' -g '\"'!**/.decision-os/**'\"' -g '\"'!**/docs/**'\"' -g '\"'!**/generated/**'\"' -g '\"'!**/dist/**'\"' -g '\"'!**/node_modules/**'\"' | sed -n '1,200p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/.codex/skills/product-analysis/SKILL.md && pwd && rg --files -g '"'!README*'"' -g '"'!**/.decision-os/**'"' -g '"'!**/docs/**'"' -g '"'!**/generated/**'"' -g '"'!**/dist/**'"' -g '"'!**/node_modules/**'"' | sed -n '1,200p'"`
Status: completed
Exit code: 0

````text
---
name: product-analysis
description: Product analysis from codebase evidence. Use when mapping a goal or need to affected workflow, actor, linked specs, missing specs, and spec gaps without using documentation or inventing evidence.
---

# Product Analysis

Read the codebase. Do not use documentation, README files, generated docs, context reports, decision-os ledgers, decision-os cards, or decision-os threads unless the operator explicitly says to use them.

## Output

1. Goal/spec link: goal need, affected product area, affected workflow, affected actor or role, relevant context fact, current behavior, expected behavior, acceptance signal.

2. Linked specs: spec id, title, source, support/constrain/block/conflict/adjacent/non-goal, goal relevance.

3. Missing specs: implied requirement, missing acceptance signal, missing UX spec, missing technical spec, missing data spec, missing operational spec.

4. Spec gaps: contradiction, unknown, unverified fact, source gap, ownership gap, product-boundary decision, technical constraint, UX constraint, data constraint, dependency constraint.

## Rules

- Preserve existing spec IDs and titles.
- Do not invent specs, owners, metrics, or requirements.
- Mark missing evidence as unknown or unverified.
- Do not recommend a path, implementation plan, or approval gate.
/home/jbb/dev/EditorBP/decision-os
MIGRATE_RUNBOOK.md
tests/launcher/decision-os-server-launcher.spec.mjs
package.json
documentation/data.json
documentation/specs.json
ledger-cli/package.json
ledger-cli/bin/ledger-cli.ts
tests/browser/zone/zones-can-be-resized.spec.ts
tests/browser/zone/a-zone-can-be-deleted-from-the-edit-panel.spec.ts
tests/browser/zone/zones-are-first-class-canvas-objects.spec.ts
tests/browser/zone/zones-can-be-drawn-from-the-tool-box-zone-tool.spec.ts
tests/browser/zone/notes-opened-from-a-zone-target-that-zone-thread.spec.ts
tests/browser/zone/zone-is-a-primary-model-and-has-a-persistent-id.spec.ts
tests/browser/zone/zones-use-darker-transparent-fill-than-their-primary-border-color.spec.ts
tests/browser/zone/zones-can-contain-cards.spec.ts
tests/browser/zone/zone-drawing-button.spec.ts
tests/browser/zone/placing-a-zone-returns-to-select-tool.spec.ts
tests/browser/zone/zones-have-a-color.spec.ts
tests/browser/zone/zones-can-be-moved.spec.ts
tests/browser/zone/zone-position-and-geometry-is-persisted.spec.ts
tests/browser/zone/zones-can-be-created-on-the-canvas.spec.ts
tests/browser/zone/zone-labels-are-always-visible-at-the-same-size-for-any-zoom-level.spec.ts
tests/browser/zone/a-zone-has-an-edit-button.spec.ts
tests/browser/zone/zone-deletion-by-pressing-del-requires-a-confirmation-modal.spec.ts
tests/browser/zone/a-zone-has-a-notes-button-linked-to-a-thread.spec.ts
tests/browser/zone/zone-color-dragging-previews-without-replacing-the-color-input.spec.ts
tests/browser/zone/zones-are-rendered-behind-the-cards.spec.ts
tests/browser/zone/deleting-a-zone-does-not-delete-the-intersecting-cards.spec.ts
tests/browser/zone/zone-labels-keep-zone-color-with-minimum-brightness.spec.ts
tests/browser/zone/moving-a-zone-moves-the-zone-and-the-intersecting-cards.spec.ts
tests/browser/zone/zones-can-be-named.spec.ts
frontend/package.json
frontend/index.html
bin/normalize-card-heights.mjs
bin/decision-os-server.mjs
bin/ledger-cli.mjs
bin/save-html.mjs
tests/browser/selection/holding-ctrl-left-click-and-dragging-draws-a-selection-box.spec.ts
tests/browser/selection/ctrl-click-can-select-multiple-zones-and-cards.spec.ts
tests/browser/selection/connected-card-highlights-use-the-inherited-card-color-glow.spec.ts
tests/browser/selection/marquee-select.spec.ts
tests/browser/selection/direct-card-clicks-replace-active-zone-selection.spec.ts
tests/browser/selection/selecting-a-zone-selects-all-the-cards-intersecting-with-the-zone.spec.ts
tests/browser/selection/a-zone-can-be-deleted-by-pressing-del-while-selected.spec.ts
tests/tools/save-html.spec.mjs
tests/browser/selection/left-clicking-an-unselected-zone-and-dragging-pans-the-canvas.spec.ts
tests/browser/selection/copy-selection.spec.ts
tests/browser/selection/zone-resizing-uses-drag-n-drop-from-zone-corners-when-the-zone-is-selected.spec.ts
tests/browser/selection/selection-clear.spec.ts
tests/browser/selection/normal-zone-click-replaces-selection-with-intersecting-cards.spec.ts
tests/browser/selection/selecting-a-card-highlights-its-directly-connected-cards.spec.ts
AGENTS.md
tests/browser/selection/a-zone-must-be-selected-before-being-draggable.spec.ts
tests/browser/selection/selected-cards-show-their-hash-id-top-right.spec.ts
tests/browser/selection/mixed-selection.spec.ts
tests/browser/selection/a-selected-card-has-a-white-glowy-border.spec.ts
tests/browser/selection/escape-clear.spec.ts
tests/browser/selection/selected-zones-and-card-can-be-copied-with-ctrl-c-and-pasted-with-ctrl-v.spec.ts
tests/browser/selection/a-selected-zone-has-its-border-rendered-in-white-glow-and-the-resize-icon-at-corners.spec.ts
tests/browser/selection/dragging-an-unselected-card-selects-the-card-and-drags-it.spec.ts
tests/browser/selection/ctrl-click-zone-adds-intersecting-cards-to-the-existing-selection.spec.ts
tests/browser/selection/selecting-the-zone-tool-opens-the-color-picker.spec.ts
frontend/test/zone/zone-model.integration.test.ts
frontend/test/zone/zone-lifecycle.integration.test.ts
tests/browser/group/selecting-a-group-expands-selection-to-cards-and-zones-in-the-grouped-selection-scope.spec.ts
tests/browser/group/group-border-is-thicker-than-a-normal-zone-border.spec.ts
tests/browser/group/click-precedence-is-currently-card-regular-zone-group-background.spec.ts
tests/browser/group/group-tool-is-present-next-to-zone-in-the-core-toolbar.spec.ts
tests/browser/group/group-renders-behind-regular-zones.spec.ts
tests/browser/group/zones-and-groups-always-expose-an-edit-icon-for-name-and-zone-color-changes.spec.ts
tests/browser/group/group-selection-participates-in-the-existing-mixed-selection-drag-system.spec.ts
tests/browser/group/group-uses-the-same-title-structure-and-title-sizing-rules-as-zones.spec.ts
tests/browser/group/placing-a-group-returns-to-select-tool.spec.ts
tests/browser/group/clicking-group-arms-the-tool.spec.ts
tests/browser/group/groups-do-not-project-zone-visual-theming-onto-cards.spec.ts
tests/browser/group/clicking-exposed-group-background-targets-the-group.spec.ts
tests/browser/group/clicking-a-regular-zone-inside-a-group-targets-the-zone.spec.ts
tests/browser/group/after-group-selection-dragging-a-selected-inner-zone-moves-the-full-grouped-selection-together.spec.ts
tests/browser/group/group-background-is-transparent.spec.ts
tests/browser/group/group-renders-behind-cards.spec.ts
tests/browser/thread/thread-panel-opens-only-for-selection-or-thread-tool.spec.ts
tests/browser/group/group-draft-uses-canvas-local-pointer-origin.spec.ts
tests/browser/group/ctrl-click-on-a-group-toggles-that-expanded-membership-as-one-unit.spec.ts
tests/browser/thread/thread-terminal-uses-black-outer-shadow-and-input-only-inset-frame.spec.ts
tests/browser/group/clicking-a-card-inside-a-group-targets-the-card.spec.ts
tests/browser/thread/threads-preserve-operator-and-assistant-history.spec.ts
tests/browser/group/groups-can-be-resized-with-resize-handles.spec.ts
tests/browser/thread/thread-notes-are-composed-in-the-terminal-input-dock.spec.ts
tests/browser/thread/thread-header-shows-the-active-target-title.spec.ts
tests/browser/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.spec.ts
tests/browser/refresh/refresh.spec.ts
tests/browser/refresh/specs-and-data-ledgers-are-available-from-decision-os.spec.ts
ledger-cli/test/unit/ledger/helper/read-ledger-json.test.ts
tests/browser/thread/delete-note.spec.ts
tests/browser/thread/thread-terminal-inherits-the-active-target-color.spec.ts
tests/browser/thread/threads-are-a-primary-model.spec.ts
tests/browser/thread/right-thread-terminal-is-animated-and-one-third-width.spec.ts
tests/browser/thread/open-conversation-drawer.spec.ts
tests/browser/thread/conversation-ledger-button.spec.ts
tests/browser/thread/create-note.spec.ts
tests/browser/refresh/fetch-based-client-server-api-calls.spec.ts
frontend/test/selection/selection-tool-safety.integration.test.ts
tests/browser/toolbox/zone-confirmation-modal-can-process-keyboard-shortcuts.spec.ts
tests/browser/relationship/arrows-adapt-and-attach-to-the-better-suited-card-border.spec.ts
tests/browser/toolbox/the-toolbox-background-is-transparent.spec.ts
tests/browser/relationship/arrow-labels-can-be-hidden-per-arrow-with-their-own-display-state.spec.ts
tests/browser/toolbox/shortcut-help-button.spec.ts
tests/browser/relationship/relationship-labels-render-near-arrow-ports-and-preserve-relationship-source-context.spec.ts
tests/browser/toolbox/hovering-the-toolbox-animates-the-background-to-dark-grey.spec.ts
tests/browser/relationship/multiple-arrows-sharing-the-same-card-side-use-deterministic-spread-ports-instead-of-stacking.spec.ts
tests/browser/toolbox/refresh-button.spec.ts
tests/browser/relationship/arrow-markers-render-in-an-overlay.spec.ts
tests/browser/toolbox/tool-mode-switch.spec.ts
tests/browser/toolbox/runbook-button.spec.ts
tests/browser/relationship/arrows-attach-to-the-nearest-card-border-side-based-on-source-and-target-geometry.spec.ts
tests/browser/relationship/bidirectional-links-between-the-same-cards-use-separated-ports.spec.ts
tests/browser/relationship/arrows-should-try-to-avoid-colliding-with-cards.spec.ts
tests/browser/relationship/relationship-arrows-redraw-when-connected-cards-move.spec.ts
tests/browser/relationship/svg-relationship-arrow-rendering.spec.ts
tests/browser/relationship/relationship-arrows-reserve-marker-clearance-when-connected-cards-are-close.spec.ts
tests/browser/relationship/relationships-render-as-svg-bezier-arrows-between-card-borders.spec.ts
tests/browser/canvas/dom-based-canvas-rendering.spec.ts
tests/browser/canvas/scrolling-the-mouse-wheel-zooms-the-canvas.spec.ts
tests/browser/canvas/holding-ctrl-and-scrolling-the-mouse-wheel-moves-the-canvas-viewport.spec.ts
ledger-cli/test/unit/ledger/controller/manage-ledger-json.test.ts
ledger-cli/test/command/ledger-cli-command.test.ts
frontend/test/thread/thread-and-selection-actions.integration.test.ts
ledger-cli/test/command/card-status-command.test.ts
ledger-cli/test/command/assets-command.test.ts
ledger-cli/test/unit/ledger/effect/write-ledger-json.test.ts
tests/browser/canvas/clicking-canvas-background-clears-focus-and-selection.spec.ts
tests/browser/canvas/css-stylesheet-rendering-system.spec.ts
tests/browser/canvas/frameworkless-browser-client-runtime.spec.ts
tests/browser/canvas/dragging-elements-at-non-default-zoom-uses-canvas-space-deltas.spec.ts
tests/browser/canvas/no-bundler-required-runtime-path.spec.ts
tests/browser/canvas/node-test-runner-for-unit-and-browser-runtime-tests.spec.ts
tests/browser/canvas/playwright-for-real-browser-interaction-tests.spec.ts
tests/browser/canvas/canvas-ui-uses-ubuntu-font.spec.ts
tests/browser/canvas/left-clicking-naked-canvas-and-dragging-pans-the-canvas.spec.ts
tests/browser/canvas/frontend-implementation-is-typescript.spec.ts
tests/browser/canvas/the-canvas-has-a-dark-honeycomb-background.spec.ts
tests/browser/canvas/honeycomb-background-tiling-scales-with-canvas-zoom.spec.ts
tests/browser/canvas/browser-typescript-client-runtime.spec.ts
tests/browser/canvas/holding-shift-and-dragging-pans-from-any-target.spec.ts
tests/browser/canvas/mouse-wheel-zoom-preserves-cursor-anchored-canvas-point.spec.ts
ledger-cli/package-lock.json
tests/browser/navigation/navigation-persistence.spec.ts
tests/browser/navigation/the-active-tab-is-derived-from-the-browser-path.spec.ts
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts
tests/browser/navigation/cards-have-a-tab-system.spec.ts
tests/browser/navigation/tab-click-loads-the-active-ledger-graph-into-the-canvas.spec.ts
tests/browser/navigation/navigation.spec.ts
tests/browser/navigation/tab-switch.spec.ts
tests/browser/navigation/tabs-are-route-addressable.spec.ts
tests/browser/navigation/the-navbar-renders-the-tab-registry.spec.ts
tests/browser/voice/voice-recording-failures-are-surfaced-to-the-operator.spec.ts
tests/browser/voice/voice-transcription-timeout-exposes-retry.spec.ts
tests/browser/voice/only-one-voice-recording-is-active-at-a-time.spec.ts
tests/browser/voice/voice-recording-shows-live-duration-and-level-telemetry.spec.ts
tests/browser/voice/voice-recording-is-thread-scoped.spec.ts
tests/browser/voice/voice-transcription-is-optional-and-configuration-gated.spec.ts
tests/browser/voice/transcribed-voice-text-fills-the-active-thread-draft.spec.ts
tests/browser/voice/stopping-a-voice-recording-routes-the-captured-audio-to-transcription.spec.ts
tests/browser/voice/voice-dock-renders-live-capture-state-not-mock-content.spec.ts
tests/browser/voice/voice-audio-is-transient-until-transcription-completes.spec.ts
tests/browser/voice/voice-transcription-upload-is-optimistic.spec.ts
tests/browser/voice/voice-transcription-status-is-visible-in-the-ui.spec.ts
tests/browser/voice/voice-terminal-shortcuts-use-x-and-esc.spec.ts
tests/browser/voice/threads-support-voice-recording.spec.ts
tests/browser/voice/voice-composer-uses-the-droidfleet-terminal-dock.spec.ts
ledger-cli/tsconfig.json
tests/browser/card/card-is-a-primary-model-and-has-a-persistent-id.spec.ts
tests/browser/card/cards-have-labels-show-top-right.spec.ts
tests/browser/card/hash-id-is-displayed-top-right-in-a-smaller-font-grey.spec.ts
tests/browser/card/cards-from-the-base-card-class-can-be-extended-for-sub-modules.spec.ts
tests/browser/card/card-positions-are-persisted-in-a-json-ledger.spec.ts
tests/browser/card/cards-can-be-resized.spec.ts
tests/browser/card/an-open-card-is-shown-on-top-of-everything-with-max-z-index.spec.ts
tests/browser/card/hovering-a-card-shows-its-hash-id.spec.ts
tests/browser/card/clicking-on-card-notes-opens-the-card-thread-in-the-right-panel.spec.ts
tests/browser/card/cards-indicate-when-the-latest-thread-answer-is-from-the-agent.spec.ts
tests/browser/card/cards-have-a-discussion-thread.spec.ts
tests/browser/card/cards-visually-inherit-the-color-of-the-regular-zone-they-intersect.spec.ts
tests/browser/card/notes-opened-from-a-card-target-that-card-thread.spec.ts
tests/browser/card/card-descriptions-are-parsed-and-rendered-as-markdown.spec.ts
tests/browser/card/card-position-is-persisted.spec.ts
tests/browser/card/canvas-cards-do-not-render-high-definition-when-it-is-not-needed.spec.ts
tests/browser/card/persisted-card-positions-are-restored-on-reload.spec.ts
tests/browser/card/the-default-tab-for-the-base-card-class-is-notes.spec.ts
tests/browser/card/notes-clicked-from-an-unselected-card-opens-its-thread-inspector.spec.ts
tests/browser/card/canvas-card-rendering-is-optimized-for-high-performance.spec.ts
tests/browser/card/a-card-is-drag-and-drop-enabled.spec.ts
tests/browser/card/the-conversation-ledger-aggregates-card-and-zone-threads.spec.ts
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts
tools/ledger-thread-file-migration/migrate-thread-notes.mjs
tools/live-verify/summary.mjs
tools/unit-coverage/function/list-source-function-files.mjs
tools/live-verify/zoom-pan-trace.mjs
tools/unit-coverage/function/build-unit-coverage-report.mjs
frontend/test/unit/zone/helper/resolve-zone-selection-membership.test.ts
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-6","timestamp":"2026-07-07T17:00:47.697Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"6","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_2"} -->

I’ve loaded the skill instructions. Next I’m narrowing on code that defines routes/tabs, process/task views, card creation, and any Codex/headless execution hooks so the final card stays evidence-based.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-7","timestamp":"2026-07-07T17:00:47.698Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"7","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"process|pipeline|stage|skill|codex|headless|agent|task-system|performances|specs|data\\\" frontend backend ledger-cli bin tests -g '\"'!**/node_modules/**'\"' -g '\"'!**/dist/**'\"'\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"process|pipeline|stage|skill|codex|headless|agent|task-system|performances|specs|data\" frontend backend ledger-cli bin tests -g '"'!**/node_modules/**'"' -g '"'!**/dist/**'"'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-8","timestamp":"2026-07-07T17:00:47.699Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"8","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"process|pipeline|stage|skill|codex|headless|agent|task-system|performances|specs|data\\\" frontend backend ledger-cli bin tests -g '\"'!**/node_modules/**'\"' -g '\"'!**/dist/**'\"'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"process|pipeline|stage|skill|codex|headless|agent|task-system|performances|specs|data\" frontend backend ledger-cli bin tests -g '"'!**/node_modules/**'"' -g '"'!**/dist/**'"'"`
Status: completed
Exit code: 0

````text
tests/launcher/decision-os-server-launcher.spec.mjs:7:import { execFileSync } from 'node:child_process';
tests/launcher/decision-os-server-launcher.spec.mjs:15:    const output = execFileSync(process.execPath, [resolve('bin/decision-os-server.mjs'), '--print-command'], { cwd: workspace, encoding: 'utf8' });
bin/normalize-card-heights.mjs:9:import { spawn } from 'node:child_process';
bin/normalize-card-heights.mjs:12:  const index = process.argv.indexOf(name);
bin/normalize-card-heights.mjs:13:  return index === -1 ? '' : process.argv[index + 1] ?? '';
bin/normalize-card-heights.mjs:40:    const message = JSON.parse(event.data);
bin/normalize-card-heights.mjs:78:      expression: `(() => ({ ready: document.readyState, cards: document.querySelectorAll('.card[data-card-id]').length }))()`,
bin/normalize-card-heights.mjs:91:    '--headless=new',
bin/normalize-card-heights.mjs:96:    `--user-data-dir=${profile}`,
bin/normalize-card-heights.mjs:118:          const card = document.querySelector(\`[data-card-id="\${CSS.escape(id)}"]\`);
bin/normalize-card-heights.mjs:158:  process.exit(1);
bin/normalize-card-heights.mjs:176:  process.exit(0);
bin/decision-os-server.mjs:6:import { spawn } from 'node:child_process';
bin/decision-os-server.mjs:15:    ...process.env,
bin/decision-os-server.mjs:16:    DECISION_OS_FRONTEND_ROOT: process.env.DECISION_OS_FRONTEND_ROOT ?? resolve(repoRoot, 'frontend'),
bin/decision-os-server.mjs:17:    TSX_TSCONFIG_PATH: process.env.TSX_TSCONFIG_PATH ?? resolve(repoRoot, 'backend/tsconfig.json')
bin/decision-os-server.mjs:19:  if (process.argv.includes('--print-command')) {
bin/decision-os-server.mjs:20:    console.log(JSON.stringify({ node: process.execPath, args: ['--import', loader, server], env: { DECISION_OS_FRONTEND_ROOT: env.DECISION_OS_FRONTEND_ROOT, TSX_TSCONFIG_PATH: env.TSX_TSCONFIG_PATH }, cwd: process.cwd() }));
bin/decision-os-server.mjs:23:  const child = spawn(process.execPath, ['--import', loader, server, ...process.argv.slice(2)], { env, stdio: 'inherit' });
bin/decision-os-server.mjs:24:  child.on('exit', (code) => process.exit(code ?? 0));
bin/ledger-cli.mjs:6:import { spawnSync } from 'node:child_process';
bin/ledger-cli.mjs:13:const result = spawnSync(process.execPath, ['--import', loader, entrypoint, ...process.argv.slice(2)], {
bin/ledger-cli.mjs:14:  cwd: process.cwd(),
bin/ledger-cli.mjs:16:  env: process.env,
bin/ledger-cli.mjs:20:  process.exitCode = result.status;
bin/ledger-cli.mjs:23:  process.exitCode = 1;
bin/save-html.mjs:7:import { execFile } from 'node:child_process';
bin/save-html.mjs:15:  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
bin/save-html.mjs:45:    '--user-agent',
bin/save-html.mjs:46:    headers['user-agent'],
bin/save-html.mjs:108:  const args = parseArgs(process.argv.slice(2));
bin/save-html.mjs:115:    process.exitCode = 1;
bin/save-html.mjs:123:    process.exitCode = 1;
tests/tools/save-html.spec.mjs:7:import { execFile } from 'node:child_process';
tests/tools/save-html.spec.mjs:32:    const { stdout } = await execFileAsync(process.execPath, [resolve('bin/save-html.mjs'), `http://127.0.0.1:${address.port}/page`, outputPath], { encoding: 'utf8' });
tests/tools/save-html.spec.mjs:44:    execFileAsync(process.execPath, [resolve('bin/save-html.mjs'), 'http://127.0.0.1/'], { encoding: 'utf8' }),
frontend/index.html:13:        <button class="tool rail-toggle" type="button" data-action="toggle-rail" title="Collapse toolbox" aria-controls="toolbox-rail" aria-expanded="true"><span>‹</span><span class="rail-toggle-label">Collapse</span></button>
frontend/index.html:14:        <button class="tool active" type="button" data-tool="select" title="Select" data-spec="40000007"><span>↖</span><span>Select</span></button>
frontend/index.html:15:        <button class="tool" type="button" data-tool="card" title="Card"><span>▤</span><span>Card</span></button>
frontend/index.html:16:        <button class="tool" type="button" data-tool="zone" title="Zone" data-spec="e0b4d11a 20000014 bd0651aa"><span>▣</span><span>Zone</span></button>
frontend/index.html:17:        <button class="tool" type="button" data-tool="group" title="Group" data-spec="53d49146 90d84349"><span>◎</span><span>Group</span></button>
frontend/index.html:18:        <button class="tool" type="button" data-tool="relationship" title="Relationship" data-spec="61bea65c 9bd42e71"><span>↗</span><span>Link</span></button>
frontend/index.html:19:        <button class="tool" type="button" data-action="resize" title="Resize selected cards"><span>↕</span><span>Resize</span></button>
frontend/index.html:20:        <button class="tool" type="button" data-action="open-ledgers-canvas" title="Ledgers"><span>▦</span><span>Ledgers</span></button>
frontend/index.html:21:        <button class="tool" type="button" data-action="refresh" title="Refresh" data-spec="cfed85d3 50000006"><span>⟳</span><span>Refresh</span></button>
frontend/index.html:22:        <button class="tool" type="button" data-tool="thread" data-action="conversation" title="Conversation ledger" data-spec="7abd939e 667ae9a9 2b67c924"><span>☰</span><span>Threads</span></button>
frontend/index.html:23:        <button class="tool" type="button" data-action="shortcut-help" title="Shortcut help" data-spec="33c20993"><span>⌘</span><span>Keys</span></button>
frontend/index.html:24:        <button class="tool" type="button" data-action="runbook" title="Runbook" data-spec="676c6a7a"><span>?</span><span>Runbook</span></button>
frontend/index.html:25:        <label class="color-picker" hidden data-spec="9f9279ff 20000014">
frontend/index.html:26:          <input type="color" value="#55b8ff" data-action="zone-color" aria-label="Zone color">
frontend/index.html:33:            <h1><button class="topbar-title-action" type="button" data-action="open-ledgers-canvas">Ledger</button></h1>
frontend/index.html:35:          <nav class="tabs" aria-label="Open ledgers" data-spec="12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1"></nav>
frontend/index.html:37:        <section class="canvas" aria-label="Canvas" tabindex="0" data-spec="30000002 30000003 30000005 30000006 30000007 a25db692 74567497 b7c2e91f b3d8a5e1">
frontend/index.html:39:            <div class="grid" aria-hidden="true" data-spec="30000007 bf394c62"></div>
frontend/index.html:40:            <article class="zone regular-zone" data-zone-id="zone-frontend" data-thread-id="thread-zone-frontend" data-spec="20000001 20000003 20000004 20000008 20000013 2000000a 2000000b 2000000c 2000000d 2000000e 2000000f 20000010 20000011 20000017 86e67c0e d5c8ece7 ce0c5d80 30000004 8f43d21c 5ac8d0f1 3fd7a96a">
frontend/index.html:48:            <article class="zone group-zone" data-group-id="group-core" data-thread-id="thread-group-core" data-spec="1d444573 796827d0 4801e6c7 85c81d67 0421d906 dff19657 d9d57c2c 2476bfa1 d2fbfa28 612afeda 8a05ef46 5b918cd3 d4f90f42 abad6dcb f18da923 c271a0df 3fd7a96a">
frontend/index.html:55:            <article class="zone regular-zone" data-zone-id="zone-backend" data-thread-id="thread-zone-backend" data-spec="20000007 20000009 20000017 20000018 8f43d21c 5ac8d0f1 3fd7a96a">
frontend/index.html:63:            <article class="card" data-card-id="card-boot" data-thread-id="thread-card-boot" data-card-class="base-card" data-spec="60000001 60000002 60000003 60000004 60000005 60000006 60000009 60000010 a946fbe0 aa42ff94 4dfbf38c d0936729 30000008 30000009 a4f8d2c9 7b2e4c90 6e18b4d2">
frontend/index.html:64:              <div class="resize-handle nw" data-spec="60000006"></div>
frontend/index.html:65:              <div class="resize-handle ne" data-spec="60000006"></div>
frontend/index.html:66:              <div class="resize-handle sw" data-spec="60000006"></div>
frontend/index.html:67:              <div class="resize-handle se" data-spec="60000006"></div>
frontend/index.html:69:              <p data-markdown-source="# Boot surface">Load ledger, derive route, clear transient selection, render canvas.</p>
frontend/index.html:70:              <div class="card-actions"><button type="button" data-action="open-card-thread">Notes</button></div>
frontend/index.html:72:            <article class="card" data-card-id="card-zone" data-thread-id="thread-card-zone" data-card-class="zone-card" data-spec="60000006 6000000a 6000000b 6000000c 6000000d 6000000e 6000000f cd58fd49">
frontend/index.html:73:              <div class="resize-handle nw" data-spec="60000006"></div>
frontend/index.html:74:              <div class="resize-handle ne" data-spec="60000006"></div>
frontend/index.html:75:              <div class="resize-handle sw" data-spec="60000006"></div>
frontend/index.html:76:              <div class="resize-handle se" data-spec="60000006"></div>
frontend/index.html:79:              <div class="card-actions"><button type="button" data-action="open-card-thread">Notes</button></div>
frontend/index.html:81:            <article class="card" data-card-id="card-ledger" data-thread-id="thread-card-ledger" data-spec="60000006 70000001 70000002 70000003 70000004 70000005 70000006 70000007">
frontend/index.html:82:              <div class="resize-handle nw" data-spec="60000006"></div>
frontend/index.html:83:              <div class="resize-handle ne" data-spec="60000006"></div>
frontend/index.html:84:              <div class="resize-handle sw" data-spec="60000006"></div>
frontend/index.html:85:              <div class="resize-handle se" data-spec="60000006"></div>
frontend/index.html:88:              <div class="card-actions"><button type="button" data-action="open-card-thread">Notes</button></div>
frontend/index.html:91:            <svg class="relationships" width="5200" height="2600" viewBox="0 0 5200 2600" role="img" aria-label="Relationships" data-spec="61bea65c 81557a54 708a7bfc 53dc0295 6f01b700 47237c02 5027f419 b200b57e ba1544b0 f93e1bb7 1d6f456a 9bd42e71 3f9c2a11">
frontend/index.html:97:              <path data-relationship-id="rel-boot-zone" data-source="card-boot" data-target="card-zone" data-relationship-label-text="hydrates" marker-start="url(#static-arrow)" marker-end="url(#static-arrow)" d="M 375 250 C 500 210, 600 210, 725 250"></path>
frontend/index.html:98:              <path data-relationship-id="rel-zone-ledger" data-source="card-zone" data-target="card-ledger" data-relationship-label-text="persists" marker-start="url(#static-arrow)" marker-end="url(#static-arrow)" d="M 360 455 C 520 570, 680 570, 840 455"></path>
frontend/index.html:107:          <p class="kicker" data-spec="c90ad7e1 72af9d0b">Telemetry</p>
frontend/index.html:111:        <section class="thread-panel agent-chat phone" hidden data-spec="eaced0c9 667ae9a9 5f8c7152 cc7ed3b4 7984a4f3 50000013 50000014 50000015 50000016 6583c446 2b67c924 74c3e1b8 e3a71d5c 9c44b0a1 d8d1f4a2 3f0c9e77 f72a6d31 5e6a9b23 e0f4c8a7 a4d9e2b6">
frontend/index.html:120:          <footer class="io voice-panel" data-spec="d38927c1 747b461e 3d074416 040cef84 8b1ff788 6cc37b58 828e6225 c0c42d20 5c4e5c22 21b2b050 b5a783cd 2a9d6f41 b8d4f0a2 c6f91a24 9c44b0a1 d8d1f4a2 e0f4c8a7"></footer>
frontend/index.html:123:      <dialog class="confirm-modal" data-spec="20000012 20000015 20000016">
frontend/index.html:125:        <button type="button" data-action="confirm-delete">Delete</button>
frontend/index.html:126:        <button type="button" data-action="cancel-delete">Cancel</button>
frontend/index.html:128:      <dialog class="shortcut-modal" data-spec="33c20993" aria-labelledby="shortcut-modal-title">
frontend/index.html:139:        <button type="button" data-action="close-shortcut-help">Close</button>
frontend/index.html:141:      <dialog class="runbook-modal" data-spec="676c6a7a" aria-labelledby="runbook-modal-title">
frontend/index.html:159:        <button type="button" data-action="close-runbook">Close</button>
frontend/index.html:161:      <dialog class="skill-modal" aria-labelledby="skill-modal-title"></dialog>
backend/test/codex/start-card-skill-process-controller.test.ts:20:test('card skill process route creates a linked output card and launches codex', async () => {
backend/test/codex/start-card-skill-process-controller.test.ts:21:  const originalCwd = process.cwd();
backend/test/codex/start-card-skill-process-controller.test.ts:22:  const previousCodexBin = process.env.CODEX_BIN;
backend/test/codex/start-card-skill-process-controller.test.ts:23:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-'));
backend/test/codex/start-card-skill-process-controller.test.ts:24:  const fakeCodex = join(workspace, 'fake-codex.mjs');
backend/test/codex/start-card-skill-process-controller.test.ts:26:  mkdirSync(join(workspace, '.skills', 'test-skill'), { recursive: true });
backend/test/codex/start-card-skill-process-controller.test.ts:27:  writeFileSync(join(workspace, '.skills', 'test-skill', 'SKILL.md'), [
backend/test/codex/start-card-skill-process-controller.test.ts:29:    'name: test-skill',
backend/test/codex/start-card-skill-process-controller.test.ts:30:    'description: Test skill description',
backend/test/codex/start-card-skill-process-controller.test.ts:35:    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/codex/start-card-skill-process-controller.test.ts:37:  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
backend/test/codex/start-card-skill-process-controller.test.ts:57:    'process.stdin.on("data", (chunk) => { input += chunk; });',
backend/test/codex/start-card-skill-process-controller.test.ts:58:    'process.stdin.on("end", () => {',
backend/test/codex/start-card-skill-process-controller.test.ts:60:    '  if (!match) process.exit(2);',
backend/test/codex/start-card-skill-process-controller.test.ts:61:    '  const args = process.argv.slice(2);',
backend/test/codex/start-card-skill-process-controller.test.ts:64:    '  writeFileSync(match[1].trim(), "# Fake Result\\n\\n" + (input.includes("$test-skill") ? "skill seen" : "skill missing") + "\\nmodel=" + model + "\\neffort=" + effort + "\\n");',
backend/test/codex/start-card-skill-process-controller.test.ts:65:    '  console.log(JSON.stringify({ type: "fake-codex-done" }));',
backend/test/codex/start-card-skill-process-controller.test.ts:70:  process.chdir(workspace);
backend/test/codex/start-card-skill-process-controller.test.ts:71:  process.env.CODEX_BIN = fakeCodex;
backend/test/codex/start-card-skill-process-controller.test.ts:79:    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/process`, {
backend/test/codex/start-card-skill-process-controller.test.ts:82:      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'test-skill', codexModel: 'gpt-5.4', codexEffort: 'xhigh' })
backend/test/codex/start-card-skill-process-controller.test.ts:85:    const body = await response.json() as { ok: boolean; run: { outputCardId: string; outputFile: string; codexModel: string; codexEffort: string } };
backend/test/codex/start-card-skill-process-controller.test.ts:89:    assert.equal(body.run.codexModel, 'gpt-5.4');
backend/test/codex/start-card-skill-process-controller.test.ts:90:    assert.equal(body.run.codexEffort, 'xhigh');
backend/test/codex/start-card-skill-process-controller.test.ts:92:    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as {
backend/test/codex/start-card-skill-process-controller.test.ts:97:    assert.equal(ledger.relationships.some((relationship) => relationship.from === 'source-card' && relationship.to === body.run.outputCardId && relationship.label === 'test-skill'), true);
backend/test/codex/start-card-skill-process-controller.test.ts:100:    await waitForText(body.run.outputFile, 'skill seen');
backend/test/codex/start-card-skill-process-controller.test.ts:105:    process.chdir(originalCwd);
backend/test/codex/start-card-skill-process-controller.test.ts:106:    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
backend/test/codex/start-card-skill-process-controller.test.ts:107:    else process.env.CODEX_BIN = previousCodexBin;
tests/browser/toolbox/zone-confirmation-modal-can-process-keyboard-shortcuts.spec.ts:2: * WHAT: Integration test for spec 20000015: zone confirmation modal can process keyboard shortcuts.
tests/browser/toolbox/zone-confirmation-modal-can-process-keyboard-shortcuts.spec.ts:9:test('zone confirmation modal can process keyboard shortcuts', async () => {
tests/browser/toolbox/zone-confirmation-modal-can-process-keyboard-shortcuts.spec.ts:10:  await assertFrontendSpec('zone confirmation modal can process keyboard shortcuts', '20000015', 'zone');
backend/test/codex/scan-codex-skills.test.ts:6:import { scanCodexSkills } from '@backend/business/codex/helper/scan-codex-skills.js';
backend/test/codex/scan-codex-skills.test.ts:8:test('scanCodexSkills reads workspace user and plugin skill frontmatter', () => {
backend/test/codex/scan-codex-skills.test.ts:9:  const previousCodexHome = process.env.CODEX_HOME;
backend/test/codex/scan-codex-skills.test.ts:10:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skills-workspace-'));
backend/test/codex/scan-codex-skills.test.ts:11:  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-skills-home-'));
backend/test/codex/scan-codex-skills.test.ts:14:    process.env.CODEX_HOME = codexHome;
backend/test/codex/scan-codex-skills.test.ts:15:    mkdirSync(join(workspace, '.skills', 'duplicate-skill'), { recursive: true });
backend/test/codex/scan-codex-skills.test.ts:16:    mkdirSync(join(codexHome, 'skills', 'duplicate-skill'), { recursive: true });
backend/test/codex/scan-codex-skills.test.ts:17:    mkdirSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill'), { recursive: true });
backend/test/codex/scan-codex-skills.test.ts:19:    writeFileSync(join(workspace, '.skills', 'duplicate-skill', 'SKILL.md'), [
backend/test/codex/scan-codex-skills.test.ts:21:      'name: duplicate-skill',
backend/test/codex/scan-codex-skills.test.ts:22:      'description: Workspace skill wins',
backend/test/codex/scan-codex-skills.test.ts:26:    writeFileSync(join(codexHome, 'skills', 'duplicate-skill', 'SKILL.md'), [
backend/test/codex/scan-codex-skills.test.ts:28:      'name: duplicate-skill',
backend/test/codex/scan-codex-skills.test.ts:29:      'description: User skill loses',
backend/test/codex/scan-codex-skills.test.ts:33:    writeFileSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill', 'SKILL.md'), [
backend/test/codex/scan-codex-skills.test.ts:35:      'name: plugin-skill',
backend/test/codex/scan-codex-skills.test.ts:36:      'description: Plugin skill description',
backend/test/codex/scan-codex-skills.test.ts:41:    const skills = scanCodexSkills({ workspaceRoot: workspace });
backend/test/codex/scan-codex-skills.test.ts:42:    const duplicate = skills.find((skill) => skill.name === 'duplicate-skill');
backend/test/codex/scan-codex-skills.test.ts:43:    const plugin = skills.find((skill) => skill.name === 'plugin-skill');
backend/test/codex/scan-codex-skills.test.ts:45:    assert.equal(duplicate?.description, 'Workspace skill wins');
backend/test/codex/scan-codex-skills.test.ts:47:    assert.equal(plugin?.description, 'Plugin skill description');
backend/test/codex/scan-codex-skills.test.ts:50:    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
backend/test/codex/scan-codex-skills.test.ts:51:    else process.env.CODEX_HOME = previousCodexHome;
backend/test/codex/scan-codex-skills.test.ts:53:    rmSync(codexHome, { recursive: true, force: true });
ledger-cli/src/business/migration/controller/manage-decision-os-migration.ts:1:import { execFile } from 'node:child_process';
ledger-cli/src/business/migration/controller/manage-decision-os-migration.ts:115:  const workspaceRoot = resolve(operation?.root ?? process.cwd());
backend/test/codex/read-card-skill-run-controller.test.ts:11:test('card skill run route derives JSONL progress and persists thread notes', async () => {
backend/test/codex/read-card-skill-run-controller.test.ts:12:  const originalCwd = process.cwd();
backend/test/codex/read-card-skill-run-controller.test.ts:13:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-'));
backend/test/codex/read-card-skill-run-controller.test.ts:16:  const runId = `codex-skill-${startedAt}-feed1234`;
backend/test/codex/read-card-skill-run-controller.test.ts:18:  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
backend/test/codex/read-card-skill-run-controller.test.ts:21:    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/codex/read-card-skill-run-controller.test.ts:23:  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
backend/test/codex/read-card-skill-run-controller.test.ts:27:      cardType: 'codex-skill-run',
backend/test/codex/read-card-skill-run-controller.test.ts:28:      comment: { what: '# Finished Skill Result\n\nThe final card body replaced the initial run metadata.' },
backend/test/codex/read-card-skill-run-controller.test.ts:36:  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
backend/test/codex/read-card-skill-run-controller.test.ts:37:  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
backend/test/codex/read-card-skill-run-controller.test.ts:40:    JSON.stringify({ type: 'item.completed', item: { id: 'msg-1', type: 'agent_message', text: 'Thinking text persisted.' } }),
backend/test/codex/read-card-skill-run-controller.test.ts:49:  process.chdir(workspace);
backend/test/codex/read-card-skill-run-controller.test.ts:57:    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}&since=2`);
backend/test/codex/read-card-skill-run-controller.test.ts:65:      agentMessageCount: number;
backend/test/codex/read-card-skill-run-controller.test.ts:74:    assert.equal(body.agentMessageCount, 1);
backend/test/codex/read-card-skill-run-controller.test.ts:78:    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { threadFiles?: Record<string, string> };
backend/test/codex/read-card-skill-run-controller.test.ts:79:    assert.equal(ledger.threadFiles?.[`thread-${outputCardId}`], `.decision-os/threads/specs/thread-${outputCardId}.md`);
backend/test/codex/read-card-skill-run-controller.test.ts:80:    const thread = readFileSync(join(workspace, '.decision-os', 'threads', 'specs', `thread-${outputCardId}.md`), 'utf8');
backend/test/codex/read-card-skill-run-controller.test.ts:81:    assert.match(thread, /"codexKind":"agent_message"/);
backend/test/codex/read-card-skill-run-controller.test.ts:82:    assert.match(thread, /"codexKind":"tool_call"/);
backend/test/codex/read-card-skill-run-controller.test.ts:85:    assert.match(thread, /"codexKind":"file_change"/);
backend/test/codex/read-card-skill-run-controller.test.ts:89:    process.chdir(originalCwd);
tests/browser/refresh/specs-and-data-ledgers-are-available-from-decision-os.spec.ts:2: * WHAT: Integration test for spec c5a84d77: Specs and data ledgers are available from decision-os .decision-os.
tests/browser/refresh/specs-and-data-ledgers-are-available-from-decision-os.spec.ts:9:test('Specs and data ledgers are available from decision-os .decision-os', async () => {
tests/browser/refresh/specs-and-data-ledgers-are-available-from-decision-os.spec.ts:10:  await assertFrontendSpec('Specs and data ledgers are available from decision-os .decision-os', 'c5a84d77', 'refresh');
backend/test/codex/resolve-codex-command.test.ts:6:import { resolveCodexCommand } from '@backend/business/codex/helper/resolve-codex-command.js';
backend/test/codex/resolve-codex-command.test.ts:9:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-command-'));
backend/test/codex/resolve-codex-command.test.ts:10:  const bin = join(workspace, 'codex-bin');
backend/test/codex/resolve-codex-command.test.ts:11:  const previousCodexBin = process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:12:  const previousCodexModel = process.env.CODEX_MODEL;
backend/test/codex/resolve-codex-command.test.ts:13:  const previousCodexEffort = process.env.CODEX_EFFORT;
backend/test/codex/resolve-codex-command.test.ts:15:    delete process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:16:    delete process.env.CODEX_MODEL;
backend/test/codex/resolve-codex-command.test.ts:17:    delete process.env.CODEX_EFFORT;
backend/test/codex/resolve-codex-command.test.ts:20:    const command = resolveCodexCommand({ workspaceRoot: workspace, runtime: { decisionOsSettings: { codexBin: bin, codexModel: 'gpt-5.4', codexReasoningEffort: 'low' } } });
backend/test/codex/resolve-codex-command.test.ts:27:    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:28:    else process.env.CODEX_BIN = previousCodexBin;
backend/test/codex/resolve-codex-command.test.ts:29:    if (previousCodexModel === undefined) delete process.env.CODEX_MODEL;
backend/test/codex/resolve-codex-command.test.ts:30:    else process.env.CODEX_MODEL = previousCodexModel;
backend/test/codex/resolve-codex-command.test.ts:31:    if (previousCodexEffort === undefined) delete process.env.CODEX_EFFORT;
backend/test/codex/resolve-codex-command.test.ts:32:    else process.env.CODEX_EFFORT = previousCodexEffort;
backend/test/codex/resolve-codex-command.test.ts:38:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-command-'));
backend/test/codex/resolve-codex-command.test.ts:42:      runtime: { decisionOsSettings: { codexModel: 'gpt-5.4', codexReasoningEffort: 'low' } },
backend/test/codex/resolve-codex-command.test.ts:43:      codexModel: 'gpt-5.5',
backend/test/codex/resolve-codex-command.test.ts:44:      codexEffort: 'xhigh'
backend/test/codex/resolve-codex-command.test.ts:57:  const adjacentCodex = resolve(dirname(process.execPath), 'codex');
backend/test/codex/resolve-codex-command.test.ts:59:  const previousPath = process.env.PATH;
backend/test/codex/resolve-codex-command.test.ts:60:  const previousCodexBin = process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:62:    process.env.PATH = '/usr/bin';
backend/test/codex/resolve-codex-command.test.ts:63:    delete process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:64:    const command = resolveCodexCommand({ workspaceRoot: process.cwd(), runtime: {} });
backend/test/codex/resolve-codex-command.test.ts:67:    if (previousPath === undefined) delete process.env.PATH;
backend/test/codex/resolve-codex-command.test.ts:68:    else process.env.PATH = previousPath;
backend/test/codex/resolve-codex-command.test.ts:69:    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:70:    else process.env.CODEX_BIN = previousCodexBin;
frontend/test/zone/zone-model.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:3: * WHY: Specs and data tabs must map to the hidden decision-os .decision-os ledgers.
frontend/test/zone/zone-lifecycle.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
ledger-cli/src/business/ledger/helper/append-thread-answer.ts:2: * WHAT: Appends an agent answer note to a ledger thread.
ledger-cli/src/business/ledger/helper/append-thread-answer.ts:3: * WHY: agents answer operator prompts by writing back into the ledger communication layer.
ledger-cli/src/business/ledger/helper/append-thread-answer.ts:36:    id: `note-agent-${Date.now()}-${randomUUID()}`,
ledger-cli/src/business/ledger/helper/append-thread-answer.ts:37:    role: 'agent',
ledger-cli/src/business/ledger/helper/format-unanswered-threads.ts:2: * WHAT: Formats unanswered thread records for operator and agent command-line use.
ledger-cli/src/business/ledger/helper/format-unanswered-threads.ts:3: * WHY: agents need thread ids, content file paths, and exact patch instructions for direct Markdown replies.
ledger-cli/src/business/ledger/helper/format-unanswered-threads.ts:13:  if (threads.length === 0) return 'No threads awaiting agent answer.';
ledger-cli/src/business/ledger/helper/format-unanswered-threads.ts:14:  const lines = [`Threads awaiting agent answer (${threads.length})`];
frontend/test/selection/selection-tool-safety.integration.test.ts:23:    specs_ledger_file: 'generated-specs-ledger.json',
backend/test/unit/routing/helper/parse-http-request.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
ledger-cli/bin/ledger-cli.ts:8:const result = await dispatchLedgerCliCommandController(process.argv.slice(2));
ledger-cli/bin/ledger-cli.ts:14:  process.exitCode = 1;
ledger-cli/src/business/ledger/helper/format-ledger-markdown-export.ts:71:function metadataLines(card: JsonObject): string[] {
ledger-cli/src/business/ledger/helper/format-ledger-markdown-export.ts:160:  const metadata = metadataLines(card);
ledger-cli/src/business/ledger/helper/format-ledger-markdown-export.ts:161:  if (metadata.length > 0) lines.push(...metadata, '');
backend/test/unit/routing/helper/resolve-ledger-route.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/thread/thread-and-selection-actions.integration.test.ts:23:    specs_ledger_file: 'generated-specs-ledger.json',
ledger-cli/src/business/ledger/helper/find-unanswered-threads.ts:2: * WHAT: Finds ledger threads with meaningful notes awaiting an agent answer.
ledger-cli/src/business/ledger/helper/find-unanswered-threads.ts:3: * WHY: the ledger acts as the operator-to-agent communication queue.
ledger-cli/src/business/ledger/helper/find-unanswered-threads.ts:24:  return role === 'agent' || role === 'assistant';
ledger-cli/src/business/ledger/helper/find-unanswered-threads.ts:67:  return `Patch ${threadFile} directly. Append one parsed answer section: # AGENT, then <!-- decision-os:note {"id":"note-agent-<unique>","timestamp":"<ISO-8601>"} -->, then the answer markdown. Only # OPERATOR and # AGENT are valid top-level message headings; do not regenerate ledger JSON for the reply.`;
backend/test/unit/routing/controller/dispatch-route-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
ledger-cli/src/lib/types.ts:11:export type AssetCommand = 'apply-gc-plan' | 'gc' | 'list-orphans' | 'list-referenced' | 'prune-json' | 'stage-referenced';
ledger-cli/src/business/ledger/helper/thread-content-file.ts:3: * WHY: agents should answer conversations by patching or appending to Markdown files.
ledger-cli/src/business/ledger/helper/thread-content-file.ts:10:const metadataPrefix = '<!-- decision-os:note ';
ledger-cli/src/business/ledger/helper/thread-content-file.ts:11:const metadataSuffix = ' -->';
ledger-cli/src/business/ledger/helper/thread-content-file.ts:58:function parseMetadata(line: string): JsonObject | null {
ledger-cli/src/business/ledger/helper/thread-content-file.ts:60:  if (!trimmed.startsWith(metadataPrefix) || !trimmed.endsWith(metadataSuffix)) return null;
ledger-cli/src/business/ledger/helper/thread-content-file.ts:62:    const parsed = JSON.parse(trimmed.slice(metadataPrefix.length, -metadataSuffix.length));
ledger-cli/src/business/ledger/helper/thread-content-file.ts:69:function noteRole(note: JsonObject): 'agent' | 'operator' {
ledger-cli/src/business/ledger/helper/thread-content-file.ts:71:  return role === 'agent' || role === 'assistant' ? 'agent' : 'operator';
ledger-cli/src/business/ledger/helper/thread-content-file.ts:76:  return normalized === 'agent' || normalized === 'assistant' ? 'AGENT' : 'OPERATOR';
ledger-cli/src/business/ledger/helper/thread-content-file.ts:79:function metadataFor(note: JsonObject): JsonObject {
ledger-cli/src/business/ledger/helper/thread-content-file.ts:80:  const metadata: JsonObject = {};
ledger-cli/src/business/ledger/helper/thread-content-file.ts:82:    if (typeof note[key] === 'string' && note[key]) metadata[key] = note[key];
ledger-cli/src/business/ledger/helper/thread-content-file.ts:84:  return metadata;
ledger-cli/src/business/ledger/helper/thread-content-file.ts:103:      current = { id: `note-${notes.length + 1}`, role: heading[1].toLowerCase() === 'agent' ? 'agent' : 'operator', message: '', timestamp: '' };
ledger-cli/src/business/ledger/helper/thread-content-file.ts:109:      const metadata = parseMetadata(line);
ledger-cli/src/business/ledger/helper/thread-content-file.ts:110:      if (metadata) {
ledger-cli/src/business/ledger/helper/thread-content-file.ts:111:        current = { ...current, ...metadata, role: noteRole({ ...current, ...metadata }) };
ledger-cli/src/business/ledger/helper/thread-content-file.ts:125:    return [`# ${headingForRole(note.role)}`, `${metadataPrefix}${JSON.stringify(metadataFor(note))}${metadataSuffix}`, '', body].join('\n').replace(/\n+$/g, '');
backend/test/unit/routing/effect/send-json-response.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/zone/helper/resolve-zone-selection-membership.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
ledger-cli/src/business/command/helper/format-ledger-cli-help.ts:17:    '      List threads whose latest meaningful note still needs an agent answer.',
ledger-cli/src/business/command/helper/format-ledger-cli-help.ts:20:    '      Append a short agent answer to a thread content file.',
ledger-cli/src/business/command/helper/format-ledger-cli-help.ts:50:    '  assets stage-referenced --root <workspace> --domain <name> [--include-risky ui-mockups]',
ledger-cli/src/business/command/helper/format-ledger-cli-help.ts:51:    '      Git-stage decision-os text state and referenced managed media for a domain.',
ledger-cli/src/business/command/helper/format-ledger-cli-help.ts:68:    '  ledger-cli unanswered --ledger .decision-os/specs.json --json',
ledger-cli/src/business/command/helper/format-ledger-cli-help.ts:69:    '  ledger-cli answer --ledger .decision-os/specs.json --thread-id thread-card-a --message "Implemented."',
ledger-cli/src/business/command/helper/format-ledger-cli-help.ts:70:    '  ledger-cli answer --ledger .decision-os/specs.json --thread-id thread-card-a --message-file /tmp/answer.md',
frontend/test/unit/zone/helper/validate-zone-draft.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/ledger/helper/read-ledger-json-file.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/zone/helper/confirm-zone-deletion.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
ledger-cli/src/business/command/helper/parse-ledger-cli-argv.ts:62:  const assetAction = (argv[1] === 'apply-gc-plan' || argv[1] === 'gc' || argv[1] === 'list-orphans' || argv[1] === 'list-referenced' || argv[1] === 'prune-json' || argv[1] === 'stage-referenced'
ledger-cli/src/business/command/helper/parse-ledger-cli-argv.ts:67:    ledgerJsonFile: flagValue(argv, '--ledger') ?? argv[1] ?? '../.decision-os/specs.json',
backend/test/unit/ledger/helper/read-decision-os-state.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
ledger-cli/src/business/assets/effect/stage-referenced-assets.ts:1:import { execFile } from 'node:child_process';
ledger-cli/src/business/assets/effect/stage-referenced-assets.ts:26:export async function stageReferencedAssets(input: { domain: string; report: AssetGcReport; workspaceRoot: string }): Promise<string[]> {
frontend/test/unit/zone/helper/calculate-zone-geometry.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/ledger/helper/validate-ledger-document.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
ledger-cli/test/ledger/ledger-json-storage.test.ts:165:  await mkdir(join(decisionOs, 'cards', 'specs'), { recursive: true });
ledger-cli/test/ledger/ledger-json-storage.test.ts:166:  const file = join(decisionOs, 'specs.json');
ledger-cli/test/ledger/ledger-json-storage.test.ts:168:  await writeFile(join(decisionOs, 'cards', 'specs', 'card-a.md'), 'Content file body for export.', 'utf8');
ledger-cli/test/ledger/ledger-json-storage.test.ts:170:    cards: [{ id: 'card-a', title: 'Card A', x: 0, y: 0, w: 100, h: 100, comment: { contentFile: '.decision-os/cards/specs/card-a.md' } }],
ledger-cli/test/ledger/ledger-json-storage.test.ts:187:  await mkdir(join(decisionOs, 'cards', 'specs'), { recursive: true });
ledger-cli/test/ledger/ledger-json-storage.test.ts:188:  const file = join(decisionOs, 'specs.json');
ledger-cli/test/ledger/ledger-json-storage.test.ts:189:  const contentFile = join(decisionOs, 'cards', 'specs', 'card-a.md');
ledger-cli/test/ledger/ledger-json-storage.test.ts:192:    cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.decision-os/cards/specs/card-a.md' } }],
ledger-cli/test/ledger/ledger-json-storage.test.ts:210:  assert.equal(persisted.cards[0].comment?.contentFile, '.decision-os/cards/specs/card-a.md');
ledger-cli/test/ledger/ledger-json-storage.test.ts:214:test('ledger-cli unanswered lists threads whose latest note is not an agent answer', async () => {
ledger-cli/test/ledger/ledger-json-storage.test.ts:224:      'thread-answered-card': [{ role: 'operator', message: 'Question' }, { role: 'agent', message: 'Answer' }]
ledger-cli/test/ledger/ledger-json-storage.test.ts:232:  assert.match(output, /Threads awaiting agent answer \(2\)/);
ledger-cli/test/ledger/ledger-json-storage.test.ts:242:test('ledger-cli unanswered lists every pending note since the last agent answer', async () => {
ledger-cli/test/ledger/ledger-json-storage.test.ts:250:        { role: 'agent', message: 'Old answer.' },
ledger-cli/test/ledger/ledger-json-storage.test.ts:261:  assert.match(output, /Threads awaiting agent answer \(1\)/);
ledger-cli/test/ledger/ledger-json-storage.test.ts:287:test('ledger-cli answer appends an agent note to a thread', async () => {
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:6:const sourceFile = '/workspace/.decision-os/cards/specs/card-a.md';
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:26:    '::html[Preview](.decision-os/cards/specs/assets/preview.html)',
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:31:    '::html[Ignored](.decision-os/cards/specs/assets/code.html)',
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:39:    '.decision-os/cards/specs/assets/preview.html',
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:41:    '.decision-os/cards/specs/assets/app.mjs',
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:42:    '.decision-os/cards/specs/assets/app.css',
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:47:    sourceFile: '/workspace/.decision-os/specs.json',
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:57:    sourceFile: '/workspace/.decision-os/specs.json',
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:69:    content: 'See .decision-os/card-images/prose.png and .decision-os/cards/specs/assets/prose.html for the old run.',
ledger-cli/test/unit/assets/helper/extract-asset-references.test.ts:76:    { kind: 'raw-media-mention', path: '.decision-os/cards/specs/assets/prose.html' }
backend/test/unit/ledger/helper/card-content-file-delete-image.test.ts:44:  const ledgerPath = join(decisionOsRoot, 'specs.json');
backend/test/unit/ledger/helper/card-content-file-delete-image.test.ts:58:  const contentFile = join(decisionOsRoot, 'cards', 'specs', 'card-1.md');
backend/test/unit/ledger/helper/card-content-file-delete-image.test.ts:69:  const ledgerPath = join(decisionOsRoot, 'specs.json');
backend/test/unit/ledger/helper/card-content-file-delete-image.test.ts:83:  const contentFile = join(decisionOsRoot, 'cards', 'specs', 'card-1.md');
ledger-cli/src/business/assets/controller/manage-assets.ts:5:import { stageReferencedAssets } from '../effect/stage-referenced-assets.js';
ledger-cli/src/business/assets/controller/manage-assets.ts:20:  if (operation.action === 'stage-referenced' && !operation.domain) {
ledger-cli/src/business/assets/controller/manage-assets.ts:21:    return { ok: false, error: 'assets stage-referenced requires --domain <name>.' };
ledger-cli/src/business/assets/controller/manage-assets.ts:27:  const workspaceRoot = resolve(operation.root ?? process.cwd());
ledger-cli/src/business/assets/controller/manage-assets.ts:48:    domain: operation.action === 'stage-referenced' ? operation.domain : undefined,
ledger-cli/src/business/assets/controller/manage-assets.ts:79:  if (operation.action === 'stage-referenced') {
ledger-cli/src/business/assets/controller/manage-assets.ts:80:    const stagedPaths = await stageReferencedAssets({
ledger-cli/src/business/assets/controller/manage-assets.ts:86:      ? JSON.stringify({ ...report, stagedPaths }, null, 2)
ledger-cli/src/business/assets/controller/manage-assets.ts:87:      : [`Staged referenced decision-os assets for domain ${operation.domain}.`, ...stagedPaths.map((path) => `  ${path}`)].join('\n');
ledger-cli/test/fixture/scenario.ts:2: * WHAT: Shared test fixtures for ledger-cli specs.
frontend/test/unit/zone/controller/edit-zone-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
ledger-cli/test/command/assets-command.test.ts:3:import { execFile } from 'node:child_process';
ledger-cli/test/command/assets-command.test.ts:285:test('assets stage-referenced stages domain text and referenced assets only', async () => {
ledger-cli/test/command/assets-command.test.ts:293:    'stage-referenced',
ledger-cli/test/command/assets-command.test.ts:302:  const staged = status.stdout.split('\n').filter(Boolean).sort();
ledger-cli/test/command/assets-command.test.ts:303:  assert.ok(staged.includes('.decision-os/cards/ui-research/card-a.md'));
ledger-cli/test/command/assets-command.test.ts:304:  assert.ok(staged.includes('.decision-os/threads/ui-research/thread-a.md'));
ledger-cli/test/command/assets-command.test.ts:305:  assert.ok(staged.includes('.decision-os/ui-research.json'));
ledger-cli/test/command/assets-command.test.ts:306:  assert.ok(staged.includes('.decision-os/cards/ui-research/assets/preview.html'));
ledger-cli/test/command/assets-command.test.ts:307:  assert.ok(staged.includes('.decision-os/cards/ui-research/assets/preview.css'));
ledger-cli/test/command/assets-command.test.ts:308:  assert.ok(staged.includes('.decision-os/cards/ui-research/assets/preview.mjs'));
ledger-cli/test/command/assets-command.test.ts:309:  assert.ok(staged.includes('.decision-os/cards/ui-research/assets/preview.png'));
ledger-cli/test/command/assets-command.test.ts:310:  assert.ok(staged.includes('.decision-os/card-images/ui-research/keep.png'));
ledger-cli/test/command/assets-command.test.ts:311:  assert.ok(staged.includes('.decision-os/thread-images/thread-a/keep.webp'));
ledger-cli/test/command/assets-command.test.ts:312:  assert.ok(staged.includes('.decision-os/card-images/ui-research/pinned-final.png'));
ledger-cli/test/command/assets-command.test.ts:313:  assert.ok(!staged.includes('.decision-os/cards/ui-research/assets/orphan.html'));
ledger-cli/test/command/assets-command.test.ts:314:  assert.ok(!staged.includes('.decision-os/.scripts/tool.html'));
ledger-cli/test/command/assets-command.test.ts:315:  assert.ok(!staged.includes('.decision-os/card-images/ui-research/orphan.png'));
ledger-cli/test/command/assets-command.test.ts:316:  assert.ok(!staged.includes('.decision-os/card-images/ui-research/json-key.svg'));
ledger-cli/src/business/assets/helper/collect-asset-source-files.ts:18:  const pipelineCatalog = resolve(uiResearchRoot, 'ui-pipeline-catalog.json');
ledger-cli/src/business/assets/helper/collect-asset-source-files.ts:19:  const pipelineCatalogs = await exists(pipelineCatalog) ? [pipelineCatalog] : [];
ledger-cli/src/business/assets/helper/collect-asset-source-files.ts:21:    ...pipelineCatalogs,
ledger-cli/test/command/card-status-command.test.ts:8:  const parsed = parseLedgerCliArgv(['done', '--ledger', '.decision-os/specs.json', '--card-id', 'card-a']);
ledger-cli/src/business/assets/helper/collect-git-ignored-paths.ts:1:import { spawn } from 'node:child_process';
ledger-cli/src/business/assets/helper/collect-git-ignored-paths.ts:15:    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
ledger-cli/src/business/assets/helper/collect-git-ignored-paths.ts:16:    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
backend/test/unit/ledger/controller/load-tab-ledgers-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
ledger-cli/src/business/assets/helper/collect-git-tracked-paths.ts:1:import { spawn } from 'node:child_process';
ledger-cli/src/business/assets/helper/collect-git-tracked-paths.ts:11:    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
ledger-cli/src/business/assets/helper/collect-git-tracked-paths.ts:12:    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
ledger-cli/src/business/assets/helper/workspace-paths.ts:30:  if (!source || /^https?:\/\//i.test(source) || /^data:/i.test(source) || source.startsWith('#')) return null;
ledger-cli/test/command/ledger-cli-command.test.ts:8:import { execFile } from 'node:child_process';
ledger-cli/test/command/ledger-cli-command.test.ts:93:  await mkdir(join(root, '.blueprinttool', 'threads', 'specs'), { recursive: true });
ledger-cli/test/command/ledger-cli-command.test.ts:95:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }],
ledger-cli/test/command/ledger-cli-command.test.ts:98:  await writeFile(join(root, '.blueprinttool', 'threads', 'specs', 'thread-card-a.md'), [
ledger-cli/test/command/ledger-cli-command.test.ts:115:test('ledger-cli migration write moves storage and rewrites settings and note metadata', async () => {
ledger-cli/test/command/ledger-cli-command.test.ts:117:  await mkdir(join(root, '.blueprinttool', 'threads', 'specs'), { recursive: true });
ledger-cli/test/command/ledger-cli-command.test.ts:123:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.blueprinttool/specs.json' }],
ledger-cli/test/command/ledger-cli-command.test.ts:125:  await writeFile(join(root, '.blueprinttool', 'threads', 'specs', 'thread-card-a.md'), '<!-- corev2:note {"voiceFileRef":"/workspace/CoreV2/.blueprinttool/voice-uploads/a.wav"} -->');
ledger-cli/test/command/ledger-cli-command.test.ts:133:  const thread = await readFile(join(root, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'utf8');
ledger-cli/test/command/ledger-cli-command.test.ts:134:  assert.match(state, /\.decision-os\/specs\.json/);
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts:21:    '.decision-os/specs.json',
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts:53:  assert.equal(command.ledgerJsonFile, '.decision-os/specs.json');
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts:73:    '.decision-os/data.json',
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts:77:  assert.equal(command.ledgerJsonFile, '.decision-os/data.json');
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts:84:    '.decision-os/data.json',
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts:90:  assert.equal(command.ledgerJsonFile, '.decision-os/data.json');
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts:98:    '.decision-os/specs.json',
ledger-cli/test/unit/command/helper/parse-ledger-cli-argv.test.ts:106:  assert.equal(command.ledgerJsonFile, '.decision-os/specs.json');
frontend/test/unit/zone/effect/render-zone-layer.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/server/front-back-stack-contracts.integration.test.ts:23:    specs_ledger_file: 'generated-specs-ledger.json',
backend/test/server/decision-os-ledger-create.integration.test.ts:12:  const originalCwd = process.cwd();
backend/test/server/decision-os-ledger-create.integration.test.ts:16:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/server/decision-os-ledger-create.integration.test.ts:18:  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({ cards: [], annotations: [], relationships: [], notes: {} }));
backend/test/server/decision-os-ledger-create.integration.test.ts:20:  process.chdir(workspace);
backend/test/server/decision-os-ledger-create.integration.test.ts:53:    process.chdir(originalCwd);
backend/test/server/decision-os-content-files.integration.test.ts:12:  const originalCwd = process.cwd();
backend/test/server/decision-os-content-files.integration.test.ts:14:  mkdirSync(join(workspace, '.decision-os', 'cards', 'specs'), { recursive: true });
backend/test/server/decision-os-content-files.integration.test.ts:16:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/server/decision-os-content-files.integration.test.ts:18:  writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'Content file body.');
backend/test/server/decision-os-content-files.integration.test.ts:19:  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
backend/test/server/decision-os-content-files.integration.test.ts:20:    cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.decision-os/cards/specs/card-a.md' }, x: 10, y: 20, w: 240 }],
backend/test/server/decision-os-content-files.integration.test.ts:26:  process.chdir(workspace);
backend/test/server/decision-os-content-files.integration.test.ts:31:  process.chdir(originalCwd);
backend/test/server/decision-os-content-files.integration.test.ts:34:    endpoint: `http://127.0.0.1:${address.port}/decision-os/specs`,
backend/test/server/decision-os-content-files.integration.test.ts:57:    const persisted = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<Record<string, any>> };
backend/test/server/decision-os-content-files.integration.test.ts:59:    assert.equal(persisted.cards[0].comment.contentFile, '.decision-os/cards/specs/card-a.md');
backend/test/server/decision-os-content-files.integration.test.ts:60:    assert.equal(readFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'utf8'), 'Edited body.');
backend/test/server/decision-os-content-files.integration.test.ts:82:    assert.equal(createdCard?.comment.contentFile, '.decision-os/cards/specs/card-new.md');
backend/test/server/decision-os-content-files.integration.test.ts:83:    assert.equal(created.threadFiles['thread-card-new'], '.decision-os/threads/specs/thread-card-new.md');
backend/test/server/decision-os-content-files.integration.test.ts:85:    const persisted = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as {
backend/test/server/decision-os-content-files.integration.test.ts:91:    assert.equal(persistedCard?.comment.contentFile, '.decision-os/cards/specs/card-new.md');
backend/test/server/decision-os-content-files.integration.test.ts:93:    assert.equal(persisted.threadFiles['thread-card-new'], '.decision-os/threads/specs/thread-card-new.md');
backend/test/server/decision-os-content-files.integration.test.ts:95:    assert.equal(readFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-new.md'), 'utf8'), '');
backend/test/server/decision-os-content-files.integration.test.ts:96:    assert.equal(readFileSync(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-new.md'), 'utf8'), '\n');
backend/test/server/decision-os-content-files.integration.test.ts:111:    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), [
backend/test/server/decision-os-content-files.integration.test.ts:128:    assert.doesNotMatch(readFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'utf8'), /carousel-delete\.png/);
backend/test/server/decision-os-content-files.integration.test.ts:141:    mkdirSync(join(workspace, '.decision-os', 'cards', 'specs', 'assets'), { recursive: true });
backend/test/server/decision-os-content-files.integration.test.ts:144:    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'assets', 'preview.html'), '<!doctype html><title>Preview</title>');
backend/test/server/decision-os-content-files.integration.test.ts:145:    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'assets', 'preview.mjs'), 'export default 1;');
backend/test/server/decision-os-content-files.integration.test.ts:149:    const htmlResponse = await fetch(`${baseUrl}/.decision-os/cards/specs/assets/preview.html`);
backend/test/server/decision-os-content-files.integration.test.ts:154:    const moduleResponse = await fetch(`${baseUrl}/.decision-os/cards/specs/assets/preview.mjs`);
backend/test/server/decision-os-content-files.integration.test.ts:176:    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), '![Keep](.decision-os/ui/keep.png)');
backend/test/server/decision-os-content-files.integration.test.ts:186:    assert.match(readFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'utf8'), /keep\.png/);
backend/test/server/decision-os-content-files.integration.test.ts:213:    writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), 'Direct file edit.');
backend/test/server/decision-os-content-files.integration.test.ts:215:    assert.match(eventText, /"contentFile":"\.decision-os\/cards\/specs\/card-a\.md"/);
backend/test/unit/ledger/effect/write-decision-os-state.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/refresh/server-refresh.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:12:  const originalCwd = process.cwd();
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:14:  mkdirSync(join(workspace, '.decision-os', 'cards', 'specs'), { recursive: true });
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:15:  mkdirSync(join(workspace, '.decision-os', 'threads', 'specs'), { recursive: true });
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:18:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:21:  writeFileSync(join(workspace, '.decision-os', 'cards', 'specs', 'card-a.md'), '![Asset](.decision-os/shared/asset.png)');
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:22:  writeFileSync(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), '# OPERATOR\n\nThread note.');
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:23:  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:24:    modelName: 'specs',
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:25:    cards: [{ id: 'card-a', title: 'Card A', comment: { contentFile: '.decision-os/cards/specs/card-a.md' }, x: 10, y: 20, w: 240 }],
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:29:    threadFiles: { 'thread-card-a': '.decision-os/threads/specs/thread-card-a.md' }
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:32:  process.chdir(workspace);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:37:  process.chdir(originalCwd);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:43:    restore: () => process.chdir(originalCwd)
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:54:    assert.equal(overview.cards[0].id, 'ledger-card:specs');
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:55:    assert.equal(overview.cards[0].targetLedgerId, 'specs');
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:59:    assert.equal(state.ledgers[0].cardId, 'ledger-card:specs');
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:92:      body: JSON.stringify({ action: 'patch-card', cardPatch: { id: 'ledger-card:specs', title: 'Renamed Specs' } })
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:96:    assert.equal(state.ledgers.some((entry) => entry.id === 'renamed-specs' && entry.ledgerFile === '.decision-os/renamed-specs.json'), true);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:97:    assert.equal(existsSync(join(workspace, '.decision-os', 'renamed-specs.json')), true);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:98:    assert.equal(existsSync(join(workspace, '.decision-os', 'cards', 'renamed-specs')), true);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:99:    const renamedLedger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'renamed-specs.json'), 'utf8')) as { cards: Array<{ comment: { contentFile: string } }>; threadFiles: Record<string, string> };
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:100:    assert.equal(renamedLedger.cards[0].comment.contentFile, '.decision-os/cards/renamed-specs/card-a.md');
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:101:    assert.equal(renamedLedger.threadFiles['thread-card-a'], '.decision-os/threads/renamed-specs/thread-card-a.md');
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:106:      body: JSON.stringify({ action: 'delete-card', cardId: 'ledger-card:renamed-specs' })
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:110:    assert.equal(state.ledgers.some((entry) => entry.id === 'renamed-specs'), false);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:111:    assert.equal(existsSync(join(workspace, '.decision-os', 'renamed-specs.json')), false);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:112:    assert.equal(existsSync(join(workspace, '.decision-os', 'cards', 'renamed-specs')), false);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:113:    assert.equal(existsSync(join(workspace, '.decision-os', 'threads', 'renamed-specs')), false);
backend/test/server/decision-os-zone-mutations.integration.test.ts:12:  const originalCwd = process.cwd();
backend/test/server/decision-os-zone-mutations.integration.test.ts:17:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/server/decision-os-zone-mutations.integration.test.ts:20:  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
backend/test/server/decision-os-zone-mutations.integration.test.ts:30:  process.chdir(workspace);
backend/test/server/decision-os-zone-mutations.integration.test.ts:36:  const endpoint = `http://127.0.0.1:${address.port}/decision-os/specs`;
backend/test/server/decision-os-zone-mutations.integration.test.ts:218:    assert.match(readFileSync(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'utf8'), /"imageSizes":\{".decision-os\/thread-images\/thread-card-a\/paste.png":\{"width":288,"height":162\}\}/);
backend/test/server/decision-os-zone-mutations.integration.test.ts:230:    assert.match(readFileSync(join(workspace, '.decision-os', 'threads', 'specs', 'thread-card-a.md'), 'utf8'), /^# OPERATOR/m);
backend/test/server/decision-os-zone-mutations.integration.test.ts:312:    const persistedLedger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { cards: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>> };
backend/test/server/decision-os-zone-mutations.integration.test.ts:318:    process.chdir(originalCwd);
backend/test/server/decision-os-zone-mutations.integration.test.ts:324:  const originalCwd = process.cwd();
backend/test/server/decision-os-zone-mutations.integration.test.ts:339:  process.chdir(nested);
backend/test/server/decision-os-zone-mutations.integration.test.ts:378:    process.chdir(originalCwd);
backend/test/ledger/decision-os-default-tabs.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
frontend/test/unit/selection/helper/copy-selection-payload.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/canvas/canvas-interaction.integration.test.ts:22:    specs_ledger_file: 'generated-specs-ledger.json',
backend/test/unit/refresh/helper/watch-ledger-directory.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/routing/server-ledger-routing.integration.test.ts:23:    specs_ledger_file: 'generated-specs-ledger.json',
backend/test/unit/refresh/helper/debounce-refresh-event.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/selection/helper/elements-intersecting-canvas-rect.test.ts:7:    { dataset: { cardId: 'inside' }, offsetLeft: 10, offsetTop: 10, offsetWidth: 50, offsetHeight: 40 },
frontend/test/unit/selection/helper/elements-intersecting-canvas-rect.test.ts:8:    { dataset: { cardId: 'outside' }, offsetLeft: 300, offsetTop: 300, offsetWidth: 50, offsetHeight: 40 },
frontend/test/unit/selection/helper/elements-intersecting-canvas-rect.test.ts:9:    { dataset: {}, offsetLeft: 20, offsetTop: 20, offsetWidth: 10, offsetHeight: 10 }
frontend/test/unit/selection/helper/elements-intersecting-canvas-rect.test.ts:14:  assert.deepEqual(elementsIntersectingCanvasRect({ x: 0, y: 0, width: 100, height: 100 }, '[data-card-id]', 'cardId'), ['inside']);
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:27:    data_model: {}
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:36:  const previousKey = process.env.OPENAI_API_KEY;
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:37:  delete process.env.OPENAI_API_KEY;
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:42:      data_model: {}
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:48:    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:49:    else process.env.OPENAI_API_KEY = previousKey;
frontend/test/unit/selection/helper/clear-transient-selection.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/codex/helper/build-card-skill-prompt.ts:2: * WHAT: Builds the stdin prompt for a card-scoped Codex skill run.
backend/src/business/codex/helper/build-card-skill-prompt.ts:3: * WHY: Headless Codex needs the selected skill, source card content, and output file contract in one deterministic payload.
backend/src/business/codex/helper/build-card-skill-prompt.ts:6:  skillName: string;
backend/src/business/codex/helper/build-card-skill-prompt.ts:13:    `$${input.skillName}`,
backend/src/business/codex/helper/build-card-skill-prompt.ts:15:    'You are processing one decision-os card from the active workspace.',
backend/test/unit/persistence/helper/validate-ledger-edit-payload.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/toolbox/helper/resolve-tool-mode.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/selection/helper/resolve-selection-target.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/refresh/controller/publish-server-refresh-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/boot/boot-surface.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
backend/src/business/codex/helper/resolve-codex-command.ts:2: * WHAT: Resolves the Codex CLI command and arguments for a headless workspace run.
backend/src/business/codex/helper/resolve-codex-command.ts:3: * WHY: The server process may not inherit the operator's interactive shell PATH.
backend/src/business/codex/helper/resolve-codex-command.ts:11:export const codexModelOptions = ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'] as const;
backend/src/business/codex/helper/resolve-codex-command.ts:12:export const codexEffortOptions = ['low', 'medium', 'high', 'xhigh'] as const;
backend/src/business/codex/helper/resolve-codex-command.ts:40:  return String(process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => resolve(directory, command));
backend/src/business/codex/helper/resolve-codex-command.ts:50:      .map((version) => resolve(versionsRoot, version, 'bin', 'codex'));
backend/src/business/codex/helper/resolve-codex-command.ts:58:    resolve(dirname(process.execPath), 'codex'),
backend/src/business/codex/helper/resolve-codex-command.ts:60:    resolve(homedir(), '.local', 'bin', 'codex'),
backend/src/business/codex/helper/resolve-codex-command.ts:61:    '/usr/local/bin/codex',
backend/src/business/codex/helper/resolve-codex-command.ts:62:    '/usr/bin/codex',
backend/src/business/codex/helper/resolve-codex-command.ts:70:  return command || 'codex';
backend/src/business/codex/helper/resolve-codex-command.ts:87:  return Boolean(allowedValue(value, codexModelOptions));
backend/src/business/codex/helper/resolve-codex-command.ts:91:  return Boolean(allowedValue(value, codexEffortOptions));
backend/src/business/codex/helper/resolve-codex-command.ts:94:export function resolveCodexCommand(input: { workspaceRoot: string; runtime: AnyRecord; codexModel?: unknown; codexEffort?: unknown }): CodexCommand {
backend/src/business/codex/helper/resolve-codex-command.ts:96:  const configuredCommand = String(process.env.CODEX_BIN || settings.codexBin || settings.CODEX_BIN || 'codex');
backend/src/business/codex/helper/resolve-codex-command.ts:97:  const model = firstAllowed([input.codexModel, process.env.CODEX_MODEL, settings.codexModel, settings.CODEX_MODEL], codexModelOptions, 'gpt-5.5');
backend/src/business/codex/helper/resolve-codex-command.ts:98:  const effort = firstAllowed([input.codexEffort, process.env.CODEX_EFFORT, settings.codexEffort, settings.codexReasoningEffort, settings.CODEX_EFFORT], codexEffortOptions, 'high');
frontend/test/unit/selection/helper/calculate-marquee-selection.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/transcription/effect/call-openai-transcription.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/transcription/effect/call-openai-transcription.test.ts:28:    data_model: {}
frontend/test/unit/voice/helper/resolve-voice-session.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/transcription/effect/persist-uploaded-voice-audio.test.ts:21:      data_model: {}
backend/src/business/codex/helper/scan-codex-skills.ts:2: * WHAT: Discovers Codex skills available to the workspace.
backend/src/business/codex/helper/scan-codex-skills.ts:3: * WHY: The browser should list skill names and descriptions without accepting filesystem paths from the client.
backend/src/business/codex/helper/scan-codex-skills.ts:15:  skillFile: string;
backend/src/business/codex/helper/scan-codex-skills.ts:28:function codexHome(): string {
backend/src/business/codex/helper/scan-codex-skills.ts:29:  return resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
backend/src/business/codex/helper/scan-codex-skills.ts:33:  const home = codexHome();
backend/src/business/codex/helper/scan-codex-skills.ts:34:  const workspaceSkills = resolve(workspaceRoot, '.skills');
backend/src/business/codex/helper/scan-codex-skills.ts:35:  const cwdSkills = resolve(process.cwd(), '.skills');
backend/src/business/codex/helper/scan-codex-skills.ts:38:    { directory: resolve(home, 'skills'), source: 'user' as const, maxDepth: 6 },
backend/src/business/codex/helper/scan-codex-skills.ts:71:  const metadata: Record<string, string> = {};
backend/src/business/codex/helper/scan-codex-skills.ts:77:    metadata[match[1]] = unquote(match[2] ?? '');
backend/src/business/codex/helper/scan-codex-skills.ts:79:  const name = String(metadata.name ?? '').trim();
backend/src/business/codex/helper/scan-codex-skills.ts:81:  return { name, description: String(metadata.description ?? '').trim() };
backend/src/business/codex/helper/scan-codex-skills.ts:84:function readSkillSummary(skillFile: string, source: CodexSkillSource): CodexSkillSummary | null {
backend/src/business/codex/helper/scan-codex-skills.ts:86:    if (!statSync(skillFile).isFile()) return null;
backend/src/business/codex/helper/scan-codex-skills.ts:87:    const metadata = parseSkillFrontmatter(readFileSync(skillFile, 'utf8'));
backend/src/business/codex/helper/scan-codex-skills.ts:88:    if (!metadata) return null;
backend/src/business/codex/helper/scan-codex-skills.ts:89:    return { ...metadata, source, skillFile };
backend/src/business/codex/helper/scan-codex-skills.ts:98:    for (const skillFile of collectSkillFiles(root.directory, root.maxDepth)) {
backend/src/business/codex/helper/scan-codex-skills.ts:99:      const summary = readSkillSummary(skillFile, root.source);
frontend/test/refresh/client-refresh.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
backend/test/unit/transcription/controller/transcribe-voice-controller.test.ts:19:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/transcription/controller/transcribe-voice-controller.test.ts:31:    data_model: {}
backend/test/unit/transcription/controller/transcribe-voice-controller.test.ts:52:      data_model: {}
backend/test/unit/transcription/controller/transcribe-voice-controller.test.ts:73:      data_model: {}
backend/test/unit/transcription/controller/transcribe-voice-controller.test.ts:78:      data_model: {}
backend/test/unit/transcription/effect/load-uploaded-voice-audio.test.ts:20:    const result = loadUploadedVoiceAudio({ action_payload: { voiceFileRef, voiceUploadRoot }, runtime_state, data_model: {} });
backend/test/unit/transcription/effect/load-uploaded-voice-audio.test.ts:37:    const result = loadUploadedVoiceAudio({ action_payload: { voiceFileRef, voiceUploadRoot }, runtime_state: {}, data_model: {} });
frontend/test/unit/toolbox/controller/operate-toolbox-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/persistence/controller/commit-ledger-edit-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/voice/helper/capture-voice-audio.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/refresh/effect/publish-refresh-event.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/transcription/effect/persist-transcribed-text.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
tests/browser/card/cards-indicate-when-the-latest-thread-answer-is-from-the-agent.spec.ts:2: * WHAT: Integration test for spec c4e8b91a: Cards indicate when the latest thread answer is from the agent.
tests/browser/card/cards-indicate-when-the-latest-thread-answer-is-from-the-agent.spec.ts:9:test('Cards indicate when the latest thread answer is from the agent.', async () => {
tests/browser/card/cards-indicate-when-the-latest-thread-answer-is-from-the-agent.spec.ts:10:  await assertFrontendSpec('Cards indicate when the latest thread answer is from the agent.', 'c4e8b91a', 'card');
frontend/test/card/card-lifecycle.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
frontend/test/card/card-labels.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
backend/test/unit/transcription/effect/clear-uploaded-voice-audio.test.ts:20:    const result = clearUploadedVoiceAudio({ action_payload: {}, runtime_state, data_model: {} });
frontend/test/unit/thread/helper/resolve-thread-target.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/toolbox/effect/render-toolbox.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/persistence/effect/write-ledger-json-file.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/voice/controller/record-voice-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/relationship/relationship-rendering.integration.test.ts:22:    specs_ledger_file: 'generated-specs-ledger.json',
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:2: * WHAT: Cancels one active card-scoped Codex skill run.
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:3: * WHY: The canvas widget needs a direct stop control for the server-owned child process.
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:5:import type { ChildProcess } from 'node:child_process';
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:10:  return runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:18:export async function cancelCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:19:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:37:    return { ok: false, statusCode: 409, error: 'Run is not cancellable in this server process.', runId };
frontend/test/unit/thread/controller/edit-thread-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/server/helper/read-decision-os-settings.ts:12:export function readDecisionOsSettings(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/server/helper/read-decision-os-settings.ts:14:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:2: * WHAT: Reads one card-scoped Codex skill run from its derived JSONL/log files.
backend/src/business/codex/controller/read-card-skill-run-controller.ts:47:  const match = runId.match(/^codex-skill-(\d+)-/);
backend/src/business/codex/controller/read-card-skill-run-controller.ts:100:  if (itemType === 'agent_message') {
backend/src/business/codex/controller/read-card-skill-run-controller.ts:102:    return { line: line.line, type, kind: 'agent_message', title: 'Codex message', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:152:  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/read-card-skill-run-controller.ts:175:  const runs = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/read-card-skill-run-controller.ts:188:  if (String(card.cardType ?? '') === 'codex-skill-run' && input.cardId === `card-${safeSegment(input.runId)}`) return true;
backend/src/business/codex/controller/read-card-skill-run-controller.ts:207:    const id = `codex-${safeSegment(input.runId)}-line-${event.line}`;
backend/src/business/codex/controller/read-card-skill-run-controller.ts:210:      role: 'agent',
backend/src/business/codex/controller/read-card-skill-run-controller.ts:214:      codexRunId: input.runId,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:215:      codexLine: String(event.line),
backend/src/business/codex/controller/read-card-skill-run-controller.ts:216:      codexKind: event.kind,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:217:      codexEventType: event.type,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:218:      codexItemId: event.itemId,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:219:      codexTool: event.tool,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:220:      codexExitCode: event.exitCode,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:242:export async function readCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/codex/controller/read-card-skill-run-controller.ts:243:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:246:  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
backend/src/business/codex/controller/read-card-skill-run-controller.ts:264:  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
backend/src/business/codex/controller/read-card-skill-run-controller.ts:283:    agentMessageCount: events.filter((event) => event.kind === 'agent_message').length,
frontend/test/group/group-selection.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
frontend/test/unit/thread/effect/render-thread-panel.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/voice/effect/render-voice-status.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/server/helper/resolve-decision-os-root.ts:11:export function resolveDecisionOsRoot(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): string {
backend/src/business/server/helper/resolve-decision-os-root.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/server/helper/resolve-decision-os-root.ts:16:  const configuredRoot = String(payload.decisionOsRoot ?? runtime.decisionOsRoot ?? process.env.DECISION_OS_ROOT ?? '');
backend/src/business/server/helper/resolve-decision-os-root.ts:18:  let current = resolve(String(payload.cwd ?? runtime.cwd ?? process.cwd()));
backend/src/business/server/helper/resolve-decision-os-root.ts:27:  return isAbsolute(fallback) ? fallback : resolve(process.cwd(), fallback);
backend/test/unit/server/helper/create-http-server.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/voice/effect/fill-thread-draft.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/persistence/effect/commit-ledger-edit.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/server/helper/read-request-buffer.ts:10:    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
frontend/test/navigation/navigation-tab-switch.integration.test.ts:21:    specs_ledger_file: 'generated-specs-ledger.json',
frontend/test/unit/refresh/helper/merge-refresh-state.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/codex/controller/start-card-skill-process-controller.ts:2: * WHAT: Creates a linked output card and starts a headless Codex skill process for the source card.
backend/src/business/codex/controller/start-card-skill-process-controller.ts:3: * WHY: Card-scoped skill processing must persist the result target before the asynchronous Codex run begins.
backend/src/business/codex/controller/start-card-skill-process-controller.ts:5:import { spawn, type ChildProcess } from 'node:child_process';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:13:import { scanCodexSkills } from '../helper/scan-codex-skills.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:14:import { buildCardSkillPrompt } from '../helper/build-card-skill-prompt.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:15:import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from '../helper/resolve-codex-command.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:16:import { readCardSkillRunController } from './read-card-skill-run-controller.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:65:  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
backend/src/business/codex/controller/start-card-skill-process-controller.ts:66:    ? runtime.codexSkillRuns as Record<string, AnyRecord>
backend/src/business/codex/controller/start-card-skill-process-controller.ts:68:  runtime.codexSkillRuns = runs;
backend/src/business/codex/controller/start-card-skill-process-controller.ts:73:  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/start-card-skill-process-controller.ts:80:  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/start-card-skill-process-controller.ts:100:export async function startCardSkillProcessController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/codex/controller/start-card-skill-process-controller.ts:101:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:104:  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:108:  const skillName = String(payload.skillName ?? '').trim();
backend/src/business/codex/controller/start-card-skill-process-controller.ts:109:  if (!ledgerId || !cardId || !skillName) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or skillName.' };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:110:  const requestedCodexModel = optionalText(payload.codexModel);
backend/src/business/codex/controller/start-card-skill-process-controller.ts:111:  const requestedCodexEffort = optionalText(payload.codexEffort);
backend/src/business/codex/controller/start-card-skill-process-controller.ts:112:  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedCodexModel };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:113:  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedCodexEffort };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:115:  const skill = scanCodexSkills({ workspaceRoot }).find((entry) => entry.name === skillName);
backend/src/business/codex/controller/start-card-skill-process-controller.ts:116:  if (!skill) return { ok: false, statusCode: 404, error: 'Skill not found.', skillName };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:130:  const runId = `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
backend/src/business/codex/controller/start-card-skill-process-controller.ts:132:  const outputTitle = `${skillName} result`;
backend/src/business/codex/controller/start-card-skill-process-controller.ts:133:  const command = resolveCodexCommand({ workspaceRoot, runtime, codexModel: requestedCodexModel, codexEffort: requestedCodexEffort });
backend/src/business/codex/controller/start-card-skill-process-controller.ts:137:    `Status: processing`,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:147:    cardType: 'codex-skill-run',
backend/src/business/codex/controller/start-card-skill-process-controller.ts:161:    label: skillName,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:174:  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:179:    skillName,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:195:    skillName,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:202:    codexModel: command.model,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:203:    codexEffort: command.effort,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:210:  notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-started', ledgerId, sourceCardId: cardId, outputCardId, runId, codexModel: command.model, codexEffort: command.effort });
backend/src/business/codex/controller/start-card-skill-process-controller.ts:222:        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-failed', ledgerId, sourceCardId: cardId, outputCardId, runId }));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:237:        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: status === 'cancelled' ? 'codex-skill-cancelled' : 'codex-skill-finished', ledgerId, sourceCardId: cardId, outputCardId, runId, exitCode }));
frontend/test/unit/voice/effect/upload-voice-audio.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/assets/canvas/terminal-chat.css:3: * WHY: The right-side agent chat must match the terminal mock branch, not a generic chat panel.
frontend/assets/canvas/terminal-chat.css:6:.agent-chat.phone {
frontend/assets/canvas/terminal-chat.css:49:.agent-chat .topbar {
frontend/assets/canvas/terminal-chat.css:64:.agent-chat .topbar::after {
frontend/assets/canvas/terminal-chat.css:74:.agent-chat .hdr-left { min-width: 0; display: flex; align-items: center; gap: 6px; }
frontend/assets/canvas/terminal-chat.css:75:.agent-chat .droid-icon-img {
frontend/assets/canvas/terminal-chat.css:82:.agent-chat .hdr-copy {
frontend/assets/canvas/terminal-chat.css:89:.agent-chat .hdr-row-1 { display: flex; align-items: baseline; gap: 4px; min-width: 0; }
frontend/assets/canvas/terminal-chat.css:90:.agent-chat .hdr-title {
frontend/assets/canvas/terminal-chat.css:101:.agent-chat .hdr-title.is-selected {
frontend/assets/canvas/terminal-chat.css:107:.agent-chat .hdr-context { color: #9aa4b2; font-size: 9px; line-height: 1.15; flex: 0 0 auto; }
frontend/assets/canvas/terminal-chat.css:108:.agent-chat .hdr-cwd {
frontend/assets/canvas/terminal-chat.css:116:.agent-chat .hdr-model { color: #9aa4b2; font-size: 9px; line-height: 1.05; white-space: nowrap; }
frontend/assets/canvas/terminal-chat.css:118:.agent-chat .hdr-grid {
frontend/assets/canvas/terminal-chat.css:132:.agent-chat .hdr-grid::after {
frontend/assets/canvas/terminal-chat.css:141:.agent-chat .hdr-btn {
frontend/assets/canvas/terminal-chat.css:157:.agent-chat .hdr-icon {
frontend/assets/canvas/terminal-chat.css:167:.agent-chat .hdr-btn.active {
frontend/assets/canvas/terminal-chat.css:171:.agent-chat .hdr-btn.active .hdr-icon { color: #f4f8ff; }
frontend/assets/canvas/terminal-chat.css:172:.agent-chat .hdr-btn.muted {
frontend/assets/canvas/terminal-chat.css:177:.agent-chat .hdr-btn.muted .hdr-icon { color: rgba(var(--workspace-secondary-rgb), 0.42); }
frontend/assets/canvas/terminal-chat.css:178:.agent-chat .hdr-btn.hdr-btn-empty {
frontend/assets/canvas/terminal-chat.css:183:.agent-chat .hdr-btn.hdr-btn-empty .hdr-icon { opacity: 0; }
frontend/assets/canvas/terminal-chat.css:185:.agent-chat .chat,
frontend/assets/canvas/terminal-chat.css:186:.agent-chat .io { background: #0a0a0a; }
frontend/assets/canvas/terminal-chat.css:187:.agent-chat .chat {
frontend/assets/canvas/terminal-chat.css:195:.agent-chat .assistant-output { margin: 0 0 8px; color: #f2f3f5; font-size: 11px; line-height: 1.4; }
frontend/assets/canvas/terminal-chat.css:196:.agent-chat .assistant-progress {
frontend/assets/canvas/terminal-chat.css:203:.agent-chat .user-msg { margin: 0 0 8px; display: flex; justify-content: flex-end; }
frontend/assets/canvas/terminal-chat.css:204:.agent-chat .user-bubble {
frontend/assets/canvas/terminal-chat.css:214:.agent-chat .thinking-line { margin: 0 0 8px; }
frontend/assets/canvas/terminal-chat.css:215:.agent-chat .thinking-label,
frontend/assets/canvas/terminal-chat.css:216:.agent-chat .thinking-preview {
frontend/assets/canvas/terminal-chat.css:223:.agent-chat .thinking-label { font-weight: 600; }
frontend/assets/canvas/terminal-chat.css:224:.agent-chat .thinking-preview { margin-top: 4px; font-weight: 400; }
frontend/assets/canvas/terminal-chat.css:225:.agent-chat .transcript-card,
frontend/assets/canvas/terminal-chat.css:226:.agent-chat .tool-card {
frontend/assets/canvas/terminal-chat.css:232:.agent-chat .tool-card { padding: 6px 8px; }
frontend/assets/canvas/terminal-chat.css:233:.agent-chat .voice-head,
frontend/assets/canvas/terminal-chat.css:234:.agent-chat .tool-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; }
frontend/assets/canvas/terminal-chat.css:235:.agent-chat .voice-primary {
frontend/assets/canvas/terminal-chat.css:245:.agent-chat .voice-head-right { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; padding: 0 8px; background: rgba(6, 8, 10, 0.98); }
frontend/assets/canvas/terminal-chat.css:246:.agent-chat .voice-spinner,
frontend/assets/canvas/terminal-chat.css:247:.agent-chat .tool-spinner {
frontend/assets/canvas/terminal-chat.css:255:.agent-chat .voice-mic-icon {
frontend/assets/canvas/terminal-chat.css:265:.agent-chat .tool-title { color: #9aa4b2; font-size: 11px; font-weight: 600; }
frontend/assets/canvas/terminal-chat.css:266:.agent-chat .tool-count { color: #9aa4b2; font-size: 10px; font-weight: 700; margin-left: auto; margin-right: 5px; }
frontend/assets/canvas/terminal-chat.css:267:.agent-chat .tool-state { color: #9aa4b2; font-size: 9px; margin-right: 5px; }
frontend/assets/canvas/terminal-chat.css:268:.agent-chat .tool-summary {
frontend/test/unit/canvas/helper/calculate-viewport-transform.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/toolbox/toolbox-navigation-zone.integration.test.ts:23:    specs_ledger_file: 'generated-specs-ledger.json',
frontend/test/unit/voice/effect/request-transcription.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/refresh/controller/handle-client-refresh-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/assets/canvas/objects.css:37:.regular-zone[data-zone-id="zone-frontend"] {
frontend/assets/canvas/objects.css:45:.regular-zone[data-zone-id="zone-backend"] {
frontend/assets/canvas/objects.css:262:.card[data-card-id="card-boot"] { left: 120px; top: 300px; }
frontend/assets/canvas/objects.css:263:.card[data-card-id="card-zone"] { left: 420px; top: 190px; }
frontend/assets/canvas/objects.css:264:.card[data-card-id="card-ledger"] { left: 420px; top: 555px; }
frontend/assets/canvas/objects.css:289:.card[data-card-work-status="processing"] .card-status-indicator {
frontend/assets/canvas/objects.css:294:.card[data-card-work-status="done"] .card-status-indicator {
frontend/assets/canvas/objects.css:401:.ledger-card-title[data-title-heading="1"] {
frontend/assets/canvas/objects.css:405:.ledger-card-title[data-title-heading="2"] {
frontend/assets/canvas/objects.css:409:.ledger-card-title[data-title-heading="3"] {
frontend/assets/canvas/objects.css:413:.ledger-card-title[data-title-heading="4"],
frontend/assets/canvas/objects.css:414:.ledger-card-title[data-title-heading="5"],
frontend/assets/canvas/objects.css:415:.ledger-card-title[data-title-heading="6"] {
frontend/assets/canvas/objects.css:437:.ledger-card-status-toggle[data-next-status] {
frontend/assets/canvas/objects.css:459:.ledger-card-status-toggle[data-next-status="done"] {
frontend/assets/canvas/objects.css:466:.codex-run-widget {
frontend/assets/canvas/objects.css:480:.codex-run-body {
frontend/assets/canvas/objects.css:487:.codex-run-header,
frontend/assets/canvas/objects.css:488:.codex-run-metrics {
frontend/assets/canvas/objects.css:496:.codex-run-cancel {
frontend/assets/canvas/objects.css:504:.codex-run-cancel:disabled {
frontend/assets/canvas/objects.css:509:.codex-run-status,
frontend/assets/canvas/objects.css:510:.codex-run-timer,
frontend/assets/canvas/objects.css:511:.codex-run-metric {
frontend/assets/canvas/objects.css:521:.codex-run-timer {
frontend/assets/canvas/objects.css:536:.codex-run-metrics {
frontend/assets/canvas/objects.css:541:.codex-run-metric {
frontend/assets/canvas/objects.css:547:.codex-run-metric strong {
frontend/assets/canvas/objects.css:553:.codex-run-latest {
frontend/assets/canvas/objects.css:564:.codex-run-widget[data-run-status="complete"] {
frontend/assets/canvas/objects.css:570:.codex-run-widget[data-run-status="failed"] {
frontend/assets/canvas/objects.css:576:.codex-run-widget[data-run-status="cancelled"] {
frontend/assets/canvas/objects.css:582:.codex-run-widget[data-run-status="unknown"] {
frontend/assets/canvas/objects.css:588:.codex-run-widget:not([data-run-status="running"]) .codex-run-timer {
frontend/assets/canvas/objects.css:694:.ledger-card-tab-frame[data-active-card-tab="description"] {
frontend/assets/canvas/objects.css:700:.ledger-card-tab-frame[data-active-card-tab="description"] .ledger-card-description-panel.is-active {
backend/src/business/server/helper/create-http-server.ts:25:import { scanCodexSkills } from '../../codex/helper/scan-codex-skills.js';
backend/src/business/server/helper/create-http-server.ts:26:import { startCardSkillProcessController } from '../../codex/controller/start-card-skill-process-controller.js';
backend/src/business/server/helper/create-http-server.ts:27:import { readCardSkillRunController } from '../../codex/controller/read-card-skill-run-controller.js';
backend/src/business/server/helper/create-http-server.ts:28:import { cancelCardSkillRunController } from '../../codex/controller/cancel-card-skill-run-controller.js';
backend/src/business/server/helper/create-http-server.ts:126:export function createHttpServer(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/server/helper/create-http-server.ts:128:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/server/helper/create-http-server.ts:132:  const configuredFrontendRoot = payload.decisionOsFrontendRoot ?? payload.frontendRoot ?? process.env.DECISION_OS_FRONTEND_ROOT ?? runtime.decisionOsFrontendRoot;
backend/src/business/server/helper/create-http-server.ts:135:    : existsSync(resolve(process.cwd(), 'frontend'))
backend/src/business/server/helper/create-http-server.ts:136:      ? resolve(process.cwd(), 'frontend')
backend/src/business/server/helper/create-http-server.ts:137:      : resolve(process.cwd(), '..', 'frontend');
backend/src/business/server/helper/create-http-server.ts:145:    const message = `event: card-content-change\ndata: ${JSON.stringify(event)}\n\n`;
backend/src/business/server/helper/create-http-server.ts:149:    const message = `event: ledger-content-change\ndata: ${JSON.stringify(event)}\n\n`;
backend/src/business/server/helper/create-http-server.ts:173:    if (url === '/api/codex/skills' && request.method === 'GET') {
backend/src/business/server/helper/create-http-server.ts:175:      const skills = scanCodexSkills({ workspaceRoot }).map((skill) => ({
backend/src/business/server/helper/create-http-server.ts:176:        name: skill.name,
backend/src/business/server/helper/create-http-server.ts:177:        description: skill.description,
backend/src/business/server/helper/create-http-server.ts:178:        source: skill.source
backend/src/business/server/helper/create-http-server.ts:182:      response.end(JSON.stringify({ ok: true, skills }));
backend/src/business/server/helper/create-http-server.ts:185:    if (url === '/api/codex/skills/process' && request.method === 'POST') {
backend/src/business/server/helper/create-http-server.ts:187:      const processPayload = (() => {
backend/src/business/server/helper/create-http-server.ts:195:        action_payload: { ...processPayload, onLedgerChange: publishLedgerContentChange },
backend/src/business/server/helper/create-http-server.ts:203:    if (url.startsWith('/api/codex/skills/runs/') && request.method === 'GET') {
backend/src/business/server/helper/create-http-server.ts:205:      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length));
backend/src/business/server/helper/create-http-server.ts:220:    if (url.startsWith('/api/codex/skills/runs/') && url.endsWith('/cancel') && request.method === 'POST') {
backend/src/business/server/helper/create-http-server.ts:229:      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length, -'/cancel'.length));
frontend/test/unit/canvas/effect/render-canvas-surface.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/assets/canvas/thread.css:11:.thread-panel.agent-chat.phone {
frontend/assets/canvas/thread.css:128:.thread-note.is-agent {
frontend/assets/canvas/thread.css:136:.thread-note.is-agent .thread-note-message,
frontend/assets/canvas/thread.css:137:.thread-note.is-agent .thread-note-message p {
frontend/assets/canvas/thread.css:143:.thread-note.is-agent .thread-note-meta {
frontend/assets/canvas/thread.css:147:.thread-note.is-codex-run-event {
frontend/assets/canvas/thread.css:155:.thread-note.is-codex-run-event .thread-note-meta {
frontend/assets/canvas/thread.css:169:.thread-note.is-codex-tool_call {
frontend/assets/canvas/thread.css:173:.thread-note.is-codex-thinking {
frontend/assets/canvas/thread.css:177:.thread-note.is-codex-file_change {
frontend/assets/canvas/thread.css:181:.thread-note.is-codex-run_status {
frontend/assets/canvas/thread.css:185:.thread-note.is-codex-tool_call .ledger-card-code-block {
frontend/test/voice/voice-thread.integration.test.ts:22:    specs_ledger_file: 'generated-specs-ledger.json',
backend/test/unit/server/controller/start-http-server-controller.test.ts:19:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/test/unit/server/controller/start-http-server-controller.test.ts:40:      data_model: {}
backend/src/business/routing/helper/parse-http-request.ts:11:export function parseHttpRequest(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/routing/helper/parse-http-request.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/routing/helper/parse-http-request.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/assets/canvas/dialogs.css:17:.skill-modal button {
frontend/assets/canvas/dialogs.css:33:.skill-modal button:hover,
frontend/assets/canvas/dialogs.css:34:.skill-modal button:focus-visible {
frontend/assets/canvas/dialogs.css:42:.skill-modal {
frontend/assets/canvas/dialogs.css:54:.skill-modal h2 {
frontend/assets/canvas/dialogs.css:59:.skill-modal {
frontend/assets/canvas/dialogs.css:64:.skill-search {
frontend/assets/canvas/dialogs.css:76:.skill-search:focus {
frontend/assets/canvas/dialogs.css:82:.skill-run-controls {
frontend/assets/canvas/dialogs.css:89:.skill-run-field {
frontend/assets/canvas/dialogs.css:100:.skill-run-field select {
frontend/assets/canvas/dialogs.css:111:.skill-run-field select:focus {
frontend/assets/canvas/dialogs.css:117:.skill-results {
frontend/assets/canvas/dialogs.css:125:.skill-result {
frontend/assets/canvas/dialogs.css:136:.skill-result.is-selected {
frontend/assets/canvas/dialogs.css:142:.skill-result-name {
frontend/assets/canvas/dialogs.css:153:.skill-result-source {
frontend/assets/canvas/dialogs.css:160:.skill-result-description {
frontend/assets/canvas/dialogs.css:167:.skill-empty,
frontend/assets/canvas/dialogs.css:168:.skill-error {
frontend/assets/canvas/dialogs.css:173:.skill-error {
frontend/assets/canvas/dialogs.css:177:.skill-actions {
frontend/assets/canvas/dialogs.css:185:.skill-actions .skill-error {
frontend/assets/canvas/dialogs.css:189:.skill-selected-name {
frontend/assets/canvas/dialogs.css:200:.skill-process-button {
frontend/assets/canvas/dialogs.css:207:  .skill-run-controls {
backend/src/business/server/helper/content-type-for.ts:22:  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
frontend/assets/canvas/shell.css:184:.topbar [data-tab] {
backend/src/business/routing/helper/resolve-ledger-route.ts:11:export function resolveLedgerRoute(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/routing/helper/resolve-ledger-route.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/routing/helper/resolve-ledger-route.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/unit/refresh/effect/subscribe-server-refresh.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/assets/canvas/canvas-layer.css:121:.canvas-control .ledger-card-skill-toggle {
frontend/assets/canvas/canvas-layer.css:266:.canvas.ledgers-canvas-mode .card[data-card-type="ledger"] {
frontend/assets/canvas/canvas-layer.css:275:.canvas.ledgers-canvas-mode .card[data-card-type="ledger"]:hover,
frontend/assets/canvas/canvas-layer.css:276:.canvas.ledgers-canvas-mode .card[data-card-type="ledger"]:focus-visible {
frontend/assets/canvas/canvas-layer.css:284:.canvas.ledgers-canvas-mode .card[data-card-type="ledger"] .card-status-indicator,
frontend/assets/canvas/canvas-layer.css:285:.canvas.ledgers-canvas-mode .card[data-card-type="ledger"] .ledger-card-overview-status {
frontend/assets/canvas/canvas-layer.css:289:.canvas.ledgers-canvas-mode .card[data-card-type="ledger"]:not(.detail-visible) .ledger-card-overview-title {
frontend/assets/canvas/canvas-layer.css:305:.canvas .card:not(.detail-visible)[data-card-work-status="todo"] .ledger-card-overview-status,
frontend/assets/canvas/canvas-layer.css:306:.canvas .card:not(.detail-visible)[data-card-work-status="processing"] .ledger-card-overview-status {
frontend/assets/canvas/canvas-layer.css:322:.canvas.low-detail .card:not(.detail-visible)[data-card-work-status="todo"] .ledger-card-overview-status {
frontend/assets/canvas/canvas-layer.css:328:.canvas.low-detail .card:not(.detail-visible)[data-card-work-status="processing"] .ledger-card-overview-status {
frontend/test/unit/boot/helper/load-ledger-state.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/assets/canvas/terminal-chat-controls.css:6:.agent-chat .io { flex: 0 0 auto; padding: 0 10px 10px; }
frontend/assets/canvas/terminal-chat-controls.css:7:.agent-chat .control-dock {
frontend/assets/canvas/terminal-chat-controls.css:16:.agent-chat .wave-panel,
frontend/assets/canvas/terminal-chat-controls.css:17:.agent-chat .meter-track {
frontend/assets/canvas/terminal-chat-controls.css:25:.agent-chat .wave-panel {
frontend/assets/canvas/terminal-chat-controls.css:31:.agent-chat .wave-panel::after,
frontend/assets/canvas/terminal-chat-controls.css:32:.agent-chat .meter-track::after {
frontend/assets/canvas/terminal-chat-controls.css:41:.agent-chat .wave-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; z-index: 1; }
frontend/assets/canvas/terminal-chat-controls.css:42:.agent-chat .wave-area-path,
frontend/assets/canvas/terminal-chat-controls.css:43:.agent-chat .wave-core-path {
frontend/assets/canvas/terminal-chat-controls.css:46:.agent-chat .wave-panel[data-front-wave-enabled="false"] .wave-core-path {
frontend/assets/canvas/terminal-chat-controls.css:49:.agent-chat .wave-head-glow {
frontend/assets/canvas/terminal-chat-controls.css:52:.agent-chat .wave-head-line {
frontend/assets/canvas/terminal-chat-controls.css:56:.agent-chat .wave-timer {
frontend/assets/canvas/terminal-chat-controls.css:72:.agent-chat .meter-panel { border: 0; background: transparent; padding: 0; display: flex; align-items: stretch; justify-content: center; height: 100%; }
frontend/assets/canvas/terminal-chat-controls.css:73:.agent-chat .meter-track { width: 100%; height: 100%; background: linear-gradient(180deg, #1a232c 0%, #11171d 100%); display: flex; align-items: end; }
frontend/assets/canvas/terminal-chat-controls.css:74:.agent-chat .meter-fill { position: relative; z-index: 1; width: 100%; height: 44%; background: linear-gradient(180deg, color-mix(in srgb, var(--thread-accent, #ff7043), white 34%) 0%, var(--thread-accent, #ff7043) 100%); border-radius: 2px; transition: none; }
frontend/assets/canvas/terminal-chat-controls.css:76:.agent-chat .voice-style-panel {
frontend/assets/canvas/terminal-chat-controls.css:84:.agent-chat .voice-style-field {
frontend/assets/canvas/terminal-chat-controls.css:98:.agent-chat .voice-style-field span,
frontend/assets/canvas/terminal-chat-controls.css:99:.agent-chat .voice-font-cycle span {
frontend/assets/canvas/terminal-chat-controls.css:106:.agent-chat .voice-style-field input[type="range"] {
frontend/assets/canvas/terminal-chat-controls.css:111:.agent-chat .voice-style-field--color {
frontend/assets/canvas/terminal-chat-controls.css:115:.agent-chat .voice-style-field input[type="color"] {
frontend/assets/canvas/terminal-chat-controls.css:123:.agent-chat .voice-font-cycle {
frontend/assets/canvas/terminal-chat-controls.css:140:.agent-chat .voice-font-cycle strong {
frontend/src/business/zone/helper/resolve-zone-selection-membership.ts:9:export function resolveZoneSelectionMembership(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/zone/helper/resolve-zone-selection-membership.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/zone/helper/resolve-zone-selection-membership.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/routing/controller/dispatch-route-controller.ts:12:export async function dispatchRouteController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/routing/controller/dispatch-route-controller.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/routing/controller/dispatch-route-controller.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/routing/controller/dispatch-route-controller.ts:17:  const request = parseHttpRequest({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/routing/controller/dispatch-route-controller.ts:18:  const route = resolveLedgerRoute({ action_payload: { ...payload, ...request }, runtime_state: runtime, data_model: data });
backend/src/business/routing/controller/dispatch-route-controller.ts:19:  const ledger = route.ok === false ? { ok: false, document: null } : readLedgerJsonFile({ action_payload: { ...payload, ...route }, runtime_state: runtime, data_model: data });
backend/src/business/routing/controller/dispatch-route-controller.ts:20:  sendJsonResponse({ action_payload: { ...payload, status: route.ok === false ? 404 : 200, body: ledger }, runtime_state: runtime, data_model: data });
frontend/test/unit/group/helper/resolve-group-membership.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/server/controller/start-http-server-controller.ts:12:export async function startHttpServerController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/server/controller/start-http-server-controller.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/server/controller/start-http-server-controller.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/server/controller/start-http-server-controller.ts:17:  const settings = readDecisionOsSettings({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/server/controller/start-http-server-controller.ts:19:  const state = readDecisionOsState({ action_payload: settingsPayload, runtime_state: runtime, data_model: data });
backend/src/business/server/controller/start-http-server-controller.ts:20:  const watch = watchLedgerDirectory({ action_payload: settingsPayload, runtime_state: runtime, data_model: data });
backend/src/business/server/controller/start-http-server-controller.ts:21:  const server = createHttpServer({ action_payload: settingsPayload, runtime_state: runtime, data_model: data });
frontend/src/business/zone/helper/confirm-zone-deletion.ts:9:export function confirmZoneDeletion(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/zone/helper/confirm-zone-deletion.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/zone/helper/confirm-zone-deletion.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/unit/group/helper/resolve-click-precedence.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/boot/controller/boot-surface-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/src/business/toolbox/helper/resolve-tool-mode.ts:9:export function resolveToolMode(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/toolbox/helper/resolve-tool-mode.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/toolbox/helper/resolve-tool-mode.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/unit/runtime/relationship/helper/route-relationship-path.test.ts:5:  (globalThis as any).window = { location: { pathname: '/specs' }, dispatchEvent() {}, __coreTelemetry: [] };
frontend/src/business/zone/helper/calculate-zone-geometry.ts:9:export function calculateZoneGeometry(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/zone/helper/calculate-zone-geometry.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/zone/helper/calculate-zone-geometry.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/routing/effect/send-json-response.ts:11:export function sendJsonResponse(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
backend/src/business/routing/effect/send-json-response.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/unit/relationship/helper/route-relationship-path.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/src/business/refresh/helper/merge-refresh-state.ts:9:export function mergeRefreshState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/refresh/helper/merge-refresh-state.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/refresh/helper/merge-refresh-state.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/unit/group/controller/edit-group-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/src/business/zone/helper/validate-zone-draft.ts:9:export function validateZoneDraft(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/zone/helper/validate-zone-draft.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/zone/helper/validate-zone-draft.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:27:  dataset: Record<string, string> = {};
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:260:    assert.equal(pre.dataset.language, 'cpp');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:295:    assert.equal(pre.dataset.language, 'ts');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:347:    assert.equal(card.dataset.cardLabels, 'validated,runtime');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:374:    assert.equal(card.dataset.cardZoneId, 'zone-owner');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:375:    assert.equal(card.dataset.cardZoneColor, '#eab308');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:421:    assert.equal(title.dataset.titleHeading, '3');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:460:    assert.equal(button.dataset.action, 'edit-card-title');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:461:    assert.equal(button.dataset.cardId, 'card-title-edit');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:487:    assert.equal(button.dataset.action, 'confirm-delete-card');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:488:    assert.equal(button.dataset.cardId, 'card-delete');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:541:    assert.equal(card.dataset.cardType, 'ledger');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:542:    assert.equal(card.dataset.targetLedgerId, 'ux');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:599:    assert.equal(card.dataset.activeCardTab, 'fields');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:601:    assert.equal((tabs.children[0] as FakeElement).dataset.action, 'switch-card-tab');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:604:    assert.equal(frame.dataset.wheelCapture, 'true');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:605:    assert.equal(description.dataset.cardPanel, 'description');
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts:606:    assert.equal(fields.dataset.cardPanel, 'fields');
frontend/src/business/refresh/controller/handle-client-refresh-controller.ts:12:export async function handleClientRefreshController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/refresh/controller/handle-client-refresh-controller.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/refresh/controller/handle-client-refresh-controller.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/refresh/controller/handle-client-refresh-controller.ts:17:  subscribeServerRefresh({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/refresh/controller/handle-client-refresh-controller.ts:18:  const ledger = loadLedgerState({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/refresh/controller/handle-client-refresh-controller.ts:19:  const merged = mergeRefreshState({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/refresh/controller/handle-client-refresh-controller.ts:20:  renderCanvasSurface({ action_payload: { ...payload, ledger, merged }, runtime_state: runtime, data_model: data });
frontend/test/unit/relationship/helper/calculate-relationship-ports.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/runtime/card-work-status-rendering.integration.test.ts:15:  dataset: Record<string, string> = {};
frontend/test/runtime/card-work-status-rendering.integration.test.ts:61:test('ledger card chrome renders todo processing and done workflow statuses', async () => {
frontend/test/runtime/card-work-status-rendering.integration.test.ts:75:        'thread-card-processing': [{ role: 'operator', message: 'Operator sent work.' }],
frontend/test/runtime/card-work-status-rendering.integration.test.ts:76:        'thread-card-done': [{ role: 'agent', message: 'Fresh answer.' }]
frontend/test/runtime/card-work-status-rendering.integration.test.ts:81:    const processing = patchLedgerCard({ id: 'card-processing', title: 'Processing', comment: { what: 'Processing.' } }) as unknown as FakeElement;
frontend/test/runtime/card-work-status-rendering.integration.test.ts:85:    const processingIndicator = findElementByClass(processing, 'card-status-indicator') as FakeElement;
frontend/test/runtime/card-work-status-rendering.integration.test.ts:86:    const processingButton = renderLedgerCardStatusButton('card-processing', 'todo', 'processing') as unknown as FakeElement;
frontend/test/runtime/card-work-status-rendering.integration.test.ts:89:    assert.equal(todo.dataset.cardStatus, 'todo');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:90:    assert.equal(todo.dataset.cardWorkStatus, 'todo');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:92:    assert.equal(processing.dataset.cardStatus, 'todo');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:93:    assert.equal(processing.dataset.cardWorkStatus, 'processing');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:94:    assert.equal(processingIndicator.textContent, 'processing');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:95:    assert.equal(processingButton.disabled, true);
frontend/test/runtime/card-work-status-rendering.integration.test.ts:96:    assert.equal(processingButton.dataset.cardCurrentStatus, 'processing');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:97:    assert.equal(processingButton.attributes['aria-label'], 'Current status: processing. Waiting for agent response');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:98:    assert.equal(processing.children.some((child) => child instanceof FakeElement && child.className.includes('ledger-card-status-toggle')), false);
frontend/test/runtime/card-work-status-rendering.integration.test.ts:99:    assert.equal(done.dataset.cardStatus, 'done');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:100:    assert.equal(done.dataset.cardWorkStatus, 'done');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:101:    assert.equal(doneButton.dataset.cardCurrentStatus, 'done');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:102:    assert.equal(doneButton.dataset.nextStatus, 'todo');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:117:  assert.match(css, /\.ledger-card-status-toggle\[data-next-status\]/);
frontend/test/runtime/card-work-status-rendering.integration.test.ts:119:  assert.match(css, /\.ledger-card-status-toggle\[data-next-status="done"\]\s*{[^}]*--card-status-toggle-accent:\s*#74d680;/s);
frontend/test/runtime/card-work-status-rendering.integration.test.ts:120:  assert.doesNotMatch(css, /\.ledger-card-status-toggle\[data-card-current-status="done"\]\s*{[^}]*--card-status-toggle-accent:\s*#74d680;/s);
frontend/src/business/toolbox/controller/operate-toolbox-controller.ts:12:export async function operateToolboxController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/toolbox/controller/operate-toolbox-controller.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/toolbox/controller/operate-toolbox-controller.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/toolbox/controller/operate-toolbox-controller.ts:17:  const target = resolveSelectionTarget({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/toolbox/controller/operate-toolbox-controller.ts:18:  const tool = resolveToolMode({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/toolbox/controller/operate-toolbox-controller.ts:19:  renderToolbox({ action_payload: { ...payload, target, tool }, runtime_state: runtime, data_model: data });
frontend/src/business/toolbox/controller/operate-toolbox-controller.ts:20:  renderCanvasSurface({ action_payload: { ...payload, target, tool }, runtime_state: runtime, data_model: data });
frontend/test/unit/runtime/gesture/helper/is-gesture-control-target.test.ts:14:  assert.equal(isGestureControlTarget(targetWithClosest({ 'a[href],button,input,textarea,select,[data-action],[data-wheel-capture],[contenteditable="true"]': true })), true);
frontend/test/unit/runtime/gesture/helper/is-gesture-control-target.test.ts:15:  assert.equal(isGestureControlTarget(targetWithClosest({ 'a[href],button,input,textarea,select,[data-action],[data-wheel-capture],[contenteditable="true"]': false })), false);
frontend/test/unit/gesture/helper/derive-gesture-intent.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/group/effect/render-group-layer.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/refresh/helper/debounce-refresh-event.ts:11:export function debounceRefreshEvent(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/refresh/helper/debounce-refresh-event.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/refresh/helper/debounce-refresh-event.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/unit/gesture/helper/calculate-drag-delta.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/src/business/refresh/effect/subscribe-server-refresh.ts:9:export function subscribeServerRefresh(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/refresh/effect/subscribe-server-refresh.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/runtime/card-markdown-images.integration.test.ts:40:  assert.match(mediaRenderer, /dataset\.action = 'confirm-delete-card-image'/);
frontend/test/runtime/card-markdown-images.integration.test.ts:42:  assert.match(mediaRenderer, /button\.dataset\.imageSrc = image\.src/);
frontend/test/runtime/card-markdown-images.integration.test.ts:43:  assert.match(mediaRenderer, /button\.dataset\.carouselSlideIndex = String\(index\)/);
frontend/test/runtime/card-markdown-images.integration.test.ts:44:  assert.match(mediaRenderer, /button\.dataset\.carouselSources = JSON\.stringify\(images\.map/);
frontend/test/runtime/card-markdown-images.integration.test.ts:49:  assert.match(mediaRenderer, /button\.dataset\.slideIndex = String\(index\)/);
frontend/test/runtime/card-markdown-images.integration.test.ts:55:  assert.match(actionClick, /carouselSources: actionTarget\.dataset\.carouselSources/);
frontend/test/runtime/card-markdown-images.integration.test.ts:56:  assert.match(actionClick, /carouselSlideIndex: actionTarget\.dataset\.carouselSlideIndex/);
frontend/test/runtime/card-markdown-images.integration.test.ts:62:  assert.match(keyboard, /modal\.dataset\.confirmKind === 'card-image'/);
frontend/test/runtime/card-markdown-images.integration.test.ts:63:  assert.match(keyboard, /carouselSources: modal\.dataset\.carouselSources/);
frontend/test/runtime/card-markdown-images.integration.test.ts:64:  assert.match(keyboard, /carouselSlideIndex: modal\.dataset\.carouselSlideIndex/);
frontend/test/runtime/card-markdown-images.integration.test.ts:69:  assert.match(mediaRenderer, /dataset\.wheelCapture = 'true'/);
frontend/test/runtime/card-markdown-images.integration.test.ts:70:  assert.match(mediaRenderer, /dataset\.imageSizeId = sizeSource/);
frontend/test/runtime/card-markdown-images.integration.test.ts:88:  assert.match(mediaRenderer, /dataset\.mediaPromotionScale/);
frontend/test/unit/navigation/helper/derive-route-state.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/refresh/helper/watch-ledger-directory.ts:11:export function watchLedgerDirectory(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/refresh/helper/watch-ledger-directory.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/unit/relationship/controller/render-relationship-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/src/business/zone/controller/edit-zone-controller.ts:16:export async function editZoneController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/zone/controller/edit-zone-controller.ts:17:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/zone/controller/edit-zone-controller.ts:20:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/zone/controller/edit-zone-controller.ts:21:  const tool = resolveToolMode({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/zone/controller/edit-zone-controller.ts:22:  const draft = validateZoneDraft({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/zone/controller/edit-zone-controller.ts:23:  const geometry = calculateZoneGeometry({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/zone/controller/edit-zone-controller.ts:24:  const membership = resolveZoneSelectionMembership({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/zone/controller/edit-zone-controller.ts:25:  const deletion = confirmZoneDeletion({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/zone/controller/edit-zone-controller.ts:27:    commitLedgerEdit({ action_payload: { ...payload, tool, draft, geometry, membership, deletion }, runtime_state: runtime, data_model: data });
frontend/src/business/zone/controller/edit-zone-controller.ts:29:  renderZoneLayer({ action_payload: { ...payload, tool, draft, geometry, membership, deletion }, runtime_state: runtime, data_model: data });
frontend/src/business/zone/controller/edit-zone-controller.ts:30:  renderCanvasSurface({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/toolbox/effect/render-toolbox.ts:9:export function renderToolbox(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/toolbox/effect/render-toolbox.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/unit/gesture/controller/handle-canvas-gesture-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:2: * WHAT: Runtime tests for target-title thread headers and card agent indicators.
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:7:import { cardHasAgentLastAnswer } from '../../src/runtime/card/helper/card-has-agent-last-answer.js';
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:42:test('card-has-agent-last-answer only marks assistant or agent latest notes', () => {
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:57:test('resolve-card-work-status derives processing from latest operator notes and lets done win', () => {
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:68:    assert.equal(resolveCardWorkStatus({ id: 'card-b' }), 'processing');
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:70:    assert.equal(resolveCardWorkStatus({ id: 'card-d' }), 'processing');
backend/src/business/ledger/helper/read-decision-os-state.ts:13:export function readDecisionOsState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/ledger/helper/read-decision-os-state.ts:15:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts:96:  assert.deepEqual(parseLedgerCardMarkdown('::html[Preview](.decision-os/cards/specs/assets/preview.html)\n\n::html[](.decision-os/cards/specs/assets/second.html "Second")\n\nText ::html[Inline](.decision-os/cards/specs/assets/inline.html)'), [
frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts:100:        { title: 'Preview', src: '.decision-os/cards/specs/assets/preview.html' },
frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts:101:        { title: 'Second', src: '.decision-os/cards/specs/assets/second.html' }
frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts:108:        { kind: 'link', text: 'Inline', href: '.decision-os/cards/specs/assets/inline.html', title: '' }
frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts:115:  assert.deepEqual(parseLedgerCardMarkdown('```md\n::html[Preview](.decision-os/cards/specs/assets/preview.html)\n```'), [
frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts:119:      text: '::html[Preview](.decision-os/cards/specs/assets/preview.html)'
frontend/assets/vendor/highlight.min.js:1:var hljs=(()=>{var A=(e,n)=>()=>(n||e((n={exports:{}}).exports,n),n.exports);var fn=A((_r,_n)=>{function an(e){return e instanceof Map?e.clear=e.delete=e.set=function(){throw new Error("map is read-only")}:e instanceof Set&&(e.add=e.clear=e.delete=function(){throw new Error("set is read-only")}),Object.freeze(e),Object.getOwnPropertyNames(e).forEach(n=>{let t=e[n],i=typeof t;(i==="object"||i==="function")&&!Object.isFrozen(t)&&an(t)}),e}var we=class{constructor(n){n.data===void 0&&(n.data={}),this.data=n.data,this.isMatchIgnored=!1}ignoreMatch(){this.isMatchIgnored=!0}};function rn(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;")}function re(e,...n){let t=Object.create(null);for(let i in e)t[i]=e[i];return n.forEach(function(i){for(let s in i)t[s]=i[s]}),t}var si="</span>",Qe=e=>!!e.scope,ci=(e,{prefix:n})=>{if(e.startsWith("language:"))return e.replace("language:","language-");if(e.includes(".")){let t=e.split(".");return[`${n}${t.shift()}`,...t.map((i,s)=>`${i}${"_".repeat(s+1)}`)].join(" ")}return`${n}${e}`},$e=class{constructor(n,t){this.buffer="",this.classPrefix=t.classPrefix,n.walk(this)}addText(n){this.buffer+=rn(n)}openNode(n){if(!Qe(n))return;let t=ci(n.scope,{prefix:this.classPrefix});this.span(t)}closeNode(n){Qe(n)&&(this.buffer+=si)}value(){return this.buffer}span(n){this.buffer+=`<span class="${n}">`}},Je=(e={})=>{let n={children:[]};return Object.assign(n,e),n},Ke=class e{constructor(){this.rootNode=Je(),this.stack=[this.rootNode]}get top(){return this.stack[this.stack.length-1]}get root(){return this.rootNode}add(n){this.top.children.push(n)}openNode(n){let t=Je({scope:n});this.add(t),this.stack.push(t)}closeNode(){if(this.stack.length>1)return this.stack.pop()}closeAllNodes(){for(;this.closeNode(););}toJSON(){return JSON.stringify(this.rootNode,null,4)}walk(n){return this.constructor._walk(n,this.rootNode)}static _walk(n,t){return typeof t=="string"?n.addText(t):t.children&&(n.openNode(t),t.children.forEach(i=>this._walk(n,i)),n.closeNode(t)),n}static _collapse(n){typeof n!="string"&&n.children&&(n.children.every(t=>typeof t=="string")?n.children=[n.children.join("")]:n.children.forEach(t=>{e._collapse(t)}))}},Ge=class extends Ke{constructor(n){super(),this.options=n}addText(n){n!==""&&this.add(n)}startScope(n){this.openNode(n)}endScope(){this.closeNode()}__addSublanguage(n,t){let i=n.root;t&&(i.scope=`language:${t}`),this.add(i)}toHTML(){return new $e(this,this.options).value()}finalize(){return this.closeAllNodes(),!0}};function _e(e){return e?typeof e=="string"?e:e.source:null}function on(e){return ce("(?=",e,")")}function li(e){return ce("(?:",e,")*")}function di(e){return ce("(?:",e,")?")}function ce(...e){return e.map(t=>_e(t)).join("")}function ui(e){let n=e[e.length-1];return typeof n=="object"&&n.constructor===Object?(e.splice(e.length-1,1),n):{}}function qe(...e){return"("+(ui(e).capture?"":"?:")+e.map(i=>_e(i)).join("|")+")"}function sn(e){return new RegExp(e.toString()+"|").exec("").length-1}function gi(e,n){let t=e&&e.exec(n);return t&&t.index===0}var bi=/\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;function We(e,{joinWith:n}){let t=0;return e.map(i=>{t+=1;let s=t,u=_e(i),r="";for(;u.length>0;){let a=bi.exec(u);if(!a){r+=u;break}r+=u.substring(0,a.index),u=u.substring(a.index+a[0].length),a[0][0]==="\\"&&a[1]?r+="\\"+String(Number(a[1])+s):(r+=a[0],a[0]==="("&&t++)}return r}).map(i=>`(${i})`).join(n)}var pi=/\b\B/,cn="[a-zA-Z]\\w*",Ye="[a-zA-Z_]\\w*",ln="\\b\\d+(\\.\\d+)?",dn="(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)",un="\\b(0b[01]+)",mi="!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~",_i=(e={})=>{let n=/^#![ ]*\//;return e.binary&&(e.begin=ce(n,/.*\b/,e.binary,/\b.*/)),re({scope:"meta",begin:n,end:/$/,relevance:0,"on:begin":(t,i)=>{t.index!==0&&i.ignoreMatch()}},e)},fe={begin:"\\\\[\\s\\S]",relevance:0},fi={scope:"string",begin:"'",end:"'",illegal:"\\n",contains:[fe]},Ei={scope:"string",begin:'"',end:'"',illegal:"\\n",contains:[fe]},hi={begin:/\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/},Oe=function(e,n,t={}){let i=re({scope:"comment",begin:e,end:n,contains:[]},t);i.contains.push({scope:"doctag",begin:"[ ]*(?=(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):)",end:/(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):/,excludeBegin:!0,relevance:0});let s=qe("I","a","is","so","us","to","at","if","in","it","on",/[A-Za-z]+['](d|ve|re|ll|t|s|n)/,/[A-Za-z]+[-][a-z]+/,/[A-Za-z][a-z]{2,}/);return i.contains.push({begin:ce(/[ ]+/,"(",s,/[.]?[:]?([.][ ]|[ ])/,"){3}")}),i},Ni=Oe("//","$"),yi=Oe("/\\*","\\*/"),Ti=Oe("#","$"),Si={scope:"number",begin:ln,relevance:0},wi={scope:"number",begin:dn,relevance:0},vi={scope:"number",begin:un,relevance:0},Oi={scope:"regexp",begin:/\/(?=[^/\n]*\/)/,end:/\/[gimuy]*/,contains:[fe,{begin:/\[/,end:/\]/,relevance:0,contains:[fe]}]},Ai={scope:"title",begin:cn,relevance:0},Ri={scope:"title",begin:Ye,relevance:0},Mi={begin:"\\.\\s*"+Ye,relevance:0},ki=function(e){return Object.assign(e,{"on:begin":(n,t)=>{t.data._beginMatch=n[1]},"on:end":(n,t)=>{t.data._beginMatch!==n[1]&&t.ignoreMatch()}})},Se=Object.freeze({__proto__:null,APOS_STRING_MODE:fi,BACKSLASH_ESCAPE:fe,BINARY_NUMBER_MODE:vi,BINARY_NUMBER_RE:un,COMMENT:Oe,C_BLOCK_COMMENT_MODE:yi,C_LINE_COMMENT_MODE:Ni,C_NUMBER_MODE:wi,C_NUMBER_RE:dn,END_SAME_AS_BEGIN:ki,HASH_COMMENT_MODE:Ti,IDENT_RE:cn,MATCH_NOTHING_RE:pi,METHOD_GUARD:Mi,NUMBER_MODE:Si,NUMBER_RE:ln,PHRASAL_WORDS_MODE:hi,QUOTE_STRING_MODE:Ei,REGEXP_MODE:Oi,RE_STARTERS_RE:mi,SHEBANG:_i,TITLE_MODE:Ai,UNDERSCORE_IDENT_RE:Ye,UNDERSCORE_TITLE_MODE:Ri});function xi(e,n){e.input[e.index-1]==="."&&n.ignoreMatch()}function Ii(e,n){e.className!==void 0&&(e.scope=e.className,delete e.className)}function Ci(e,n){n&&e.beginKeywords&&(e.begin="\\b("+e.beginKeywords.split(" ").join("|")+")(?!\\.)(?=\\b|\\s)",e.__beforeBegin=xi,e.keywords=e.keywords||e.beginKeywords,delete e.beginKeywords,e.relevance===void 0&&(e.relevance=0))}function Li(e,n){Array.isArray(e.illegal)&&(e.illegal=qe(...e.illegal))}function Di(e,n){if(e.match){if(e.begin||e.end)throw new Error("begin & end are not supported with match");e.begin=e.match,delete e.match}}function Bi(e,n){e.relevance===void 0&&(e.relevance=1)}var Ui=(e,n)=>{if(!e.beforeMatch)return;if(e.starts)throw new Error("beforeMatch cannot be used with starts");let t=Object.assign({},e);Object.keys(e).forEach(i=>{delete e[i]}),e.keywords=t.keywords,e.begin=ce(t.beforeMatch,on(t.begin)),e.starts={relevance:0,contains:[Object.assign(t,{endsParent:!0})]},e.relevance=0,delete t.beforeMatch},Pi=["of","and","for","in","not","or","if","then","parent","list","value"],Fi="keyword";function gn(e,n,t=Fi){let i=Object.create(null);return typeof e=="string"?s(t,e.split(" ")):Array.isArray(e)?s(t,e):Object.keys(e).forEach(function(u){Object.assign(i,gn(e[u],n,u))}),i;function s(u,r){n&&(r=r.map(a=>a.toLowerCase())),r.forEach(function(a){let o=a.split("|");i[o[0]]=[u,zi(o[0],o[1])]})}}function zi(e,n){return n?Number(n):$i(e)?0:1}function $i(e){return Pi.includes(e.toLowerCase())}var je={},se=e=>{console.error(e)},en=(e,...n)=>{console.log(`WARN: ${e}`,...n)},ue=(e,n)=>{je[`${e}/${n}`]||(console.log(`Deprecated as of ${e}. ${n}`),je[`${e}/${n}`]=!0)},ve=new Error;function bn(e,n,{key:t}){let i=0,s=e[t],u={},r={};for(let a=1;a<=n.length;a++)r[a+i]=s[a],u[a+i]=!0,i+=sn(n[a-1]);e[t]=r,e[t]._emit=u,e[t]._multi=!0}function Ki(e){if(Array.isArray(e.begin)){if(e.skip||e.excludeBegin||e.returnBegin)throw se("skip, excludeBegin, returnBegin not compatible with beginScope: {}"),ve;if(typeof e.beginScope!="object"||e.beginScope===null)throw se("beginScope must be object"),ve;bn(e,e.begin,{key:"beginScope"}),e.begin=We(e.begin,{joinWith:""})}}function Gi(e){if(Array.isArray(e.end)){if(e.skip||e.excludeEnd||e.returnEnd)throw se("skip, excludeEnd, returnEnd not compatible with endScope: {}"),ve;if(typeof e.endScope!="object"||e.endScope===null)throw se("endScope must be object"),ve;bn(e,e.end,{key:"endScope"}),e.end=We(e.end,{joinWith:""})}}function Hi(e){e.scope&&typeof e.scope=="object"&&e.scope!==null&&(e.beginScope=e.scope,delete e.scope)}function qi(e){Hi(e),typeof e.beginScope=="string"&&(e.beginScope={_wrap:e.beginScope}),typeof e.endScope=="string"&&(e.endScope={_wrap:e.endScope}),Ki(e),Gi(e)}function Wi(e){function n(r,a){return new RegExp(_e(r),"m"+(e.case_insensitive?"i":"")+(e.unicodeRegex?"u":"")+(a?"g":""))}class t{constructor(){this.matchIndexes={},this.regexes=[],this.matchAt=1,this.position=0}addRule(a,o){o.position=this.position++,this.matchIndexes[this.matchAt]=o,this.regexes.push([o,a]),this.matchAt+=sn(a)+1}compile(){this.regexes.length===0&&(this.exec=()=>null);let a=this.regexes.map(o=>o[1]);this.matcherRe=n(We(a,{joinWith:"|"}),!0),this.lastIndex=0}exec(a){this.matcherRe.lastIndex=this.lastIndex;let o=this.matcherRe.exec(a);if(!o)return null;let c=o.findIndex((f,b)=>b>0&&f!==void 0),d=this.matchIndexes[c];return o.splice(0,c),Object.assign(o,d)}}class i{constructor(){this.rules=[],this.multiRegexes=[],this.count=0,this.lastIndex=0,this.regexIndex=0}getMatcher(a){if(this.multiRegexes[a])return this.multiRegexes[a];let o=new t;return this.rules.slice(a).forEach(([c,d])=>o.addRule(c,d)),o.compile(),this.multiRegexes[a]=o,o}resumingScanAtSamePosition(){return this.regexIndex!==0}considerAll(){this.regexIndex=0}addRule(a,o){this.rules.push([a,o]),o.type==="begin"&&this.count++}exec(a){let o=this.getMatcher(this.regexIndex);o.lastIndex=this.lastIndex;let c=o.exec(a);if(this.resumingScanAtSamePosition()&&!(c&&c.index===this.lastIndex)){let d=this.getMatcher(0);d.lastIndex=this.lastIndex+1,c=d.exec(a)}return c&&(this.regexIndex+=c.position+1,this.regexIndex===this.count&&this.considerAll()),c}}function s(r){let a=new i;return r.contains.forEach(o=>a.addRule(o.begin,{rule:o,type:"begin"})),r.terminatorEnd&&a.addRule(r.terminatorEnd,{type:"end"}),r.illegal&&a.addRule(r.illegal,{type:"illegal"}),a}function u(r,a){let o=r;if(r.isCompiled)return o;[Ii,Di,qi,Ui].forEach(d=>d(r,a)),e.compilerExtensions.forEach(d=>d(r,a)),r.__beforeBegin=null,[Ci,Li,Bi].forEach(d=>d(r,a)),r.isCompiled=!0;let c=null;return typeof r.keywords=="object"&&r.keywords.$pattern&&(r.keywords=Object.assign({},r.keywords),c=r.keywords.$pattern,delete r.keywords.$pattern),c=c||/\w+/,r.keywords&&(r.keywords=gn(r.keywords,e.case_insensitive)),o.keywordPatternRe=n(c,!0),a&&(r.begin||(r.begin=/\B|\b/),o.beginRe=n(o.begin),!r.end&&!r.endsWithParent&&(r.end=/\B|\b/),r.end&&(o.endRe=n(o.end)),o.terminatorEnd=_e(o.end)||"",r.endsWithParent&&a.terminatorEnd&&(o.terminatorEnd+=(r.end?"|":"")+a.terminatorEnd)),r.illegal&&(o.illegalRe=n(r.illegal)),r.contains||(r.contains=[]),r.contains=[].concat(...r.contains.map(function(d){return Yi(d==="self"?r:d)})),r.contains.forEach(function(d){u(d,o)}),r.starts&&u(r.starts,a),o.matcher=s(o),o}if(e.compilerExtensions||(e.compilerExtensions=[]),e.contains&&e.contains.includes("self"))throw new Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.");return e.classNameAliases=re(e.classNameAliases||{}),u(e)}function pn(e){return e?e.endsWithParent||pn(e.starts):!1}function Yi(e){return e.variants&&!e.cachedVariants&&(e.cachedVariants=e.variants.map(function(n){return re(e,{variants:null},n)})),e.cachedVariants?e.cachedVariants:pn(e)?re(e,{starts:e.starts?re(e.starts):null}):Object.isFrozen(e)?re(e):e}var Zi="11.11.1",He=class extends Error{constructor(n,t){super(n),this.name="HTMLInjectionError",this.html=t}},ze=rn,nn=re,tn=Symbol("nomatch"),Xi=7,mn=function(e){let n=Object.create(null),t=Object.create(null),i=[],s=!0,u="Could not find the language '{}', did you forget to load/include a language module?",r={disableAutodetect:!0,name:"Plain text",contains:[]},a={ignoreUnescapedHTML:!1,throwUnescapedHTML:!1,noHighlightRe:/^(no-?highlight)$/i,languageDetectRe:/\blang(?:uage)?-([\w-]+)\b/i,classPrefix:"hljs-",cssSelector:"pre code",languages:null,__emitter:Ge};function o(l){return a.noHighlightRe.test(l)}function c(l){let m=l.className+" ";m+=l.parentNode?l.parentNode.className:"";let p=a.languageDetectRe.exec(m);if(p){let w=L(p[1]);return w||(en(u.replace("{}",p[1])),en("Falling back to no-highlight mode for this block.",l)),w?p[1]:"no-highlight"}return m.split(/\s+/).find(w=>o(w)||L(w))}function d(l,m,p){let w="",x="";typeof m=="object"?(w=l,p=m.ignoreIllegals,x=m.language):(ue("10.7.0","highlight(lang, code, ...args) has been deprecated."),ue("10.7.0",`Please use highlight(code, options) instead.
frontend/assets/vendor/highlight.min.js:3:`,1;if(Pe>1e5&&Pe>E.index*3)throw new Error("potential infinite loop, way more iterations than matches");return F+=O,O.length}let j=L(l);if(!j)throw se(u.replace("{}",l)),new Error('Unknown language: "'+l+'"');let B=Wi(j),ae="",y=w||B,ye={},q=new a.__emitter(a);Ue();let F="",Te=0,oe=0,Pe=0,Fe=!1;try{if(j.__emitTokens)j.__emitTokens(m,q);else{for(y.matcher.considerAll();;){Pe++,Fe?Fe=!1:y.matcher.considerAll(),y.matcher.lastIndex=oe;let g=y.matcher.exec(m);if(!g)break;let E=m.substring(oe,g.index),O=Ne(E,g);oe=g.index+O}Ne(m.substring(oe))}return q.finalize(),ae=q.toHTML(),{language:l,value:ae,relevance:Te,illegal:!1,_emitter:q,_top:y}}catch(g){if(g.message&&g.message.includes("Illegal"))return{language:l,value:ze(m),illegal:!0,relevance:0,_illegalBy:{message:g.message,index:oe,context:m.slice(oe-100,oe+100),mode:g.mode,resultSoFar:ae},_emitter:q};if(s)return{language:l,value:ze(m),illegal:!1,relevance:0,errorRaised:g,_emitter:q,_top:y};throw g}}function b(l){let m={value:ze(l),illegal:!1,relevance:0,_top:r,_emitter:new a.__emitter(a)};return m._emitter.addText(l),m}function _(l,m){m=m||a.languages||Object.keys(n);let p=b(l),w=m.filter(L).filter(X).map(Y=>f(Y,l,!1));w.unshift(p);let x=w.sort((Y,V)=>{if(Y.relevance!==V.relevance)return V.relevance-Y.relevance;if(Y.language&&V.language){if(L(Y.language).supersetOf===V.language)return 1;if(L(V.language).supersetOf===Y.language)return-1}return 0}),[P,$]=x,J=P;return J.secondBest=$,J}function S(l,m,p){let w=m&&t[m]||p;l.classList.add("hljs"),l.classList.add(`language-${w}`)}function h(l){let m=null,p=c(l);if(o(p))return;if(K("before:highlightElement",{el:l,language:p}),l.dataset.highlighted){console.log("Element previously highlighted. To highlight again, first unset `dataset.highlighted`.",l);return}if(l.children.length>0&&(a.ignoreUnescapedHTML||(console.warn("One of your code blocks includes unescaped HTML. This is a potentially serious security risk."),console.warn("https://github.com/highlightjs/highlight.js/wiki/security"),console.warn("The element with unescaped HTML:"),console.warn(l)),a.throwUnescapedHTML))throw new He("One of your code blocks includes unescaped HTML.",l.innerHTML);m=l;let w=m.textContent,x=p?d(w,{language:p,ignoreIllegals:!0}):_(w);l.innerHTML=x.value,l.dataset.highlighted="yes",S(l,p,x.language),l.result={language:x.language,re:x.relevance,relevance:x.relevance},x.secondBest&&(l.secondBest={language:x.secondBest.language,relevance:x.secondBest.relevance}),K("after:highlightElement",{el:l,result:x,text:w})}function N(l){a=nn(a,l)}let T=()=>{M(),ue("10.6.0","initHighlighting() deprecated.  Use highlightAll() now.")};function R(){M(),ue("10.6.0","initHighlightingOnLoad() deprecated.  Use highlightAll() now.")}let I=!1;function M(){function l(){M()}if(document.readyState==="loading"){I||window.addEventListener("DOMContentLoaded",l,!1),I=!0;return}document.querySelectorAll(a.cssSelector).forEach(h)}function C(l,m){let p=null;try{p=m(e)}catch(w){if(se("Language definition for '{}' could not be registered.".replace("{}",l)),s)se(w);else throw w;p=r}p.name||(p.name=l),n[l]=p,p.rawDefinition=m.bind(null,e),p.aliases&&z(p.aliases,{languageName:l})}function k(l){delete n[l];for(let m of Object.keys(t))t[m]===l&&delete t[m]}function H(){return Object.keys(n)}function L(l){return l=(l||"").toLowerCase(),n[l]||n[t[l]]}function z(l,{languageName:m}){typeof l=="string"&&(l=[l]),l.forEach(p=>{t[p.toLowerCase()]=m})}function X(l){let m=L(l);return m&&!m.disableAutodetect}function ne(l){l["before:highlightBlock"]&&!l["before:highlightElement"]&&(l["before:highlightElement"]=m=>{l["before:highlightBlock"](Object.assign({block:m.el},m))}),l["after:highlightBlock"]&&!l["after:highlightElement"]&&(l["after:highlightElement"]=m=>{l["after:highlightBlock"](Object.assign({block:m.el},m))})}function Q(l){ne(l),i.push(l)}function ee(l){let m=i.indexOf(l);m!==-1&&i.splice(m,1)}function K(l,m){let p=l;i.forEach(function(w){w[p]&&w[p](m)})}function G(l){return ue("10.7.0","highlightBlock will be removed entirely in v12.0"),ue("10.7.0","Please use highlightElement now."),h(l)}Object.assign(e,{highlight:d,highlightAuto:_,highlightAll:M,highlightElement:h,highlightBlock:G,configure:N,initHighlighting:T,initHighlightingOnLoad:R,registerLanguage:C,unregisterLanguage:k,listLanguages:H,getLanguage:L,registerAliases:z,autoDetection:X,inherit:nn,addPlugin:Q,removePlugin:ee}),e.debugMode=function(){s=!1},e.safeMode=function(){s=!0},e.versionString=Zi,e.regex={concat:ce,lookahead:on,either:qe,optional:di,anyNumberOfTimes:li};for(let l in Se)typeof Se[l]=="object"&&an(Se[l]);return Object.assign(e,Se),e},ge=mn({});ge.newInstance=()=>mn({});_n.exports=ge;ge.HighlightJS=ge;ge.default=ge});var hn=A((fr,En)=>{function Vi(e){let n=e.regex,t=n.concat(/[\p{L}_]/u,n.optional(/[\p{L}0-9_.-]*:/u),/[\p{L}0-9_.-]*/u),i=/[\p{L}0-9._:-]+/u,s={className:"symbol",begin:/&[a-z]+;|&#[0-9]+;|&#x[a-f0-9]+;/},u={begin:/\s/,contains:[{className:"keyword",begin:/#?[a-z_][a-z1-9_-]+/,illegal:/\n/}]},r=e.inherit(u,{begin:/\(/,end:/\)/}),a=e.inherit(e.APOS_STRING_MODE,{className:"string"}),o=e.inherit(e.QUOTE_STRING_MODE,{className:"string"}),c={endsWithParent:!0,illegal:/</,relevance:0,contains:[{className:"attr",begin:i,relevance:0},{begin:/=\s*/,relevance:0,contains:[{className:"string",endsParent:!0,variants:[{begin:/"/,end:/"/,contains:[s]},{begin:/'/,end:/'/,contains:[s]},{begin:/[^\s"'=<>`]+/}]}]}]};return{name:"HTML, XML",aliases:["html","xhtml","rss","atom","xjb","xsd","xsl","plist","wsf","svg"],case_insensitive:!0,unicodeRegex:!0,contains:[{className:"meta",begin:/<![a-z]/,end:/>/,relevance:10,contains:[u,o,a,r,{begin:/\[/,end:/\]/,contains:[{className:"meta",begin:/<![a-z]/,end:/>/,contains:[u,r,o,a]}]}]},e.COMMENT(/<!--/,/-->/,{relevance:10}),{begin:/<!\[CDATA\[/,end:/\]\]>/,relevance:10},s,{className:"meta",end:/\?>/,variants:[{begin:/<\?xml/,relevance:10,contains:[o]},{begin:/<\?[a-z][a-z0-9]+/}]},{className:"tag",begin:/<style(?=\s|>)/,end:/>/,keywords:{name:"style"},contains:[c],starts:{end:/<\/style>/,returnEnd:!0,subLanguage:["css","xml"]}},{className:"tag",begin:/<script(?=\s|>)/,end:/>/,keywords:{name:"script"},contains:[c],starts:{end:/<\/script>/,returnEnd:!0,subLanguage:["javascript","handlebars","xml"]}},{className:"tag",begin:/<>|<\/>/},{className:"tag",begin:n.concat(/</,n.lookahead(n.concat(t,n.either(/\/>/,/>/,/\s/)))),end:/\/?>/,contains:[{className:"name",begin:t,relevance:0,starts:c}]},{className:"tag",begin:n.concat(/<\//,n.lookahead(n.concat(t,/>/))),contains:[{className:"name",begin:t,relevance:0},{begin:/>/,relevance:0,endsParent:!0}]}]}}En.exports=Vi});var yn=A((Er,Nn)=>{function Qi(e){let n=e.regex,t={},i={begin:/\$\{/,end:/\}/,contains:["self",{begin:/:-/,contains:[t]}]};Object.assign(t,{className:"variable",variants:[{begin:n.concat(/\$[\w\d#@][\w\d_]*/,"(?![\\w\\d])(?![$])")},i]});let s={className:"subst",begin:/\$\(/,end:/\)/,contains:[e.BACKSLASH_ESCAPE]},u=e.inherit(e.COMMENT(),{match:[/(^|\s)/,/#.*$/],scope:{2:"comment"}}),r={begin:/<<-?\s*(?=\w+)/,starts:{contains:[e.END_SAME_AS_BEGIN({begin:/(\w+)/,end:/(\w+)/,className:"string"})]}},a={className:"string",begin:/"/,end:/"/,contains:[e.BACKSLASH_ESCAPE,t,s]};s.contains.push(a);let o={match:/\\"/},c={className:"string",begin:/'/,end:/'/},d={match:/\\'/},f={begin:/\$?\(\(/,end:/\)\)/,contains:[{begin:/\d+#[0-9a-f]+/,className:"number"},e.NUMBER_MODE,t]},b=["fish","bash","zsh","sh","csh","ksh","tcsh","dash","scsh"],_=e.SHEBANG({binary:`(${b.join("|")})`,relevance:10}),S={className:"function",begin:/\w[\w\d_]*\s*\(\s*\)\s*\{/,returnBegin:!0,contains:[e.inherit(e.TITLE_MODE,{begin:/\w[\w\d_]*/})],relevance:0},h=["if","then","else","elif","fi","time","for","while","until","in","do","done","case","esac","coproc","function","select"],N=["true","false"],T={match:/(\/[a-z._-]+)+/},R=["break","cd","continue","eval","exec","exit","export","getopts","hash","pwd","readonly","return","shift","test","times","trap","umask","unset"],I=["alias","bind","builtin","caller","command","declare","echo","enable","help","let","local","logout","mapfile","printf","read","readarray","source","sudo","type","typeset","ulimit","unalias"],M=["autoload","bg","bindkey","bye","cap","chdir","clone","comparguments","compcall","compctl","compdescribe","compfiles","compgroups","compquote","comptags","comptry","compvalues","dirs","disable","disown","echotc","echoti","emulate","fc","fg","float","functions","getcap","getln","history","integer","jobs","kill","limit","log","noglob","popd","print","pushd","pushln","rehash","sched","setcap","setopt","stat","suspend","ttyctl","unfunction","unhash","unlimit","unsetopt","vared","wait","whence","where","which","zcompile","zformat","zftp","zle","zmodload","zparseopts","zprof","zpty","zregexparse","zsocket","zstyle","ztcp"],C=["chcon","chgrp","chown","chmod","cp","dd","df","dir","dircolors","ln","ls","mkdir","mkfifo","mknod","mktemp","mv","realpath","rm","rmdir","shred","sync","touch","truncate","vdir","b2sum","base32","base64","cat","cksum","comm","csplit","cut","expand","fmt","fold","head","join","md5sum","nl","numfmt","od","paste","ptx","pr","sha1sum","sha224sum","sha256sum","sha384sum","sha512sum","shuf","sort","split","sum","tac","tail","tr","tsort","unexpand","uniq","wc","arch","basename","chroot","date","dirname","du","echo","env","expr","factor","groups","hostid","id","link","logname","nice","nohup","nproc","pathchk","pinky","printenv","printf","pwd","readlink","runcon","seq","sleep","stat","stdbuf","stty","tee","test","timeout","tty","uname","unlink","uptime","users","who","whoami","yes"];return{name:"Bash",aliases:["sh","zsh"],keywords:{$pattern:/\b[a-z][a-z0-9._-]+\b/,keyword:h,literal:N,built_in:[...R,...I,"set","shopt",...M,...C]},contains:[_,e.SHEBANG(),S,f,u,r,T,a,o,c,d,t]}}Nn.exports=Qi});var Sn=A((hr,Tn)=>{function Ji(e){let n=e.regex,t=e.COMMENT("//","$",{contains:[{begin:/\\\n/}]}),i="decltype\\(auto\\)",s="[a-zA-Z_]\\w*::",r="("+i+"|"+n.optional(s)+"[a-zA-Z_]\\w*"+n.optional("<[^<>]+>")+")",a={className:"type",variants:[{begin:"\\b[a-z\\d_]*_t\\b"},{match:/\batomic_[a-z]{3,6}\b/}]},c={className:"string",variants:[{begin:'(u8?|U|L)?"',end:'"',illegal:"\\n",contains:[e.BACKSLASH_ESCAPE]},{begin:"(u8?|U|L)?'("+"\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)"+"|.)",end:"'",illegal:"."},e.END_SAME_AS_BEGIN({begin:/(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,end:/\)([^()\\ ]{0,16})"/})]},d={className:"number",variants:[{match:/\b(0b[01']+)/},{match:/(-?)\b([\d']+(\.[\d']*)?|\.[\d']+)((ll|LL|l|L)(u|U)?|(u|U)(ll|LL|l|L)?|f|F|b|B)/},{match:/(-?)\b(0[xX][a-fA-F0-9]+(?:'[a-fA-F0-9]+)*(?:\.[a-fA-F0-9]*(?:'[a-fA-F0-9]*)*)?(?:[pP][-+]?[0-9]+)?(l|L)?(u|U)?)/},{match:/(-?)\b\d+(?:'\d+)*(?:\.\d*(?:'\d*)*)?(?:[eE][-+]?\d+)?/}],relevance:0},f={className:"meta",begin:/#\s*[a-z]+\b/,end:/$/,keywords:{keyword:"if else elif endif define undef warning error line pragma _Pragma ifdef ifndef elifdef elifndef include"},contains:[{begin:/\\\n/,relevance:0},e.inherit(c,{className:"string"}),{className:"string",begin:/<.*?>/},t,e.C_BLOCK_COMMENT_MODE]},b={className:"title",begin:n.optional(s)+e.IDENT_RE,relevance:0},_=n.optional(s)+e.IDENT_RE+"\\s*\\(",N={keyword:["asm","auto","break","case","continue","default","do","else","enum","extern","for","fortran","goto","if","inline","register","restrict","return","sizeof","typeof","typeof_unqual","struct","switch","typedef","union","volatile","while","_Alignas","_Alignof","_Atomic","_Generic","_Noreturn","_Static_assert","_Thread_local","alignas","alignof","noreturn","static_assert","thread_local","_Pragma"],type:["float","double","signed","unsigned","int","short","long","char","void","_Bool","_BitInt","_Complex","_Imaginary","_Decimal32","_Decimal64","_Decimal96","_Decimal128","_Decimal64x","_Decimal128x","_Float16","_Float32","_Float64","_Float128","_Float32x","_Float64x","_Float128x","const","static","constexpr","complex","bool","imaginary"],literal:"true false NULL",built_in:"std string wstring cin cout cerr clog stdin stdout stderr stringstream istringstream ostringstream auto_ptr deque list queue stack vector map set pair bitset multiset multimap unordered_set unordered_map unordered_multiset unordered_multimap priority_queue make_pair array shared_ptr abort terminate abs acos asin atan2 atan calloc ceil cosh cos exit exp fabs floor fmod fprintf fputs free frexp fscanf future isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper isxdigit tolower toupper labs ldexp log10 log malloc realloc memchr memcmp memcpy memset modf pow printf putchar puts scanf sinh sin snprintf sprintf sqrt sscanf strcat strchr strcmp strcpy strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn strstr tanh tan vfprintf vprintf vsprintf endl initializer_list unique_ptr"},T=[f,a,t,e.C_BLOCK_COMMENT_MODE,d,c],R={variants:[{begin:/=/,end:/;/},{begin:/\(/,end:/\)/},{beginKeywords:"new throw return else",end:/;/}],keywords:N,contains:T.concat([{begin:/\(/,end:/\)/,keywords:N,contains:T.concat(["self"]),relevance:0}]),relevance:0},I={begin:"("+r+"[\\*&\\s]+)+"+_,returnBegin:!0,end:/[{;=]/,excludeEnd:!0,keywords:N,illegal:/[^\w\s\*&:<>.]/,contains:[{begin:i,keywords:N,relevance:0},{begin:_,returnBegin:!0,contains:[e.inherit(b,{className:"title.function"})],relevance:0},{relevance:0,match:/,/},{className:"params",begin:/\(/,end:/\)/,keywords:N,relevance:0,contains:[t,e.C_BLOCK_COMMENT_MODE,c,d,a,{begin:/\(/,end:/\)/,keywords:N,relevance:0,contains:["self",t,e.C_BLOCK_COMMENT_MODE,c,d,a]}]},a,t,e.C_BLOCK_COMMENT_MODE,f]};return{name:"C",aliases:["h"],keywords:N,disableAutodetect:!0,illegal:"</",contains:[].concat(R,I,T,[f,{begin:e.IDENT_RE+"::",keywords:N},{className:"class",beginKeywords:"enum class struct union",end:/[{;:<>=]/,contains:[{beginKeywords:"final class struct"},e.TITLE_MODE]}]),exports:{preprocessor:f,strings:c,keywords:N}}}Tn.exports=Ji});var vn=A((Nr,wn)=>{function ji(e){let n=e.regex,t=e.COMMENT("//","$",{contains:[{begin:/\\\n/}]}),i="decltype\\(auto\\)",s="[a-zA-Z_]\\w*::",r="(?!struct)("+i+"|"+n.optional(s)+"[a-zA-Z_]\\w*"+n.optional("<[^<>]+>")+")",a={className:"type",begin:"\\b[a-z\\d_]*_t\\b"},c={className:"string",variants:[{begin:'(u8?|U|L)?"',end:'"',illegal:"\\n",contains:[e.BACKSLASH_ESCAPE]},{begin:"(u8?|U|L)?'("+"\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)"+"|.)",end:"'",illegal:"."},e.END_SAME_AS_BEGIN({begin:/(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,end:/\)([^()\\ ]{0,16})"/})]},d={className:"number",variants:[{begin:"[+-]?(?:(?:[0-9](?:'?[0-9])*\\.(?:[0-9](?:'?[0-9])*)?|\\.[0-9](?:'?[0-9])*)(?:[Ee][+-]?[0-9](?:'?[0-9])*)?|[0-9](?:'?[0-9])*[Ee][+-]?[0-9](?:'?[0-9])*|0[Xx](?:[0-9A-Fa-f](?:'?[0-9A-Fa-f])*(?:\\.(?:[0-9A-Fa-f](?:'?[0-9A-Fa-f])*)?)?|\\.[0-9A-Fa-f](?:'?[0-9A-Fa-f])*)[Pp][+-]?[0-9](?:'?[0-9])*)(?:[Ff](?:16|32|64|128)?|(BF|bf)16|[Ll]|)"},{begin:"[+-]?\\b(?:0[Bb][01](?:'?[01])*|0[Xx][0-9A-Fa-f](?:'?[0-9A-Fa-f])*|0(?:'?[0-7])*|[1-9](?:'?[0-9])*)(?:[Uu](?:LL?|ll?)|[Uu][Zz]?|(?:LL?|ll?)[Uu]?|[Zz][Uu]|)"}],relevance:0},f={className:"meta",begin:/#\s*[a-z]+\b/,end:/$/,keywords:{keyword:"if else elif endif define undef warning error line pragma _Pragma ifdef ifndef include"},contains:[{begin:/\\\n/,relevance:0},e.inherit(c,{className:"string"}),{className:"string",begin:/<.*?>/},t,e.C_BLOCK_COMMENT_MODE]},b={className:"title",begin:n.optional(s)+e.IDENT_RE,relevance:0},_=n.optional(s)+e.IDENT_RE+"\\s*\\(",S=["alignas","alignof","and","and_eq","asm","atomic_cancel","atomic_commit","atomic_noexcept","auto","bitand","bitor","break","case","catch","class","co_await","co_return","co_yield","compl","concept","const_cast|10","consteval","constexpr","constinit","continue","decltype","default","delete","do","dynamic_cast|10","else","enum","explicit","export","extern","false","final","for","friend","goto","if","import","inline","module","mutable","namespace","new","noexcept","not","not_eq","nullptr","operator","or","or_eq","override","private","protected","public","reflexpr","register","reinterpret_cast|10","requires","return","sizeof","static_assert","static_cast|10","struct","switch","synchronized","template","this","thread_local","throw","transaction_safe","transaction_safe_dynamic","true","try","typedef","typeid","typename","union","using","virtual","volatile","while","xor","xor_eq"],h=["bool","char","char16_t","char32_t","char8_t","double","float","int","long","short","void","wchar_t","unsigned","signed","const","static"],N=["any","auto_ptr","barrier","binary_semaphore","bitset","complex","condition_variable","condition_variable_any","counting_semaphore","deque","false_type","flat_map","flat_set","future","imaginary","initializer_list","istringstream","jthread","latch","lock_guard","multimap","multiset","mutex","optional","ostringstream","packaged_task","pair","promise","priority_queue","queue","recursive_mutex","recursive_timed_mutex","scoped_lock","set","shared_future","shared_lock","shared_mutex","shared_timed_mutex","shared_ptr","stack","string_view","stringstream","timed_mutex","thread","true_type","tuple","unique_lock","unique_ptr","unordered_map","unordered_multimap","unordered_multiset","unordered_set","variant","vector","weak_ptr","wstring","wstring_view"],T=["abort","abs","acos","apply","as_const","asin","atan","atan2","calloc","ceil","cerr","cin","clog","cos","cosh","cout","declval","endl","exchange","exit","exp","fabs","floor","fmod","forward","fprintf","fputs","free","frexp","fscanf","future","invoke","isalnum","isalpha","iscntrl","isdigit","isgraph","islower","isprint","ispunct","isspace","isupper","isxdigit","labs","launder","ldexp","log","log10","make_pair","make_shared","make_shared_for_overwrite","make_tuple","make_unique","malloc","memchr","memcmp","memcpy","memset","modf","move","pow","printf","putchar","puts","realloc","scanf","sin","sinh","snprintf","sprintf","sqrt","sscanf","std","stderr","stdin","stdout","strcat","strchr","strcmp","strcpy","strcspn","strlen","strncat","strncmp","strncpy","strpbrk","strrchr","strspn","strstr","swap","tan","tanh","terminate","to_underlying","tolower","toupper","vfprintf","visit","vprintf","vsprintf"],M={type:h,keyword:S,literal:["NULL","false","nullopt","nullptr","true"],built_in:["_Pragma"],_type_hints:N},C={className:"function.dispatch",relevance:0,keywords:{_hint:T},begin:n.concat(/\b/,/(?!decltype)/,/(?!if)/,/(?!for)/,/(?!switch)/,/(?!while)/,e.IDENT_RE,n.lookahead(/(<[^<>]+>|)\s*\(/))},k=[C,f,a,t,e.C_BLOCK_COMMENT_MODE,d,c],H={variants:[{begin:/=/,end:/;/},{begin:/\(/,end:/\)/},{beginKeywords:"new throw return else",end:/;/}],keywords:M,contains:k.concat([{begin:/\(/,end:/\)/,keywords:M,contains:k.concat(["self"]),relevance:0}]),relevance:0},L={className:"function",begin:"("+r+"[\\*&\\s]+)+"+_,returnBegin:!0,end:/[{;=]/,excludeEnd:!0,keywords:M,illegal:/[^\w\s\*&:<>.]/,contains:[{begin:i,keywords:M,relevance:0},{begin:_,returnBegin:!0,contains:[b],relevance:0},{begin:/::/,relevance:0},{begin:/:/,endsWithParent:!0,contains:[c,d]},{relevance:0,match:/,/},{className:"params",begin:/\(/,end:/\)/,keywords:M,relevance:0,contains:[t,e.C_BLOCK_COMMENT_MODE,c,d,a,{begin:/\(/,end:/\)/,keywords:M,relevance:0,contains:["self",t,e.C_BLOCK_COMMENT_MODE,c,d,a]}]},a,t,e.C_BLOCK_COMMENT_MODE,f]};return{name:"C++",aliases:["cc","c++","h++","hpp","hh","hxx","cxx"],keywords:M,illegal:"</",classNameAliases:{"function.dispatch":"built_in"},contains:[].concat(H,L,C,k,[f,{begin:"\\b(deque|list|queue|priority_queue|pair|stack|vector|map|set|bitset|multiset|multimap|unordered_map|unordered_set|unordered_multiset|unordered_multimap|array|tuple|optional|variant|function|flat_map|flat_set)\\s*<(?!<)",end:">",keywords:M,contains:["self",a]},{begin:e.IDENT_RE+"::",keywords:M},{match:[/\b(?:enum(?:\s+(?:class|struct))?|class|struct|union)/,/\s+/,/\w+/],className:{1:"keyword",3:"title.class"}}])}}wn.exports=ji});var An=A((yr,On)=>{function ea(e){let n=["bool","byte","char","decimal","delegate","double","dynamic","enum","float","int","long","nint","nuint","object","sbyte","short","string","ulong","uint","ushort"],t=["public","private","protected","static","internal","protected","abstract","async","extern","override","unsafe","virtual","new","sealed","partial"],i=["default","false","null","true"],s=["abstract","as","base","break","case","catch","class","const","continue","do","else","event","explicit","extern","finally","fixed","for","foreach","goto","if","implicit","in","interface","internal","is","lock","namespace","new","operator","out","override","params","private","protected","public","readonly","record","ref","return","scoped","sealed","sizeof","stackalloc","static","struct","switch","this","throw","try","typeof","unchecked","unsafe","using","virtual","void","volatile","while"],u=["add","alias","and","ascending","args","async","await","by","descending","dynamic","equals","file","from","get","global","group","init","into","join","let","nameof","not","notnull","on","or","orderby","partial","record","remove","required","scoped","select","set","unmanaged","value|0","var","when","where","with","yield"],r={keyword:s.concat(u),built_in:n,literal:i},a=e.inherit(e.TITLE_MODE,{begin:"[a-zA-Z](\\.?\\w)*"}),o={className:"number",variants:[{begin:"\\b(0b[01']+)"},{begin:"(-?)\\b([\\d']+(\\.[\\d']*)?|\\.[\\d']+)(u|U|l|L|ul|UL|f|F|b|B)"},{begin:"(-?)(\\b0[xX][a-fA-F0-9']+|(\\b[\\d']+(\\.[\\d']*)?|\\.[\\d']+)([eE][-+]?[\\d']+)?)"}],relevance:0},c={className:"string",begin:/"""("*)(?!")(.|\n)*?"""\1/,relevance:1},d={className:"string",begin:'@"',end:'"',contains:[{begin:'""'}]},f=e.inherit(d,{illegal:/\n/}),b={className:"subst",begin:/\{/,end:/\}/,keywords:r},_=e.inherit(b,{illegal:/\n/}),S={className:"string",begin:/\$"/,end:'"',illegal:/\n/,contains:[{begin:/\{\{/},{begin:/\}\}/},e.BACKSLASH_ESCAPE,_]},h={className:"string",begin:/\$@"/,end:'"',contains:[{begin:/\{\{/},{begin:/\}\}/},{begin:'""'},b]},N=e.inherit(h,{illegal:/\n/,contains:[{begin:/\{\{/},{begin:/\}\}/},{begin:'""'},_]});b.contains=[h,S,d,e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,o,e.C_BLOCK_COMMENT_MODE],_.contains=[N,S,f,e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,o,e.inherit(e.C_BLOCK_COMMENT_MODE,{illegal:/\n/})];let T={variants:[c,h,S,d,e.APOS_STRING_MODE,e.QUOTE_STRING_MODE]},R={begin:"<",end:">",contains:[{beginKeywords:"in out"},a]},I=e.IDENT_RE+"(<"+e.IDENT_RE+"(\\s*,\\s*"+e.IDENT_RE+")*>)?(\\[\\])?",M={begin:"@"+e.IDENT_RE,relevance:0};return{name:"C#",aliases:["cs","c#"],keywords:r,illegal:/::/,contains:[e.COMMENT("///","$",{returnBegin:!0,contains:[{className:"doctag",variants:[{begin:"///",relevance:0},{begin:"<!--|-->"},{begin:"</?",end:">"}]}]}),e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,{className:"meta",begin:"#",end:"$",keywords:{keyword:"if else elif endif define undef warning error line region endregion pragma checksum"}},T,o,{beginKeywords:"class interface",relevance:0,end:/[{;=]/,illegal:/[^\s:,]/,contains:[{beginKeywords:"where class"},a,R,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},{beginKeywords:"namespace",relevance:0,end:/[{;=]/,illegal:/[^\s:]/,contains:[a,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},{beginKeywords:"record",relevance:0,end:/[{;=]/,illegal:/[^\s:]/,contains:[a,R,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},{className:"meta",begin:"^\\s*\\[(?=[\\w])",excludeBegin:!0,end:"\\]",excludeEnd:!0,contains:[{className:"string",begin:/"/,end:/"/}]},{beginKeywords:"new return throw await else",relevance:0},{className:"function",begin:"("+I+"\\s+)+"+e.IDENT_RE+"\\s*(<[^=]+>\\s*)?\\(",returnBegin:!0,end:/\s*[{;=]/,excludeEnd:!0,keywords:r,contains:[{beginKeywords:t.join(" "),relevance:0},{begin:e.IDENT_RE+"\\s*(<[^=]+>\\s*)?\\(",returnBegin:!0,contains:[e.TITLE_MODE,R],relevance:0},{match:/\(\)/},{className:"params",begin:/\(/,end:/\)/,excludeBegin:!0,excludeEnd:!0,keywords:r,relevance:0,contains:[T,o,e.C_BLOCK_COMMENT_MODE]},e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},M]}}On.exports=ea});var Mn=A((Tr,Rn)=>{var na=e=>({IMPORTANT:{scope:"meta",begin:"!important"},BLOCK_COMMENT:e.C_BLOCK_COMMENT_MODE,HEXCOLOR:{scope:"number",begin:/#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/},FUNCTION_DISPATCH:{className:"built_in",begin:/[\w-]+(?=\()/},ATTRIBUTE_SELECTOR_MODE:{scope:"selector-attr",begin:/\[/,end:/\]/,illegal:"$",contains:[e.APOS_STRING_MODE,e.QUOTE_STRING_MODE]},CSS_NUMBER_MODE:{scope:"number",begin:e.NUMBER_RE+"(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",relevance:0},CSS_VARIABLE:{className:"attr",begin:/--[A-Za-z_][A-Za-z0-9_-]*/}}),ta=["a","abbr","address","article","aside","audio","b","blockquote","body","button","canvas","caption","cite","code","dd","del","details","dfn","div","dl","dt","em","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hgroup","html","i","iframe","img","input","ins","kbd","label","legend","li","main","mark","menu","nav","object","ol","optgroup","option","p","picture","q","quote","samp","section","select","source","span","strong","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","tr","ul","var","video"],ia=["defs","g","marker","mask","pattern","svg","switch","symbol","feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feFlood","feGaussianBlur","feImage","feMerge","feMorphology","feOffset","feSpecularLighting","feTile","feTurbulence","linearGradient","radialGradient","stop","circle","ellipse","image","line","path","polygon","polyline","rect","text","use","textPath","tspan","foreignObject","clipPath"],aa=[...ta,...ia],ra=["any-hover","any-pointer","aspect-ratio","color","color-gamut","color-index","device-aspect-ratio","device-height","device-width","display-mode","forced-colors","grid","height","hover","inverted-colors","monochrome","orientation","overflow-block","overflow-inline","pointer","prefers-color-scheme","prefers-contrast","prefers-reduced-motion","prefers-reduced-transparency","resolution","scan","scripting","update","width","min-width","max-width","min-height","max-height"].sort().reverse(),oa=["active","any-link","blank","checked","current","default","defined","dir","disabled","drop","empty","enabled","first","first-child","first-of-type","fullscreen","future","focus","focus-visible","focus-within","has","host","host-context","hover","indeterminate","in-range","invalid","is","lang","last-child","last-of-type","left","link","local-link","not","nth-child","nth-col","nth-last-child","nth-last-col","nth-last-of-type","nth-of-type","only-child","only-of-type","optional","out-of-range","past","placeholder-shown","read-only","read-write","required","right","root","scope","target","target-within","user-invalid","valid","visited","where"].sort().reverse(),sa=["after","backdrop","before","cue","cue-region","first-letter","first-line","grammar-error","marker","part","placeholder","selection","slotted","spelling-error"].sort().reverse(),ca=["accent-color","align-content","align-items","align-self","alignment-baseline","all","anchor-name","animation","animation-composition","animation-delay","animation-direction","animation-duration","animation-fill-mode","animation-iteration-count","animation-name","animation-play-state","animation-range","animation-range-end","animation-range-start","animation-timeline","animation-timing-function","appearance","aspect-ratio","backdrop-filter","backface-visibility","background","background-attachment","background-blend-mode","background-clip","background-color","background-image","background-origin","background-position","background-position-x","background-position-y","background-repeat","background-size","baseline-shift","block-size","border","border-block","border-block-color","border-block-end","border-block-end-color","border-block-end-style","border-block-end-width","border-block-start","border-block-start-color","border-block-start-style","border-block-start-width","border-block-style","border-block-width","border-bottom","border-bottom-color","border-bottom-left-radius","border-bottom-right-radius","border-bottom-style","border-bottom-width","border-collapse","border-color","border-end-end-radius","border-end-start-radius","border-image","border-image-outset","border-image-repeat","border-image-slice","border-image-source","border-image-width","border-inline","border-inline-color","border-inline-end","border-inline-end-color","border-inline-end-style","border-inline-end-width","border-inline-start","border-inline-start-color","border-inline-start-style","border-inline-start-width","border-inline-style","border-inline-width","border-left","border-left-color","border-left-style","border-left-width","border-radius","border-right","border-right-color","border-right-style","border-right-width","border-spacing","border-start-end-radius","border-start-start-radius","border-style","border-top","border-top-color","border-top-left-radius","border-top-right-radius","border-top-style","border-top-width","border-width","bottom","box-align","box-decoration-break","box-direction","box-flex","box-flex-group","box-lines","box-ordinal-group","box-orient","box-pack","box-shadow","box-sizing","break-after","break-before","break-inside","caption-side","caret-color","clear","clip","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","color-scheme","column-count","column-fill","column-gap","column-rule","column-rule-color","column-rule-style","column-rule-width","column-span","column-width","columns","contain","contain-intrinsic-block-size","contain-intrinsic-height","contain-intrinsic-inline-size","contain-intrinsic-size","contain-intrinsic-width","container","container-name","container-type","content","content-visibility","counter-increment","counter-reset","counter-set","cue","cue-after","cue-before","cursor","cx","cy","direction","display","dominant-baseline","empty-cells","enable-background","field-sizing","fill","fill-opacity","fill-rule","filter","flex","flex-basis","flex-direction","flex-flow","flex-grow","flex-shrink","flex-wrap","float","flood-color","flood-opacity","flow","font","font-display","font-family","font-feature-settings","font-kerning","font-language-override","font-optical-sizing","font-palette","font-size","font-size-adjust","font-smooth","font-smoothing","font-stretch","font-style","font-synthesis","font-synthesis-position","font-synthesis-small-caps","font-synthesis-style","font-synthesis-weight","font-variant","font-variant-alternates","font-variant-caps","font-variant-east-asian","font-variant-emoji","font-variant-ligatures","font-variant-numeric","font-variant-position","font-variation-settings","font-weight","forced-color-adjust","gap","glyph-orientation-horizontal","glyph-orientation-vertical","grid","grid-area","grid-auto-columns","grid-auto-flow","grid-auto-rows","grid-column","grid-column-end","grid-column-start","grid-gap","grid-row","grid-row-end","grid-row-start","grid-template","grid-template-areas","grid-template-columns","grid-template-rows","hanging-punctuation","height","hyphenate-character","hyphenate-limit-chars","hyphens","icon","image-orientation","image-rendering","image-resolution","ime-mode","initial-letter","initial-letter-align","inline-size","inset","inset-area","inset-block","inset-block-end","inset-block-start","inset-inline","inset-inline-end","inset-inline-start","isolation","justify-content","justify-items","justify-self","kerning","left","letter-spacing","lighting-color","line-break","line-height","line-height-step","list-style","list-style-image","list-style-position","list-style-type","margin","margin-block","margin-block-end","margin-block-start","margin-bottom","margin-inline","margin-inline-end","margin-inline-start","margin-left","margin-right","margin-top","margin-trim","marker","marker-end","marker-mid","marker-start","marks","mask","mask-border","mask-border-mode","mask-border-outset","mask-border-repeat","mask-border-slice","mask-border-source","mask-border-width","mask-clip","mask-composite","mask-image","mask-mode","mask-origin","mask-position","mask-repeat","mask-size","mask-type","masonry-auto-flow","math-depth","math-shift","math-style","max-block-size","max-height","max-inline-size","max-width","min-block-size","min-height","min-inline-size","min-width","mix-blend-mode","nav-down","nav-index","nav-left","nav-right","nav-up","none","normal","object-fit","object-position","offset","offset-anchor","offset-distance","offset-path","offset-position","offset-rotate","opacity","order","orphans","outline","outline-color","outline-offset","outline-style","outline-width","overflow","overflow-anchor","overflow-block","overflow-clip-margin","overflow-inline","overflow-wrap","overflow-x","overflow-y","overlay","overscroll-behavior","overscroll-behavior-block","overscroll-behavior-inline","overscroll-behavior-x","overscroll-behavior-y","padding","padding-block","padding-block-end","padding-block-start","padding-bottom","padding-inline","padding-inline-end","padding-inline-start","padding-left","padding-right","padding-top","page","page-break-after","page-break-before","page-break-inside","paint-order","pause","pause-after","pause-before","perspective","perspective-origin","place-content","place-items","place-self","pointer-events","position","position-anchor","position-visibility","print-color-adjust","quotes","r","resize","rest","rest-after","rest-before","right","rotate","row-gap","ruby-align","ruby-position","scale","scroll-behavior","scroll-margin","scroll-margin-block","scroll-margin-block-end","scroll-margin-block-start","scroll-margin-bottom","scroll-margin-inline","scroll-margin-inline-end","scroll-margin-inline-start","scroll-margin-left","scroll-margin-right","scroll-margin-top","scroll-padding","scroll-padding-block","scroll-padding-block-end","scroll-padding-block-start","scroll-padding-bottom","scroll-padding-inline","scroll-padding-inline-end","scroll-padding-inline-start","scroll-padding-left","scroll-padding-right","scroll-padding-top","scroll-snap-align","scroll-snap-stop","scroll-snap-type","scroll-timeline","scroll-timeline-axis","scroll-timeline-name","scrollbar-color","scrollbar-gutter","scrollbar-width","shape-image-threshold","shape-margin","shape-outside","shape-rendering","speak","speak-as","src","stop-color","stop-opacity","stroke","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke-width","tab-size","table-layout","text-align","text-align-all","text-align-last","text-anchor","text-combine-upright","text-decoration","text-decoration-color","text-decoration-line","text-decoration-skip","text-decoration-skip-ink","text-decoration-style","text-decoration-thickness","text-emphasis","text-emphasis-color","text-emphasis-position","text-emphasis-style","text-indent","text-justify","text-orientation","text-overflow","text-rendering","text-shadow","text-size-adjust","text-transform","text-underline-offset","text-underline-position","text-wrap","text-wrap-mode","text-wrap-style","timeline-scope","top","touch-action","transform","transform-box","transform-origin","transform-style","transition","transition-behavior","transition-delay","transition-duration","transition-property","transition-timing-function","translate","unicode-bidi","user-modify","user-select","vector-effect","vertical-align","view-timeline","view-timeline-axis","view-timeline-inset","view-timeline-name","view-transition-name","visibility","voice-balance","voice-duration","voice-family","voice-pitch","voice-range","voice-rate","voice-stress","voice-volume","white-space","white-space-collapse","widows","width","will-change","word-break","word-spacing","word-wrap","writing-mode","x","y","z-index","zoom"].sort().reverse();function la(e){let n=e.regex,t=na(e),i={begin:/-(webkit|moz|ms|o)-(?=[a-z])/},s="and or not only",u=/@-?\w[\w]*(-\w+)*/,r="[a-zA-Z-][a-zA-Z0-9_-]*",a=[e.APOS_STRING_MODE,e.QUOTE_STRING_MODE];return{name:"CSS",case_insensitive:!0,illegal:/[=|'\$]/,keywords:{keyframePosition:"from to"},classNameAliases:{keyframePosition:"selector-tag"},contains:[t.BLOCK_COMMENT,i,t.CSS_NUMBER_MODE,{className:"selector-id",begin:/#[A-Za-z0-9_-]+/,relevance:0},{className:"selector-class",begin:"\\."+r,relevance:0},t.ATTRIBUTE_SELECTOR_MODE,{className:"selector-pseudo",variants:[{begin:":("+oa.join("|")+")"},{begin:":(:)?("+sa.join("|")+")"}]},t.CSS_VARIABLE,{className:"attribute",begin:"\\b("+ca.join("|")+")\\b"},{begin:/:/,end:/[;}{]/,contains:[t.BLOCK_COMMENT,t.HEXCOLOR,t.IMPORTANT,t.CSS_NUMBER_MODE,...a,{begin:/(url|data-uri)\(/,end:/\)/,relevance:0,keywords:{built_in:"url data-uri"},contains:[...a,{className:"string",begin:/[^)]/,endsWithParent:!0,excludeEnd:!0}]},t.FUNCTION_DISPATCH]},{begin:n.lookahead(/@/),end:"[{;]",relevance:0,illegal:/:/,contains:[{className:"keyword",begin:u},{begin:/\s/,endsWithParent:!0,excludeEnd:!0,relevance:0,keywords:{$pattern:/[a-z-]+/,keyword:s,attribute:ra.join(" ")},contains:[{begin:/[a-z-]+(?=:)/,className:"attribute"},...a,t.CSS_NUMBER_MODE]}]},{className:"selector-tag",begin:"\\b("+aa.join("|")+")\\b"}]}}Rn.exports=la});var xn=A((Sr,kn)=>{function da(e){let n=e.regex,t={begin:/<\/?[A-Za-z_]/,end:">",subLanguage:"xml",relevance:0},i={begin:"^[-\\*]{3,}",end:"$"},s={className:"code",variants:[{begin:"(`{3,})[^`](.|\\n)*?\\1`*[ ]*"},{begin:"(~{3,})[^~](.|\\n)*?\\1~*[ ]*"},{begin:"```",end:"```+[ ]*$"},{begin:"~~~",end:"~~~+[ ]*$"},{begin:"`.+?`"},{begin:"(?=^( {4}|\\t))",contains:[{begin:"^( {4}|\\t)",end:"(\\n)$"}],relevance:0}]},u={className:"bullet",begin:"^[ 	]*([*+-]|(\\d+\\.))(?=\\s+)",end:"\\s+",excludeEnd:!0},r={begin:/^\[[^\n]+\]:/,returnBegin:!0,contains:[{className:"symbol",begin:/\[/,end:/\]/,excludeBegin:!0,excludeEnd:!0},{className:"link",begin:/:\s*/,end:/$/,excludeBegin:!0}]},a=/[A-Za-z][A-Za-z0-9+.-]*/,o={variants:[{begin:/\[.+?\]\[.*?\]/,relevance:0},{begin:/\[.+?\]\(((data|javascript|mailto):|(?:http|ftp)s?:\/\/).*?\)/,relevance:2},{begin:n.concat(/\[.+?\]\(/,a,/:\/\/.*?\)/),relevance:2},{begin:/\[.+?\]\([./?&#].*?\)/,relevance:1},{begin:/\[.*?\]\(.*?\)/,relevance:0}],returnBegin:!0,contains:[{match:/\[(?=\])/},{className:"string",relevance:0,begin:"\\[",end:"\\]",excludeBegin:!0,returnEnd:!0},{className:"link",relevance:0,begin:"\\]\\(",end:"\\)",excludeBegin:!0,excludeEnd:!0},{className:"symbol",relevance:0,begin:"\\]\\[",end:"\\]",excludeBegin:!0,excludeEnd:!0}]},c={className:"strong",contains:[],variants:[{begin:/_{2}(?!\s)/,end:/_{2}/},{begin:/\*{2}(?!\s)/,end:/\*{2}/}]},d={className:"emphasis",contains:[],variants:[{begin:/\*(?![*\s])/,end:/\*/},{begin:/_(?![_\s])/,end:/_/,relevance:0}]},f=e.inherit(c,{contains:[]}),b=e.inherit(d,{contains:[]});c.contains.push(b),d.contains.push(f);let _=[t,o];return[c,d,f,b].forEach(T=>{T.contains=T.contains.concat(_)}),_=_.concat(c,d),{name:"Markdown",aliases:["md","mkdown","mkd"],contains:[{className:"section",variants:[{begin:"^#{1,6}",end:"$",contains:_},{begin:"(?=^.+?\\n[=-]{2,}$)",contains:[{begin:"^[=-]*$"},{begin:"^",end:"\\n",contains:_}]}]},t,u,c,d,{className:"quote",begin:"^>\\s+",contains:_,end:"$"},s,i,o,r,{scope:"literal",match:/&([a-zA-Z0-9]+|#[0-9]{1,7}|#[Xx][0-9a-fA-F]{1,6});/}]}}kn.exports=da});var Cn=A((wr,In)=>{function ua(e){let n=e.regex;return{name:"Diff",aliases:["patch"],contains:[{className:"meta",relevance:10,match:n.either(/^@@ +-\d+,\d+ +\+\d+,\d+ +@@/,/^\*\*\* +\d+,\d+ +\*\*\*\*$/,/^--- +\d+,\d+ +----$/)},{className:"comment",variants:[{begin:n.either(/Index: /,/^index/,/={3,}/,/^-{3}/,/^\*{3} /,/^\+{3}/,/^diff --git/),end:/$/},{match:/^\*{15}$/}]},{className:"addition",begin:/^\+/,end:/$/},{className:"deletion",begin:/^-/,end:/$/},{className:"addition",begin:/^!/,end:/$/}]}}In.exports=ua});var Dn=A((vr,Ln)=>{function ga(e){let n=e.regex,t="([a-zA-Z_]\\w*[!?=]?|[-+~]@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?)",i=n.either(/\b([A-Z]+[a-z0-9]+)+/,/\b([A-Z]+[a-z0-9]+)+[A-Z]+/),s=n.concat(i,/(::\w+)*/),r={"variable.constant":["__FILE__","__LINE__","__ENCODING__"],"variable.language":["self","super"],keyword:["alias","and","begin","BEGIN","break","case","class","defined","do","else","elsif","end","END","ensure","for","if","in","module","next","not","or","redo","require","rescue","retry","return","then","undef","unless","until","when","while","yield",...["include","extend","prepend","public","private","protected","raise","throw"]],built_in:["proc","lambda","attr_accessor","attr_reader","attr_writer","define_method","private_constant","module_function"],literal:["true","false","nil"]},a={className:"doctag",begin:"@[A-Za-z]+"},o={begin:"#<",end:">"},c=[e.COMMENT("#","$",{contains:[a]}),e.COMMENT("^=begin","^=end",{contains:[a],relevance:10}),e.COMMENT("^__END__",e.MATCH_NOTHING_RE)],d={className:"subst",begin:/#\{/,end:/\}/,keywords:r},f={className:"string",contains:[e.BACKSLASH_ESCAPE,d],variants:[{begin:/'/,end:/'/},{begin:/"/,end:/"/},{begin:/`/,end:/`/},{begin:/%[qQwWx]?\(/,end:/\)/},{begin:/%[qQwWx]?\[/,end:/\]/},{begin:/%[qQwWx]?\{/,end:/\}/},{begin:/%[qQwWx]?</,end:/>/},{begin:/%[qQwWx]?\//,end:/\//},{begin:/%[qQwWx]?%/,end:/%/},{begin:/%[qQwWx]?-/,end:/-/},{begin:/%[qQwWx]?\|/,end:/\|/},{begin:/\B\?(\\\d{1,3})/},{begin:/\B\?(\\x[A-Fa-f0-9]{1,2})/},{begin:/\B\?(\\u\{?[A-Fa-f0-9]{1,6}\}?)/},{begin:/\B\?(\\M-\\C-|\\M-\\c|\\c\\M-|\\M-|\\C-\\M-)[\x20-\x7e]/},{begin:/\B\?\\(c|C-)[\x20-\x7e]/},{begin:/\B\?\\?\S/},{begin:n.concat(/<<[-~]?'?/,n.lookahead(/(\w+)(?=\W)[^\n]*\n(?:[^\n]*\n)*?\s*\1\b/)),contains:[e.END_SAME_AS_BEGIN({begin:/(\w+)/,end:/(\w+)/,contains:[e.BACKSLASH_ESCAPE,d]})]}]},b="[1-9](_?[0-9])*|0",_="[0-9](_?[0-9])*",S={className:"number",relevance:0,variants:[{begin:`\\b(${b})(\\.(${_}))?([eE][+-]?(${_})|r)?i?\\b`},{begin:"\\b0[dD][0-9](_?[0-9])*r?i?\\b"},{begin:"\\b0[bB][0-1](_?[0-1])*r?i?\\b"},{begin:"\\b0[oO][0-7](_?[0-7])*r?i?\\b"},{begin:"\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*r?i?\\b"},{begin:"\\b0(_?[0-7])+r?i?\\b"}]},h={variants:[{match:/\(\)/},{className:"params",begin:/\(/,end:/(?=\))/,excludeBegin:!0,endsParent:!0,keywords:r}]},k=[f,{variants:[{match:[/class\s+/,s,/\s+<\s+/,s]},{match:[/\b(class|module)\s+/,s]}],scope:{2:"title.class",4:"title.class.inherited"},keywords:r},{match:[/(include|extend)\s+/,s],scope:{2:"title.class"},keywords:r},{relevance:0,match:[s,/\.new[. (]/],scope:{1:"title.class"}},{relevance:0,match:/\b[A-Z][A-Z_0-9]+\b/,className:"variable.constant"},{relevance:0,match:i,scope:"title.class"},{match:[/def/,/\s+/,t],scope:{1:"keyword",3:"title.function"},contains:[h]},{begin:e.IDENT_RE+"::"},{className:"symbol",begin:e.UNDERSCORE_IDENT_RE+"(!|\\?)?:",relevance:0},{className:"symbol",begin:":(?!\\s)",contains:[f,{begin:t}],relevance:0},S,{className:"variable",begin:"(\\$\\W)|((\\$|@@?)(\\w+))(?=[^@$?])(?![A-Za-z])(?![@$?'])"},{className:"params",begin:/\|(?!=)/,end:/\|/,excludeBegin:!0,excludeEnd:!0,relevance:0,keywords:r},{begin:"("+e.RE_STARTERS_RE+"|unless)\\s*",keywords:"unless",contains:[{className:"regexp",contains:[e.BACKSLASH_ESCAPE,d],illegal:/\n/,variants:[{begin:"/",end:"/[a-z]*"},{begin:/%r\{/,end:/\}[a-z]*/},{begin:"%r\\(",end:"\\)[a-z]*"},{begin:"%r!",end:"![a-z]*"},{begin:"%r\\[",end:"\\][a-z]*"}]}].concat(o,c),relevance:0}].concat(o,c);d.contains=k,h.contains=k;let X=[{begin:/^\s*=>/,starts:{end:"$",contains:k}},{className:"meta.prompt",begin:"^("+"[>?]>"+"|"+"[\\w#]+\\(\\w+\\):\\d+:\\d+[>*]"+"|"+"(\\w+-)?\\d+\\.\\d+\\.\\d+(p\\d+)?[^\\d][^>]+>"+")(?=[ ])",starts:{end:"$",keywords:r,contains:k}}];return c.unshift(o),{name:"Ruby",aliases:["rb","gemspec","podspec","thor","irb"],keywords:r,illegal:/\/\*/,contains:[e.SHEBANG({binary:"ruby"})].concat(X).concat(c).concat(k)}}Ln.exports=ga});var Un=A((Or,Bn)=>{function ba(e){let u={keyword:["break","case","chan","const","continue","default","defer","else","fallthrough","for","func","go","goto","if","import","interface","map","package","range","return","select","struct","switch","type","var"],type:["bool","byte","complex64","complex128","error","float32","float64","int8","int16","int32","int64","string","uint8","uint16","uint32","uint64","int","uint","uintptr","rune"],literal:["true","false","iota","nil"],built_in:["append","cap","close","complex","copy","imag","len","make","new","panic","print","println","real","recover","delete"]};return{name:"Go",aliases:["golang"],keywords:u,illegal:"</",contains:[e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,{className:"string",variants:[e.QUOTE_STRING_MODE,e.APOS_STRING_MODE,{begin:"`",end:"`"}]},{className:"number",variants:[{match:/-?\b0[xX]\.[a-fA-F0-9](_?[a-fA-F0-9])*[pP][+-]?\d(_?\d)*i?/,relevance:0},{match:/-?\b0[xX](_?[a-fA-F0-9])+((\.([a-fA-F0-9](_?[a-fA-F0-9])*)?)?[pP][+-]?\d(_?\d)*)?i?/,relevance:0},{match:/-?\b0[oO](_?[0-7])*i?/,relevance:0},{match:/-?\.\d(_?\d)*([eE][+-]?\d(_?\d)*)?i?/,relevance:0},{match:/-?\b\d(_?\d)*(\.(\d(_?\d)*)?)?([eE][+-]?\d(_?\d)*)?i?/,relevance:0}]},{begin:/:=/},{className:"function",beginKeywords:"func",end:"\\s*(\\{|$)",excludeEnd:!0,contains:[e.TITLE_MODE,{className:"params",begin:/\(/,end:/\)/,endsParent:!0,keywords:u,illegal:/["']/}]}]}}Bn.exports=ba});var Fn=A((Ar,Pn)=>{function pa(e){let n=e.regex,t=/[_A-Za-z][_0-9A-Za-z]*/;return{name:"GraphQL",aliases:["gql"],case_insensitive:!0,disableAutodetect:!1,keywords:{keyword:["query","mutation","subscription","type","input","schema","directive","interface","union","scalar","fragment","enum","on"],literal:["true","false","null"]},contains:[e.HASH_COMMENT_MODE,e.QUOTE_STRING_MODE,e.NUMBER_MODE,{scope:"punctuation",match:/[.]{3}/,relevance:0},{scope:"punctuation",begin:/[\!\(\)\:\=\[\]\{\|\}]{1}/,relevance:0},{scope:"variable",begin:/\$/,end:/\W/,excludeEnd:!0,relevance:0},{scope:"meta",match:/@\w+/,excludeEnd:!0},{scope:"symbol",begin:n.concat(t,n.lookahead(/\s*:/)),relevance:0}],illegal:[/[;<']/,/BEGIN/]}}Pn.exports=pa});var $n=A((Rr,zn)=>{function ma(e){let n=e.regex,t={className:"number",relevance:0,variants:[{begin:/([+-]+)?[\d]+_[\d_]+/},{begin:e.NUMBER_RE}]},i=e.COMMENT();i.variants=[{begin:/;/,end:/$/},{begin:/#/,end:/$/}];let s={className:"variable",variants:[{begin:/\$[\w\d"][\w\d_]*/},{begin:/\$\{(.*?)\}/}]},u={className:"literal",begin:/\bon|off|true|false|yes|no\b/},r={className:"string",contains:[e.BACKSLASH_ESCAPE],variants:[{begin:"'''",end:"'''",relevance:10},{begin:'"""',end:'"""',relevance:10},{begin:'"',end:'"'},{begin:"'",end:"'"}]},a={begin:/\[/,end:/\]/,contains:[i,u,s,r,t,"self"],relevance:0},o=/[A-Za-z0-9_-]+/,c=/"(\\"|[^"])*"/,d=/'[^']*'/,f=n.either(o,c,d),b=n.concat(f,"(\\s*\\.\\s*",f,")*",n.lookahead(/\s*=\s*[^#\s]/));return{name:"TOML, also INI",aliases:["toml"],case_insensitive:!0,illegal:/\S/,contains:[i,{className:"section",begin:/\[+/,end:/\]+/},{begin:b,className:"attr",starts:{end:/$/,contains:[i,a,u,s,r,t]}}]}}zn.exports=ma});var qn=A((Mr,Hn)=>{var be="[0-9](_*[0-9])*",Ae=`\\.(${be})`,Re="[0-9a-fA-F](_*[0-9a-fA-F])*",Kn={className:"number",variants:[{begin:`(\\b(${be})((${Ae})|\\.)?|(${Ae}))[eE][+-]?(${be})[fFdD]?\\b`},{begin:`\\b(${be})((${Ae})[fFdD]?\\b|\\.([fFdD]\\b)?)`},{begin:`(${Ae})[fFdD]?\\b`},{begin:`\\b(${be})[fFdD]\\b`},{begin:`\\b0[xX]((${Re})\\.?|(${Re})?\\.(${Re}))[pP][+-]?(${be})[fFdD]?\\b`},{begin:"\\b(0|[1-9](_*[0-9])*)[lL]?\\b"},{begin:`\\b0[xX](${Re})[lL]?\\b`},{begin:"\\b0(_*[0-7])*[lL]?\\b"},{begin:"\\b0[bB][01](_*[01])*[lL]?\\b"}],relevance:0};function Gn(e,n,t){return t===-1?"":e.replace(n,i=>Gn(e,n,t-1))}function _a(e){let n=e.regex,t="[\xC0-\u02B8a-zA-Z_$][\xC0-\u02B8a-zA-Z_$0-9]*",i=t+Gn("(?:<"+t+"~~~(?:\\s*,\\s*"+t+"~~~)*>)?",/~~~/g,2),o={keyword:["synchronized","abstract","private","var","static","if","const ","for","while","strictfp","finally","protected","import","native","final","void","enum","else","break","transient","catch","instanceof","volatile","case","assert","package","default","public","try","switch","continue","throws","protected","public","private","module","requires","exports","do","sealed","yield","permits","goto","when"],literal:["false","true","null"],type:["char","boolean","long","float","int","byte","short","double"],built_in:["super","this"]},c={className:"meta",begin:"@"+t,contains:[{begin:/\(/,end:/\)/,contains:["self"]}]},d={className:"params",begin:/\(/,end:/\)/,keywords:o,relevance:0,contains:[e.C_BLOCK_COMMENT_MODE],endsParent:!0};return{name:"Java",aliases:["jsp"],keywords:o,illegal:/<\/|#/,contains:[e.COMMENT("/\\*\\*","\\*/",{relevance:0,contains:[{begin:/\w+@/,relevance:0},{className:"doctag",begin:"@[A-Za-z]+"}]}),{begin:/import java\.[a-z]+\./,keywords:"import",relevance:2},e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,{begin:/"""/,end:/"""/,className:"string",contains:[e.BACKSLASH_ESCAPE]},e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,{match:[/\b(?:class|interface|enum|extends|implements|new)/,/\s+/,t],className:{1:"keyword",3:"title.class"}},{match:/non-sealed/,scope:"keyword"},{begin:[n.concat(/(?!else)/,t),/\s+/,t,/\s+/,/=(?!=)/],className:{1:"type",3:"variable",5:"operator"}},{begin:[/record/,/\s+/,t],className:{1:"keyword",3:"title.class"},contains:[d,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},{beginKeywords:"new throw return else",relevance:0},{begin:["(?:"+i+"\\s+)",e.UNDERSCORE_IDENT_RE,/\s*(?=\()/],className:{2:"title.function"},keywords:o,contains:[{className:"params",begin:/\(/,end:/\)/,keywords:o,relevance:0,contains:[c,e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,Kn,e.C_BLOCK_COMMENT_MODE]},e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},Kn,c]}}Hn.exports=_a});var Qn=A((kr,Vn)=>{var Wn="[A-Za-z$_][0-9A-Za-z$_]*",fa=["as","in","of","if","for","while","finally","var","new","function","do","return","void","else","break","catch","instanceof","with","throw","case","default","try","switch","continue","typeof","delete","let","yield","const","class","debugger","async","await","static","import","from","export","extends","using"],Ea=["true","false","null","undefined","NaN","Infinity"],Yn=["Object","Function","Boolean","Symbol","Math","Date","Number","BigInt","String","RegExp","Array","Float32Array","Float64Array","Int8Array","Uint8Array","Uint8ClampedArray","Int16Array","Int32Array","Uint16Array","Uint32Array","BigInt64Array","BigUint64Array","Set","Map","WeakSet","WeakMap","ArrayBuffer","SharedArrayBuffer","Atomics","DataView","JSON","Promise","Generator","GeneratorFunction","AsyncFunction","Reflect","Proxy","Intl","WebAssembly"],Zn=["Error","EvalError","InternalError","RangeError","ReferenceError","SyntaxError","TypeError","URIError"],Xn=["setInterval","setTimeout","clearInterval","clearTimeout","require","exports","eval","isFinite","isNaN","parseFloat","parseInt","decodeURI","decodeURIComponent","encodeURI","encodeURIComponent","escape","unescape"],ha=["arguments","this","super","console","window","document","localStorage","sessionStorage","module","global"],Na=[].concat(Xn,Yn,Zn);function ya(e){let n=e.regex,t=(p,{after:w})=>{let x="</"+p[0].slice(1);return p.input.indexOf(x,w)!==-1},i=Wn,s={begin:"<>",end:"</>"},u=/<[A-Za-z0-9\\._:-]+\s*\/>/,r={begin:/<[A-Za-z0-9\\._:-]+/,end:/\/[A-Za-z0-9\\._:-]+>|\/>/,isTrulyOpeningTag:(p,w)=>{let x=p[0].length+p.index,P=p.input[x];if(P==="<"||P===","){w.ignoreMatch();return}P===">"&&(t(p,{after:x})||w.ignoreMatch());let $,J=p.input.substring(x);if($=J.match(/^\s*=/)){w.ignoreMatch();return}if(($=J.match(/^\s+extends\s+/))&&$.index===0){w.ignoreMatch();return}}},a={$pattern:Wn,keyword:fa,literal:Ea,built_in:Na,"variable.language":ha},o="[0-9](_?[0-9])*",c=`\\.(${o})`,d="0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*",f={className:"number",variants:[{begin:`(\\b(${d})((${c})|\\.)?|(${c}))[eE][+-]?(${o})\\b`},{begin:`\\b(${d})\\b((${c})\\b|\\.)?|(${c})\\b`},{begin:"\\b(0|[1-9](_?[0-9])*)n\\b"},{begin:"\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b"},{begin:"\\b0[bB][0-1](_?[0-1])*n?\\b"},{begin:"\\b0[oO][0-7](_?[0-7])*n?\\b"},{begin:"\\b0[0-7]+n?\\b"}],relevance:0},b={className:"subst",begin:"\\$\\{",end:"\\}",keywords:a,contains:[]},_={begin:".?html`",end:"",starts:{end:"`",returnEnd:!1,contains:[e.BACKSLASH_ESCAPE,b],subLanguage:"xml"}},S={begin:".?css`",end:"",starts:{end:"`",returnEnd:!1,contains:[e.BACKSLASH_ESCAPE,b],subLanguage:"css"}},h={begin:".?gql`",end:"",starts:{end:"`",returnEnd:!1,contains:[e.BACKSLASH_ESCAPE,b],subLanguage:"graphql"}},N={className:"string",begin:"`",end:"`",contains:[e.BACKSLASH_ESCAPE,b]},R={className:"comment",variants:[e.COMMENT(/\/\*\*(?!\/)/,"\\*/",{relevance:0,contains:[{begin:"(?=@[A-Za-z]+)",relevance:0,contains:[{className:"doctag",begin:"@[A-Za-z]+"},{className:"type",begin:"\\{",end:"\\}",excludeEnd:!0,excludeBegin:!0,relevance:0},{className:"variable",begin:i+"(?=\\s*(-)|$)",endsParent:!0,relevance:0},{begin:/(?=[^\n])\s/,relevance:0}]}]}),e.C_BLOCK_COMMENT_MODE,e.C_LINE_COMMENT_MODE]},I=[e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,_,S,h,N,{match:/\$\d+/},f];b.contains=I.concat({begin:/\{/,end:/\}/,keywords:a,contains:["self"].concat(I)});let M=[].concat(R,b.contains),C=M.concat([{begin:/(\s*)\(/,end:/\)/,keywords:a,contains:["self"].concat(M)}]),k={className:"params",begin:/(\s*)\(/,end:/\)/,excludeBegin:!0,excludeEnd:!0,keywords:a,contains:C},H={variants:[{match:[/class/,/\s+/,i,/\s+/,/extends/,/\s+/,n.concat(i,"(",n.concat(/\./,i),")*")],scope:{1:"keyword",3:"title.class",5:"keyword",7:"title.class.inherited"}},{match:[/class/,/\s+/,i],scope:{1:"keyword",3:"title.class"}}]},L={relevance:0,match:n.either(/\bJSON/,/\b[A-Z][a-z]+([A-Z][a-z]*|\d)*/,/\b[A-Z]{2,}([A-Z][a-z]+|\d)+([A-Z][a-z]*)*/,/\b[A-Z]{2,}[a-z]+([A-Z][a-z]+|\d)*([A-Z][a-z]*)*/),className:"title.class",keywords:{_:[...Yn,...Zn]}},z={label:"use_strict",className:"meta",relevance:10,begin:/^\s*['"]use (strict|asm)['"]/},X={variants:[{match:[/function/,/\s+/,i,/(?=\s*\()/]},{match:[/function/,/\s*(?=\()/]}],className:{1:"keyword",3:"title.function"},label:"func.def",contains:[k],illegal:/%/},ne={relevance:0,match:/\b[A-Z][A-Z_0-9]+\b/,className:"variable.constant"};function Q(p){return n.concat("(?!",p.join("|"),")")}let ee={match:n.concat(/\b/,Q([...Xn,"super","import"].map(p=>`${p}\\s*\\(`)),i,n.lookahead(/\s*\(/)),className:"title.function",relevance:0},K={begin:n.concat(/\./,n.lookahead(n.concat(i,/(?![0-9A-Za-z$_(])/))),end:i,excludeBegin:!0,keywords:"prototype",className:"property",relevance:0},G={match:[/get|set/,/\s+/,i,/(?=\()/],className:{1:"keyword",3:"title.function"},contains:[{begin:/\(\)/},k]},l="(\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)|"+e.UNDERSCORE_IDENT_RE+")\\s*=>",m={match:[/const|var|let/,/\s+/,i,/\s*/,/=\s*/,/(async\s*)?/,n.lookahead(l)],keywords:"async",className:{1:"keyword",3:"title.function"},contains:[k]};return{name:"JavaScript",aliases:["js","jsx","mjs","cjs"],keywords:a,exports:{PARAMS_CONTAINS:C,CLASS_REFERENCE:L},illegal:/#(?![$_A-z])/,contains:[e.SHEBANG({label:"shebang",binary:"node",relevance:5}),z,e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,_,S,h,N,R,{match:/\$\d+/},f,L,{scope:"attr",match:i+n.lookahead(":"),relevance:0},m,{begin:"("+e.RE_STARTERS_RE+"|\\b(case|return|throw)\\b)\\s*",keywords:"return throw case",relevance:0,contains:[R,e.REGEXP_MODE,{className:"function",begin:l,returnBegin:!0,end:"\\s*=>",contains:[{className:"params",variants:[{begin:e.UNDERSCORE_IDENT_RE,relevance:0},{className:null,begin:/\(\s*\)/,skip:!0},{begin:/(\s*)\(/,end:/\)/,excludeBegin:!0,excludeEnd:!0,keywords:a,contains:C}]}]},{begin:/,/,relevance:0},{match:/\s+/,relevance:0},{variants:[{begin:s.begin,end:s.end},{match:u},{begin:r.begin,"on:begin":r.isTrulyOpeningTag,end:r.end}],subLanguage:"xml",contains:[{begin:r.begin,end:r.end,skip:!0,contains:["self"]}]}]},X,{beginKeywords:"while if switch catch for"},{begin:"\\b(?!function)"+e.UNDERSCORE_IDENT_RE+"\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)\\s*\\{",returnBegin:!0,label:"func.def",contains:[k,e.inherit(e.TITLE_MODE,{begin:i,className:"title.function"})]},{match:/\.\.\./,relevance:0},K,{match:"\\$"+i,relevance:0},{match:[/\bconstructor(?=\s*\()/],className:{1:"title.function"},contains:[k]},ee,ne,H,G,{match:/\$[(.]/}]}}Vn.exports=ya});var jn=A((xr,Jn)=>{function Ta(e){let n={className:"attr",begin:/"(\\.|[^\\"\r\n])*"(?=\s*:)/,relevance:1.01},t={match:/[{}[\],:]/,className:"punctuation",relevance:0},i=["true","false","null"],s={scope:"literal",beginKeywords:i.join(" ")};return{name:"JSON",aliases:["jsonc"],keywords:{literal:i},contains:[n,t,e.QUOTE_STRING_MODE,s,e.C_NUMBER_MODE,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE],illegal:"\\S"}}Jn.exports=Ta});var nt=A((Ir,et)=>{var pe="[0-9](_*[0-9])*",Me=`\\.(${pe})`,ke="[0-9a-fA-F](_*[0-9a-fA-F])*",Sa={className:"number",variants:[{begin:`(\\b(${pe})((${Me})|\\.)?|(${Me}))[eE][+-]?(${pe})[fFdD]?\\b`},{begin:`\\b(${pe})((${Me})[fFdD]?\\b|\\.([fFdD]\\b)?)`},{begin:`(${Me})[fFdD]?\\b`},{begin:`\\b(${pe})[fFdD]\\b`},{begin:`\\b0[xX]((${ke})\\.?|(${ke})?\\.(${ke}))[pP][+-]?(${pe})[fFdD]?\\b`},{begin:"\\b(0|[1-9](_*[0-9])*)[lL]?\\b"},{begin:`\\b0[xX](${ke})[lL]?\\b`},{begin:"\\b0(_*[0-7])*[lL]?\\b"},{begin:"\\b0[bB][01](_*[01])*[lL]?\\b"}],relevance:0};function wa(e){let n={keyword:"abstract as val var vararg get set class object open private protected public noinline crossinline dynamic final enum if else do while for when throw try catch finally import package is in fun override companion reified inline lateinit init interface annotation data sealed internal infix operator out by constructor super tailrec where const inner suspend typealias external expect actual",built_in:"Byte Short Char Int Long Boolean Float Double Void Unit Nothing",literal:"true false null"},t={className:"keyword",begin:/\b(break|continue|return|this)\b/,starts:{contains:[{className:"symbol",begin:/@\w+/}]}},i={className:"symbol",begin:e.UNDERSCORE_IDENT_RE+"@"},s={className:"subst",begin:/\$\{/,end:/\}/,contains:[e.C_NUMBER_MODE]},u={className:"variable",begin:"\\$"+e.UNDERSCORE_IDENT_RE},r={className:"string",variants:[{begin:'"""',end:'"""(?=[^"])',contains:[u,s]},{begin:"'",end:"'",illegal:/\n/,contains:[e.BACKSLASH_ESCAPE]},{begin:'"',end:'"',illegal:/\n/,contains:[e.BACKSLASH_ESCAPE,u,s]}]};s.contains.push(r);let a={className:"meta",begin:"@(?:file|property|field|get|set|receiver|param|setparam|delegate)\\s*:(?:\\s*"+e.UNDERSCORE_IDENT_RE+")?"},o={className:"meta",begin:"@"+e.UNDERSCORE_IDENT_RE,contains:[{begin:/\(/,end:/\)/,contains:[e.inherit(r,{className:"string"}),"self"]}]},c=Sa,d=e.COMMENT("/\\*","\\*/",{contains:[e.C_BLOCK_COMMENT_MODE]}),f={variants:[{className:"type",begin:e.UNDERSCORE_IDENT_RE},{begin:/\(/,end:/\)/,contains:[]}]},b=f;return b.variants[1].contains=[f],f.variants[1].contains=[b],{name:"Kotlin",aliases:["kt","kts"],keywords:n,contains:[e.COMMENT("/\\*\\*","\\*/",{relevance:0,contains:[{className:"doctag",begin:"@[A-Za-z]+"}]}),e.C_LINE_COMMENT_MODE,d,t,i,a,o,{className:"function",beginKeywords:"fun",end:"[(]|$",returnBegin:!0,excludeEnd:!0,keywords:n,relevance:5,contains:[{begin:e.UNDERSCORE_IDENT_RE+"\\s*\\(",returnBegin:!0,relevance:0,contains:[e.UNDERSCORE_TITLE_MODE]},{className:"type",begin:/</,end:/>/,keywords:"reified",relevance:0},{className:"params",begin:/\(/,end:/\)/,endsParent:!0,keywords:n,relevance:0,contains:[{begin:/:/,end:/[=,\/]/,endsWithParent:!0,contains:[f,e.C_LINE_COMMENT_MODE,d],relevance:0},e.C_LINE_COMMENT_MODE,d,a,o,r,e.C_NUMBER_MODE]},d]},{begin:[/class|interface|trait/,/\s+/,e.UNDERSCORE_IDENT_RE],beginScope:{3:"title.class"},keywords:"class interface trait",end:/[:\{(]|$/,excludeEnd:!0,illegal:"extends implements",contains:[{beginKeywords:"public protected internal private constructor"},e.UNDERSCORE_TITLE_MODE,{className:"type",begin:/</,end:/>/,excludeBegin:!0,excludeEnd:!0,relevance:0},{className:"type",begin:/[,:]\s*/,end:/[<\(,){\s]|$/,excludeBegin:!0,returnEnd:!0},a,o]},r,{className:"meta",begin:"^#!/usr/bin/env",end:"$",illegal:`
frontend/assets/vendor/highlight.min.js:4:`},c]}}et.exports=wa});var rt=A((Cr,at)=>{var va=e=>({IMPORTANT:{scope:"meta",begin:"!important"},BLOCK_COMMENT:e.C_BLOCK_COMMENT_MODE,HEXCOLOR:{scope:"number",begin:/#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/},FUNCTION_DISPATCH:{className:"built_in",begin:/[\w-]+(?=\()/},ATTRIBUTE_SELECTOR_MODE:{scope:"selector-attr",begin:/\[/,end:/\]/,illegal:"$",contains:[e.APOS_STRING_MODE,e.QUOTE_STRING_MODE]},CSS_NUMBER_MODE:{scope:"number",begin:e.NUMBER_RE+"(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",relevance:0},CSS_VARIABLE:{className:"attr",begin:/--[A-Za-z_][A-Za-z0-9_-]*/}}),Oa=["a","abbr","address","article","aside","audio","b","blockquote","body","button","canvas","caption","cite","code","dd","del","details","dfn","div","dl","dt","em","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hgroup","html","i","iframe","img","input","ins","kbd","label","legend","li","main","mark","menu","nav","object","ol","optgroup","option","p","picture","q","quote","samp","section","select","source","span","strong","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","tr","ul","var","video"],Aa=["defs","g","marker","mask","pattern","svg","switch","symbol","feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feFlood","feGaussianBlur","feImage","feMerge","feMorphology","feOffset","feSpecularLighting","feTile","feTurbulence","linearGradient","radialGradient","stop","circle","ellipse","image","line","path","polygon","polyline","rect","text","use","textPath","tspan","foreignObject","clipPath"],Ra=[...Oa,...Aa],Ma=["any-hover","any-pointer","aspect-ratio","color","color-gamut","color-index","device-aspect-ratio","device-height","device-width","display-mode","forced-colors","grid","height","hover","inverted-colors","monochrome","orientation","overflow-block","overflow-inline","pointer","prefers-color-scheme","prefers-contrast","prefers-reduced-motion","prefers-reduced-transparency","resolution","scan","scripting","update","width","min-width","max-width","min-height","max-height"].sort().reverse(),tt=["active","any-link","blank","checked","current","default","defined","dir","disabled","drop","empty","enabled","first","first-child","first-of-type","fullscreen","future","focus","focus-visible","focus-within","has","host","host-context","hover","indeterminate","in-range","invalid","is","lang","last-child","last-of-type","left","link","local-link","not","nth-child","nth-col","nth-last-child","nth-last-col","nth-last-of-type","nth-of-type","only-child","only-of-type","optional","out-of-range","past","placeholder-shown","read-only","read-write","required","right","root","scope","target","target-within","user-invalid","valid","visited","where"].sort().reverse(),it=["after","backdrop","before","cue","cue-region","first-letter","first-line","grammar-error","marker","part","placeholder","selection","slotted","spelling-error"].sort().reverse(),ka=["accent-color","align-content","align-items","align-self","alignment-baseline","all","anchor-name","animation","animation-composition","animation-delay","animation-direction","animation-duration","animation-fill-mode","animation-iteration-count","animation-name","animation-play-state","animation-range","animation-range-end","animation-range-start","animation-timeline","animation-timing-function","appearance","aspect-ratio","backdrop-filter","backface-visibility","background","background-attachment","background-blend-mode","background-clip","background-color","background-image","background-origin","background-position","background-position-x","background-position-y","background-repeat","background-size","baseline-shift","block-size","border","border-block","border-block-color","border-block-end","border-block-end-color","border-block-end-style","border-block-end-width","border-block-start","border-block-start-color","border-block-start-style","border-block-start-width","border-block-style","border-block-width","border-bottom","border-bottom-color","border-bottom-left-radius","border-bottom-right-radius","border-bottom-style","border-bottom-width","border-collapse","border-color","border-end-end-radius","border-end-start-radius","border-image","border-image-outset","border-image-repeat","border-image-slice","border-image-source","border-image-width","border-inline","border-inline-color","border-inline-end","border-inline-end-color","border-inline-end-style","border-inline-end-width","border-inline-start","border-inline-start-color","border-inline-start-style","border-inline-start-width","border-inline-style","border-inline-width","border-left","border-left-color","border-left-style","border-left-width","border-radius","border-right","border-right-color","border-right-style","border-right-width","border-spacing","border-start-end-radius","border-start-start-radius","border-style","border-top","border-top-color","border-top-left-radius","border-top-right-radius","border-top-style","border-top-width","border-width","bottom","box-align","box-decoration-break","box-direction","box-flex","box-flex-group","box-lines","box-ordinal-group","box-orient","box-pack","box-shadow","box-sizing","break-after","break-before","break-inside","caption-side","caret-color","clear","clip","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","color-scheme","column-count","column-fill","column-gap","column-rule","column-rule-color","column-rule-style","column-rule-width","column-span","column-width","columns","contain","contain-intrinsic-block-size","contain-intrinsic-height","contain-intrinsic-inline-size","contain-intrinsic-size","contain-intrinsic-width","container","container-name","container-type","content","content-visibility","counter-increment","counter-reset","counter-set","cue","cue-after","cue-before","cursor","cx","cy","direction","display","dominant-baseline","empty-cells","enable-background","field-sizing","fill","fill-opacity","fill-rule","filter","flex","flex-basis","flex-direction","flex-flow","flex-grow","flex-shrink","flex-wrap","float","flood-color","flood-opacity","flow","font","font-display","font-family","font-feature-settings","font-kerning","font-language-override","font-optical-sizing","font-palette","font-size","font-size-adjust","font-smooth","font-smoothing","font-stretch","font-style","font-synthesis","font-synthesis-position","font-synthesis-small-caps","font-synthesis-style","font-synthesis-weight","font-variant","font-variant-alternates","font-variant-caps","font-variant-east-asian","font-variant-emoji","font-variant-ligatures","font-variant-numeric","font-variant-position","font-variation-settings","font-weight","forced-color-adjust","gap","glyph-orientation-horizontal","glyph-orientation-vertical","grid","grid-area","grid-auto-columns","grid-auto-flow","grid-auto-rows","grid-column","grid-column-end","grid-column-start","grid-gap","grid-row","grid-row-end","grid-row-start","grid-template","grid-template-areas","grid-template-columns","grid-template-rows","hanging-punctuation","height","hyphenate-character","hyphenate-limit-chars","hyphens","icon","image-orientation","image-rendering","image-resolution","ime-mode","initial-letter","initial-letter-align","inline-size","inset","inset-area","inset-block","inset-block-end","inset-block-start","inset-inline","inset-inline-end","inset-inline-start","isolation","justify-content","justify-items","justify-self","kerning","left","letter-spacing","lighting-color","line-break","line-height","line-height-step","list-style","list-style-image","list-style-position","list-style-type","margin","margin-block","margin-block-end","margin-block-start","margin-bottom","margin-inline","margin-inline-end","margin-inline-start","margin-left","margin-right","margin-top","margin-trim","marker","marker-end","marker-mid","marker-start","marks","mask","mask-border","mask-border-mode","mask-border-outset","mask-border-repeat","mask-border-slice","mask-border-source","mask-border-width","mask-clip","mask-composite","mask-image","mask-mode","mask-origin","mask-position","mask-repeat","mask-size","mask-type","masonry-auto-flow","math-depth","math-shift","math-style","max-block-size","max-height","max-inline-size","max-width","min-block-size","min-height","min-inline-size","min-width","mix-blend-mode","nav-down","nav-index","nav-left","nav-right","nav-up","none","normal","object-fit","object-position","offset","offset-anchor","offset-distance","offset-path","offset-position","offset-rotate","opacity","order","orphans","outline","outline-color","outline-offset","outline-style","outline-width","overflow","overflow-anchor","overflow-block","overflow-clip-margin","overflow-inline","overflow-wrap","overflow-x","overflow-y","overlay","overscroll-behavior","overscroll-behavior-block","overscroll-behavior-inline","overscroll-behavior-x","overscroll-behavior-y","padding","padding-block","padding-block-end","padding-block-start","padding-bottom","padding-inline","padding-inline-end","padding-inline-start","padding-left","padding-right","padding-top","page","page-break-after","page-break-before","page-break-inside","paint-order","pause","pause-after","pause-before","perspective","perspective-origin","place-content","place-items","place-self","pointer-events","position","position-anchor","position-visibility","print-color-adjust","quotes","r","resize","rest","rest-after","rest-before","right","rotate","row-gap","ruby-align","ruby-position","scale","scroll-behavior","scroll-margin","scroll-margin-block","scroll-margin-block-end","scroll-margin-block-start","scroll-margin-bottom","scroll-margin-inline","scroll-margin-inline-end","scroll-margin-inline-start","scroll-margin-left","scroll-margin-right","scroll-margin-top","scroll-padding","scroll-padding-block","scroll-padding-block-end","scroll-padding-block-start","scroll-padding-bottom","scroll-padding-inline","scroll-padding-inline-end","scroll-padding-inline-start","scroll-padding-left","scroll-padding-right","scroll-padding-top","scroll-snap-align","scroll-snap-stop","scroll-snap-type","scroll-timeline","scroll-timeline-axis","scroll-timeline-name","scrollbar-color","scrollbar-gutter","scrollbar-width","shape-image-threshold","shape-margin","shape-outside","shape-rendering","speak","speak-as","src","stop-color","stop-opacity","stroke","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke-width","tab-size","table-layout","text-align","text-align-all","text-align-last","text-anchor","text-combine-upright","text-decoration","text-decoration-color","text-decoration-line","text-decoration-skip","text-decoration-skip-ink","text-decoration-style","text-decoration-thickness","text-emphasis","text-emphasis-color","text-emphasis-position","text-emphasis-style","text-indent","text-justify","text-orientation","text-overflow","text-rendering","text-shadow","text-size-adjust","text-transform","text-underline-offset","text-underline-position","text-wrap","text-wrap-mode","text-wrap-style","timeline-scope","top","touch-action","transform","transform-box","transform-origin","transform-style","transition","transition-behavior","transition-delay","transition-duration","transition-property","transition-timing-function","translate","unicode-bidi","user-modify","user-select","vector-effect","vertical-align","view-timeline","view-timeline-axis","view-timeline-inset","view-timeline-name","view-transition-name","visibility","voice-balance","voice-duration","voice-family","voice-pitch","voice-range","voice-rate","voice-stress","voice-volume","white-space","white-space-collapse","widows","width","will-change","word-break","word-spacing","word-wrap","writing-mode","x","y","z-index","zoom"].sort().reverse(),xa=tt.concat(it).sort().reverse();function Ia(e){let n=va(e),t=xa,i="and or not only",s="[\\w-]+",u="("+s+"|@\\{"+s+"\\})",r=[],a=[],o=function(I){return{className:"string",begin:"~?"+I+".*?"+I}},c=function(I,M,C){return{className:I,begin:M,relevance:C}},d={$pattern:/[a-z-]+/,keyword:i,attribute:Ma.join(" ")},f={begin:"\\(",end:"\\)",contains:a,keywords:d,relevance:0};a.push(e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,o("'"),o('"'),n.CSS_NUMBER_MODE,{begin:"(url|data-uri)\\(",starts:{className:"string",end:"[\\)\\n]",excludeEnd:!0}},n.HEXCOLOR,f,c("variable","@@?"+s,10),c("variable","@\\{"+s+"\\}"),c("built_in","~?`[^`]*?`"),{className:"attribute",begin:s+"\\s*:",end:":",returnBegin:!0,excludeEnd:!0},n.IMPORTANT,{beginKeywords:"and not"},n.FUNCTION_DISPATCH);let b=a.concat({begin:/\{/,end:/\}/,contains:r}),_={beginKeywords:"when",endsWithParent:!0,contains:[{beginKeywords:"and not"}].concat(a)},S={begin:u+"\\s*:",returnBegin:!0,end:/[;}]/,relevance:0,contains:[{begin:/-(webkit|moz|ms|o)-/},n.CSS_VARIABLE,{className:"attribute",begin:"\\b("+ka.join("|")+")\\b",end:/(?=:)/,starts:{endsWithParent:!0,illegal:"[<=$]",relevance:0,contains:a}}]},h={className:"keyword",begin:"@(import|media|charset|font-face|(-[a-z]+-)?keyframes|supports|document|namespace|page|viewport|host)\\b",starts:{end:"[;{}]",keywords:d,returnEnd:!0,contains:a,relevance:0}},N={className:"variable",variants:[{begin:"@"+s+"\\s*:",relevance:15},{begin:"@"+s}],starts:{end:"[;}]",returnEnd:!0,contains:b}},T={variants:[{begin:"[\\.#:&\\[>]",end:"[;{}]"},{begin:u,end:/\{/}],returnBegin:!0,returnEnd:!0,illegal:`[<='$"]`,relevance:0,contains:[e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,_,c("keyword","all\\b"),c("variable","@\\{"+s+"\\}"),{begin:"\\b("+Ra.join("|")+")\\b",className:"selector-tag"},n.CSS_NUMBER_MODE,c("selector-tag",u,0),c("selector-id","#"+u),c("selector-class","\\."+u,0),c("selector-tag","&",0),n.ATTRIBUTE_SELECTOR_MODE,{className:"selector-pseudo",begin:":("+tt.join("|")+")"},{className:"selector-pseudo",begin:":(:)?("+it.join("|")+")"},{begin:/\(/,end:/\)/,relevance:0,contains:b},{begin:"!important"},n.FUNCTION_DISPATCH]},R={begin:s+`:(:)?(${t.join("|")})`,returnBegin:!0,contains:[T]};return r.push(e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,h,N,R,S,T,_,n.FUNCTION_DISPATCH),{name:"Less",case_insensitive:!0,illegal:`[=>'/<($"]`,contains:r}}at.exports=Ia});var st=A((Lr,ot)=>{function Ca(e){let n="\\[=*\\[",t="\\]=*\\]",i={begin:n,end:t,contains:["self"]},s=[e.COMMENT("--(?!"+n+")","$"),e.COMMENT("--"+n,t,{contains:[i],relevance:10})];return{name:"Lua",aliases:["pluto"],keywords:{$pattern:e.UNDERSCORE_IDENT_RE,literal:"true false nil",keyword:"and break do else elseif end for goto if in local not or repeat return then until while",built_in:"_G _ENV _VERSION __index __newindex __mode __call __metatable __tostring __len __gc __add __sub __mul __div __mod __pow __concat __unm __eq __lt __le assert collectgarbage dofile error getfenv getmetatable ipairs load loadfile loadstring module next pairs pcall print rawequal rawget rawset require select setfenv setmetatable tonumber tostring type unpack xpcall arg self coroutine resume yield status wrap create running debug getupvalue debug sethook getmetatable gethook setmetatable setlocal traceback setfenv getinfo setupvalue getlocal getregistry getfenv io lines write close flush open output type read stderr stdin input stdout popen tmpfile math log max acos huge ldexp pi cos tanh pow deg tan cosh sinh random randomseed frexp ceil floor rad abs sqrt modf asin min mod fmod log10 atan2 exp sin atan os exit setlocale date getenv difftime remove time clock tmpname rename execute package preload loadlib loaded loaders cpath config path seeall string sub upper len gfind rep find match char dump gmatch reverse byte format gsub lower table setn insert getn foreachi maxn foreach concat sort remove"},contains:s.concat([{className:"function",beginKeywords:"function",end:"\\)",contains:[e.inherit(e.TITLE_MODE,{begin:"([_a-zA-Z]\\w*\\.)*([_a-zA-Z]\\w*:)?[_a-zA-Z]\\w*"}),{className:"params",begin:"\\(",endsWithParent:!0,contains:s}].concat(s)},e.C_NUMBER_MODE,e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,{className:"string",begin:n,end:t,contains:[i],relevance:5}])}}ot.exports=Ca});var lt=A((Dr,ct)=>{function La(e){let n={className:"variable",variants:[{begin:"\\$\\("+e.UNDERSCORE_IDENT_RE+"\\)",contains:[e.BACKSLASH_ESCAPE]},{begin:/\$[@%<?\^\+\*]/}]},t={className:"string",begin:/"/,end:/"/,contains:[e.BACKSLASH_ESCAPE,n]},i={className:"variable",begin:/\$\([\w-]+\s/,end:/\)/,keywords:{built_in:"subst patsubst strip findstring filter filter-out sort word wordlist firstword lastword dir notdir suffix basename addsuffix addprefix join wildcard realpath abspath error warning shell origin flavor foreach if or and call eval file value"},contains:[n,t]},s={begin:"^"+e.UNDERSCORE_IDENT_RE+"\\s*(?=[:+?]?=)"},u={className:"meta",begin:/^\.PHONY:/,end:/$/,keywords:{$pattern:/[\.\w]+/,keyword:".PHONY"}},r={className:"section",begin:/^[^\s]+:/,end:/$/,contains:[n]};return{name:"Makefile",aliases:["mk","mak","make"],keywords:{$pattern:/[\w-]+/,keyword:"define endef undefine ifdef ifndef ifeq ifneq else endif include -include sinclude override export unexport private vpath"},contains:[e.HASH_COMMENT_MODE,n,t,i,s,u,r]}}ct.exports=La});var ut=A((Br,dt)=>{function Da(e){let n=e.regex,t=["abs","accept","alarm","and","atan2","bind","binmode","bless","break","caller","chdir","chmod","chomp","chop","chown","chr","chroot","class","close","closedir","connect","continue","cos","crypt","dbmclose","dbmopen","defined","delete","die","do","dump","each","else","elsif","endgrent","endhostent","endnetent","endprotoent","endpwent","endservent","eof","eval","exec","exists","exit","exp","fcntl","field","fileno","flock","for","foreach","fork","format","formline","getc","getgrent","getgrgid","getgrnam","gethostbyaddr","gethostbyname","gethostent","getlogin","getnetbyaddr","getnetbyname","getnetent","getpeername","getpgrp","getpriority","getprotobyname","getprotobynumber","getprotoent","getpwent","getpwnam","getpwuid","getservbyname","getservbyport","getservent","getsockname","getsockopt","given","glob","gmtime","goto","grep","gt","hex","if","index","int","ioctl","join","keys","kill","last","lc","lcfirst","length","link","listen","local","localtime","log","lstat","lt","ma","map","method","mkdir","msgctl","msgget","msgrcv","msgsnd","my","ne","next","no","not","oct","open","opendir","or","ord","our","pack","package","pipe","pop","pos","print","printf","prototype","push","q|0","qq","quotemeta","qw","qx","rand","read","readdir","readline","readlink","readpipe","recv","redo","ref","rename","require","reset","return","reverse","rewinddir","rindex","rmdir","say","scalar","seek","seekdir","select","semctl","semget","semop","send","setgrent","sethostent","setnetent","setpgrp","setpriority","setprotoent","setpwent","setservent","setsockopt","shift","shmctl","shmget","shmread","shmwrite","shutdown","sin","sleep","socket","socketpair","sort","splice","split","sprintf","sqrt","srand","stat","state","study","sub","substr","symlink","syscall","sysopen","sysread","sysseek","system","syswrite","tell","telldir","tie","tied","time","times","tr","truncate","uc","ucfirst","umask","undef","unless","unlink","unpack","unshift","untie","until","use","utime","values","vec","wait","waitpid","wantarray","warn","when","while","write","x|0","xor","y|0"],i=/[dualxmsipngr]{0,12}/,s={$pattern:/[\w.]+/,keyword:t.join(" ")},u={className:"subst",begin:"[$@]\\{",end:"\\}",keywords:s},r={begin:/->\{/,end:/\}/},a={scope:"attr",match:/\s+:\s*\w+(\s*\(.*?\))?/},o={scope:"variable",variants:[{begin:/\$\d/},{begin:n.concat(/[$%@](?!")(\^\w\b|#\w+(::\w+)*|\{\w+\}|\w+(::\w*)*)/,"(?![A-Za-z])(?![@$%])")},{begin:/[$%@](?!")[^\s\w{=]|\$=/,relevance:0}],contains:[a]},c={className:"number",variants:[{match:/0?\.[0-9][0-9_]+\b/},{match:/\bv?(0|[1-9][0-9_]*(\.[0-9_]+)?|[1-9][0-9_]*)\b/},{match:/\b0[0-7][0-7_]*\b/},{match:/\b0x[0-9a-fA-F][0-9a-fA-F_]*\b/},{match:/\b0b[0-1][0-1_]*\b/}],relevance:0},d=[e.BACKSLASH_ESCAPE,u,o],f=[/!/,/\//,/\|/,/\?/,/'/,/"/,/#/],b=(h,N,T="\\1")=>{let R=T==="\\1"?T:n.concat(T,N);return n.concat(n.concat("(?:",h,")"),N,/(?:\\.|[^\\\/])*?/,R,/(?:\\.|[^\\\/])*?/,T,i)},_=(h,N,T)=>n.concat(n.concat("(?:",h,")"),N,/(?:\\.|[^\\\/])*?/,T,i),S=[o,e.HASH_COMMENT_MODE,e.COMMENT(/^=\w/,/=cut/,{endsWithParent:!0}),r,{className:"string",contains:d,variants:[{begin:"q[qwxr]?\\s*\\(",end:"\\)",relevance:5},{begin:"q[qwxr]?\\s*\\[",end:"\\]",relevance:5},{begin:"q[qwxr]?\\s*\\{",end:"\\}",relevance:5},{begin:"q[qwxr]?\\s*\\|",end:"\\|",relevance:5},{begin:"q[qwxr]?\\s*<",end:">",relevance:5},{begin:"qw\\s+q",end:"q",relevance:5},{begin:"'",end:"'",contains:[e.BACKSLASH_ESCAPE]},{begin:'"',end:'"'},{begin:"`",end:"`",contains:[e.BACKSLASH_ESCAPE]},{begin:/\{\w+\}/,relevance:0},{begin:"-?\\w+\\s*=>",relevance:0}]},c,{begin:"(\\/\\/|"+e.RE_STARTERS_RE+"|\\b(split|return|print|reverse|grep)\\b)\\s*",keywords:"split return print reverse grep",relevance:0,contains:[e.HASH_COMMENT_MODE,{className:"regexp",variants:[{begin:b("s|tr|y",n.either(...f,{capture:!0}))},{begin:b("s|tr|y","\\(","\\)")},{begin:b("s|tr|y","\\[","\\]")},{begin:b("s|tr|y","\\{","\\}")}],relevance:2},{className:"regexp",variants:[{begin:/(m|qr)\/\//,relevance:0},{begin:_("(?:m|qr)?",/\//,/\//)},{begin:_("m|qr",n.either(...f,{capture:!0}),/\1/)},{begin:_("m|qr",/\(/,/\)/)},{begin:_("m|qr",/\[/,/\]/)},{begin:_("m|qr",/\{/,/\}/)}]}]},{className:"function",beginKeywords:"sub method",end:"(\\s*\\(.*?\\))?[;{]",excludeEnd:!0,relevance:5,contains:[e.TITLE_MODE,a]},{className:"class",beginKeywords:"class",end:"[;{]",excludeEnd:!0,relevance:5,contains:[e.TITLE_MODE,a,c]},{begin:"-\\w\\b",relevance:0},{begin:"^__DATA__$",end:"^__END__$",subLanguage:"mojolicious",contains:[{begin:"^@@.*",end:"$",className:"comment"}]}];return u.contains=S,r.contains=S,{name:"Perl",aliases:["pl","pm"],keywords:s,contains:S}}dt.exports=Da});var bt=A((Ur,gt)=>{function Ba(e){let n={className:"built_in",begin:"\\b(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)\\w+"},t=/[a-zA-Z@][a-zA-Z0-9_]*/,a={"variable.language":["this","super"],$pattern:t,keyword:["while","export","sizeof","typedef","const","struct","for","union","volatile","static","mutable","if","do","return","goto","enum","else","break","extern","asm","case","default","register","explicit","typename","switch","continue","inline","readonly","assign","readwrite","self","@synchronized","id","typeof","nonatomic","IBOutlet","IBAction","strong","weak","copy","in","out","inout","bycopy","byref","oneway","__strong","__weak","__block","__autoreleasing","@private","@protected","@public","@try","@property","@end","@throw","@catch","@finally","@autoreleasepool","@synthesize","@dynamic","@selector","@optional","@required","@encode","@package","@import","@defs","@compatibility_alias","__bridge","__bridge_transfer","__bridge_retained","__bridge_retain","__covariant","__contravariant","__kindof","_Nonnull","_Nullable","_Null_unspecified","__FUNCTION__","__PRETTY_FUNCTION__","__attribute__","getter","setter","retain","unsafe_unretained","nonnull","nullable","null_unspecified","null_resettable","class","instancetype","NS_DESIGNATED_INITIALIZER","NS_UNAVAILABLE","NS_REQUIRES_SUPER","NS_RETURNS_INNER_POINTER","NS_INLINE","NS_AVAILABLE","NS_DEPRECATED","NS_ENUM","NS_OPTIONS","NS_SWIFT_UNAVAILABLE","NS_ASSUME_NONNULL_BEGIN","NS_ASSUME_NONNULL_END","NS_REFINED_FOR_SWIFT","NS_SWIFT_NAME","NS_SWIFT_NOTHROW","NS_DURING","NS_HANDLER","NS_ENDHANDLER","NS_VALUERETURN","NS_VOIDRETURN"],literal:["false","true","FALSE","TRUE","nil","YES","NO","NULL"],built_in:["dispatch_once_t","dispatch_queue_t","dispatch_sync","dispatch_async","dispatch_once"],type:["int","float","char","unsigned","signed","short","long","double","wchar_t","unichar","void","bool","BOOL","id|0","_Bool"]},o={$pattern:t,keyword:["@interface","@class","@protocol","@implementation"]};return{name:"Objective-C",aliases:["mm","objc","obj-c","obj-c++","objective-c++"],keywords:a,illegal:"</",contains:[n,e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,e.C_NUMBER_MODE,e.QUOTE_STRING_MODE,e.APOS_STRING_MODE,{className:"string",variants:[{begin:'@"',end:'"',illegal:"\\n",contains:[e.BACKSLASH_ESCAPE]}]},{className:"meta",begin:/#\s*[a-z]+\b/,end:/$/,keywords:{keyword:"if else elif endif define undef warning error line pragma ifdef ifndef include"},contains:[{begin:/\\\n/,relevance:0},e.inherit(e.QUOTE_STRING_MODE,{className:"string"}),{className:"string",begin:/<.*?>/,end:/$/,illegal:"\\n"},e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE]},{className:"class",begin:"("+o.keyword.join("|")+")\\b",end:/(\{|$)/,excludeEnd:!0,keywords:o,contains:[e.UNDERSCORE_TITLE_MODE]},{begin:"\\."+e.UNDERSCORE_IDENT_RE,relevance:0}]}}gt.exports=Ba});var mt=A((Pr,pt)=>{function Ua(e){let n=e.regex,t=/(?![A-Za-z0-9])(?![$])/,i=n.concat(/[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/,t),s=n.concat(/(\\?[A-Z][a-z0-9_\x7f-\xff]+|\\?[A-Z]+(?=[A-Z][a-z0-9_\x7f-\xff])){1,}/,t),u=n.concat(/[A-Z]+/,t),r={scope:"variable",match:"\\$+"+i},a={scope:"meta",variants:[{begin:/<\?php/,relevance:10},{begin:/<\?=/},{begin:/<\?/,relevance:.1},{begin:/\?>/}]},o={scope:"subst",variants:[{begin:/\$\w+/},{begin:/\{\$/,end:/\}/}]},c=e.inherit(e.APOS_STRING_MODE,{illegal:null}),d=e.inherit(e.QUOTE_STRING_MODE,{illegal:null,contains:e.QUOTE_STRING_MODE.contains.concat(o)}),f={begin:/<<<[ \t]*(?:(\w+)|"(\w+)")\n/,end:/[ \t]*(\w+)\b/,contains:e.QUOTE_STRING_MODE.contains.concat(o),"on:begin":(K,G)=>{G.data._beginMatch=K[1]||K[2]},"on:end":(K,G)=>{G.data._beginMatch!==K[1]&&G.ignoreMatch()}},b=e.END_SAME_AS_BEGIN({begin:/<<<[ \t]*'(\w+)'\n/,end:/[ \t]*(\w+)\b/}),_=`[ 	
frontend/assets/vendor/highlight.min.js:5:]`,S={scope:"string",variants:[d,c,f,b]},h={scope:"number",variants:[{begin:"\\b0[bB][01]+(?:_[01]+)*\\b"},{begin:"\\b0[oO][0-7]+(?:_[0-7]+)*\\b"},{begin:"\\b0[xX][\\da-fA-F]+(?:_[\\da-fA-F]+)*\\b"},{begin:"(?:\\b\\d+(?:_\\d+)*(\\.(?:\\d+(?:_\\d+)*))?|\\B\\.\\d+)(?:[eE][+-]?\\d+)?"}],relevance:0},N=["false","null","true"],T=["__CLASS__","__DIR__","__FILE__","__FUNCTION__","__COMPILER_HALT_OFFSET__","__LINE__","__METHOD__","__NAMESPACE__","__TRAIT__","die","echo","exit","include","include_once","print","require","require_once","array","abstract","and","as","binary","bool","boolean","break","callable","case","catch","class","clone","const","continue","declare","default","do","double","else","elseif","empty","enddeclare","endfor","endforeach","endif","endswitch","endwhile","enum","eval","extends","final","finally","float","for","foreach","from","global","goto","if","implements","instanceof","insteadof","int","integer","interface","isset","iterable","list","match|0","mixed","new","never","object","or","private","protected","public","readonly","real","return","string","switch","throw","trait","try","unset","use","var","void","while","xor","yield"],R=["Error|0","AppendIterator","ArgumentCountError","ArithmeticError","ArrayIterator","ArrayObject","AssertionError","BadFunctionCallException","BadMethodCallException","CachingIterator","CallbackFilterIterator","CompileError","Countable","DirectoryIterator","DivisionByZeroError","DomainException","EmptyIterator","ErrorException","Exception","FilesystemIterator","FilterIterator","GlobIterator","InfiniteIterator","InvalidArgumentException","IteratorIterator","LengthException","LimitIterator","LogicException","MultipleIterator","NoRewindIterator","OutOfBoundsException","OutOfRangeException","OuterIterator","OverflowException","ParentIterator","ParseError","RangeException","RecursiveArrayIterator","RecursiveCachingIterator","RecursiveCallbackFilterIterator","RecursiveDirectoryIterator","RecursiveFilterIterator","RecursiveIterator","RecursiveIteratorIterator","RecursiveRegexIterator","RecursiveTreeIterator","RegexIterator","RuntimeException","SeekableIterator","SplDoublyLinkedList","SplFileInfo","SplFileObject","SplFixedArray","SplHeap","SplMaxHeap","SplMinHeap","SplObjectStorage","SplObserver","SplPriorityQueue","SplQueue","SplStack","SplSubject","SplTempFileObject","TypeError","UnderflowException","UnexpectedValueException","UnhandledMatchError","ArrayAccess","BackedEnum","Closure","Fiber","Generator","Iterator","IteratorAggregate","Serializable","Stringable","Throwable","Traversable","UnitEnum","WeakReference","WeakMap","Directory","__PHP_Incomplete_Class","parent","php_user_filter","self","static","stdClass"],M={keyword:T,literal:(K=>{let G=[];return K.forEach(l=>{G.push(l),l.toLowerCase()===l?G.push(l.toUpperCase()):G.push(l.toLowerCase())}),G})(N),built_in:R},C=K=>K.map(G=>G.replace(/\|\d+$/,"")),k={variants:[{match:[/new/,n.concat(_,"+"),n.concat("(?!",C(R).join("\\b|"),"\\b)"),s],scope:{1:"keyword",4:"title.class"}}]},H=n.concat(i,"\\b(?!\\()"),L={variants:[{match:[n.concat(/::/,n.lookahead(/(?!class\b)/)),H],scope:{2:"variable.constant"}},{match:[/::/,/class/],scope:{2:"variable.language"}},{match:[s,n.concat(/::/,n.lookahead(/(?!class\b)/)),H],scope:{1:"title.class",3:"variable.constant"}},{match:[s,n.concat("::",n.lookahead(/(?!class\b)/))],scope:{1:"title.class"}},{match:[s,/::/,/class/],scope:{1:"title.class",3:"variable.language"}}]},z={scope:"attr",match:n.concat(i,n.lookahead(":"),n.lookahead(/(?!::)/))},X={relevance:0,begin:/\(/,end:/\)/,keywords:M,contains:[z,r,L,e.C_BLOCK_COMMENT_MODE,S,h,k]},ne={relevance:0,match:[/\b/,n.concat("(?!fn\\b|function\\b|",C(T).join("\\b|"),"|",C(R).join("\\b|"),"\\b)"),i,n.concat(_,"*"),n.lookahead(/(?=\()/)],scope:{3:"title.function.invoke"},contains:[X]};X.contains.push(ne);let Q=[z,L,e.C_BLOCK_COMMENT_MODE,S,h,k],ee={begin:n.concat(/#\[\s*\\?/,n.either(s,u)),beginScope:"meta",end:/]/,endScope:"meta",keywords:{literal:N,keyword:["new","array"]},contains:[{begin:/\[/,end:/]/,keywords:{literal:N,keyword:["new","array"]},contains:["self",...Q]},...Q,{scope:"meta",variants:[{match:s},{match:u}]}]};return{case_insensitive:!1,keywords:M,contains:[ee,e.HASH_COMMENT_MODE,e.COMMENT("//","$"),e.COMMENT("/\\*","\\*/",{contains:[{scope:"doctag",match:"@[A-Za-z]+"}]}),{match:/__halt_compiler\(\);/,keywords:"__halt_compiler",starts:{scope:"comment",end:e.MATCH_NOTHING_RE,contains:[{match:/\?>/,scope:"meta",endsParent:!0}]}},a,{scope:"variable.language",match:/\$this\b/},r,ne,L,{match:[/const/,/\s/,i],scope:{1:"keyword",3:"variable.constant"}},k,{scope:"function",relevance:0,beginKeywords:"fn function",end:/[;{]/,excludeEnd:!0,illegal:"[$%\\[]",contains:[{beginKeywords:"use"},e.UNDERSCORE_TITLE_MODE,{begin:"=>",endsParent:!0},{scope:"params",begin:"\\(",end:"\\)",excludeBegin:!0,excludeEnd:!0,keywords:M,contains:["self",ee,r,L,e.C_BLOCK_COMMENT_MODE,S,h]}]},{scope:"class",variants:[{beginKeywords:"enum",illegal:/[($"]/},{beginKeywords:"class interface trait",illegal:/[:($"]/}],relevance:0,end:/\{/,excludeEnd:!0,contains:[{beginKeywords:"extends implements"},e.UNDERSCORE_TITLE_MODE]},{beginKeywords:"namespace",relevance:0,end:";",illegal:/[.']/,contains:[e.inherit(e.UNDERSCORE_TITLE_MODE,{scope:"title.class"})]},{beginKeywords:"use",relevance:0,end:";",contains:[{match:/\b(as|const|function)\b/,scope:"keyword"},e.UNDERSCORE_TITLE_MODE]},S,h]}}pt.exports=Ua});var ft=A((Fr,_t)=>{function Pa(e){return{name:"PHP template",subLanguage:"xml",contains:[{begin:/<\?(php|=)?/,end:/\?>/,subLanguage:"php",contains:[{begin:"/\\*",end:"\\*/",skip:!0},{begin:'b"',end:'"',skip:!0},{begin:"b'",end:"'",skip:!0},e.inherit(e.APOS_STRING_MODE,{illegal:null,className:null,contains:null,skip:!0}),e.inherit(e.QUOTE_STRING_MODE,{illegal:null,className:null,contains:null,skip:!0})]}]}}_t.exports=Pa});var ht=A((zr,Et)=>{function Fa(e){return{name:"Plain text",aliases:["text","txt"],disableAutodetect:!0}}Et.exports=Fa});var yt=A(($r,Nt)=>{function za(e){let n=e.regex,t=/[\p{XID_Start}_]\p{XID_Continue}*/u,i=["and","as","assert","async","await","break","case","class","continue","def","del","elif","else","except","finally","for","from","global","if","import","in","is","lambda","match","nonlocal|10","not","or","pass","raise","return","try","while","with","yield"],a={$pattern:/[A-Za-z]\w+|__\w+__/,keyword:i,built_in:["__import__","abs","all","any","ascii","bin","bool","breakpoint","bytearray","bytes","callable","chr","classmethod","compile","complex","delattr","dict","dir","divmod","enumerate","eval","exec","filter","float","format","frozenset","getattr","globals","hasattr","hash","help","hex","id","input","int","isinstance","issubclass","iter","len","list","locals","map","max","memoryview","min","next","object","oct","open","ord","pow","print","property","range","repr","reversed","round","set","setattr","slice","sorted","staticmethod","str","sum","super","tuple","type","vars","zip"],literal:["__debug__","Ellipsis","False","None","NotImplemented","True"],type:["Any","Callable","Coroutine","Dict","List","Literal","Generic","Optional","Sequence","Set","Tuple","Type","Union"]},o={className:"meta",begin:/^(>>>|\.\.\.) /},c={className:"subst",begin:/\{/,end:/\}/,keywords:a,illegal:/#/},d={begin:/\{\{/,relevance:0},f={className:"string",contains:[e.BACKSLASH_ESCAPE],variants:[{begin:/([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?'''/,end:/'''/,contains:[e.BACKSLASH_ESCAPE,o],relevance:10},{begin:/([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?"""/,end:/"""/,contains:[e.BACKSLASH_ESCAPE,o],relevance:10},{begin:/([fF][rR]|[rR][fF]|[fF])'''/,end:/'''/,contains:[e.BACKSLASH_ESCAPE,o,d,c]},{begin:/([fF][rR]|[rR][fF]|[fF])"""/,end:/"""/,contains:[e.BACKSLASH_ESCAPE,o,d,c]},{begin:/([uU]|[rR])'/,end:/'/,relevance:10},{begin:/([uU]|[rR])"/,end:/"/,relevance:10},{begin:/([bB]|[bB][rR]|[rR][bB])'/,end:/'/},{begin:/([bB]|[bB][rR]|[rR][bB])"/,end:/"/},{begin:/([fF][rR]|[rR][fF]|[fF])'/,end:/'/,contains:[e.BACKSLASH_ESCAPE,d,c]},{begin:/([fF][rR]|[rR][fF]|[fF])"/,end:/"/,contains:[e.BACKSLASH_ESCAPE,d,c]},e.APOS_STRING_MODE,e.QUOTE_STRING_MODE]},b="[0-9](_?[0-9])*",_=`(\\b(${b}))?\\.(${b})|\\b(${b})\\.`,S=`\\b|${i.join("|")}`,h={className:"number",relevance:0,variants:[{begin:`(\\b(${b})|(${_}))[eE][+-]?(${b})[jJ]?(?=${S})`},{begin:`(${_})[jJ]?`},{begin:`\\b([1-9](_?[0-9])*|0+(_?0)*)[lLjJ]?(?=${S})`},{begin:`\\b0[bB](_?[01])+[lL]?(?=${S})`},{begin:`\\b0[oO](_?[0-7])+[lL]?(?=${S})`},{begin:`\\b0[xX](_?[0-9a-fA-F])+[lL]?(?=${S})`},{begin:`\\b(${b})[jJ](?=${S})`}]},N={className:"comment",begin:n.lookahead(/# type:/),end:/$/,keywords:a,contains:[{begin:/# type:/},{begin:/#/,end:/\b\B/,endsWithParent:!0}]},T={className:"params",variants:[{className:"",begin:/\(\s*\)/,skip:!0},{begin:/\(/,end:/\)/,excludeBegin:!0,excludeEnd:!0,keywords:a,contains:["self",o,h,f,e.HASH_COMMENT_MODE]}]};return c.contains=[f,h,o],{name:"Python",aliases:["py","gyp","ipython"],unicodeRegex:!0,keywords:a,illegal:/(<\/|\?)|=>/,contains:[o,h,{scope:"variable.language",match:/\bself\b/},{beginKeywords:"if",relevance:0},{match:/\bor\b/,scope:"keyword"},f,N,e.HASH_COMMENT_MODE,{match:[/\bdef/,/\s+/,t],scope:{1:"keyword",3:"title.function"},contains:[T]},{variants:[{match:[/\bclass/,/\s+/,t,/\s*/,/\(\s*/,t,/\s*\)/]},{match:[/\bclass/,/\s+/,t]}],scope:{1:"keyword",3:"title.class",6:"title.class.inherited"}},{className:"meta",begin:/^[\t ]*@/,end:/(?=#)|$/,contains:[h,T,f]}]}}Nt.exports=za});var St=A((Kr,Tt)=>{function $a(e){return{aliases:["pycon"],contains:[{className:"meta.prompt",starts:{end:/ |$/,starts:{end:"$",subLanguage:"python"}},variants:[{begin:/^>>>(?=[ ]|$)/},{begin:/^\.\.\.(?=[ ]|$)/}]}]}}Tt.exports=$a});var vt=A((Gr,wt)=>{function Ka(e){let n=e.regex,t=/(?:(?:[a-zA-Z]|\.[._a-zA-Z])[._a-zA-Z0-9]*)|\.(?!\d)/,i=n.either(/0[xX][0-9a-fA-F]+\.[0-9a-fA-F]*[pP][+-]?\d+i?/,/0[xX][0-9a-fA-F]+(?:[pP][+-]?\d+)?[Li]?/,/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[Li]?/),s=/[=!<>:]=|\|\||&&|:::?|<-|<<-|->>|->|\|>|[-+*\/?!$&|:<=>@^~]|\*\*/,u=n.either(/[()]/,/[{}]/,/\[\[/,/[[\]]/,/\\/,/,/);return{name:"R",keywords:{$pattern:t,keyword:"function if in break next repeat else for while",literal:"NULL NA TRUE FALSE Inf NaN NA_integer_|10 NA_real_|10 NA_character_|10 NA_complex_|10",built_in:"LETTERS letters month.abb month.name pi T F abs acos acosh all any anyNA Arg as.call as.character as.complex as.double as.environment as.integer as.logical as.null.default as.numeric as.raw asin asinh atan atanh attr attributes baseenv browser c call ceiling class Conj cos cosh cospi cummax cummin cumprod cumsum digamma dim dimnames emptyenv exp expression floor forceAndCall gamma gc.time globalenv Im interactive invisible is.array is.atomic is.call is.character is.complex is.double is.environment is.expression is.finite is.function is.infinite is.integer is.language is.list is.logical is.matrix is.na is.name is.nan is.null is.numeric is.object is.pairlist is.raw is.recursive is.single is.symbol lazyLoadDBfetch length lgamma list log max min missing Mod names nargs nzchar oldClass on.exit pos.to.env proc.time prod quote range Re rep retracemem return round seq_along seq_len seq.int sign signif sin sinh sinpi sqrt standardGeneric substitute sum switch tan tanh tanpi tracemem trigamma trunc unclass untracemem UseMethod xtfrm"},contains:[e.COMMENT(/#'/,/$/,{contains:[{scope:"doctag",match:/@examples/,starts:{end:n.lookahead(n.either(/\n^#'\s*(?=@[a-zA-Z]+)/,/\n^(?!#')/)),endsParent:!0}},{scope:"doctag",begin:"@param",end:/$/,contains:[{scope:"variable",variants:[{match:t},{match:/`(?:\\.|[^`\\])+`/}],endsParent:!0}]},{scope:"doctag",match:/@[a-zA-Z]+/},{scope:"keyword",match:/\\[a-zA-Z]+/}]}),e.HASH_COMMENT_MODE,{scope:"string",contains:[e.BACKSLASH_ESCAPE],variants:[e.END_SAME_AS_BEGIN({begin:/[rR]"(-*)\(/,end:/\)(-*)"/}),e.END_SAME_AS_BEGIN({begin:/[rR]"(-*)\{/,end:/\}(-*)"/}),e.END_SAME_AS_BEGIN({begin:/[rR]"(-*)\[/,end:/\](-*)"/}),e.END_SAME_AS_BEGIN({begin:/[rR]'(-*)\(/,end:/\)(-*)'/}),e.END_SAME_AS_BEGIN({begin:/[rR]'(-*)\{/,end:/\}(-*)'/}),e.END_SAME_AS_BEGIN({begin:/[rR]'(-*)\[/,end:/\](-*)'/}),{begin:'"',end:'"',relevance:0},{begin:"'",end:"'",relevance:0}]},{relevance:0,variants:[{scope:{1:"operator",2:"number"},match:[s,i]},{scope:{1:"operator",2:"number"},match:[/%[^%]*%/,i]},{scope:{1:"punctuation",2:"number"},match:[u,i]},{scope:{2:"number"},match:[/[^a-zA-Z0-9._]|^/,i]}]},{scope:{3:"operator"},match:[t,/\s+/,/<-/,/\s+/]},{scope:"operator",relevance:0,variants:[{match:s},{match:/%[^%]*%/}]},{scope:"punctuation",relevance:0,match:u},{begin:"`",end:"`",contains:[{begin:/\\./}]}]}}wt.exports=Ka});var At=A((Hr,Ot)=>{function Ga(e){let n=e.regex,t=/(r#)?/,i=n.concat(t,e.UNDERSCORE_IDENT_RE),s=n.concat(t,e.IDENT_RE),u={className:"title.function.invoke",relevance:0,begin:n.concat(/\b/,/(?!let|for|while|if|else|match\b)/,s,n.lookahead(/\s*\(/))},r="([ui](8|16|32|64|128|size)|f(32|64))?",a=["abstract","as","async","await","become","box","break","const","continue","crate","do","dyn","else","enum","extern","false","final","fn","for","if","impl","in","let","loop","macro","match","mod","move","mut","override","priv","pub","ref","return","self","Self","static","struct","super","trait","true","try","type","typeof","union","unsafe","unsized","use","virtual","where","while","yield"],o=["true","false","Some","None","Ok","Err"],c=["drop ","Copy","Send","Sized","Sync","Drop","Fn","FnMut","FnOnce","ToOwned","Clone","Debug","PartialEq","PartialOrd","Eq","Ord","AsRef","AsMut","Into","From","Default","Iterator","Extend","IntoIterator","DoubleEndedIterator","ExactSizeIterator","SliceConcatExt","ToString","assert!","assert_eq!","bitflags!","bytes!","cfg!","col!","concat!","concat_idents!","debug_assert!","debug_assert_eq!","env!","eprintln!","panic!","file!","format!","format_args!","include_bytes!","include_str!","line!","local_data_key!","module_path!","option_env!","print!","println!","select!","stringify!","try!","unimplemented!","unreachable!","vec!","write!","writeln!","macro_rules!","assert_ne!","debug_assert_ne!"],d=["i8","i16","i32","i64","i128","isize","u8","u16","u32","u64","u128","usize","f32","f64","str","char","bool","Box","Option","Result","String","Vec"];return{name:"Rust",aliases:["rs"],keywords:{$pattern:e.IDENT_RE+"!?",type:d,keyword:a,literal:o,built_in:c},illegal:"</",contains:[e.C_LINE_COMMENT_MODE,e.COMMENT("/\\*","\\*/",{contains:["self"]}),e.inherit(e.QUOTE_STRING_MODE,{begin:/b?"/,illegal:null}),{className:"symbol",begin:/'[a-zA-Z_][a-zA-Z0-9_]*(?!')/},{scope:"string",variants:[{begin:/b?r(#*)"(.|\n)*?"\1(?!#)/},{begin:/b?'/,end:/'/,contains:[{scope:"char.escape",match:/\\('|\w|x\w{2}|u\w{4}|U\w{8})/}]}]},{className:"number",variants:[{begin:"\\b0b([01_]+)"+r},{begin:"\\b0o([0-7_]+)"+r},{begin:"\\b0x([A-Fa-f0-9_]+)"+r},{begin:"\\b(\\d[\\d_]*(\\.[0-9_]+)?([eE][+-]?[0-9_]+)?)"+r}],relevance:0},{begin:[/fn/,/\s+/,i],className:{1:"keyword",3:"title.function"}},{className:"meta",begin:"#!?\\[",end:"\\]",contains:[{className:"string",begin:/"/,end:/"/,contains:[e.BACKSLASH_ESCAPE]}]},{begin:[/let/,/\s+/,/(?:mut\s+)?/,i],className:{1:"keyword",3:"keyword",4:"variable"}},{begin:[/for/,/\s+/,i,/\s+/,/in/],className:{1:"keyword",3:"variable",5:"keyword"}},{begin:[/type/,/\s+/,i],className:{1:"keyword",3:"title.class"}},{begin:[/(?:trait|enum|struct|union|impl|for)/,/\s+/,i],className:{1:"keyword",3:"title.class"}},{begin:e.IDENT_RE+"::",keywords:{keyword:"Self",built_in:c,type:d}},{className:"punctuation",begin:"->"},u]}}Ot.exports=Ga});var Mt=A((qr,Rt)=>{var Ha=e=>({IMPORTANT:{scope:"meta",begin:"!important"},BLOCK_COMMENT:e.C_BLOCK_COMMENT_MODE,HEXCOLOR:{scope:"number",begin:/#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/},FUNCTION_DISPATCH:{className:"built_in",begin:/[\w-]+(?=\()/},ATTRIBUTE_SELECTOR_MODE:{scope:"selector-attr",begin:/\[/,end:/\]/,illegal:"$",contains:[e.APOS_STRING_MODE,e.QUOTE_STRING_MODE]},CSS_NUMBER_MODE:{scope:"number",begin:e.NUMBER_RE+"(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",relevance:0},CSS_VARIABLE:{className:"attr",begin:/--[A-Za-z_][A-Za-z0-9_-]*/}}),qa=["a","abbr","address","article","aside","audio","b","blockquote","body","button","canvas","caption","cite","code","dd","del","details","dfn","div","dl","dt","em","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hgroup","html","i","iframe","img","input","ins","kbd","label","legend","li","main","mark","menu","nav","object","ol","optgroup","option","p","picture","q","quote","samp","section","select","source","span","strong","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","tr","ul","var","video"],Wa=["defs","g","marker","mask","pattern","svg","switch","symbol","feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feFlood","feGaussianBlur","feImage","feMerge","feMorphology","feOffset","feSpecularLighting","feTile","feTurbulence","linearGradient","radialGradient","stop","circle","ellipse","image","line","path","polygon","polyline","rect","text","use","textPath","tspan","foreignObject","clipPath"],Ya=[...qa,...Wa],Za=["any-hover","any-pointer","aspect-ratio","color","color-gamut","color-index","device-aspect-ratio","device-height","device-width","display-mode","forced-colors","grid","height","hover","inverted-colors","monochrome","orientation","overflow-block","overflow-inline","pointer","prefers-color-scheme","prefers-contrast","prefers-reduced-motion","prefers-reduced-transparency","resolution","scan","scripting","update","width","min-width","max-width","min-height","max-height"].sort().reverse(),Xa=["active","any-link","blank","checked","current","default","defined","dir","disabled","drop","empty","enabled","first","first-child","first-of-type","fullscreen","future","focus","focus-visible","focus-within","has","host","host-context","hover","indeterminate","in-range","invalid","is","lang","last-child","last-of-type","left","link","local-link","not","nth-child","nth-col","nth-last-child","nth-last-col","nth-last-of-type","nth-of-type","only-child","only-of-type","optional","out-of-range","past","placeholder-shown","read-only","read-write","required","right","root","scope","target","target-within","user-invalid","valid","visited","where"].sort().reverse(),Va=["after","backdrop","before","cue","cue-region","first-letter","first-line","grammar-error","marker","part","placeholder","selection","slotted","spelling-error"].sort().reverse(),Qa=["accent-color","align-content","align-items","align-self","alignment-baseline","all","anchor-name","animation","animation-composition","animation-delay","animation-direction","animation-duration","animation-fill-mode","animation-iteration-count","animation-name","animation-play-state","animation-range","animation-range-end","animation-range-start","animation-timeline","animation-timing-function","appearance","aspect-ratio","backdrop-filter","backface-visibility","background","background-attachment","background-blend-mode","background-clip","background-color","background-image","background-origin","background-position","background-position-x","background-position-y","background-repeat","background-size","baseline-shift","block-size","border","border-block","border-block-color","border-block-end","border-block-end-color","border-block-end-style","border-block-end-width","border-block-start","border-block-start-color","border-block-start-style","border-block-start-width","border-block-style","border-block-width","border-bottom","border-bottom-color","border-bottom-left-radius","border-bottom-right-radius","border-bottom-style","border-bottom-width","border-collapse","border-color","border-end-end-radius","border-end-start-radius","border-image","border-image-outset","border-image-repeat","border-image-slice","border-image-source","border-image-width","border-inline","border-inline-color","border-inline-end","border-inline-end-color","border-inline-end-style","border-inline-end-width","border-inline-start","border-inline-start-color","border-inline-start-style","border-inline-start-width","border-inline-style","border-inline-width","border-left","border-left-color","border-left-style","border-left-width","border-radius","border-right","border-right-color","border-right-style","border-right-width","border-spacing","border-start-end-radius","border-start-start-radius","border-style","border-top","border-top-color","border-top-left-radius","border-top-right-radius","border-top-style","border-top-width","border-width","bottom","box-align","box-decoration-break","box-direction","box-flex","box-flex-group","box-lines","box-ordinal-group","box-orient","box-pack","box-shadow","box-sizing","break-after","break-before","break-inside","caption-side","caret-color","clear","clip","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","color-scheme","column-count","column-fill","column-gap","column-rule","column-rule-color","column-rule-style","column-rule-width","column-span","column-width","columns","contain","contain-intrinsic-block-size","contain-intrinsic-height","contain-intrinsic-inline-size","contain-intrinsic-size","contain-intrinsic-width","container","container-name","container-type","content","content-visibility","counter-increment","counter-reset","counter-set","cue","cue-after","cue-before","cursor","cx","cy","direction","display","dominant-baseline","empty-cells","enable-background","field-sizing","fill","fill-opacity","fill-rule","filter","flex","flex-basis","flex-direction","flex-flow","flex-grow","flex-shrink","flex-wrap","float","flood-color","flood-opacity","flow","font","font-display","font-family","font-feature-settings","font-kerning","font-language-override","font-optical-sizing","font-palette","font-size","font-size-adjust","font-smooth","font-smoothing","font-stretch","font-style","font-synthesis","font-synthesis-position","font-synthesis-small-caps","font-synthesis-style","font-synthesis-weight","font-variant","font-variant-alternates","font-variant-caps","font-variant-east-asian","font-variant-emoji","font-variant-ligatures","font-variant-numeric","font-variant-position","font-variation-settings","font-weight","forced-color-adjust","gap","glyph-orientation-horizontal","glyph-orientation-vertical","grid","grid-area","grid-auto-columns","grid-auto-flow","grid-auto-rows","grid-column","grid-column-end","grid-column-start","grid-gap","grid-row","grid-row-end","grid-row-start","grid-template","grid-template-areas","grid-template-columns","grid-template-rows","hanging-punctuation","height","hyphenate-character","hyphenate-limit-chars","hyphens","icon","image-orientation","image-rendering","image-resolution","ime-mode","initial-letter","initial-letter-align","inline-size","inset","inset-area","inset-block","inset-block-end","inset-block-start","inset-inline","inset-inline-end","inset-inline-start","isolation","justify-content","justify-items","justify-self","kerning","left","letter-spacing","lighting-color","line-break","line-height","line-height-step","list-style","list-style-image","list-style-position","list-style-type","margin","margin-block","margin-block-end","margin-block-start","margin-bottom","margin-inline","margin-inline-end","margin-inline-start","margin-left","margin-right","margin-top","margin-trim","marker","marker-end","marker-mid","marker-start","marks","mask","mask-border","mask-border-mode","mask-border-outset","mask-border-repeat","mask-border-slice","mask-border-source","mask-border-width","mask-clip","mask-composite","mask-image","mask-mode","mask-origin","mask-position","mask-repeat","mask-size","mask-type","masonry-auto-flow","math-depth","math-shift","math-style","max-block-size","max-height","max-inline-size","max-width","min-block-size","min-height","min-inline-size","min-width","mix-blend-mode","nav-down","nav-index","nav-left","nav-right","nav-up","none","normal","object-fit","object-position","offset","offset-anchor","offset-distance","offset-path","offset-position","offset-rotate","opacity","order","orphans","outline","outline-color","outline-offset","outline-style","outline-width","overflow","overflow-anchor","overflow-block","overflow-clip-margin","overflow-inline","overflow-wrap","overflow-x","overflow-y","overlay","overscroll-behavior","overscroll-behavior-block","overscroll-behavior-inline","overscroll-behavior-x","overscroll-behavior-y","padding","padding-block","padding-block-end","padding-block-start","padding-bottom","padding-inline","padding-inline-end","padding-inline-start","padding-left","padding-right","padding-top","page","page-break-after","page-break-before","page-break-inside","paint-order","pause","pause-after","pause-before","perspective","perspective-origin","place-content","place-items","place-self","pointer-events","position","position-anchor","position-visibility","print-color-adjust","quotes","r","resize","rest","rest-after","rest-before","right","rotate","row-gap","ruby-align","ruby-position","scale","scroll-behavior","scroll-margin","scroll-margin-block","scroll-margin-block-end","scroll-margin-block-start","scroll-margin-bottom","scroll-margin-inline","scroll-margin-inline-end","scroll-margin-inline-start","scroll-margin-left","scroll-margin-right","scroll-margin-top","scroll-padding","scroll-padding-block","scroll-padding-block-end","scroll-padding-block-start","scroll-padding-bottom","scroll-padding-inline","scroll-padding-inline-end","scroll-padding-inline-start","scroll-padding-left","scroll-padding-right","scroll-padding-top","scroll-snap-align","scroll-snap-stop","scroll-snap-type","scroll-timeline","scroll-timeline-axis","scroll-timeline-name","scrollbar-color","scrollbar-gutter","scrollbar-width","shape-image-threshold","shape-margin","shape-outside","shape-rendering","speak","speak-as","src","stop-color","stop-opacity","stroke","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke-width","tab-size","table-layout","text-align","text-align-all","text-align-last","text-anchor","text-combine-upright","text-decoration","text-decoration-color","text-decoration-line","text-decoration-skip","text-decoration-skip-ink","text-decoration-style","text-decoration-thickness","text-emphasis","text-emphasis-color","text-emphasis-position","text-emphasis-style","text-indent","text-justify","text-orientation","text-overflow","text-rendering","text-shadow","text-size-adjust","text-transform","text-underline-offset","text-underline-position","text-wrap","text-wrap-mode","text-wrap-style","timeline-scope","top","touch-action","transform","transform-box","transform-origin","transform-style","transition","transition-behavior","transition-delay","transition-duration","transition-property","transition-timing-function","translate","unicode-bidi","user-modify","user-select","vector-effect","vertical-align","view-timeline","view-timeline-axis","view-timeline-inset","view-timeline-name","view-transition-name","visibility","voice-balance","voice-duration","voice-family","voice-pitch","voice-range","voice-rate","voice-stress","voice-volume","white-space","white-space-collapse","widows","width","will-change","word-break","word-spacing","word-wrap","writing-mode","x","y","z-index","zoom"].sort().reverse();function Ja(e){let n=Ha(e),t=Va,i=Xa,s="@[a-z-]+",u="and or not only",a={className:"variable",begin:"(\\$"+"[a-zA-Z-][a-zA-Z0-9_-]*"+")\\b",relevance:0};return{name:"SCSS",case_insensitive:!0,illegal:"[=/|']",contains:[e.C_LINE_COMMENT_MODE,e.C_BLOCK_COMMENT_MODE,n.CSS_NUMBER_MODE,{className:"selector-id",begin:"#[A-Za-z0-9_-]+",relevance:0},{className:"selector-class",begin:"\\.[A-Za-z0-9_-]+",relevance:0},n.ATTRIBUTE_SELECTOR_MODE,{className:"selector-tag",begin:"\\b("+Ya.join("|")+")\\b",relevance:0},{className:"selector-pseudo",begin:":("+i.join("|")+")"},{className:"selector-pseudo",begin:":(:)?("+t.join("|")+")"},a,{begin:/\(/,end:/\)/,contains:[n.CSS_NUMBER_MODE]},n.CSS_VARIABLE,{className:"attribute",begin:"\\b("+Qa.join("|")+")\\b"},{begin:"\\b(whitespace|wait|w-resize|visible|vertical-text|vertical-ideographic|uppercase|upper-roman|upper-alpha|underline|transparent|top|thin|thick|text|text-top|text-bottom|tb-rl|table-header-group|table-footer-group|sw-resize|super|strict|static|square|solid|small-caps|separate|se-resize|scroll|s-resize|rtl|row-resize|ridge|right|repeat|repeat-y|repeat-x|relative|progress|pointer|overline|outside|outset|oblique|nowrap|not-allowed|normal|none|nw-resize|no-repeat|no-drop|newspaper|ne-resize|n-resize|move|middle|medium|ltr|lr-tb|lowercase|lower-roman|lower-alpha|loose|list-item|line|line-through|line-edge|lighter|left|keep-all|justify|italic|inter-word|inter-ideograph|inside|inset|inline|inline-block|inherit|inactive|ideograph-space|ideograph-parenthesis|ideograph-numeric|ideograph-alpha|horizontal|hidden|help|hand|groove|fixed|ellipsis|e-resize|double|dotted|distribute|distribute-space|distribute-letter|distribute-all-lines|disc|disabled|default|decimal|dashed|crosshair|collapse|col-resize|circle|char|center|capitalize|break-word|break-all|bottom|both|bolder|bold|block|bidi-override|below|baseline|auto|always|all-scroll|absolute|table|table-cell)\\b"},{begin:/:/,end:/[;}{]/,relevance:0,contains:[n.BLOCK_COMMENT,a,n.HEXCOLOR,n.CSS_NUMBER_MODE,e.QUOTE_STRING_MODE,e.APOS_STRING_MODE,n.IMPORTANT,n.FUNCTION_DISPATCH]},{begin:"@(page|font-face)",keywords:{$pattern:s,keyword:"@page @font-face"}},{begin:"@",end:"[{;]",returnBegin:!0,keywords:{$pattern:/[a-z-]+/,keyword:u,attribute:Za.join(" ")},contains:[{begin:s,className:"keyword"},{begin:/[a-z-]+(?=:)/,className:"attribute"},a,e.QUOTE_STRING_MODE,e.APOS_STRING_MODE,n.HEXCOLOR,n.CSS_NUMBER_MODE]},n.FUNCTION_DISPATCH]}}Rt.exports=Ja});var xt=A((Wr,kt)=>{function ja(e){return{name:"Shell Session",aliases:["console","shellsession"],contains:[{className:"meta.prompt",begin:/^\s{0,3}[/~\w\d[\]()@-]*[>%$#][ ]?/,starts:{end:/[^\\](?=\s*$)/,subLanguage:"bash"}}]}}kt.exports=ja});var Ct=A((Yr,It)=>{function er(e){let n=e.regex,t=e.COMMENT("--","$"),i={scope:"string",variants:[{begin:/'/,end:/'/,contains:[{match:/''/}]}]},s={begin:/"/,end:/"/,contains:[{match:/""/}]},u=["true","false","unknown"],r=["double precision","large object","with timezone","without timezone"],a=["bigint","binary","blob","boolean","char","character","clob","date","dec","decfloat","decimal","float","int","integer","interval","nchar","nclob","national","numeric","real","row","smallint","time","timestamp","varchar","varying","varbinary"],o=["add","asc","collation","desc","final","first","last","view"],c=["abs","acos","all","allocate","alter","and","any","are","array","array_agg","array_max_cardinality","as","asensitive","asin","asymmetric","at","atan","atomic","authorization","avg","begin","begin_frame","begin_partition","between","bigint","binary","blob","boolean","both","by","call","called","cardinality","cascaded","case","cast","ceil","ceiling","char","char_length","character","character_length","check","classifier","clob","close","coalesce","collate","collect","column","commit","condition","connect","constraint","contains","convert","copy","corr","corresponding","cos","cosh","count","covar_pop","covar_samp","create","cross","cube","cume_dist","current","current_catalog","current_date","current_default_transform_group","current_path","current_role","current_row","current_schema","current_time","current_timestamp","current_path","current_role","current_transform_group_for_type","current_user","cursor","cycle","date","day","deallocate","dec","decimal","decfloat","declare","default","define","delete","dense_rank","deref","describe","deterministic","disconnect","distinct","double","drop","dynamic","each","element","else","empty","end","end_frame","end_partition","end-exec","equals","escape","every","except","exec","execute","exists","exp","external","extract","false","fetch","filter","first_value","float","floor","for","foreign","frame_row","free","from","full","function","fusion","get","global","grant","group","grouping","groups","having","hold","hour","identity","in","indicator","initial","inner","inout","insensitive","insert","int","integer","intersect","intersection","interval","into","is","join","json_array","json_arrayagg","json_exists","json_object","json_objectagg","json_query","json_table","json_table_primitive","json_value","lag","language","large","last_value","lateral","lead","leading","left","like","like_regex","listagg","ln","local","localtime","localtimestamp","log","log10","lower","match","match_number","match_recognize","matches","max","member","merge","method","min","minute","mod","modifies","module","month","multiset","national","natural","nchar","nclob","new","no","none","normalize","not","nth_value","ntile","null","nullif","numeric","octet_length","occurrences_regex","of","offset","old","omit","on","one","only","open","or","order","out","outer","over","overlaps","overlay","parameter","partition","pattern","per","percent","percent_rank","percentile_cont","percentile_disc","period","portion","position","position_regex","power","precedes","precision","prepare","primary","procedure","ptf","range","rank","reads","real","recursive","ref","references","referencing","regr_avgx","regr_avgy","regr_count","regr_intercept","regr_r2","regr_slope","regr_sxx","regr_sxy","regr_syy","release","result","return","returns","revoke","right","rollback","rollup","row","row_number","rows","running","savepoint","scope","scroll","search","second","seek","select","sensitive","session_user","set","show","similar","sin","sinh","skip","smallint","some","specific","specifictype","sql","sqlexception","sqlstate","sqlwarning","sqrt","start","static","stddev_pop","stddev_samp","submultiset","subset","substring","substring_regex","succeeds","sum","symmetric","system","system_time","system_user","table","tablesample","tan","tanh","then","time","timestamp","timezone_hour","timezone_minute","to","trailing","translate","translate_regex","translation","treat","trigger","trim","trim_array","true","truncate","uescape","union","unique","unknown","unnest","update","upper","user","using","value","values","value_of","var_pop","var_samp","varbinary","varchar","varying","versioning","when","whenever","where","width_bucket","window","with","within","without","year"],d=["abs","acos","array_agg","asin","atan","avg","cast","ceil","ceiling","coalesce","corr","cos","cosh","count","covar_pop","covar_samp","cume_dist","dense_rank","deref","element","exp","extract","first_value","floor","json_array","json_arrayagg","json_exists","json_object","json_objectagg","json_query","json_table","json_table_primitive","json_value","lag","last_value","lead","listagg","ln","log","log10","lower","max","min","mod","nth_value","ntile","nullif","percent_rank","percentile_cont","percentile_disc","position","position_regex","power","rank","regr_avgx","regr_avgy","regr_count","regr_intercept","regr_r2","regr_slope","regr_sxx","regr_sxy","regr_syy","row_number","sin","sinh","sqrt","stddev_pop","stddev_samp","substring","substring_regex","sum","tan","tanh","translate","translate_regex","treat","trim","trim_array","unnest","upper","value_of","var_pop","var_samp","width_bucket"],f=["current_catalog","current_date","current_default_transform_group","current_path","current_role","current_schema","current_transform_group_for_type","current_user","session_user","system_time","system_user","current_time","localtime","current_timestamp","localtimestamp"],b=["create table","insert into","primary key","foreign key","not null","alter table","add constraint","grouping sets","on overflow","character set","respect nulls","ignore nulls","nulls first","nulls last","depth first","breadth first"],_=d,S=[...c,...o].filter(C=>!d.includes(C)),h={scope:"variable",match:/@[a-z0-9][a-z0-9_]*/},N={scope:"operator",match:/[-+*/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?/,relevance:0},T={match:n.concat(/\b/,n.either(..._),/\s*\(/),relevance:0,keywords:{built_in:_}};function R(C){return n.concat(/\b/,n.either(...C.map(k=>k.replace(/\s+/,"\\s+"))),/\b/)}let I={scope:"keyword",match:R(b),relevance:0};function M(C,{exceptions:k,when:H}={}){let L=H;return k=k||[],C.map(z=>z.match(/\|\d+$/)||k.includes(z)?z:L(z)?`${z}|0`:z)}return{name:"SQL",case_insensitive:!0,illegal:/[{}]|<\//,keywords:{$pattern:/\b[\w\.]+/,keyword:M(S,{when:C=>C.length<3}),literal:u,type:a,built_in:f},contains:[{scope:"type",match:R(r)},I,T,h,i,s,e.C_NUMBER_MODE,e.C_BLOCK_COMMENT_MODE,t,N]}}It.exports=er});var Kt=A((Zr,$t)=>{function Ut(e){return e?typeof e=="string"?e:e.source:null}function Ee(e){return U("(?=",e,")")}function U(...e){return e.map(t=>Ut(t)).join("")}function nr(e){let n=e[e.length-1];return typeof n=="object"&&n.constructor===Object?(e.splice(e.length-1,1),n):{}}function Z(...e){return"("+(nr(e).capture?"":"?:")+e.map(i=>Ut(i)).join("|")+")"}var Ve=e=>U(/\b/,e,/\w$/.test(e)?/\b/:/\B/),tr=["Protocol","Type"].map(Ve),Lt=["init","self"].map(Ve),ir=["Any","Self"],Ze=["actor","any","associatedtype","async","await",/as\?/,/as!/,"as","borrowing","break","case","catch","class","consume","consuming","continue","convenience","copy","default","defer","deinit","didSet","distributed","do","dynamic","each","else","enum","extension","fallthrough",/fileprivate\(set\)/,"fileprivate","final","for","func","get","guard","if","import","indirect","infix",/init\?/,/init!/,"inout",/internal\(set\)/,"internal","in","is","isolated","nonisolated","lazy","let","macro","mutating","nonmutating",/open\(set\)/,"open","operator","optional","override","package","postfix","precedencegroup","prefix",/private\(set\)/,"private","protocol",/public\(set\)/,"public","repeat","required","rethrows","return","set","some","static","struct","subscript","super","switch","throws","throw",/try\?/,/try!/,"try","typealias",/unowned\(safe\)/,/unowned\(unsafe\)/,"unowned","var","weak","where","while","willSet"],Dt=["false","nil","true"],ar=["assignment","associativity","higherThan","left","lowerThan","none","right"],rr=["#colorLiteral","#column","#dsohandle","#else","#elseif","#endif","#error","#file","#fileID","#fileLiteral","#filePath","#function","#if","#imageLiteral","#keyPath","#line","#selector","#sourceLocation","#warning"],Bt=["abs","all","any","assert","assertionFailure","debugPrint","dump","fatalError","getVaList","isKnownUniquelyReferenced","max","min","numericCast","pointwiseMax","pointwiseMin","precondition","preconditionFailure","print","readLine","repeatElement","sequence","stride","swap","swift_unboxFromSwiftValueWithType","transcode","type","unsafeBitCast","unsafeDowncast","withExtendedLifetime","withUnsafeMutablePointer","withUnsafePointer","withVaList","withoutActuallyEscaping","zip"],Pt=Z(/[/=\-+!*%<>&|^~?]/,/[\u00A1-\u00A7]/,/[\u00A9\u00AB]/,/[\u00AC\u00AE]/,/[\u00B0\u00B1]/,/[\u00B6\u00BB\u00BF\u00D7\u00F7]/,/[\u2016-\u2017]/,/[\u2020-\u2027]/,/[\u2030-\u203E]/,/[\u2041-\u2053]/,/[\u2055-\u205E]/,/[\u2190-\u23FF]/,/[\u2500-\u2775]/,/[\u2794-\u2BFF]/,/[\u2E00-\u2E7F]/,/[\u3001-\u3003]/,/[\u3008-\u3020]/,/[\u3030]/),Ft=Z(Pt,/[\u0300-\u036F]/,/[\u1DC0-\u1DFF]/,/[\u20D0-\u20FF]/,/[\uFE00-\uFE0F]/,/[\uFE20-\uFE2F]/),Xe=U(Pt,Ft,"*"),zt=Z(/[a-zA-Z_]/,/[\u00A8\u00AA\u00AD\u00AF\u00B2-\u00B5\u00B7-\u00BA]/,/[\u00BC-\u00BE\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/,/[\u0100-\u02FF\u0370-\u167F\u1681-\u180D\u180F-\u1DBF]/,/[\u1E00-\u1FFF]/,/[\u200B-\u200D\u202A-\u202E\u203F-\u2040\u2054\u2060-\u206F]/,/[\u2070-\u20CF\u2100-\u218F\u2460-\u24FF\u2776-\u2793]/,/[\u2C00-\u2DFF\u2E80-\u2FFF]/,/[\u3004-\u3007\u3021-\u302F\u3031-\u303F\u3040-\uD7FF]/,/[\uF900-\uFD3D\uFD40-\uFDCF\uFDF0-\uFE1F\uFE30-\uFE44]/,/[\uFE47-\uFEFE\uFF00-\uFFFD]/),Ie=Z(zt,/\d/,/[\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/),te=U(zt,Ie,"*"),xe=U(/[A-Z]/,Ie,"*"),or=["attached","autoclosure",U(/convention\(/,Z("swift","block","c"),/\)/),"discardableResult","dynamicCallable","dynamicMemberLookup","escaping","freestanding","frozen","GKInspectable","IBAction","IBDesignable","IBInspectable","IBOutlet","IBSegueAction","inlinable","main","nonobjc","NSApplicationMain","NSCopying","NSManaged",U(/objc\(/,te,/\)/),"objc","objcMembers","propertyWrapper","requires_stored_property_inits","resultBuilder","Sendable","testable","UIApplicationMain","unchecked","unknown","usableFromInline","warn_unqualified_access"],sr=["iOS","iOSApplicationExtension","macOS","macOSApplicationExtension","macCatalyst","macCatalystApplicationExtension","watchOS","watchOSApplicationExtension","tvOS","tvOSApplicationExtension","swift"];function cr(e){let n={match:/\s+/,relevance:0},t=e.COMMENT("/\\*","\\*/",{contains:["self"]}),i=[e.C_LINE_COMMENT_MODE,t],s={match:[/\./,Z(...tr,...Lt)],className:{2:"keyword"}},u={match:U(/\./,Z(...Ze)),relevance:0},r=Ze.filter(B=>typeof B=="string").concat(["_|0"]),a=Ze.filter(B=>typeof B!="string").concat(ir).map(Ve),o={variants:[{className:"keyword",match:Z(...a,...Lt)}]},c={$pattern:Z(/\b\w+/,/#\w+/),keyword:r.concat(rr),literal:Dt},d=[s,u,o],f={match:U(/\./,Z(...Bt)),relevance:0},b={className:"built_in",match:U(/\b/,Z(...Bt),/(?=\()/)},_=[f,b],S={match:/->/,relevance:0},h={className:"operator",relevance:0,variants:[{match:Xe},{match:`\\.(\\.|${Ft})+`}]},N=[S,h],T="([0-9]_*)+",R="([0-9a-fA-F]_*)+",I={className:"number",relevance:0,variants:[{match:`\\b(${T})(\\.(${T}))?([eE][+-]?(${T}))?\\b`},{match:`\\b0x(${R})(\\.(${R}))?([pP][+-]?(${T}))?\\b`},{match:/\b0o([0-7]_*)+\b/},{match:/\b0b([01]_*)+\b/}]},M=(B="")=>({className:"subst",variants:[{match:U(/\\/,B,/[0\\tnr"']/)},{match:U(/\\/,B,/u\{[0-9a-fA-F]{1,8}\}/)}]}),C=(B="")=>({className:"subst",match:U(/\\/,B,/[\t ]*(?:[\r\n]|\r\n)/)}),k=(B="")=>({className:"subst",label:"interpol",begin:U(/\\/,B,/\(/),end:/\)/}),H=(B="")=>({begin:U(B,/"""/),end:U(/"""/,B),contains:[M(B),C(B),k(B)]}),L=(B="")=>({begin:U(B,/"/),end:U(/"/,B),contains:[M(B),k(B)]}),z={className:"string",variants:[H(),H("#"),H("##"),H("###"),L(),L("#"),L("##"),L("###")]},X=[e.BACKSLASH_ESCAPE,{begin:/\[/,end:/\]/,relevance:0,contains:[e.BACKSLASH_ESCAPE]}],ne={begin:/\/[^\s](?=[^/\n]*\/)/,end:/\//,contains:X},Q=B=>{let ae=U(B,/\//),y=U(/\//,B);return{begin:ae,end:y,contains:[...X,{scope:"comment",begin:`#(?!.*${y})`,end:/$/}]}},ee={scope:"regexp",variants:[Q("###"),Q("##"),Q("#"),ne]},K={match:U(/`/,te,/`/)},G={className:"variable",match:/\$\d+/},l={className:"variable",match:`\\$${Ie}+`},m=[K,G,l],p={match:/(@|#(un)?)available/,scope:"keyword",starts:{contains:[{begin:/\(/,end:/\)/,keywords:sr,contains:[...N,I,z]}]}},w={scope:"keyword",match:U(/@/,Z(...or),Ee(Z(/\(/,/\s+/)))},x={scope:"meta",match:U(/@/,te)},P=[p,w,x],$={match:Ee(/\b[A-Z]/),relevance:0,contains:[{className:"type",match:U(/(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)/,Ie,"+")},{className:"type",match:xe,relevance:0},{match:/[?!]+/,relevance:0},{match:/\.\.\./,relevance:0},{match:U(/\s+&\s+/,Ee(xe)),relevance:0}]},J={begin:/</,end:/>/,keywords:c,contains:[...i,...d,...P,S,$]};$.contains.push(J);let Y={match:U(te,/\s*:/),keywords:"_|0",relevance:0},V={begin:/\(/,end:/\)/,relevance:0,keywords:c,contains:["self",Y,...i,ee,...d,..._,...N,I,z,...m,...P,$]},le={begin:/</,end:/>/,keywords:"repeat each",contains:[...i,$]},he={begin:Z(Ee(U(te,/\s*:/)),Ee(U(te,/\s+/,te,/\s*:/))),end:/:/,relevance:0,contains:[{className:"keyword",match:/\b_\b/},{className:"params",match:te}]},me={begin:/\(/,end:/\)/,keywords:c,contains:[he,...i,...d,...N,I,z,...P,$,V],endsParent:!0,illegal:/["']/},Le={match:[/(func|macro)/,/\s+/,Z(K.match,te,Xe)],className:{1:"keyword",3:"title.function"},contains:[le,me,n],illegal:[/\[/,/%/]},De={match:[/\b(?:subscript|init[?!]?)/,/\s*(?=[<(])/],className:{1:"keyword"},contains:[le,me,n],illegal:/\[|%/},Be={match:[/operator/,/\s+/,Xe],className:{1:"keyword",3:"title"}},Ue={begin:[/precedencegroup/,/\s+/,xe],className:{1:"keyword",3:"title"},contains:[$],keywords:[...ar,...Dt],end:/}/},de={match:[/class\b/,/\s+/,/func\b/,/\s+/,/\b[A-Za-z_][A-Za-z0-9_]*\b/],scope:{1:"keyword",3:"keyword",5:"title.function"}},Ne={match:[/class\b/,/\s+/,/var\b/],scope:{1:"keyword",3:"keyword"}},j={begin:[/(struct|protocol|class|extension|enum|actor)/,/\s+/,te,/\s*/],beginScope:{1:"keyword",3:"title.class"},keywords:c,contains:[le,...d,{begin:/:/,end:/\{/,keywords:c,contains:[{scope:"title.class.inherited",match:xe},...d],relevance:0}]};for(let B of z.variants){let ae=B.contains.find(ye=>ye.label==="interpol");ae.keywords=c;let y=[...d,..._,...N,I,z,...m];ae.contains=[...y,{begin:/\(/,end:/\)/,contains:["self",...y]}]}return{name:"Swift",keywords:c,contains:[...i,Le,De,de,Ne,j,Be,Ue,{beginKeywords:"import",end:/$/,contains:[...i],relevance:0},ee,...d,..._,...N,I,z,...m,...P,$,V]}}$t.exports=cr});var Ht=A((Xr,Gt)=>{function lr(e){let n="true false yes no null",t="[\\w#;/?:@&=+$,.~*'()[\\]]+",i={className:"attr",variants:[{begin:/[\w*@][\w*@ :()\./-]*:(?=[ \t]|$)/},{begin:/"[\w*@][\w*@ :()\./-]*":(?=[ \t]|$)/},{begin:/'[\w*@][\w*@ :()\./-]*':(?=[ \t]|$)/}]},s={className:"template-variable",variants:[{begin:/\{\{/,end:/\}\}/},{begin:/%\{/,end:/\}/}]},u={className:"string",relevance:0,begin:/'/,end:/'/,contains:[{match:/''/,scope:"char.escape",relevance:0}]},r={className:"string",relevance:0,variants:[{begin:/"/,end:/"/},{begin:/\S+/}],contains:[e.BACKSLASH_ESCAPE,s]},a=e.inherit(r,{variants:[{begin:/'/,end:/'/,contains:[{begin:/''/,relevance:0}]},{begin:/"/,end:/"/},{begin:/[^\s,{}[\]]+/}]}),b={className:"number",begin:"\\b"+"[0-9]{4}(-[0-9][0-9]){0,2}"+"([Tt \\t][0-9][0-9]?(:[0-9][0-9]){2})?"+"(\\.[0-9]*)?"+"([ \\t])*(Z|[-+][0-9][0-9]?(:[0-9][0-9])?)?"+"\\b"},_={end:",",endsWithParent:!0,excludeEnd:!0,keywords:n,relevance:0},S={begin:/\{/,end:/\}/,contains:[_],illegal:"\\n",relevance:0},h={begin:"\\[",end:"\\]",contains:[_],illegal:"\\n",relevance:0},N=[i,{className:"meta",begin:"^---\\s*$",relevance:10},{className:"string",begin:"[\\|>]([1-9]?[+-])?[ ]*\\n( +)[^ ][^\\n]*\\n(\\2[^\\n]+\\n?)*"},{begin:"<%[%=-]?",end:"[%-]?%>",subLanguage:"ruby",excludeBegin:!0,excludeEnd:!0,relevance:0},{className:"type",begin:"!\\w+!"+t},{className:"type",begin:"!<"+t+">"},{className:"type",begin:"!"+t},{className:"type",begin:"!!"+t},{className:"meta",begin:"&"+e.UNDERSCORE_IDENT_RE+"$"},{className:"meta",begin:"\\*"+e.UNDERSCORE_IDENT_RE+"$"},{className:"bullet",begin:"-(?=[ ]|$)",relevance:0},e.HASH_COMMENT_MODE,{beginKeywords:n,keywords:{literal:n}},b,{className:"number",begin:e.C_NUMBER_RE+"\\b",relevance:0},S,h,u,r],T=[...N];return T.pop(),T.push(a),_.contains=T,{name:"YAML",case_insensitive:!0,aliases:["yml"],contains:N}}Gt.exports=lr});var jt=A((Vr,Jt)=>{var Ce="[A-Za-z$_][0-9A-Za-z$_]*",qt=["as","in","of","if","for","while","finally","var","new","function","do","return","void","else","break","catch","instanceof","with","throw","case","default","try","switch","continue","typeof","delete","let","yield","const","class","debugger","async","await","static","import","from","export","extends","using"],Wt=["true","false","null","undefined","NaN","Infinity"],Yt=["Object","Function","Boolean","Symbol","Math","Date","Number","BigInt","String","RegExp","Array","Float32Array","Float64Array","Int8Array","Uint8Array","Uint8ClampedArray","Int16Array","Int32Array","Uint16Array","Uint32Array","BigInt64Array","BigUint64Array","Set","Map","WeakSet","WeakMap","ArrayBuffer","SharedArrayBuffer","Atomics","DataView","JSON","Promise","Generator","GeneratorFunction","AsyncFunction","Reflect","Proxy","Intl","WebAssembly"],Zt=["Error","EvalError","InternalError","RangeError","ReferenceError","SyntaxError","TypeError","URIError"],Xt=["setInterval","setTimeout","clearInterval","clearTimeout","require","exports","eval","isFinite","isNaN","parseFloat","parseInt","decodeURI","decodeURIComponent","encodeURI","encodeURIComponent","escape","unescape"],Vt=["arguments","this","super","console","window","document","localStorage","sessionStorage","module","global"],Qt=[].concat(Xt,Yt,Zt);function dr(e){let n=e.regex,t=(p,{after:w})=>{let x="</"+p[0].slice(1);return p.input.indexOf(x,w)!==-1},i=Ce,s={begin:"<>",end:"</>"},u=/<[A-Za-z0-9\\._:-]+\s*\/>/,r={begin:/<[A-Za-z0-9\\._:-]+/,end:/\/[A-Za-z0-9\\._:-]+>|\/>/,isTrulyOpeningTag:(p,w)=>{let x=p[0].length+p.index,P=p.input[x];if(P==="<"||P===","){w.ignoreMatch();return}P===">"&&(t(p,{after:x})||w.ignoreMatch());let $,J=p.input.substring(x);if($=J.match(/^\s*=/)){w.ignoreMatch();return}if(($=J.match(/^\s+extends\s+/))&&$.index===0){w.ignoreMatch();return}}},a={$pattern:Ce,keyword:qt,literal:Wt,built_in:Qt,"variable.language":Vt},o="[0-9](_?[0-9])*",c=`\\.(${o})`,d="0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*",f={className:"number",variants:[{begin:`(\\b(${d})((${c})|\\.)?|(${c}))[eE][+-]?(${o})\\b`},{begin:`\\b(${d})\\b((${c})\\b|\\.)?|(${c})\\b`},{begin:"\\b(0|[1-9](_?[0-9])*)n\\b"},{begin:"\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b"},{begin:"\\b0[bB][0-1](_?[0-1])*n?\\b"},{begin:"\\b0[oO][0-7](_?[0-7])*n?\\b"},{begin:"\\b0[0-7]+n?\\b"}],relevance:0},b={className:"subst",begin:"\\$\\{",end:"\\}",keywords:a,contains:[]},_={begin:".?html`",end:"",starts:{end:"`",returnEnd:!1,contains:[e.BACKSLASH_ESCAPE,b],subLanguage:"xml"}},S={begin:".?css`",end:"",starts:{end:"`",returnEnd:!1,contains:[e.BACKSLASH_ESCAPE,b],subLanguage:"css"}},h={begin:".?gql`",end:"",starts:{end:"`",returnEnd:!1,contains:[e.BACKSLASH_ESCAPE,b],subLanguage:"graphql"}},N={className:"string",begin:"`",end:"`",contains:[e.BACKSLASH_ESCAPE,b]},R={className:"comment",variants:[e.COMMENT(/\/\*\*(?!\/)/,"\\*/",{relevance:0,contains:[{begin:"(?=@[A-Za-z]+)",relevance:0,contains:[{className:"doctag",begin:"@[A-Za-z]+"},{className:"type",begin:"\\{",end:"\\}",excludeEnd:!0,excludeBegin:!0,relevance:0},{className:"variable",begin:i+"(?=\\s*(-)|$)",endsParent:!0,relevance:0},{begin:/(?=[^\n])\s/,relevance:0}]}]}),e.C_BLOCK_COMMENT_MODE,e.C_LINE_COMMENT_MODE]},I=[e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,_,S,h,N,{match:/\$\d+/},f];b.contains=I.concat({begin:/\{/,end:/\}/,keywords:a,contains:["self"].concat(I)});let M=[].concat(R,b.contains),C=M.concat([{begin:/(\s*)\(/,end:/\)/,keywords:a,contains:["self"].concat(M)}]),k={className:"params",begin:/(\s*)\(/,end:/\)/,excludeBegin:!0,excludeEnd:!0,keywords:a,contains:C},H={variants:[{match:[/class/,/\s+/,i,/\s+/,/extends/,/\s+/,n.concat(i,"(",n.concat(/\./,i),")*")],scope:{1:"keyword",3:"title.class",5:"keyword",7:"title.class.inherited"}},{match:[/class/,/\s+/,i],scope:{1:"keyword",3:"title.class"}}]},L={relevance:0,match:n.either(/\bJSON/,/\b[A-Z][a-z]+([A-Z][a-z]*|\d)*/,/\b[A-Z]{2,}([A-Z][a-z]+|\d)+([A-Z][a-z]*)*/,/\b[A-Z]{2,}[a-z]+([A-Z][a-z]+|\d)*([A-Z][a-z]*)*/),className:"title.class",keywords:{_:[...Yt,...Zt]}},z={label:"use_strict",className:"meta",relevance:10,begin:/^\s*['"]use (strict|asm)['"]/},X={variants:[{match:[/function/,/\s+/,i,/(?=\s*\()/]},{match:[/function/,/\s*(?=\()/]}],className:{1:"keyword",3:"title.function"},label:"func.def",contains:[k],illegal:/%/},ne={relevance:0,match:/\b[A-Z][A-Z_0-9]+\b/,className:"variable.constant"};function Q(p){return n.concat("(?!",p.join("|"),")")}let ee={match:n.concat(/\b/,Q([...Xt,"super","import"].map(p=>`${p}\\s*\\(`)),i,n.lookahead(/\s*\(/)),className:"title.function",relevance:0},K={begin:n.concat(/\./,n.lookahead(n.concat(i,/(?![0-9A-Za-z$_(])/))),end:i,excludeBegin:!0,keywords:"prototype",className:"property",relevance:0},G={match:[/get|set/,/\s+/,i,/(?=\()/],className:{1:"keyword",3:"title.function"},contains:[{begin:/\(\)/},k]},l="(\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)|"+e.UNDERSCORE_IDENT_RE+")\\s*=>",m={match:[/const|var|let/,/\s+/,i,/\s*/,/=\s*/,/(async\s*)?/,n.lookahead(l)],keywords:"async",className:{1:"keyword",3:"title.function"},contains:[k]};return{name:"JavaScript",aliases:["js","jsx","mjs","cjs"],keywords:a,exports:{PARAMS_CONTAINS:C,CLASS_REFERENCE:L},illegal:/#(?![$_A-z])/,contains:[e.SHEBANG({label:"shebang",binary:"node",relevance:5}),z,e.APOS_STRING_MODE,e.QUOTE_STRING_MODE,_,S,h,N,R,{match:/\$\d+/},f,L,{scope:"attr",match:i+n.lookahead(":"),relevance:0},m,{begin:"("+e.RE_STARTERS_RE+"|\\b(case|return|throw)\\b)\\s*",keywords:"return throw case",relevance:0,contains:[R,e.REGEXP_MODE,{className:"function",begin:l,returnBegin:!0,end:"\\s*=>",contains:[{className:"params",variants:[{begin:e.UNDERSCORE_IDENT_RE,relevance:0},{className:null,begin:/\(\s*\)/,skip:!0},{begin:/(\s*)\(/,end:/\)/,excludeBegin:!0,excludeEnd:!0,keywords:a,contains:C}]}]},{begin:/,/,relevance:0},{match:/\s+/,relevance:0},{variants:[{begin:s.begin,end:s.end},{match:u},{begin:r.begin,"on:begin":r.isTrulyOpeningTag,end:r.end}],subLanguage:"xml",contains:[{begin:r.begin,end:r.end,skip:!0,contains:["self"]}]}]},X,{beginKeywords:"while if switch catch for"},{begin:"\\b(?!function)"+e.UNDERSCORE_IDENT_RE+"\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)\\s*\\{",returnBegin:!0,label:"func.def",contains:[k,e.inherit(e.TITLE_MODE,{begin:i,className:"title.function"})]},{match:/\.\.\./,relevance:0},K,{match:"\\$"+i,relevance:0},{match:[/\bconstructor(?=\s*\()/],className:{1:"title.function"},contains:[k]},ee,ne,H,G,{match:/\$[(.]/}]}}function ur(e){let n=e.regex,t=dr(e),i=Ce,s=["any","void","number","boolean","string","object","never","symbol","bigint","unknown"],u={begin:[/namespace/,/\s+/,e.IDENT_RE],beginScope:{1:"keyword",3:"title.class"}},r={beginKeywords:"interface",end:/\{/,excludeEnd:!0,keywords:{keyword:"interface extends",built_in:s},contains:[t.exports.CLASS_REFERENCE]},a={className:"meta",relevance:10,begin:/^\s*['"]use strict['"]/},o=["type","interface","public","private","protected","implements","declare","abstract","readonly","enum","override","satisfies"],c={$pattern:Ce,keyword:qt.concat(o),literal:Wt,built_in:Qt.concat(s),"variable.language":Vt},d={className:"meta",begin:"@"+i},f=(h,N,T)=>{let R=h.contains.findIndex(I=>I.label===N);if(R===-1)throw new Error("can not find mode to replace");h.contains.splice(R,1,T)};Object.assign(t.keywords,c),t.exports.PARAMS_CONTAINS.push(d);let b=t.contains.find(h=>h.scope==="attr"),_=Object.assign({},b,{match:n.concat(i,n.lookahead(/\s*\?:/))});t.exports.PARAMS_CONTAINS.push([t.exports.CLASS_REFERENCE,b,_]),t.contains=t.contains.concat([d,u,r,_]),f(t,"shebang",e.SHEBANG()),f(t,"use_strict",a);let S=t.contains.find(h=>h.label==="func.def");return S.relevance=0,Object.assign(t,{name:"TypeScript",aliases:["ts","tsx","mts","cts"]}),t}Jt.exports=ur});var ni=A((Qr,ei)=>{function gr(e){let n=e.regex,t={className:"string",begin:/"(""|[^/n])"C\b/},i={className:"string",begin:/"/,end:/"/,illegal:/\n/,contains:[{begin:/""/}]},s=/\d{1,2}\/\d{1,2}\/\d{4}/,u=/\d{4}-\d{1,2}-\d{1,2}/,r=/(\d|1[012])(:\d+){0,2} *(AM|PM)/,a=/\d{1,2}(:\d{1,2}){1,2}/,o={className:"literal",variants:[{begin:n.concat(/# */,n.either(u,s),/ *#/)},{begin:n.concat(/# */,a,/ *#/)},{begin:n.concat(/# */,r,/ *#/)},{begin:n.concat(/# */,n.either(u,s),/ +/,n.either(r,a),/ *#/)}]},c={className:"number",relevance:0,variants:[{begin:/\b\d[\d_]*((\.[\d_]+(E[+-]?[\d_]+)?)|(E[+-]?[\d_]+))[RFD@!#]?/},{begin:/\b\d[\d_]*((U?[SIL])|[%&])?/},{begin:/&H[\dA-F_]+((U?[SIL])|[%&])?/},{begin:/&O[0-7_]+((U?[SIL])|[%&])?/},{begin:/&B[01_]+((U?[SIL])|[%&])?/}]},d={className:"label",begin:/^\w+:/},f=e.COMMENT(/'''/,/$/,{contains:[{className:"doctag",begin:/<\/?/,end:/>/}]}),b=e.COMMENT(null,/$/,{variants:[{begin:/'/},{begin:/([\t ]|^)REM(?=\s)/}]});return{name:"Visual Basic .NET",aliases:["vb"],case_insensitive:!0,classNameAliases:{label:"symbol"},keywords:{keyword:"addhandler alias aggregate ansi as async assembly auto binary by byref byval call case catch class compare const continue custom declare default delegate dim distinct do each equals else elseif end enum erase error event exit explicit finally for friend from function get global goto group handles if implements imports in inherits interface into iterator join key let lib loop me mid module mustinherit mustoverride mybase myclass namespace narrowing new next notinheritable notoverridable of off on operator option optional order overloads overridable overrides paramarray partial preserve private property protected public raiseevent readonly redim removehandler resume return select set shadows shared skip static step stop structure strict sub synclock take text then throw to try unicode until using when where while widening with withevents writeonly yield",built_in:"addressof and andalso await directcast gettype getxmlnamespace is isfalse isnot istrue like mod nameof new not or orelse trycast typeof xor cbool cbyte cchar cdate cdbl cdec cint clng cobj csbyte cshort csng cstr cuint culng cushort",type:"boolean byte char date decimal double integer long object sbyte short single string uinteger ulong ushort",literal:"true false nothing"},illegal:"//|\\{|\\}|endif|gosub|variant|wend|^\\$ ",contains:[t,i,o,c,d,f,b,{className:"meta",begin:/[\t ]*#(const|disable|else|elseif|enable|end|externalsource|if|region)\b/,end:/$/,keywords:{keyword:"const disable else elseif enable end externalsource if region then"},contains:[b]}]}}ei.exports=gr});var ii=A((Jr,ti)=>{function br(e){e.regex;let n=e.COMMENT(/\(;/,/;\)/);n.contains.push("self");let t=e.COMMENT(/;;/,/$/),i=["anyfunc","block","br","br_if","br_table","call","call_indirect","data","drop","elem","else","end","export","func","global.get","global.set","local.get","local.set","local.tee","get_global","get_local","global","if","import","local","loop","memory","memory.grow","memory.size","module","mut","nop","offset","param","result","return","select","set_global","set_local","start","table","tee_local","then","type","unreachable"],s={begin:[/(?:func|call|call_indirect)/,/\s+/,/\$[^\s)]+/],className:{1:"keyword",3:"title.function"}},u={className:"variable",begin:/\$[\w_]+/},r={match:/(\((?!;)|\))+/,className:"punctuation",relevance:0},a={className:"number",relevance:0,match:/[+-]?\b(?:\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|0x[\da-fA-F](?:_?[\da-fA-F])*(?:\.[\da-fA-F](?:_?[\da-fA-D])*)?(?:[pP][+-]?\d(?:_?\d)*)?)\b|\binf\b|\bnan(?::0x[\da-fA-F](?:_?[\da-fA-D])*)?\b/},o={match:/(i32|i64|f32|f64)(?!\.)/,className:"type"},c={className:"keyword",match:/\b(f32|f64|i32|i64)(?:\.(?:abs|add|and|ceil|clz|const|convert_[su]\/i(?:32|64)|copysign|ctz|demote\/f64|div(?:_[su])?|eqz?|extend_[su]\/i32|floor|ge(?:_[su])?|gt(?:_[su])?|le(?:_[su])?|load(?:(?:8|16|32)_[su])?|lt(?:_[su])?|max|min|mul|nearest|neg?|or|popcnt|promote\/f32|reinterpret\/[fi](?:32|64)|rem_[su]|rot[lr]|shl|shr_[su]|store(?:8|16|32)?|sqrt|sub|trunc(?:_[su]\/f(?:32|64))?|wrap\/i64|xor))\b/};return{name:"WebAssembly",keywords:{$pattern:/[\w.]+/,keyword:i},contains:[t,n,{match:[/(?:offset|align)/,/\s*/,/=/],className:{1:"keyword",3:"operator"}},u,r,s,e.QUOTE_STRING_MODE,o,c,a]}}ti.exports=br});var pr=A((jr,ai)=>{var v=fn();v.registerLanguage("xml",hn());v.registerLanguage("bash",yn());v.registerLanguage("c",Sn());v.registerLanguage("cpp",vn());v.registerLanguage("csharp",An());v.registerLanguage("css",Mn());v.registerLanguage("markdown",xn());v.registerLanguage("diff",Cn());v.registerLanguage("ruby",Dn());v.registerLanguage("go",Un());v.registerLanguage("graphql",Fn());v.registerLanguage("ini",$n());v.registerLanguage("java",qn());v.registerLanguage("javascript",Qn());v.registerLanguage("json",jn());v.registerLanguage("kotlin",nt());v.registerLanguage("less",rt());v.registerLanguage("lua",st());v.registerLanguage("makefile",lt());v.registerLanguage("perl",ut());v.registerLanguage("objectivec",bt());v.registerLanguage("php",mt());v.registerLanguage("php-template",ft());v.registerLanguage("plaintext",ht());v.registerLanguage("python",yt());v.registerLanguage("python-repl",St());v.registerLanguage("r",vt());v.registerLanguage("rust",At());v.registerLanguage("scss",Mt());v.registerLanguage("shell",xt());v.registerLanguage("sql",Ct());v.registerLanguage("swift",Kt());v.registerLanguage("yaml",Ht());v.registerLanguage("typescript",jt());v.registerLanguage("vbnet",ni());v.registerLanguage("wasm",ii());v.HighlightJS=v;v.default=v;ai.exports=v});return pr();})();
backend/src/business/refresh/controller/publish-server-refresh-controller.ts:13:export async function publishServerRefreshController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/refresh/controller/publish-server-refresh-controller.ts:14:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/refresh/controller/publish-server-refresh-controller.ts:17:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/refresh/controller/publish-server-refresh-controller.ts:18:  const watch = watchLedgerDirectory({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/refresh/controller/publish-server-refresh-controller.ts:19:  const debounce = debounceRefreshEvent({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/refresh/controller/publish-server-refresh-controller.ts:20:  const ledger = readLedgerJsonFile({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/refresh/controller/publish-server-refresh-controller.ts:21:  const validation = validateLedgerDocument({ action_payload: { ...payload, document: ledger.document }, runtime_state: runtime, data_model: data });
backend/src/business/refresh/controller/publish-server-refresh-controller.ts:23:    publishRefreshEvent({ action_payload: { ...payload, watch, debounce, ledger }, runtime_state: runtime, data_model: data });
frontend/src/business/relationship/helper/route-relationship-path.ts:9:export function routeRelationshipPath(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/relationship/helper/route-relationship-path.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/relationship/helper/route-relationship-path.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/ledger/helper/read-ledger-json-file.ts:11:export function readLedgerJsonFile(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/ledger/helper/read-ledger-json-file.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/ledger/helper/read-ledger-json-file.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/ledger/helper/read-ledger-json-file.ts:19:    return { ok: true, file, document: data.document ?? { tabs: [], cards: [], zones: [], relationships: [] } };
frontend/test/unit/relationship/effect/render-relationship-overlay.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/runtime/codex-skill-request.integration.test.ts:3:import { loadCodexSkills } from '../../src/runtime/codex/effect/load-codex-skills.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:4:import { requestCardSkillProcess } from '../../src/runtime/codex/effect/request-card-skill-process.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:5:import { requestCardSkillRunStatus } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:6:import { cardCodexRunId } from '../../src/runtime/codex/helper/card-codex-run-id.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:8:test('loadCodexSkills returns server skill summaries', async () => {
frontend/test/runtime/codex-skill-request.integration.test.ts:12:      assert.equal(url, '/api/codex/skills');
frontend/test/runtime/codex-skill-request.integration.test.ts:13:      return new Response(JSON.stringify({ ok: true, skills: [{ name: 'analysis', description: 'Analyze code', source: 'workspace' }] }), {
frontend/test/runtime/codex-skill-request.integration.test.ts:19:    const skills = await loadCodexSkills();
frontend/test/runtime/codex-skill-request.integration.test.ts:20:    assert.deepEqual(skills, [{ name: 'analysis', description: 'Analyze code', source: 'workspace' }]);
frontend/test/runtime/codex-skill-request.integration.test.ts:26:test('requestCardSkillProcess posts active card skill payload', async () => {
frontend/test/runtime/codex-skill-request.integration.test.ts:30:      assert.equal(url, '/api/codex/skills/process');
frontend/test/runtime/codex-skill-request.integration.test.ts:35:        ledgerId: 'specs',
frontend/test/runtime/codex-skill-request.integration.test.ts:37:        skillName: 'analysis',
frontend/test/runtime/codex-skill-request.integration.test.ts:38:        codexModel: 'gpt-5.5',
frontend/test/runtime/codex-skill-request.integration.test.ts:39:        codexEffort: 'xhigh'
frontend/test/runtime/codex-skill-request.integration.test.ts:47:    const result = await requestCardSkillProcess({ ledgerId: 'specs', cardId: 'card-a', skillName: 'analysis', codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
frontend/test/runtime/codex-skill-request.integration.test.ts:59:      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd?ledgerId=specs&cardId=card-a&since=4');
frontend/test/runtime/codex-skill-request.integration.test.ts:67:        agentMessageCount: 1,
frontend/test/runtime/codex-skill-request.integration.test.ts:79:    const result = await requestCardSkillRunStatus({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd', since: 4 });
frontend/test/runtime/codex-skill-request.integration.test.ts:91:    id: 'card-codex-skill-1000-abcd',
frontend/test/runtime/codex-skill-request.integration.test.ts:92:    comment: { what: '# Finished result without run metadata' }
frontend/test/runtime/codex-skill-request.integration.test.ts:93:  }), 'codex-skill-1000-abcd');
frontend/test/runtime/codex-skill-request.integration.test.ts:96:    comment: { what: 'Codex run: codex-skill-2000-efgh' }
frontend/test/runtime/codex-skill-request.integration.test.ts:97:  }), 'codex-skill-2000-efgh');
frontend/test/unit/navigation/controller/navigate-tab-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/src/business/relationship/helper/calculate-relationship-ports.ts:9:export function calculateRelationshipPorts(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/relationship/helper/calculate-relationship-ports.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/relationship/helper/calculate-relationship-ports.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/unit/ledger/helper/zone-attribution-cache.test.ts:16:  }, 'specs');
frontend/test/unit/ledger/helper/zone-attribution-cache.test.ts:27:    dataset: {},
frontend/test/unit/ledger/helper/zone-attribution-cache.test.ts:44:  assert.equal(element.dataset.cardZoneId, 'zone-a');
frontend/test/unit/ledger/helper/zone-attribution-cache.test.ts:45:  assert.equal(element.dataset.cardZoneColor, '#38d9e8');
frontend/test/unit/ledger/helper/zone-attribution-cache.test.ts:50:  assert.equal(element.dataset.cardZoneId, undefined);
frontend/test/unit/ledger/helper/zone-attribution-cache.test.ts:51:  assert.equal(element.dataset.cardZoneColor, undefined);
backend/src/business/ledger/helper/thread-content-file.ts:3: * WHY: agents should answer by patching a thread file instead of regenerating ledger JSON note arrays.
backend/src/business/ledger/helper/thread-content-file.ts:10:const metadataPrefix = '<!-- decision-os:note ';
backend/src/business/ledger/helper/thread-content-file.ts:11:const metadataSuffix = ' -->';
backend/src/business/ledger/helper/thread-content-file.ts:30:function noteRole(note: AnyRecord): 'agent' | 'operator' {
backend/src/business/ledger/helper/thread-content-file.ts:32:  return role === 'agent' || role === 'assistant' ? 'agent' : 'operator';
backend/src/business/ledger/helper/thread-content-file.ts:37:  return normalized === 'agent' || normalized === 'assistant' ? 'AGENT' : 'OPERATOR';
backend/src/business/ledger/helper/thread-content-file.ts:40:function parseMetadata(line: string): AnyRecord | null {
backend/src/business/ledger/helper/thread-content-file.ts:42:  if (!trimmed.startsWith(metadataPrefix) || !trimmed.endsWith(metadataSuffix)) return null;
backend/src/business/ledger/helper/thread-content-file.ts:44:    const raw = trimmed.slice(metadataPrefix.length, -metadataSuffix.length);
backend/src/business/ledger/helper/thread-content-file.ts:52:function metadataFor(note: AnyRecord): AnyRecord {
backend/src/business/ledger/helper/thread-content-file.ts:53:  const metadata: AnyRecord = {};
backend/src/business/ledger/helper/thread-content-file.ts:54:  for (const key of ['id', 'timestamp', 'voiceFileRef', 'status', 'transcriptionStartedAt', 'error', 'codexRunId', 'codexLine', 'codexKind', 'codexEventType', 'codexItemId', 'codexTool', 'codexExitCode']) {
backend/src/business/ledger/helper/thread-content-file.ts:55:    if (typeof note[key] === 'string' && note[key]) metadata[key] = note[key];
backend/src/business/ledger/helper/thread-content-file.ts:57:  if (isRecord(note.imageSizes) && Object.keys(note.imageSizes).length > 0) metadata.imageSizes = note.imageSizes;
backend/src/business/ledger/helper/thread-content-file.ts:58:  return metadata;
backend/src/business/ledger/helper/thread-content-file.ts:101:        role: heading[1].toLowerCase() === 'agent' ? 'agent' : 'operator',
backend/src/business/ledger/helper/thread-content-file.ts:110:      const metadata = parseMetadata(line);
backend/src/business/ledger/helper/thread-content-file.ts:111:      if (metadata) {
backend/src/business/ledger/helper/thread-content-file.ts:112:        current = { ...current, ...metadata, role: noteRole({ ...current, ...metadata }) };
backend/src/business/ledger/helper/thread-content-file.ts:125:    const metadata = metadataFor(note);
backend/src/business/ledger/helper/thread-content-file.ts:127:    return [`# ${headingForRole(note.role)}`, `${metadataPrefix}${JSON.stringify(metadata)}${metadataSuffix}`, '', body].join('\n').replace(/\n+$/g, '');
frontend/src/business/zone/effect/render-zone-layer.ts:9:export function renderZoneLayer(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/zone/effect/render-zone-layer.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/persistence/effect/commit-ledger-edit.ts:9:export function commitLedgerEdit(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/persistence/effect/commit-ledger-edit.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/unit/runtime/voice/helper/encode-wav-blob.test.ts:19:  assert.equal(text(view, 36, 4), 'data');
frontend/test/unit/card/helper/parse-card-markdown.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
backend/src/business/ledger/helper/validate-ledger-document.ts:11:export function validateLedgerDocument(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/ledger/helper/validate-ledger-document.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/ledger/helper/validate-ledger-document.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/ledger/helper/validate-ledger-document.ts:17:  const document = payload.document ?? data.document ?? {};
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts:14:  const specs = source('documentation/specs.json');
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts:16:  assert.match(specs, /84cf2a6b/);
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts:21:  assert.match(specs, /9d5e0b7a/);
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts:54:  const specs = source('documentation/specs.json');
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts:56:  assert.match(specs, /2aa4f070/);
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts:57:  assert.match(specs, /5d8f2a1b/);
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts:65:  assert.match(overlayRuntime, /color\.dataset\.action = 'edit-zone-color'/);
backend/src/server.ts:11:const port = Number(process.env.PORT ?? settings.port ?? 4173);
backend/src/server.ts:12:const host = String(process.env.HOST ?? settings.host ?? '127.0.0.1');
frontend/src/business/relationship/controller/render-relationship-controller.ts:11:export async function renderRelationshipController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/relationship/controller/render-relationship-controller.ts:12:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/relationship/controller/render-relationship-controller.ts:15:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/relationship/controller/render-relationship-controller.ts:16:  const ports = calculateRelationshipPorts({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/relationship/controller/render-relationship-controller.ts:17:  const relationshipPath = routeRelationshipPath({ action_payload: { ...payload, ...ports }, runtime_state: runtime, data_model: data });
frontend/src/business/relationship/controller/render-relationship-controller.ts:18:  renderRelationshipOverlay({ action_payload: { ...payload, ports, relationshipPath }, runtime_state: runtime, data_model: data });
backend/src/business/refresh/effect/publish-refresh-event.ts:11:export function publishRefreshEvent(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
backend/src/business/refresh/effect/publish-refresh-event.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/unit/navigation/effect/render-tab-registry.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/unit/card/controller/edit-card-controller.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/test/runtime/keyboard-card-resize-shortcut.integration.test.ts:23:  assert.match(resizeEffect, /forceCardDetailsForMeasurement\(cards\.map\(\(card\) => card\.dataset\.cardId \?\? ''\)\)/);
frontend/test/runtime/keyboard-card-resize-shortcut.integration.test.ts:39:  assert.match(index, /data-action="toggle-rail"[^>]*aria-expanded="true"/);
frontend/test/unit/card/effect/resize-selected-card.test.ts:11:    dataset: { cardId: 'card-a' },
frontend/test/unit/card/effect/resize-selected-card.test.ts:48:    assert.equal(card.dataset.sizeCacheWidth, '300');
frontend/test/unit/card/effect/resize-selected-card.test.ts:49:    assert.equal(card.dataset.sizeCacheHeight, '190');
backend/src/business/ledger/controller/load-tab-ledgers-controller.ts:12:export async function loadTabLedgersController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/ledger/controller/load-tab-ledgers-controller.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/ledger/controller/load-tab-ledgers-controller.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/ledger/controller/load-tab-ledgers-controller.ts:17:  const state = readDecisionOsState({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/ledger/controller/load-tab-ledgers-controller.ts:18:  const ledger = readLedgerJsonFile({ action_payload: { ...payload, ...state }, runtime_state: runtime, data_model: data });
backend/src/business/ledger/controller/load-tab-ledgers-controller.ts:19:  const validation = validateLedgerDocument({ action_payload: { ...payload, document: ledger.document }, runtime_state: runtime, data_model: data });
backend/src/business/ledger/controller/load-tab-ledgers-controller.ts:20:  writeDecisionOsState({ action_payload: { ...payload, state, ledger, validation }, runtime_state: runtime, data_model: data });
frontend/test/unit/card/effect/render-card-layer.test.ts:16:    data_model: { cards: [{ id: 'card-1' }], document: {} }
frontend/src/business/relationship/effect/render-relationship-overlay.ts:9:export function renderRelationshipOverlay(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/relationship/effect/render-relationship-overlay.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/runtime/real-ledger-tabs.integration.test.ts:13:  assert.doesNotMatch(html, /data-tab="surface"/);
frontend/test/runtime/real-ledger-tabs.integration.test.ts:14:  assert.doesNotMatch(html, /data-tab="runtime"/);
frontend/test/runtime/real-ledger-tabs.integration.test.ts:15:  assert.doesNotMatch(html, /data-tab="specs"/);
frontend/test/runtime/real-ledger-tabs.integration.test.ts:16:  assert.doesNotMatch(html, /data-tab="data"/);
frontend/test/runtime/real-ledger-tabs.integration.test.ts:17:  assert.match(html, /data-action="open-ledgers-canvas"/);
frontend/test/runtime/real-ledger-tabs.integration.test.ts:18:  assert.match(html, /data-action="open-ledgers-canvas"[^>]*title="Ledgers"[\s\S]*<span>Ledgers<\/span>/);
frontend/test/runtime/real-ledger-tabs.integration.test.ts:25:  assert.match(state, /activeTab: 'specs'/);
frontend/test/runtime/real-ledger-tabs.integration.test.ts:37:  assert.doesNotMatch(routeTab, /'surface', 'specs', 'data', 'runtime'/);
frontend/src/business/selection/helper/calculate-marquee-selection.ts:9:export function calculateMarqueeSelection(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/selection/helper/calculate-marquee-selection.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/selection/helper/calculate-marquee-selection.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/selection/helper/calculate-marquee-selection.ts:15:  const items = Array.isArray(payload.items) ? payload.items : Array.isArray(data.cards) ? data.cards : [];
frontend/src/test/spec-assertions.js:8:const specs = JSON.parse(readFileSync('documentation/specs.json', 'utf8'));
frontend/src/test/spec-assertions.js:9:const specById = new Map((specs.cards ?? []).map((card) => [card.id, card]));
frontend/src/test/spec-assertions.js:34:  if (domain === 'zone') tokens.push('zone', 'data-zone-id');
frontend/src/test/spec-assertions.js:35:  if (domain === 'card') tokens.push('card', 'data-card-id');
frontend/src/test/spec-assertions.js:37:  if (domain === 'group') tokens.push('group', 'data-group-id');
frontend/src/test/spec-assertions.js:41:  if (domain === 'navigation') tokens.push('data-tab', 'route');
frontend/src/test/spec-assertions.js:42:  if (domain === 'toolbox') tokens.push('data-tool', 'renderToolbox');
frontend/src/business/navigation/helper/derive-route-state.ts:9:export function deriveRouteState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/navigation/helper/derive-route-state.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/navigation/helper/derive-route-state.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/selection/helper/copy-selection-payload.ts:9:export function copySelectionPayload(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/selection/helper/copy-selection-payload.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/selection/helper/copy-selection-payload.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/runtime/thread-selection-runtime.integration.test.ts:22:  dataset: Record<string, string>;
frontend/test/runtime/thread-selection-runtime.integration.test.ts:38:  element.dataset = {};
frontend/test/runtime/thread-selection-runtime.integration.test.ts:344:    assert.equal(retry?.dataset?.action, 'voice-retry');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:345:    assert.equal(retry?.dataset?.noteId, 'note-1');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:346:    assert.equal(retry?.dataset?.voiceFileRef, '/tmp/voice.webm');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:348:    assert.equal(deleteButton?.dataset?.action, 'confirm-delete-note');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:349:    assert.equal(deleteButton?.dataset?.noteId, 'note-1');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:437:    assert.equal(retry?.dataset?.action, 'voice-retry');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:438:    assert.equal(retry?.dataset?.noteId, 'note-stale');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:439:    assert.equal(retry?.dataset?.voiceFileRef, '/tmp/voice.webm');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:447:test('render-thread-notes separates operator and agent speaker ownership', () => {
frontend/test/runtime/thread-selection-runtime.integration.test.ts:477:          { id: 'note-agent', role: 'assistant', message: '**Agent** answer.\n\n---\n\n`Tail` line.' }
frontend/test/runtime/thread-selection-runtime.integration.test.ts:483:    assert.equal(rendered[1].className, 'thread-note is-agent');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:486:    const agentParagraph = rendered[1].children[0].children[0];
frontend/test/runtime/thread-selection-runtime.integration.test.ts:487:    assert.equal(agentParagraph.children[0].tagName, 'strong');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:488:    assert.equal(agentParagraph.children[0].textContent, 'Agent');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:489:    assert.equal(agentParagraph.children[1].textContent, ' answer.');
frontend/test/runtime/thread-selection-runtime.integration.test.ts:503:test('render-thread-notes renders escaped newline agent answers as markdown blocks', () => {
frontend/test/runtime/thread-selection-runtime.integration.test.ts:532:          { id: 'note-agent', role: 'assistant', message: 'Treated.\\n\\nSave research report:\\n- `UDatabaseController::CreateTables`\\n- `FWorldCellDataInterface`' }
frontend/test/runtime/thread-selection-runtime.integration.test.ts:538:    assert.equal(rendered[0].className, 'thread-note is-agent');
backend/src/business/ledger/effect/write-decision-os-state.ts:12:export function writeDecisionOsState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
backend/src/business/ledger/effect/write-decision-os-state.ts:14:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/navigation/effect/render-tab-registry.ts:9:export function renderTabRegistry(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/navigation/effect/render-tab-registry.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/selection/helper/clear-transient-selection.ts:9:export function clearTransientSelection(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/selection/helper/clear-transient-selection.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/selection/helper/clear-transient-selection.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/navigation/controller/navigate-tab-controller.ts:12:export async function navigateTabController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/navigation/controller/navigate-tab-controller.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/navigation/controller/navigate-tab-controller.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/navigation/controller/navigate-tab-controller.ts:17:  const route = deriveRouteState({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/navigation/controller/navigate-tab-controller.ts:18:  const ledger = loadLedgerState({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/navigation/controller/navigate-tab-controller.ts:19:  renderTabRegistry({ action_payload: { ...payload, route, ledger }, runtime_state: runtime, data_model: data });
frontend/src/business/navigation/controller/navigate-tab-controller.ts:20:  renderCanvasSurface({ action_payload: { ...payload, route, ledger }, runtime_state: runtime, data_model: data });
backend/src/business/transcription/helper/resolve-transcription-config.ts:9:export function resolveTranscriptionConfig(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/transcription/helper/resolve-transcription-config.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/transcription/helper/resolve-transcription-config.ts:15:  const apiKey = String(payload.openaiApiKey ?? process.env.OPENAI_API_KEY ?? runtime.openaiApiKey ?? settings.openaiApiKey ?? '');
backend/src/business/transcription/helper/resolve-transcription-config.ts:16:  const model = String(payload.transcriptionModel ?? process.env.OPENAI_TRANSCRIPTION_MODEL ?? runtime.transcriptionModel ?? settings.transcriptionModel ?? 'gpt-4o-mini-transcribe');
frontend/test/runtime/ledger-content-refresh.integration.test.ts:9:  const file = resolve(process.cwd(), path);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:11:  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
frontend/src/business/selection/helper/resolve-selection-target.ts:9:export function resolveSelectionTarget(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/selection/helper/resolve-selection-target.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/selection/helper/resolve-selection-target.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/transcription/controller/transcribe-voice-controller.ts:15:export async function transcribeVoiceController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/transcription/controller/transcribe-voice-controller.ts:16:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/transcription/controller/transcribe-voice-controller.ts:19:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/transcription/controller/transcribe-voice-controller.ts:20:  const request = parseHttpRequest({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/transcription/controller/transcribe-voice-controller.ts:22:    ? loadUploadedVoiceAudio({ action_payload: payload, runtime_state: runtime, data_model: data })
backend/src/business/transcription/controller/transcribe-voice-controller.ts:23:    : persistUploadedVoiceAudio({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/transcription/controller/transcribe-voice-controller.ts:24:  const config = resolveTranscriptionConfig({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/transcription/controller/transcribe-voice-controller.ts:28:    transcription = await callOpenaiTranscription({ action_payload: { ...payload, request, config, audioBuffer: upload.audioBuffer ?? payload.audioBuffer, mimeType: upload.mimeType ?? payload.mimeType }, runtime_state: runtime, data_model: data });
backend/src/business/transcription/controller/transcribe-voice-controller.ts:30:      persistTranscribedText({ action_payload: { ...payload, request, config }, runtime_state: runtime, data_model: data });
backend/src/business/transcription/controller/transcribe-voice-controller.ts:37:  sendJsonResponse({ action_payload: { ...payload, status, body }, runtime_state: runtime, data_model: data });
backend/src/business/persistence/effect/write-ledger-json-file.ts:11:export function writeLedgerJsonFile(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
backend/src/business/persistence/effect/write-ledger-json-file.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/transcription/effect/load-uploaded-voice-audio.ts:12:export function loadUploadedVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/transcription/effect/load-uploaded-voice-audio.ts:14:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/transcription/effect/load-uploaded-voice-audio.ts:20:  const uploadRoot = resolve(String(payload.voiceUploadRoot ?? process.env.DECISION_OS_VOICE_UPLOAD_ROOT ?? resolve(blueprintRoot, 'voice-uploads')));
backend/src/business/persistence/helper/validate-ledger-edit-payload.ts:11:export function validateLedgerEditPayload(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/persistence/helper/validate-ledger-edit-payload.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/persistence/helper/validate-ledger-edit-payload.ts:16:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/voice/helper/resolve-voice-session.ts:9:export function resolveVoiceSession(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/voice/helper/resolve-voice-session.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/voice/helper/resolve-voice-session.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/runtime/thread-accent-runtime.integration.test.ts:23:    const target = { dataset: { cardZoneColor: '#1122ee' } } as unknown as HTMLElement;
frontend/test/runtime/thread-accent-runtime.integration.test.ts:49:  assert.match(threadCss, /thread-note\.is-agent[\s\S]*background: transparent/);
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts:13:export async function commitLedgerEditController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts:14:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts:17:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts:18:  const request = parseHttpRequest({ action_payload: payload, runtime_state: runtime, data_model: data });
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts:19:  const validation = validateLedgerEditPayload({ action_payload: { ...payload, request }, runtime_state: runtime, data_model: data });
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts:21:    writeLedgerJsonFile({ action_payload: { ...payload, document: validation.document }, runtime_state: runtime, data_model: data });
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts:22:    writeDecisionOsState({ action_payload: { ...payload, state: { lastEdit: validation.document } }, runtime_state: runtime, data_model: data });
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts:24:  sendJsonResponse({ action_payload: { ...payload, status: validation.ok === false ? 400 : 200, body: validation }, runtime_state: runtime, data_model: data });
frontend/test/runtime/visible-card-quality-refresh.integration.test.ts:43:  assert.match(mediaComponent, /dataset\.mediaPromotionScale/);
frontend/test/runtime/visible-card-quality-refresh.integration.test.ts:66:  assert.match(media, /ledger-card-media-placeholder\[data-media-promotion-key\]/);
frontend/test/runtime/visible-card-quality-refresh.integration.test.ts:83:  assert.doesNotMatch(objectCss, /data-media-overlay-active/);
frontend/test/runtime/visible-card-quality-refresh.integration.test.ts:84:  assert.doesNotMatch(objectCss, /data-quality-promoted/);
frontend/src/business/boot/helper/load-ledger-state.ts:9:export function loadLedgerState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/boot/helper/load-ledger-state.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/boot/helper/load-ledger-state.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/boot/helper/load-ledger-state.ts:17:  const canvas = (payload.canvas && typeof payload.canvas === 'object' ? payload.canvas : data.canvas ?? {}) as AnyRecord;
frontend/src/business/boot/helper/load-ledger-state.ts:18:  return { ok, tabs, canvas, ledger: { ...data, ...payload }, activeCanvasId: payload.activeCanvasId ?? 'main' };
backend/src/business/transcription/effect/persist-uploaded-voice-audio.ts:13:export function persistUploadedVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/transcription/effect/persist-uploaded-voice-audio.ts:15:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/transcription/effect/persist-uploaded-voice-audio.ts:21:  const uploadRoot = resolve(String(payload.voiceUploadRoot ?? process.env.DECISION_OS_VOICE_UPLOAD_ROOT ?? resolve(blueprintRoot, 'voice-uploads')));
frontend/src/business/canvas/helper/calculate-viewport-transform.ts:9:export function calculateViewportTransform(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/canvas/helper/calculate-viewport-transform.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/canvas/helper/calculate-viewport-transform.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/runtime/card-label-chips-style.integration.test.ts:24:  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\)\[data-card-work-status="processing"\] \.ledger-card-overview-status\s*{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*justify-content:\s*center;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--inverse-viewport-scale, 1\)\);/s);
frontend/test/runtime/card-label-chips-style.integration.test.ts:25:  assert.match(canvasLayerCss, /\.canvas\.low-detail \.card:not\(\.detail-visible\)\[data-card-work-status="processing"\] \.ledger-card-overview-status\s*{[^}]*border-color:\s*color-mix\(in srgb, #f4c542, white 18%\);[^}]*background:\s*color-mix\(in srgb, #f4c542, rgba\(3, 4, 5, 0\.94\) 38%\);/s);
frontend/src/business/voice/helper/capture-voice-audio.ts:9:export function captureVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/voice/helper/capture-voice-audio.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/voice/helper/capture-voice-audio.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
backend/src/business/transcription/effect/persist-transcribed-text.ts:11:export function persistTranscribedText(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
backend/src/business/transcription/effect/persist-transcribed-text.ts:13:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/thread/helper/resolve-thread-target.ts:9:export function resolveThreadTarget(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/thread/helper/resolve-thread-target.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/thread/helper/resolve-thread-target.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/voice/effect/fill-thread-draft.ts:9:export function fillThreadDraft(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/voice/effect/fill-thread-draft.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/voice/controller/record-voice-controller.ts:14:export async function recordVoiceController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/voice/controller/record-voice-controller.ts:15:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/voice/controller/record-voice-controller.ts:18:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/voice/controller/record-voice-controller.ts:19:  const session = resolveVoiceSession({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/voice/controller/record-voice-controller.ts:20:  const audio = captureVoiceAudio({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/voice/controller/record-voice-controller.ts:22:    uploadVoiceAudio({ action_payload: { ...payload, session, audio }, runtime_state: runtime, data_model: data });
frontend/src/business/voice/controller/record-voice-controller.ts:23:    requestTranscription({ action_payload: { ...payload, session, audio }, runtime_state: runtime, data_model: data });
frontend/src/business/voice/controller/record-voice-controller.ts:24:    fillThreadDraft({ action_payload: { ...payload, transcription: payload.transcription ?? '' }, runtime_state: runtime, data_model: data });
frontend/src/business/voice/controller/record-voice-controller.ts:26:  renderVoiceStatus({ action_payload: { ...payload, session, audio }, runtime_state: runtime, data_model: data });
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:4:test('specs and data ledger tabs commit canvas mutations through the server ledger endpoint', async () => {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:12:    location: { pathname: '/specs' },
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:37:        dataset: {},
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:59:  for (const activeTab of ['specs', 'data']) {
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:63:      { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:64:      { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:234:    location: { pathname: '/specs' },
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:241:  state.activeTab = 'specs';
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:243:    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:244:    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:246:  state.viewports = { specs: { x: 0, y: 0, scale: 1 } };
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:264:    assert.equal(url, '/decision-os/specs');
frontend/src/business/voice/effect/render-voice-status.ts:9:export function renderVoiceStatus(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/voice/effect/render-voice-status.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts:12:  const specs = source('documentation/specs.json');
frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts:17:  assert.match(specs, /0f6a3e91/);
frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts:18:  assert.match(specs, /2f9a6c8d/);
frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts:32:  (globalThis as any).window = { location: { pathname: '/specs' }, dispatchEvent() {}, __coreTelemetry: [] };
frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts:33:  const specs = source('documentation/specs.json');
frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts:46:  assert.match(specs, /6c2d8e0a/);
backend/src/business/transcription/effect/call-openai-transcription.ts:9:export async function callOpenaiTranscription(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<Record<string, unknown>> {
backend/src/business/transcription/effect/call-openai-transcription.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/runtime/document-title.integration.test.ts:35:    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' },
frontend/src/business/canvas/effect/render-canvas-surface.ts:9:export function renderCanvasSurface(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/canvas/effect/render-canvas-surface.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/boot/controller/boot-surface-controller.ts:13:export async function bootSurfaceController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/boot/controller/boot-surface-controller.ts:14:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/boot/controller/boot-surface-controller.ts:17:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/boot/controller/boot-surface-controller.ts:18:  const route = deriveRouteState({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/boot/controller/boot-surface-controller.ts:19:  const ledger = loadLedgerState({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/boot/controller/boot-surface-controller.ts:20:  clearTransientSelection({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/boot/controller/boot-surface-controller.ts:21:  renderTabRegistry({ action_payload: { ...payload, route, ledger }, runtime_state: runtime, data_model: data });
frontend/src/business/boot/controller/boot-surface-controller.ts:22:  renderCanvasSurface({ action_payload: { ...payload, route, ledger }, runtime_state: runtime, data_model: data });
frontend/src/business/voice/effect/upload-voice-audio.ts:9:export function uploadVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/voice/effect/upload-voice-audio.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/card/helper/parse-card-markdown.ts:9:export function parseCardMarkdown(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/card/helper/parse-card-markdown.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/card/helper/parse-card-markdown.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/card/effect/render-card-layer.ts:9:export function renderCardLayer(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/card/effect/render-card-layer.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
backend/src/business/transcription/effect/clear-uploaded-voice-audio.ts:10:export function clearUploadedVoiceAudio(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
backend/src/business/transcription/effect/clear-uploaded-voice-audio.ts:12:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/runtime/voice-processing-footer.integration.test.ts:2: * WHAT: Runtime coverage for voice processing footer visibility.
frontend/src/business/group/helper/resolve-click-precedence.ts:9:export function resolveClickPrecedence(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/group/helper/resolve-click-precedence.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/group/helper/resolve-click-precedence.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/thread/controller/edit-thread-controller.ts:11:export async function editThreadController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/thread/controller/edit-thread-controller.ts:12:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/thread/controller/edit-thread-controller.ts:15:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/thread/controller/edit-thread-controller.ts:16:  const target = resolveThreadTarget({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/thread/controller/edit-thread-controller.ts:18:    commitLedgerEdit({ action_payload: { ...payload, target }, runtime_state: runtime, data_model: data });
frontend/src/business/thread/controller/edit-thread-controller.ts:20:  renderThreadPanel({ action_payload: { ...payload, target }, runtime_state: runtime, data_model: data });
frontend/test/runtime/drag-release-freeze.integration.test.ts:9:  dataset: Record<string, string>;
frontend/test/runtime/drag-release-freeze.integration.test.ts:37:function fakeElement(dataset: Record<string, string> = {}): FakeElement {
frontend/test/runtime/drag-release-freeze.integration.test.ts:40:    dataset,
frontend/test/runtime/drag-release-freeze.integration.test.ts:106:    location: { pathname: '/specs' },
frontend/test/runtime/drag-release-freeze.integration.test.ts:118:      if (selector === '[data-card-id="card-a"]') return card;
frontend/test/runtime/drag-release-freeze.integration.test.ts:122:      if (selector === '[data-card-id]') return [card];
frontend/test/runtime/drag-release-freeze.integration.test.ts:145:  state.activeTab = 'specs';
frontend/test/runtime/drag-release-freeze.integration.test.ts:146:  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
frontend/src/business/voice/effect/request-transcription.ts:9:export function requestTranscription(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/voice/effect/request-transcription.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/thread/effect/render-thread-panel.ts:9:export function renderThreadPanel(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/thread/effect/render-thread-panel.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/gesture/helper/calculate-drag-delta.ts:9:export function calculateDragDelta(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/gesture/helper/calculate-drag-delta.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/gesture/helper/calculate-drag-delta.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/group/helper/resolve-group-membership.ts:9:export function resolveGroupMembership(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/group/helper/resolve-group-membership.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/group/helper/resolve-group-membership.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/runtime/ledgers-canvas-navigation.integration.test.ts:14:    state.ledgers = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
frontend/test/runtime/ledgers-canvas-navigation.integration.test.ts:17:    assert.equal(routeCanvasMode('/specs'), 'ledger');
frontend/test/runtime/ledgers-canvas-navigation.integration.test.ts:19:    assert.equal(ledgerEndpointForTab('specs'), '/decision-os/ledgers-canvas');
frontend/test/runtime/ledgers-canvas-navigation.integration.test.ts:21:    assert.equal(ledgerEndpointForTab('specs'), '/decision-os/specs');
frontend/test/runtime/ledgers-canvas-navigation.integration.test.ts:31:    dataset: { targetLedgerId: 'ux' }
frontend/test/runtime/ledgers-canvas-navigation.integration.test.ts:34:    closest: (selector: string) => selector === '.card[data-target-ledger-id]' ? card : null
frontend/test/runtime/card-zone-color-ownership.integration.test.ts:13:  const specs = source('documentation/specs.json');
frontend/test/runtime/card-zone-color-ownership.integration.test.ts:25:  assert.match(specs, /5f3a9d2e/);
frontend/test/runtime/card-zone-color-ownership.integration.test.ts:26:  assert.equal(buildZoneAttributionCache({ cards: [card], annotations }, 'specs').cardById.card?.zoneColor, '#eab308');
frontend/test/runtime/card-zone-color-ownership.integration.test.ts:31:  assert.match(cacheRuntime, /dataset\.cardZoneColor/);
frontend/test/runtime/card-zone-color-ownership.integration.test.ts:32:  assert.match(cacheRuntime, /dataset\.cardZoneId/);
frontend/src/business/gesture/helper/derive-gesture-intent.ts:9:export function deriveGestureIntent(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
frontend/src/business/gesture/helper/derive-gesture-intent.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/gesture/helper/derive-gesture-intent.ts:14:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/test/runtime/card-media-carousel-state.integration.test.ts:20:      tabId: 'specs',
frontend/test/runtime/card-media-carousel-state.integration.test.ts:35:      tabId: 'specs',
frontend/test/runtime/card-media-carousel-state.integration.test.ts:42:      tabId: 'specs',
frontend/test/runtime/card-media-carousel-state.integration.test.ts:49:      tabId: 'specs',
frontend/test/runtime/card-media-carousel-state.integration.test.ts:56:      tabId: 'specs',
frontend/test/runtime/card-media-carousel-state.integration.test.ts:63:      tabId: 'specs',
frontend/test/runtime/card-media-carousel-state.integration.test.ts:70:      tabId: 'specs',
frontend/test/runtime/card-markdown-html-embeds.integration.test.ts:25:  assert.doesNotMatch(htmlRenderer, /dataset\.imageSizeId/);
frontend/src/runtime/input/controller/handle-region-color-input.ts:4:  const input = (event.target as HTMLElement | null)?.closest?.('[data-action="edit-zone-color"]') as HTMLInputElement | null;
frontend/src/runtime/input/controller/handle-region-color-input.ts:6:  const zone = input.dataset.zoneId
frontend/src/runtime/input/controller/handle-region-color-input.ts:7:    ? document.querySelector(`[data-zone-id="${CSS.escape(input.dataset.zoneId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-region-color-input.ts:8:    : input.closest('[data-zone-id]') as HTMLElement | null;
frontend/src/runtime/input/controller/handle-region-color-input.ts:13:  const input = (event.target as HTMLElement | null)?.closest?.('[data-action="edit-zone-color"]') as HTMLInputElement | null;
frontend/src/runtime/input/controller/handle-region-color-input.ts:15:  const zone = input.dataset.zoneId
frontend/src/runtime/input/controller/handle-region-color-input.ts:16:    ? document.querySelector(`[data-zone-id="${CSS.escape(input.dataset.zoneId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-region-color-input.ts:17:    : input.closest('[data-zone-id]') as HTMLElement | null;
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:14:export async function handleCanvasGestureController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:15:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:18:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:19:  const intent = deriveGestureIntent({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:20:  const selection = calculateMarqueeSelection({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:21:  const transform = calculateViewportTransform({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:22:  clearTransientSelection({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:23:  const clipboard = copySelectionPayload({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/gesture/controller/handle-canvas-gesture-controller.ts:24:  renderCanvasSurface({ action_payload: { ...payload, intent, selection, transform, clipboard }, runtime_state: runtime, data_model: data });
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:173:      return { className: '', textContent: '', type: '', dataset: {}, append() {}, replaceChildren() {} };
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:261:        dataset: {},
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:323:test('append-voice-note persists voice metadata to the active thread ledger', async () => {
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:354:      return { className: '', textContent: '', type: '', dataset: {}, append() {}, replaceChildren() {} };
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:435:  state.activeTab = 'specs';
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:436:  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:468:    state.activeTab = 'specs';
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:477:  state.activeTab = 'specs';
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:478:  state.ledgerTabs = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
frontend/test/runtime/zone-color-input-preview.integration.test.ts:25:  assert.match(colorEffect, /previewCachedZoneColor\(zone\.dataset\.zoneId, color\)/);
frontend/test/runtime/zone-color-input-preview.integration.test.ts:46:  assert.match(helper, /button,input,textarea,select,\[data-action\],\[data-wheel-capture\],\[contenteditable="true"\]/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:12:test('card markdown inline code and bold styling follow card color specs', () => {
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:13:  const specs = source('documentation/specs.json');
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:17:  assert.match(specs, /f1c7a9d4/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:18:  assert.match(specs, /1e9b7c4f/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:19:  assert.match(specs, /2f9a6c8d/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:20:  assert.match(specs, /8b6e4d2a/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:35:  const specs = source('documentation/specs.json');
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:41:  assert.match(specs, /c4e8b2f9/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:42:  assert.match(specs, /4b7c1d9e/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:43:  assert.match(specs, /7e4b0a2c/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:44:  assert.match(specs, /9d5e0b7a/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:77:  const specs = source('documentation/specs.json');
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:82:  assert.match(specs, /9a7d3c5e/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:92:  const specs = source('documentation/specs.json');
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:95:  assert.match(specs, /3c1d8f6b/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:100:  const specs = source('documentation/specs.json');
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:111:  assert.match(specs, /a6f4c2e1/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:112:  assert.match(specs, /d0b7e3a9/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:113:  assert.match(specs, /e4c1b8f5/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:114:  assert.match(specs, /91f0c6a2/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:115:  assert.match(specs, /b0f6a1c3/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:116:  assert.match(specs, /c6e3b7d1/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:117:  assert.match(specs, /f8d2c4a7/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:118:  assert.match(specs, /6a2d9f0e/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:119:  assert.match(specs, /0d4c8b2f/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:120:  assert.match(specs, /7b0f2e6c/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:121:  assert.match(specs, /1a8d5f7b/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:122:  assert.match(specs, /2e7c9a1d/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:123:  assert.match(specs, /8c4e2b71/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:129:  assert.match(action, /closest\('\.card\[data-card-id\]'\)/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:138:  assert.match(gesture, /\[data-wheel-capture\]/);
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts:155:  assert.match(css, /\.ledger-card-tab-frame\[data-active-card-tab="description"\]\s*{[^}]*overflow:\s*visible;/s);
frontend/src/business/card/controller/edit-card-controller.ts:13:export async function editCardController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/card/controller/edit-card-controller.ts:14:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/card/controller/edit-card-controller.ts:17:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/card/controller/edit-card-controller.ts:18:  const target = resolveSelectionTarget({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/card/controller/edit-card-controller.ts:19:  const delta = calculateDragDelta({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/card/controller/edit-card-controller.ts:20:  const markdown = parseCardMarkdown({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/card/controller/edit-card-controller.ts:21:  commitLedgerEdit({ action_payload: { ...payload, target, delta, markdown }, runtime_state: runtime, data_model: data });
frontend/src/business/card/controller/edit-card-controller.ts:22:  renderCardLayer({ action_payload: { ...payload, target, delta, markdown }, runtime_state: runtime, data_model: data });
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:17:  const specs = source('documentation/specs.json');
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:22:  assert.match(specs, /f0c2d8a9/);
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:23:  assert.match(specs, /d4b9a6c1/);
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:24:  assert.match(css, /\.ledger-card-tab-frame\[data-active-card-tab="description"\]\s*{[^}]*height:\s*auto;[^}]*overflow:\s*visible;/s);
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:25:  assert.match(css, /\.ledger-card-tab-frame\[data-active-card-tab="description"\] \.ledger-card-description-panel\.is-active\s*{[^}]*position:\s*relative;[^}]*inset:\s*auto;/s);
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:30:  assert.match(patchCard, /element\.dataset\.sizeCacheHeight = String\(fixedHeight\);/);
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:35:  assert.match(helper, /target\.closest\('button,\[data-action\]'\)\) return false/);
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:85:      if (selector.includes('[data-action]') && input.command) return this;
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts:87:      if (selector.includes('[data-wheel-capture]')) return input.wheelCapture ?? null;
frontend/test/runtime/canvas-zoom-range.integration.test.ts:10:  const specs = readFileSync(new URL('documentation/specs.json', root), 'utf8');
frontend/test/runtime/canvas-zoom-range.integration.test.ts:15:  assert.match(specs, /down to 0\.03 scale/);
frontend/test/runtime/zone-intersection-performance.integration.test.ts:17:    dataset: input.id ? { cardId: input.id } : { zoneId: 'zone-a' },
frontend/test/runtime/zone-intersection-performance.integration.test.ts:75:      querySelector: (selector: string) => selector === '[data-zone-id="zone-a"]' ? zone : null,
frontend/test/runtime/zone-intersection-performance.integration.test.ts:76:      querySelectorAll: (selector: string) => selector === '.card[data-card-id]' ? [inside, outside] : []
frontend/test/runtime/zone-intersection-performance.integration.test.ts:84:    assert.match(source, /for \(const card of document\.querySelectorAll\('\.card\[data-card-id\]'\)\)/);
frontend/src/business/group/effect/render-group-layer.ts:9:export function renderGroupLayer(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/business/group/effect/render-group-layer.ts:11:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/test/runtime/canvas-pan-performance.integration.test.ts:92:    const zoneEvent = { shiftKey: false, ctrlKey: false, target: { closest: (selector: string) => selector === '[data-zone-id]' ? { dataset: { zoneId: 'zone-a' } } : null } } as unknown as PointerEvent;
frontend/test/runtime/canvas-pan-performance.integration.test.ts:93:    const groupEvent = { shiftKey: false, ctrlKey: false, target: { closest: (selector: string) => selector === '[data-group-id]' ? { dataset: { groupId: 'group-a' } } : null } } as unknown as PointerEvent;
frontend/test/runtime/canvas-pan-performance.integration.test.ts:120:  const specs = source('documentation/specs.json');
frontend/test/runtime/canvas-pan-performance.integration.test.ts:122:  assert.match(specs, /7d2c8b91/);
frontend/test/runtime/canvas-pan-performance.integration.test.ts:246:  assert.doesNotMatch(sync, /querySelectorAll<HTMLElement>\(':scope > \.card\[data-card-id\]'\)/);
frontend/src/runtime/input/controller/handle-keyboard.ts:36:      if (modal.dataset.confirmKind === 'note') {
frontend/src/runtime/input/controller/handle-keyboard.ts:37:        await deleteNoteController({ threadId: modal.dataset.threadId ?? state.threadId, noteId: modal.dataset.noteId ?? '' });
frontend/src/runtime/input/controller/handle-keyboard.ts:38:      } else if (modal.dataset.confirmKind === 'card-image') {
frontend/src/runtime/input/controller/handle-keyboard.ts:40:          cardId: modal.dataset.cardId ?? '',
frontend/src/runtime/input/controller/handle-keyboard.ts:41:          imageSrc: modal.dataset.imageSrc ?? '',
frontend/src/runtime/input/controller/handle-keyboard.ts:42:          carouselSources: modal.dataset.carouselSources,
frontend/src/runtime/input/controller/handle-keyboard.ts:43:          carouselSlideIndex: modal.dataset.carouselSlideIndex
frontend/src/runtime/input/controller/handle-keyboard.ts:45:      } else if (modal.dataset.confirmKind === 'card') {
frontend/src/runtime/input/controller/handle-keyboard.ts:46:        await deleteCardController({ cardId: modal.dataset.cardId ?? '' });
frontend/src/runtime/input/controller/handle-keyboard.ts:47:      } else if (modal.dataset.confirmKind === 'group') {
frontend/src/runtime/input/controller/handle-keyboard.ts:48:        await deleteGroupController({ groupId: modal.dataset.groupId ?? '' });
frontend/test/runtime/input-controller-routing.integration.test.ts:119:  assert.match(terminalComposer, /data-action="thread-file-picker"/);
frontend/test/runtime/input-controller-routing.integration.test.ts:177:  const specsLedger = source('.decision-os/specs.json');
frontend/test/runtime/input-controller-routing.integration.test.ts:185:  assert.match(specsLedger, /"title": "Sidebar collapse state persists locally"/);
frontend/test/runtime/input-controller-routing.integration.test.ts:186:  assert.doesNotMatch(specsLedger, /"id": "b4e9c2d7"[\s\S]{0,260}"comment"/);
frontend/test/runtime/input-controller-routing.integration.test.ts:197:  assert.match(cardDetailRenderer, /edit\.dataset\.action = 'edit-card-title'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:201:  assert.match(controlOverlay, /edit\.dataset\.action = 'edit-card-title'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:202:  assert.match(controlOverlay, /edit\.title = card\.dataset\.targetLedgerId \? 'Edit ledger name' : 'Edit card title'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:203:  assert.match(controlOverlay, /editBody\.dataset\.action = 'edit-card-description'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:205:  assert.match(controlOverlay, /skill\.dataset\.action = 'open-card-skill-modal'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:206:  assert.match(controlOverlay, /skill\.textContent = 'fx'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:208:  assert.match(controlOverlay, /\[skill, renderLedgerCardStatusButton\(cardId, persistedStatus, visibleStatus\), editBody, renderLedgerCardDeleteButton\(cardId\)\]/);
frontend/test/runtime/input-controller-routing.integration.test.ts:215:  const skillModal = source('frontend/src/runtime/codex/effect/render-skill-modal.ts');
frontend/test/runtime/input-controller-routing.integration.test.ts:216:  const cardDetailSkillRunWidget = source('frontend/src/runtime/codex/component/render-card-skill-run-widget.ts');
frontend/test/runtime/input-controller-routing.integration.test.ts:217:  const cardDetailSkillRunPoller = source('frontend/src/runtime/codex/effect/poll-card-skill-run.ts');
frontend/test/runtime/input-controller-routing.integration.test.ts:219:  assert.match(skillModal, /resultsScrollTop/);
frontend/test/runtime/input-controller-routing.integration.test.ts:220:  assert.match(skillModal, /querySelector<HTMLDivElement>\('\.skill-results'\)\?\.scrollTop/);
frontend/test/runtime/input-controller-routing.integration.test.ts:221:  assert.match(skillModal, /className = 'skill-selected-name'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:222:  assert.match(skillModal, /selectedName\.textContent = skillModalState\.selectedSkillName/);
frontend/test/runtime/input-controller-routing.integration.test.ts:223:  assert.match(skillModal, /const codexModelOptions = \['gpt-5\.5', 'gpt-5\.4', 'gpt-5\.3-codex', 'gpt-5\.2-codex', 'gpt-5\.2'\]/);
frontend/test/runtime/input-controller-routing.integration.test.ts:224:  assert.match(skillModal, /const codexEffortOptions = \['low', 'medium', 'high', 'xhigh'\]/);
frontend/test/runtime/input-controller-routing.integration.test.ts:225:  assert.match(skillModal, /className = 'skill-run-controls'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:228:  assert.match(cardDetailSkillRunWidget, /body\.className = 'codex-run-body'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:236:  assert.match(cardDetailSkillRunPoller, /function removeTimer\(element: HTMLElement\): void \{[\s\S]*querySelector\('\[data-codex-run-timer\]'\)\?\.remove\(\);[\s\S]*\}/);
frontend/test/runtime/input-controller-routing.integration.test.ts:242:  assert.match(threadNotes, /codexNoteClass\(note\)/);
frontend/test/runtime/input-controller-routing.integration.test.ts:243:  assert.match(threadNotes, /is-codex-run-event/);
frontend/test/runtime/input-controller-routing.integration.test.ts:250:  assert.match(controlOverlay, /deleteButton\.dataset\.action = 'confirm-delete-group'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:251:  assert.match(controlOverlay, /edit\.dataset\.zoneId = id/);
frontend/test/runtime/input-controller-routing.integration.test.ts:252:  assert.match(controlOverlay, /color\.dataset\.zoneId = id/);
frontend/test/runtime/input-controller-routing.integration.test.ts:260:  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\)\[data-card-work-status="processing"\] \.ledger-card-overview-status\s*{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*justify-content:\s*center;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--inverse-viewport-scale, 1\)\);/s);
frontend/test/runtime/input-controller-routing.integration.test.ts:262:  assert.match(objectsCss, /\.codex-run-widget\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(108px, max-content\);[^}]*min-height:\s*86px;/s);
frontend/test/runtime/input-controller-routing.integration.test.ts:263:  assert.match(objectsCss, /\.codex-run-timer\s*{[^}]*align-self:\s*stretch;[^}]*font-size:\s*30px;[^}]*font-variant-numeric:\s*tabular-nums;/s);
frontend/test/runtime/input-controller-routing.integration.test.ts:264:  assert.match(objectsCss, /\.codex-run-widget\[data-run-status="complete"\]\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*min-height:\s*auto;/s);
frontend/test/runtime/input-controller-routing.integration.test.ts:265:  assert.match(objectsCss, /\.codex-run-widget:not\(\[data-run-status="running"\]\) \.codex-run-timer\s*{[^}]*display:\s*none;/s);
frontend/src/business/group/controller/edit-group-controller.ts:15:export async function editGroupController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
frontend/src/business/group/controller/edit-group-controller.ts:16:  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
frontend/src/business/group/controller/edit-group-controller.ts:19:  const data = (envelope.data_model ?? {}) as AnyRecord;
frontend/src/business/group/controller/edit-group-controller.ts:20:  const tool = resolveToolMode({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/group/controller/edit-group-controller.ts:21:  const target = resolveSelectionTarget({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/group/controller/edit-group-controller.ts:22:  const membership = resolveGroupMembership({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/group/controller/edit-group-controller.ts:23:  const precedence = resolveClickPrecedence({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/group/controller/edit-group-controller.ts:24:  const delta = calculateDragDelta({ action_payload: payload, runtime_state: runtime, data_model: data });
frontend/src/business/group/controller/edit-group-controller.ts:25:  commitLedgerEdit({ action_payload: { ...payload, tool, target, membership, precedence, delta }, runtime_state: runtime, data_model: data });
frontend/src/business/group/controller/edit-group-controller.ts:26:  renderGroupLayer({ action_payload: { ...payload, tool, target, membership, precedence, delta }, runtime_state: runtime, data_model: data });
frontend/src/runtime/state.ts:5:  activeLedgerId: 'specs',
frontend/src/runtime/state.ts:6:  activeTab: 'specs',
frontend/src/runtime/state.ts:8:    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
frontend/src/runtime/state.ts:9:    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
frontend/src/runtime/state.ts:12:    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
frontend/src/runtime/state.ts:13:    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
frontend/src/runtime/state.ts:24:  viewports: { specs: { x: 0, y: 0, scale: 1 }, data: { x: 0, y: 0, scale: 1 } },
frontend/src/runtime/navigation/helper/route-tab.ts:7:  return tabs.includes(tab) ? tab : tabs[0] ?? 'specs';
frontend/src/runtime/zone/helper/cards-intersecting-zone.ts:65:  const zone = document.querySelector(`[data-zone-id="${CSS.escape(zoneId)}"]`) as HTMLElement | null;
frontend/src/runtime/zone/helper/cards-intersecting-zone.ts:69:  for (const card of document.querySelectorAll('.card[data-card-id]')) {
frontend/src/runtime/zone/helper/cards-intersecting-zone.ts:71:    const cardId = element.dataset.cardId;
frontend/src/runtime/persistence/effect/apply-persisted-geometry.ts:12:    const record = source[element.dataset[key] ?? ''];
frontend/src/runtime/gesture/helper/should-capture-wheel-target.ts:8:  if (target.closest('button,[data-action]')) return false;
frontend/src/runtime/gesture/helper/should-capture-wheel-target.ts:10:  const capture = target.closest('[data-wheel-capture]') as HTMLElement | null;
frontend/src/runtime/persistence/helper/snapshot-canvas-region-edits.ts:5:    zones: snapshotRegionEdits('[data-zone-id]', 'zoneId', true),
frontend/src/runtime/persistence/helper/snapshot-canvas-region-edits.ts:6:    groups: snapshotRegionEdits('[data-group-id]', 'groupId', false)
frontend/src/runtime/persistence/helper/snapshot-canvas-region-edits.ts:13:    const id = element.dataset[key] ?? '';
frontend/src/runtime/gesture/helper/is-gesture-control-target.ts:2:  return Boolean((target as HTMLElement | null)?.closest?.('a[href],button,input,textarea,select,[data-action],[data-wheel-capture],[contenteditable="true"]'));
frontend/src/runtime/persistence/effect/hydrate-persisted-geometry.ts:9:  applyPersistedGeometry('[data-card-id]', 'cardId', records.cards, { minWidth: 250, minHeight: 132 });
frontend/src/runtime/persistence/effect/hydrate-persisted-geometry.ts:10:  applyPersistedGeometry('[data-zone-id]', 'zoneId', records.zones, { minWidth: 180, minHeight: 140 });
frontend/src/runtime/persistence/effect/hydrate-persisted-geometry.ts:11:  applyPersistedGeometry('[data-group-id]', 'groupId', records.groups, { minWidth: 220, minHeight: 160 });
frontend/src/runtime/thread/helper/resolve-thread-target-title.ts:9:  const target = threadId ? document.querySelector(`[data-thread-id="${escapedThreadId}"]`) as HTMLElement | null : null;
frontend/src/runtime/input/controller/handle-action-click.ts:34:import { closeCardSkillModal, openCardSkillModal, processSelectedCardSkill, selectCardSkill } from '../../codex/effect/render-skill-modal.js';
frontend/src/runtime/input/controller/handle-action-click.ts:51:  const actionTarget = targetElement.closest('[data-action]') as HTMLElement | null;
frontend/src/runtime/input/controller/handle-action-click.ts:52:  const action = actionTarget?.dataset.action;
frontend/src/runtime/input/controller/handle-action-click.ts:68:    const card = actionTarget.closest('.card[data-card-id]') as HTMLElement | null;
frontend/src/runtime/input/controller/handle-action-click.ts:69:    const tab = actionTarget.dataset.cardTab === 'fields' ? 'fields' : 'description';
frontend/src/runtime/input/controller/handle-action-click.ts:78:    const target = targetElement.closest('[data-card-id],[data-zone-id],[data-group-id]') as HTMLElement | null;
frontend/src/runtime/input/controller/handle-action-click.ts:80:    selectThread(target?.dataset.threadId ?? 'conversation-ledger');
frontend/src/runtime/input/controller/handle-action-click.ts:81:    if (action === 'open-card-thread' && target?.dataset.cardId) selectTarget('card', target.dataset.cardId, false);
frontend/src/runtime/input/controller/handle-action-click.ts:82:    if (action === 'open-zone-thread' && target?.dataset.zoneId) selectTarget('zone', target.dataset.zoneId, false);
frontend/src/runtime/input/controller/handle-action-click.ts:83:    if (target?.dataset.groupId) selectTarget('group', target.dataset.groupId, false);
frontend/src/runtime/input/controller/handle-action-click.ts:98:    await retryVoiceTranscription({ threadId: actionTarget.dataset.threadId ?? state.threadId, noteId: actionTarget.dataset.noteId ?? '', voiceFileRef: actionTarget.dataset.voiceFileRef ?? '' });
frontend/src/runtime/input/controller/handle-action-click.ts:102:    confirmCardDeletionController({ cardId: actionTarget.dataset.cardId ?? '' });
frontend/src/runtime/input/controller/handle-action-click.ts:107:      cardId: actionTarget.dataset.cardId ?? '',
frontend/src/runtime/input/controller/handle-action-click.ts:108:      imageSrc: actionTarget.dataset.imageSrc ?? '',
frontend/src/runtime/input/controller/handle-action-click.ts:109:      carouselSources: actionTarget.dataset.carouselSources,
frontend/src/runtime/input/controller/handle-action-click.ts:110:      carouselSlideIndex: actionTarget.dataset.carouselSlideIndex
frontend/src/runtime/input/controller/handle-action-click.ts:115:    const status = actionTarget.dataset.nextStatus === 'todo' ? 'todo' : 'done';
frontend/src/runtime/input/controller/handle-action-click.ts:116:    await toggleCardStatusController({ cardId: actionTarget.dataset.cardId ?? '', status });
frontend/src/runtime/input/controller/handle-action-click.ts:119:  if (action === 'open-card-skill-modal') {
frontend/src/runtime/input/controller/handle-action-click.ts:120:    await openCardSkillModal(actionTarget.dataset.cardId ?? '');
frontend/src/runtime/input/controller/handle-action-click.ts:123:  if (action === 'select-card-skill') {
frontend/src/runtime/input/controller/handle-action-click.ts:124:    selectCardSkill(actionTarget.dataset.skillName ?? '');
frontend/src/runtime/input/controller/handle-action-click.ts:127:  if (action === 'process-card-skill') {
frontend/src/runtime/input/controller/handle-action-click.ts:128:    await processSelectedCardSkill();
frontend/src/runtime/input/controller/handle-action-click.ts:131:  if (action === 'close-card-skill-modal') {
frontend/src/runtime/input/controller/handle-action-click.ts:136:    const cardId = actionTarget.dataset.cardId ?? '';
frontend/src/runtime/input/controller/handle-action-click.ts:138:      ? document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-action-click.ts:139:      : targetElement.closest('[data-card-id]') as HTMLElement | null;
frontend/src/runtime/input/controller/handle-action-click.ts:144:    const cardId = actionTarget.dataset.cardId ?? '';
frontend/src/runtime/input/controller/handle-action-click.ts:146:      ? document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-action-click.ts:147:      : targetElement.closest('[data-card-id]') as HTMLElement | null;
frontend/src/runtime/input/controller/handle-action-click.ts:152:    await deleteCardController({ cardId: actionTarget.dataset.cardId ?? modal.dataset.cardId ?? '' });
frontend/src/runtime/input/controller/handle-action-click.ts:158:      cardId: actionTarget.dataset.cardId ?? modal.dataset.cardId ?? '',
frontend/src/runtime/input/controller/handle-action-click.ts:159:      imageSrc: actionTarget.dataset.imageSrc ?? modal.dataset.imageSrc ?? '',
frontend/src/runtime/input/controller/handle-action-click.ts:160:      carouselSources: actionTarget.dataset.carouselSources ?? modal.dataset.carouselSources,
frontend/src/runtime/input/controller/handle-action-click.ts:161:      carouselSlideIndex: actionTarget.dataset.carouselSlideIndex ?? modal.dataset.carouselSlideIndex
frontend/src/runtime/input/controller/handle-action-click.ts:167:    confirmGroupDeletionController({ groupId: actionTarget.dataset.groupId ?? '' });
frontend/src/runtime/input/controller/handle-action-click.ts:171:    await deleteGroupController({ groupId: actionTarget.dataset.groupId ?? modal.dataset.groupId ?? '' });
frontend/src/runtime/input/controller/handle-action-click.ts:176:    const zone = actionTarget.dataset.zoneId
frontend/src/runtime/input/controller/handle-action-click.ts:177:      ? document.querySelector(`[data-zone-id="${CSS.escape(actionTarget.dataset.zoneId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-action-click.ts:178:      : actionTarget.dataset.groupId
frontend/src/runtime/input/controller/handle-action-click.ts:179:        ? document.querySelector(`[data-group-id="${CSS.escape(actionTarget.dataset.groupId)}"]`) as HTMLElement | null
frontend/src/runtime/input/controller/handle-action-click.ts:180:        : targetElement.closest('[data-zone-id],[data-group-id]') as HTMLElement | null;
frontend/src/runtime/input/controller/handle-action-click.ts:189:      threadId: actionTarget.dataset.threadId ?? modal.dataset.threadId ?? state.threadId,
frontend/src/runtime/input/controller/handle-action-click.ts:190:      noteId: actionTarget.dataset.noteId ?? modal.dataset.noteId ?? ''
frontend/src/runtime/input/controller/handle-action-click.ts:197:      threadId: actionTarget.dataset.threadId ?? state.threadId,
frontend/src/runtime/input/controller/handle-action-click.ts:198:      noteId: actionTarget.dataset.noteId ?? ''
frontend/src/runtime/persistence/helper/snapshot-elements-geometry.ts:5:      return [element.dataset[key] ?? '', {
frontend/src/runtime/gesture/helper/derive-pointer-intent.ts:17:  const group = (event.target as HTMLElement).closest('[data-group-id]') as HTMLElement | null;
frontend/src/runtime/gesture/helper/derive-pointer-intent.ts:18:  if (targetKind === 'group' && !state.selection.groupIds.includes(group?.dataset.groupId)) return 'pan';
frontend/src/runtime/gesture/helper/derive-pointer-intent.ts:20:  const zone = (event.target as HTMLElement).closest('[data-zone-id]') as HTMLElement | null;
frontend/src/runtime/gesture/helper/derive-pointer-intent.ts:21:  if (targetKind === 'zone' && !state.selection.zoneIds.includes(zone?.dataset.zoneId)) return 'pan';
frontend/src/runtime/group/helper/resolve-group-membership.ts:5:  const group = document.querySelector(`[data-group-id="${groupId}"]`) as HTMLElement | null;
frontend/src/runtime/group/helper/resolve-group-membership.ts:6:  const zoneIds = group ? elementsIntersectingBox(group, '[data-zone-id]', 'zoneId') : [];
frontend/src/runtime/group/helper/resolve-group-membership.ts:7:  const cardIds = group ? elementsIntersectingBox(group, '[data-card-id]', 'cardId') : [];
frontend/src/runtime/persistence/helper/snapshot-canvas-geometry.ts:5:    cards: snapshotElementsGeometry('[data-card-id]', 'cardId'),
frontend/src/runtime/persistence/helper/snapshot-canvas-geometry.ts:6:    zones: snapshotElementsGeometry('[data-zone-id]', 'zoneId'),
frontend/src/runtime/persistence/helper/snapshot-canvas-geometry.ts:7:    groups: snapshotElementsGeometry('[data-group-id]', 'groupId')
frontend/src/runtime/debug/effect/render-canvas-debug-overlay.ts:83:    row('dom cards', String(count(':scope > .card[data-card-id]'))),
frontend/src/runtime/zone/controller/edit-region-controller.ts:6:  if (region?.dataset.zoneId) selectTarget('zone', region.dataset.zoneId, false);
frontend/src/runtime/zone/controller/edit-region-controller.ts:7:  if (region?.dataset.groupId) selectTarget('group', region.dataset.groupId, false);
frontend/src/runtime/zone/controller/edit-region-controller.ts:8:  telemetry('edit-region-controller', { regionId: region?.dataset.zoneId ?? region?.dataset.groupId });
frontend/src/runtime/zone/controller/edit-region-controller.ts:9:  telemetry('open-zone-edit-panel', { regionId: region?.dataset.zoneId ?? region?.dataset.groupId });
frontend/src/runtime/thread/helper/resolve-thread-target-accent.ts:8:  return target.dataset.cardZoneColor
frontend/src/runtime/navigation/effect/render-tab-registry.ts:28:  document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('active', state.canvasMode === 'ledger' && (tab as HTMLElement).dataset.tab === state.activeTab));
frontend/src/runtime/input/effect/bind-inputs.ts:33:  document.querySelectorAll('[data-tool]').forEach((button) => {
frontend/src/runtime/input/effect/bind-inputs.ts:35:      state.activeTool = (button as HTMLElement).dataset.tool;
frontend/src/runtime/input/effect/bind-inputs.ts:45:  document.querySelector('[data-action="zone-color"]')?.addEventListener('input', (event) => {
frontend/src/runtime/input/effect/bind-inputs.ts:51:    const overviewButton = (event.target as HTMLElement).closest('[data-action="open-ledgers-canvas"]') as HTMLElement | null;
frontend/src/runtime/input/effect/bind-inputs.ts:56:    const createButton = (event.target as HTMLElement).closest('[data-action="create-ledger"]') as HTMLElement | null;
frontend/src/runtime/input/effect/bind-inputs.ts:61:    const button = (event.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
frontend/src/runtime/input/effect/bind-inputs.ts:62:    if (!button?.dataset.tab) return;
frontend/src/runtime/input/effect/bind-inputs.ts:65:    state.activeTab = button.dataset.tab;
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:12:  modal.dataset.confirmKind = 'zone';
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:13:  delete modal.dataset.cardId;
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:14:  delete modal.dataset.imageSrc;
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:15:  delete modal.dataset.groupId;
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:16:  delete modal.dataset.threadId;
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:17:  delete modal.dataset.noteId;
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:19:  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:20:  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
frontend/src/runtime/zone/controller/confirm-zone-deletion-controller.ts:23:    confirm.dataset.action = 'confirm-delete';
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:26:  const target = rawTarget.closest('[data-card-id],[data-zone-id],[data-group-id]') as HTMLElement | null;
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:27:  const targetKind = target?.dataset.cardId ? 'card' : target?.dataset.groupId ? 'group' : target?.dataset.zoneId ? 'zone' : 'canvas';
frontend/src/runtime/gesture/controller/handle-pointer-down.ts:28:  const targetId = target?.dataset.cardId ?? target?.dataset.groupId ?? target?.dataset.zoneId ?? '';
frontend/src/runtime/toolbox/effect/render-toolbox.ts:5:  document.querySelectorAll('[data-tool]').forEach((tool) => tool.classList.toggle('active', (tool as HTMLElement).dataset.tool === state.activeTool));
frontend/src/runtime/refresh/controller/refresh-runtime-state.ts:14:  await fetch('/decision-os/data').catch(() => undefined);
frontend/src/runtime/group/effect/create-group-from-rect.ts:20:  group.dataset.groupId = groupId;
frontend/src/runtime/group/effect/create-group-from-rect.ts:21:  group.dataset.threadId = `thread-${groupId}`;
frontend/src/runtime/group/effect/create-group-from-rect.ts:22:  group.dataset.spec = '1d444573 796827d0 4801e6c7 85c81d67 0421d906 dff19657 d9d57c2c 2476bfa1 d2fbfa28 612afeda 8a05ef46 5b918cd3 d4f90f42 abad6dcb f18da923 c271a0df';
frontend/src/runtime/group/effect/delete-selected-groups.ts:14:    groupIds.forEach((id: string) => document.querySelector(`[data-group-id="${id}"]`)?.remove());
frontend/src/runtime/zone/controller/edit-region-color-controller.ts:6:  telemetry('edit-region-color-controller', { zoneId: zone.dataset.zoneId, color });
frontend/src/runtime/zone/controller/edit-region-color-controller.ts:12:  telemetry('preview-region-color-controller', { zoneId: zone.dataset.zoneId, color });
frontend/src/runtime/voice/helper/encode-wav-blob.ts:20:  writeAscii(view, 36, 'data');
frontend/src/runtime/toolbox/effect/apply-rail-collapsed-state.ts:7:  const railToggle = button ?? document.querySelector('[data-action="toggle-rail"]') as HTMLElement | null;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:12:  modal.dataset.confirmKind = 'group';
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:13:  if (input.groupId) modal.dataset.groupId = input.groupId;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:14:  else delete modal.dataset.groupId;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:15:  delete modal.dataset.cardId;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:16:  delete modal.dataset.imageSrc;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:17:  delete modal.dataset.threadId;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:18:  delete modal.dataset.noteId;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:20:  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:21:  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
frontend/src/runtime/group/controller/confirm-group-deletion-controller.ts:24:    confirm.dataset.action = 'delete-group';
frontend/src/runtime/voice/helper/collect-voice-recording-blob.ts:3: * WHY: Stop flow must wait for the browser's last dataavailable chunk before upload.
frontend/src/runtime/zone/effect/begin-zone-label-edit.ts:10:  const regionId = zone.dataset.zoneId ?? zone.dataset.groupId;
frontend/src/runtime/zone/effect/begin-zone-label-edit.ts:11:  const regionKind = zone.dataset.groupId ? 'group' : 'zone';
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:10:  modal.dataset.confirmKind = 'note';
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:11:  delete modal.dataset.cardId;
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:12:  delete modal.dataset.imageSrc;
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:13:  delete modal.dataset.groupId;
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:14:  modal.dataset.threadId = input.threadId;
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:15:  modal.dataset.noteId = input.noteId;
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:17:  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:18:  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
frontend/src/runtime/thread/controller/confirm-note-deletion-controller.ts:21:    confirm.dataset.action = 'delete-note';
frontend/src/runtime/dom.ts:11:export const skillModal = runtimeDocument?.querySelector('.skill-modal') as HTMLDialogElement;
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:16:  const data = String((event as MessageEvent).data ?? '');
frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts:18:    const parsed = JSON.parse(data) as { kind?: unknown };
frontend/src/runtime/card/helper/resolve-card-work-status.ts:3: * WHY: Card chrome needs one status indicator while processing remains derived from thread ownership.
frontend/src/runtime/card/helper/resolve-card-work-status.ts:8:export type CardVisibleWorkStatus = CardPersistedWorkStatus | 'processing';
frontend/src/runtime/card/helper/resolve-card-work-status.ts:26:  if (role === 'operator') return 'processing';
frontend/src/runtime/codex/helper/card-codex-run-id.ts:2: * WHAT: Extracts the Codex run id embedded in a skill output card body.
frontend/src/runtime/codex/helper/card-codex-run-id.ts:8:  const bodyMatch = ledgerCardBody(card).match(/^Codex run:\s*(codex-skill-[^\s]+)/m);
frontend/src/runtime/codex/helper/card-codex-run-id.ts:10:  const idMatch = String(card.id ?? '').match(/^card-(codex-skill-[^\s]+)$/);
frontend/src/runtime/voice/controller/cancel-voice-recording.ts:13:  const processor = state.voice.processor as ScriptProcessorNode | undefined;
frontend/src/runtime/voice/controller/cancel-voice-recording.ts:14:  processor?.disconnect();
frontend/src/runtime/zone/effect/apply-zone-color-edit.ts:15:  if (state.activeLedger && zone.dataset.zoneId) previewCachedZoneColor(zone.dataset.zoneId, color);
frontend/src/runtime/zone/effect/apply-zone-color-edit.ts:18:  telemetry('preview-region-color-edit', { zoneId: zone.dataset.zoneId, color });
frontend/src/runtime/zone/effect/apply-zone-color-edit.ts:23:  if (state.activeLedger && zone.dataset.zoneId) {
frontend/src/runtime/zone/effect/apply-zone-color-edit.ts:24:    void commitActiveLedgerMutation({ action: 'patch-region', region: { id: zone.dataset.zoneId, kind: 'zone', color } }, { render: true });
frontend/src/runtime/zone/effect/apply-zone-color-edit.ts:28:  telemetry('commit-static-surface-edit', { zoneId: zone.dataset.zoneId, color });
frontend/src/runtime/voice/controller/stop-voice-recording.ts:19:  const processor = state.voice.processor as ScriptProcessorNode | undefined;
frontend/src/runtime/voice/controller/stop-voice-recording.ts:20:  processor?.disconnect();
frontend/src/runtime/card/controller/switch-card-tab-controller.ts:6:  const cardId = cardElement.dataset.cardId;
frontend/src/runtime/card/controller/switch-card-tab-controller.ts:15:  cardElement.dataset.activeCardTab = tab;
frontend/src/runtime/card/controller/switch-card-tab-controller.ts:17:  frame?.setAttribute('data-active-card-tab', tab);
frontend/src/runtime/card/controller/switch-card-tab-controller.ts:20:    const isActive = tabButton.dataset.cardTab === tab;
frontend/src/runtime/card/controller/switch-card-tab-controller.ts:26:    panel.classList.toggle('is-active', panel.dataset.cardPanel === tab);
frontend/src/runtime/card/helper/card-has-agent-last-answer.ts:2: * WHAT: Detects whether a card thread's latest note is an agent answer.
frontend/src/runtime/card/helper/card-has-agent-last-answer.ts:3: * WHY: Cards need a compact visual signal when the operator has a fresh agent response.
frontend/src/runtime/card/helper/card-has-agent-last-answer.ts:12:  return role === 'agent' || role === 'assistant';
frontend/src/runtime/codex/effect/request-card-skill-process.ts:2: * WHAT: Starts a backend Codex skill process for one card.
frontend/src/runtime/codex/effect/request-card-skill-process.ts:3: * WHY: The UI should delegate output card creation and process ownership to the server.
frontend/src/runtime/codex/effect/request-card-skill-process.ts:8:  skillName: string;
frontend/src/runtime/codex/effect/request-card-skill-process.ts:9:  codexModel?: string;
frontend/src/runtime/codex/effect/request-card-skill-process.ts:10:  codexEffort?: string;
frontend/src/runtime/codex/effect/request-card-skill-process.ts:14:  const response = await fetch('/api/codex/skills/process', {
frontend/src/runtime/zone/effect/resize-selected-zone.ts:11:  const id = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
frontend/src/runtime/zone/effect/resize-selected-zone.ts:21:  const minWidth = zone.dataset.groupId ? 220 : 180;
frontend/src/runtime/zone/effect/resize-selected-zone.ts:22:  const minHeight = zone.dataset.groupId ? 160 : 140;
frontend/src/runtime/zone/effect/resize-selected-zone.ts:44:  telemetry(zone.dataset.groupId ? 'render-group-layer' : 'render-zone-layer', { resized: id, geometry });
frontend/src/runtime/voice/controller/start-voice-recording.ts:30:    const processor = audioContext.createScriptProcessor(1024, 1, 1);
frontend/src/runtime/voice/controller/start-voice-recording.ts:33:    processor.onaudioprocess = (event) => {
frontend/src/runtime/voice/controller/start-voice-recording.ts:40:    source.connect(processor);
frontend/src/runtime/voice/controller/start-voice-recording.ts:41:    processor.connect(silentGain);
frontend/src/runtime/voice/controller/start-voice-recording.ts:46:    recorder.addEventListener('dataavailable', (event) => {
frontend/src/runtime/voice/controller/start-voice-recording.ts:47:      if (event.data?.size) chunks.push(event.data);
frontend/src/runtime/voice/controller/start-voice-recording.ts:50:    state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, pendingVoicePeak: 0, waveSamples: [], transcriptionStatus: 'recording', threadId, stream, audioContext, analyser, recorder, chunks, mimeType: 'audio/wav', recorderMimeType: recorder.mimeType || 'audio/webm', pcmChunks, sampleRate: audioContext.sampleRate, processor, silentGain, error: '' };
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:10:  modal.dataset.confirmKind = 'card';
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:11:  modal.dataset.cardId = input.cardId;
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:12:  delete modal.dataset.imageSrc;
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:13:  delete modal.dataset.groupId;
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:14:  delete modal.dataset.threadId;
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:15:  delete modal.dataset.noteId;
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:17:  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:18:  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
frontend/src/runtime/card/controller/confirm-card-deletion-controller.ts:21:    confirm.dataset.action = 'delete-card';
frontend/src/runtime/codex/effect/load-codex-skills.ts:2: * WHAT: Loads Codex skill summaries from the backend.
frontend/src/runtime/codex/effect/load-codex-skills.ts:3: * WHY: The skill modal needs server-authoritative names and descriptions.
frontend/src/runtime/codex/effect/load-codex-skills.ts:12:  const response = await fetch('/api/codex/skills').catch(() => undefined);
frontend/src/runtime/codex/effect/load-codex-skills.ts:14:  const body = await response.json().catch(() => null) as { skills?: CodexSkillSummary[] } | null;
frontend/src/runtime/codex/effect/load-codex-skills.ts:15:  return Array.isArray(body?.skills) ? body.skills : [];
frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:7:  const zones = Array.from(content.querySelectorAll(':scope > .zone[data-zone-id], :scope > .zone[data-group-id]')) as HTMLElement[];
frontend/src/runtime/zone/effect/render-zone-label-overlay.ts:17:    label.dataset.zoneLabelFor = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:2: * WHAT: Starts a selected card skill run and refreshes the active canvas.
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:8:import { requestCardSkillProcess } from '../effect/request-card-skill-process.js';
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:10:export async function processCardSkillController(input: { cardId: string; skillName: string; codexModel?: string; codexEffort?: string }): Promise<boolean> {
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:12:  if (!ledgerId || !input.cardId || !input.skillName) return false;
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:13:  telemetry('codex-skill-process-start', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '' });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:14:  const result = await requestCardSkillProcess({ ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel, codexEffort: input.codexEffort });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:16:    telemetry('codex-skill-process-failed', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', error: result.error ?? '' });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:20:  telemetry('codex-skill-process-created-card', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', run: result.run?.id ?? '' });
frontend/src/runtime/ledger/helper/resolve-overview-target-ledger.ts:3:  const card = element?.closest?.('.card[data-target-ledger-id]') as HTMLElement | null;
frontend/src/runtime/ledger/helper/resolve-overview-target-ledger.ts:4:  return String(card?.dataset.targetLedgerId ?? '').trim();
frontend/src/runtime/relationship/helper/connected-card-ids.ts:6:  document.querySelectorAll('[data-relationship-id]').forEach((node) => {
frontend/src/runtime/relationship/helper/connected-card-ids.ts:8:    const source = path.dataset.source ?? '';
frontend/src/runtime/relationship/helper/connected-card-ids.ts:9:    const target = path.dataset.target ?? '';
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:10:  modal.dataset.confirmKind = 'card-image';
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:11:  modal.dataset.cardId = input.cardId;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:12:  modal.dataset.imageSrc = input.imageSrc;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:13:  if (input.carouselSources) modal.dataset.carouselSources = input.carouselSources;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:14:  else delete modal.dataset.carouselSources;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:15:  if (input.carouselSlideIndex) modal.dataset.carouselSlideIndex = input.carouselSlideIndex;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:16:  else delete modal.dataset.carouselSlideIndex;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:17:  delete modal.dataset.groupId;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:18:  delete modal.dataset.threadId;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:19:  delete modal.dataset.noteId;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:21:  const confirm = modal.querySelector('[data-action]') as HTMLButtonElement | null;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:22:  const cancel = modal.querySelector('[data-action="cancel-delete"]') as HTMLButtonElement | null;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:25:    confirm.dataset.action = 'delete-card-image';
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:26:    confirm.dataset.cardId = input.cardId;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:27:    confirm.dataset.imageSrc = input.imageSrc;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:28:    if (input.carouselSources) confirm.dataset.carouselSources = input.carouselSources;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:29:    else delete confirm.dataset.carouselSources;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:30:    if (input.carouselSlideIndex) confirm.dataset.carouselSlideIndex = input.carouselSlideIndex;
frontend/src/runtime/card/controller/confirm-card-image-deletion-controller.ts:31:    else delete confirm.dataset.carouselSlideIndex;
frontend/src/runtime/zone/effect/delete-selected-zones.ts:13:    zoneIds.forEach((id: string) => document.querySelector(`[data-zone-id="${id}"]`)?.remove());
frontend/src/runtime/thread/effect/render-thread-notes.ts:15:function codexNoteClass(note: Record<string, unknown>): string {
frontend/src/runtime/thread/effect/render-thread-notes.ts:16:  const kind = String(note.codexKind ?? '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
frontend/src/runtime/thread/effect/render-thread-notes.ts:17:  return kind ? `is-codex-run-event is-codex-${kind}` : '';
frontend/src/runtime/thread/effect/render-thread-notes.ts:69:    const agentOwned = role === 'agent' || role === 'assistant';
frontend/src/runtime/thread/effect/render-thread-notes.ts:75:    item.className = ['thread-note', note.voiceFileRef ? 'voice-note' : '', note.optimistic ? 'is-optimistic' : '', busy ? 'is-busy' : '', retryable ? 'is-retryable' : '', codexNoteClass(note), agentOwned ? 'is-agent' : 'is-operator'].filter(Boolean).join(' ');
frontend/src/runtime/thread/effect/render-thread-notes.ts:96:    deleteButton.dataset.action = 'confirm-delete-note';
frontend/src/runtime/thread/effect/render-thread-notes.ts:97:    deleteButton.dataset.threadId = state.threadId;
frontend/src/runtime/thread/effect/render-thread-notes.ts:98:    deleteButton.dataset.noteId = noteId;
frontend/src/runtime/thread/effect/render-thread-notes.ts:108:      spinner.textContent = normalizedStatus || 'processing';
frontend/src/runtime/thread/effect/render-thread-notes.ts:115:      retry.dataset.action = 'voice-retry';
frontend/src/runtime/thread/effect/render-thread-notes.ts:116:      retry.dataset.threadId = state.threadId;
frontend/src/runtime/thread/effect/render-thread-notes.ts:117:      retry.dataset.noteId = String(note.id ?? '');
frontend/src/runtime/thread/effect/render-thread-notes.ts:118:      retry.dataset.voiceFileRef = String(note.voiceFileRef ?? '');
frontend/src/runtime/codex/effect/request-card-skill-run-cancel.ts:2: * WHAT: Requests cancellation for one active card-scoped Codex skill run.
frontend/src/runtime/codex/effect/request-card-skill-run-cancel.ts:3: * WHY: The widget stop button must delegate process ownership to the backend.
frontend/src/runtime/codex/effect/request-card-skill-run-cancel.ts:6:  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}/cancel`, {
frontend/src/runtime/card/effect/resize-selected-card.ts:11:  const current = state.activeLedger && card.dataset.cardId
frontend/src/runtime/card/effect/resize-selected-card.ts:12:    ? ledgerCardGeometry(activeLedgerCardMap().get(card.dataset.cardId) ?? {})
frontend/src/runtime/card/effect/resize-selected-card.ts:38:  if (state.activeLedger && card.dataset.cardId) {
frontend/src/runtime/card/effect/resize-selected-card.ts:39:    const ledgerCard = activeLedgerCardMap().get(card.dataset.cardId);
frontend/src/runtime/card/effect/resize-selected-card.ts:45:  telemetry('render-card-layer', { spec: '60000006', resized: card.dataset.cardId, geometry });
frontend/src/runtime/card/effect/resize-selected-card.ts:55:  card.dataset.sizeCacheWidth = String(geometry.width);
frontend/src/runtime/card/effect/resize-selected-card.ts:56:  card.dataset.sizeCacheHeight = String(geometry.height);
frontend/src/runtime/voice/effect/render-voice-dock.ts:11:  if (!('dataset' in dock)) return;
frontend/src/runtime/voice/effect/render-voice-dock.ts:12:  if (dock.dataset.voiceDockMounted !== 'true') {
frontend/src/runtime/voice/effect/render-voice-dock.ts:14:    dock.dataset.voiceDockMounted = 'true';
frontend/src/runtime/zone/effect/create-zone-from-rect.ts:21:  zone.dataset.zoneId = zoneId;
frontend/src/runtime/zone/effect/create-zone-from-rect.ts:22:  zone.dataset.threadId = `thread-${zoneId}`;
frontend/src/runtime/zone/effect/create-zone-from-rect.ts:23:  zone.dataset.spec = '20000002 20000003 20000004 20000006 20000014 20000017';
frontend/src/runtime/thread/effect/apply-thread-accent.ts:16:  const target = threadId ? document.querySelector(`[data-thread-id="${escapedThreadId}"]`) as HTMLElement | null : null;
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:50:    .map((id: string) => document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null)
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:55:  return Array.from(document.querySelectorAll('.card[data-card-id]') as NodeListOf<HTMLElement>)
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:79:    const description = frame.querySelector('[data-card-panel="description"]') as HTMLElement | null;
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:120:  const cardId = card.dataset.cardId ?? '';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:132:  const zoneId = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:150:  card.dataset.sizeCacheWidth = String(geometry.width);
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:151:  card.dataset.sizeCacheHeight = String(geometry.height);
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:158:    .map((id: string) => document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null)
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:168:    const cardId = card.dataset.cardId ?? '';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:177:    const zoneId = zone.dataset.zoneId ?? '';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:187:    const zoneId = zone.dataset.zoneId ?? '';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:191:      const cardId = card.dataset.cardId ?? '';
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:217:  const sourceByCardId = new Map(allCards.map((card) => [card.dataset.cardId ?? '', sourceCardGeometry(card, ledgerCards)]));
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:221:  const restoreForcedDetails = forceCardDetailsForMeasurement(cards.map((card) => card.dataset.cardId ?? ''));
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:225:      const sourceGeometry = sourceByCardId.get(card.dataset.cardId ?? '') ?? sourceCardGeometry(card, ledgerCards);
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:228:        id: card.dataset.cardId ?? '',
frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts:236:    const byId = new Map(cards.map((card) => [card.dataset.cardId ?? '', card]));
frontend/src/runtime/ledger/helper/zone-attribution-cache.ts:96:    delete element.dataset.cardZoneId;
frontend/src/runtime/ledger/helper/zone-attribution-cache.ts:97:    delete element.dataset.cardZoneColor;
frontend/src/runtime/ledger/helper/zone-attribution-cache.ts:103:  element.dataset.cardZoneId = attribution.zoneId;
frontend/src/runtime/ledger/helper/zone-attribution-cache.ts:104:  element.dataset.cardZoneColor = attribution.zoneColor;
frontend/src/runtime/ledger/helper/zone-attribution-cache.ts:131:    const element = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"].ledger-node`) as HTMLElement | null;
frontend/src/runtime/thread/effect/pin-thread-feed-to-last-message.ts:3: * WHY: Opening a card thread should land on the latest operator/agent exchange.
frontend/src/runtime/voice/effect/paint-voice-wave-level.ts:3: * WHY: The voice dock must reflect capture state instead of replaying mock waveform data.
frontend/src/runtime/canvas/effect/render-ledgers-indicator.ts:21:    indicator.dataset.action = 'open-ledgers-canvas';
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:6:import { requestCardSkillRunStatus, type CardSkillRunSummary } from './request-card-skill-run-status.js';
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:7:import { requestCardSkillRunCancel } from './request-card-skill-run-cancel.js';
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:47:  const match = runId.match(/^codex-skill-(\d+)-/);
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:58:  element.querySelector('[data-codex-run-timer]')?.remove();
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:62:  return element.querySelector<HTMLButtonElement>('[data-codex-run-cancel]');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:79:  element.dataset.runStatus = summary.status;
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:80:  setText(element, '[data-codex-run-status]', statusLabel(summary.status));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:85:  setText(element, '[data-codex-run-tools]', String(summary.toolCallCount));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:86:  setText(element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:87:  setText(element, '[data-codex-run-files]', String(summary.fileChangeCount));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:88:  setText(element, '[data-codex-run-latest]', latestEventLabel(summary));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:93:  setText(poller.element, '[data-codex-run-timer]', durationLabel(Date.now() - runStartedAt(poller.runId)));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:158:  setText(poller.element, '[data-codex-run-latest]', 'Cancelling run');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:163:    setText(poller.element, '[data-codex-run-latest]', result.error || 'Cancel failed');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:193:    poller.element.dataset.runStatus = 'unknown';
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:196:    setText(poller.element, '[data-codex-run-status]', 'UNKNOWN');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:197:    setText(poller.element, '[data-codex-run-latest]', summary.error || 'Run unavailable');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:203:  telemetry('codex-skill-run-polled', { runId: poller.runId, status: summary.status, lineCount: summary.lineCount });
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:38:    const selector = zone.variant === 'group' ? `[data-group-id="${CSS.escape(id)}"].ledger-node` : `[data-zone-id="${CSS.escape(id)}"].ledger-node`;
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:45:    const node = patchLedgerCard(card, content.querySelector(`[data-card-id="${CSS.escape(id)}"].ledger-node`) as HTMLElement | null, zoneAttribution?.cardById?.[id]);
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:48:  content.querySelectorAll('.ledger-node[data-zone-id]').forEach((node) => {
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:49:    if (!activeZoneIds.has((node as HTMLElement).dataset.zoneId ?? '')) node.remove();
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:51:  content.querySelectorAll('.ledger-node[data-group-id]').forEach((node) => {
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:52:    if (!activeZoneIds.has((node as HTMLElement).dataset.groupId ?? '')) node.remove();
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:54:  content.querySelectorAll('.ledger-node[data-card-id]').forEach((node) => {
frontend/src/runtime/ledger/effect/render-ledger-surface.ts:55:    if (!activeCardIds.has((node as HTMLElement).dataset.cardId ?? '')) node.remove();
frontend/src/runtime/card/effect/begin-ledger-card-edit.ts:16:  const cardId = cardElement.dataset.cardId;
frontend/src/runtime/card/effect/begin-ledger-card-edit.ts:43:  const cardId = cardElement.dataset.cardId;
frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:2: * WHAT: Requests the derived status for one card-scoped Codex skill run.
frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:27:  agentMessageCount: number;
frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:42:  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}?${params.toString()}`).catch(() => undefined);
frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:43:  if (!response) return { ok: false, status: 'unknown', elapsedMs: 0, lineCount: 0, nextSince: 0, toolCallCount: 0, agentMessageCount: 0, fileChangeCount: 0, thinkingCount: 0, persistedEventCount: 0, latestEvent: null, events: [], error: 'Request failed.' };
frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:52:    agentMessageCount: Number(body.agentMessageCount ?? 0),
frontend/src/runtime/card/effect/render-card-zone-colors.ts:126:  const zones = Array.from(document.querySelectorAll('.regular-zone[data-zone-id]')) as HTMLElement[];
frontend/src/runtime/card/effect/render-card-zone-colors.ts:128:  for (const card of Array.from(document.querySelectorAll('[data-card-id]')) as HTMLElement[]) {
frontend/src/runtime/card/effect/render-card-zone-colors.ts:129:    const ledgerZoneId = card.dataset.cardZoneId ?? '';
frontend/src/runtime/card/effect/render-card-zone-colors.ts:130:    const ledgerZoneColor = card.dataset.cardZoneColor ?? '';
frontend/src/runtime/card/effect/render-card-zone-colors.ts:135:      ? zones.find((zone) => zone.dataset.zoneId === ledgerZoneId)
frontend/src/runtime/card/effect/render-card-zone-colors.ts:142:      card.dataset.cardZoneColor = zoneColor;
frontend/src/runtime/canvas/effect/sync-viewport-card-details.ts:29:  return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null;
frontend/src/runtime/card/effect/sync-ledger-card-tab-frames.ts:6:    const description = frame.querySelector('[data-card-panel="description"]') as HTMLElement | null;
frontend/src/runtime/codex/effect/render-skill-modal.ts:2: * WHAT: Renders and updates the card Codex skill picker modal.
frontend/src/runtime/codex/effect/render-skill-modal.ts:3: * WHY: Operators need searchable skill descriptions before launching a card-scoped process.
frontend/src/runtime/codex/effect/render-skill-modal.ts:5:import { skillModal } from '../../dom.js';
frontend/src/runtime/codex/effect/render-skill-modal.ts:7:import { processCardSkillController } from '../controller/process-card-skill-controller.js';
frontend/src/runtime/codex/effect/render-skill-modal.ts:8:import { loadCodexSkills, type CodexSkillSummary } from './load-codex-skills.js';
frontend/src/runtime/codex/effect/render-skill-modal.ts:14:  codexModel: string;
frontend/src/runtime/codex/effect/render-skill-modal.ts:15:  codexEffort: string;
frontend/src/runtime/codex/effect/render-skill-modal.ts:16:  skills: CodexSkillSummary[];
frontend/src/runtime/codex/effect/render-skill-modal.ts:18:  processing: boolean;
frontend/src/runtime/codex/effect/render-skill-modal.ts:26:const skillModalState: SkillModalState = {
frontend/src/runtime/codex/effect/render-skill-modal.ts:30:  codexModel: 'gpt-5.5',
frontend/src/runtime/codex/effect/render-skill-modal.ts:31:  codexEffort: 'high',
frontend/src/runtime/codex/effect/render-skill-modal.ts:32:  skills: [],
frontend/src/runtime/codex/effect/render-skill-modal.ts:34:  processing: false,
frontend/src/runtime/codex/effect/render-skill-modal.ts:38:const codexModelOptions = ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'];
frontend/src/runtime/codex/effect/render-skill-modal.ts:39:const codexEffortOptions = ['low', 'medium', 'high', 'xhigh'];
frontend/src/runtime/codex/effect/render-skill-modal.ts:48:  label.className = 'skill-run-field';
frontend/src/runtime/codex/effect/render-skill-modal.ts:66:  const query = skillModalState.query.trim().toLowerCase();
frontend/src/runtime/codex/effect/render-skill-modal.ts:67:  if (!query) return skillModalState.skills;
frontend/src/runtime/codex/effect/render-skill-modal.ts:68:  return skillModalState.skills.filter((skill) => {
frontend/src/runtime/codex/effect/render-skill-modal.ts:69:    const text = `${skill.name} ${skill.description} ${skill.source}`.toLowerCase();
frontend/src/runtime/codex/effect/render-skill-modal.ts:74:function renderSkillRow(skill: CodexSkillSummary): HTMLButtonElement {
frontend/src/runtime/codex/effect/render-skill-modal.ts:75:  const selected = skill.name === skillModalState.selectedSkillName;
frontend/src/runtime/codex/effect/render-skill-modal.ts:77:  button.className = `skill-result${selected ? ' is-selected' : ''}`;
frontend/src/runtime/codex/effect/render-skill-modal.ts:79:  button.dataset.action = 'select-card-skill';
frontend/src/runtime/codex/effect/render-skill-modal.ts:80:  button.dataset.skillName = skill.name;
frontend/src/runtime/codex/effect/render-skill-modal.ts:84:  title.className = 'skill-result-name';
frontend/src/runtime/codex/effect/render-skill-modal.ts:85:  title.textContent = skill.name;
frontend/src/runtime/codex/effect/render-skill-modal.ts:87:  source.className = 'skill-result-source';
frontend/src/runtime/codex/effect/render-skill-modal.ts:88:  source.textContent = skill.source;
frontend/src/runtime/codex/effect/render-skill-modal.ts:90:  description.className = 'skill-result-description';
frontend/src/runtime/codex/effect/render-skill-modal.ts:91:  description.textContent = skill.description || 'No description.';
frontend/src/runtime/codex/effect/render-skill-modal.ts:97:  if (!skillModal) return;
frontend/src/runtime/codex/effect/render-skill-modal.ts:99:  title.id = 'skill-modal-title';
frontend/src/runtime/codex/effect/render-skill-modal.ts:103:  search.className = 'skill-search';
frontend/src/runtime/codex/effect/render-skill-modal.ts:105:  search.placeholder = 'Search skills';
frontend/src/runtime/codex/effect/render-skill-modal.ts:106:  search.value = skillModalState.query;
frontend/src/runtime/codex/effect/render-skill-modal.ts:108:  search.setAttribute('aria-label', 'Search skills');
frontend/src/runtime/codex/effect/render-skill-modal.ts:110:    skillModalState.query = search.value;
frontend/src/runtime/codex/effect/render-skill-modal.ts:112:    skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
frontend/src/runtime/codex/effect/render-skill-modal.ts:116:  runControls.className = 'skill-run-controls';
frontend/src/runtime/codex/effect/render-skill-modal.ts:119:    value: skillModalState.codexModel,
frontend/src/runtime/codex/effect/render-skill-modal.ts:120:    options: codexModelOptions,
frontend/src/runtime/codex/effect/render-skill-modal.ts:122:      skillModalState.codexModel = value;
frontend/src/runtime/codex/effect/render-skill-modal.ts:123:      telemetry('codex-skill-model-selected', { cardId: skillModalState.cardId, codexModel: value });
frontend/src/runtime/codex/effect/render-skill-modal.ts:128:    value: skillModalState.codexEffort,
frontend/src/runtime/codex/effect/render-skill-modal.ts:129:    options: codexEffortOptions,
frontend/src/runtime/codex/effect/render-skill-modal.ts:131:      skillModalState.codexEffort = value;
frontend/src/runtime/codex/effect/render-skill-modal.ts:132:      telemetry('codex-skill-effort-selected', { cardId: skillModalState.cardId, codexEffort: value });
frontend/src/runtime/codex/effect/render-skill-modal.ts:138:  results.className = 'skill-results';
frontend/src/runtime/codex/effect/render-skill-modal.ts:139:  if (skillModalState.loading) {
frontend/src/runtime/codex/effect/render-skill-modal.ts:141:    loading.className = 'skill-empty';
frontend/src/runtime/codex/effect/render-skill-modal.ts:142:    loading.textContent = 'Loading skills';
frontend/src/runtime/codex/effect/render-skill-modal.ts:149:      empty.className = 'skill-empty';
frontend/src/runtime/codex/effect/render-skill-modal.ts:150:      empty.textContent = 'No matching skills';
frontend/src/runtime/codex/effect/render-skill-modal.ts:156:  actions.className = 'skill-actions';
frontend/src/runtime/codex/effect/render-skill-modal.ts:157:  if (skillModalState.error) {
frontend/src/runtime/codex/effect/render-skill-modal.ts:159:    error.className = 'skill-error';
frontend/src/runtime/codex/effect/render-skill-modal.ts:160:    error.textContent = skillModalState.error;
frontend/src/runtime/codex/effect/render-skill-modal.ts:163:  if (skillModalState.selectedSkillName) {
frontend/src/runtime/codex/effect/render-skill-modal.ts:165:    selectedName.className = 'skill-selected-name';
frontend/src/runtime/codex/effect/render-skill-modal.ts:166:    selectedName.title = skillModalState.selectedSkillName;
frontend/src/runtime/codex/effect/render-skill-modal.ts:167:    selectedName.textContent = skillModalState.selectedSkillName;
frontend/src/runtime/codex/effect/render-skill-modal.ts:170:    const process = document.createElement('button');
frontend/src/runtime/codex/effect/render-skill-modal.ts:171:    process.className = 'skill-process-button';
frontend/src/runtime/codex/effect/render-skill-modal.ts:172:    process.type = 'button';
frontend/src/runtime/codex/effect/render-skill-modal.ts:173:    process.dataset.action = 'process-card-skill';
frontend/src/runtime/codex/effect/render-skill-modal.ts:174:    process.disabled = skillModalState.processing;
frontend/src/runtime/codex/effect/render-skill-modal.ts:175:    process.textContent = skillModalState.processing ? 'Processing' : 'Process';
frontend/src/runtime/codex/effect/render-skill-modal.ts:176:    actions.append(process);
frontend/src/runtime/codex/effect/render-skill-modal.ts:180:  close.dataset.action = 'close-card-skill-modal';
frontend/src/runtime/codex/effect/render-skill-modal.ts:184:  skillModal.setAttribute('aria-labelledby', 'skill-modal-title');
frontend/src/runtime/codex/effect/render-skill-modal.ts:185:  skillModal.replaceChildren(title, search, runControls, results, actions);
frontend/src/runtime/codex/effect/render-skill-modal.ts:190:  if (!skillModal || !cardId) return;
frontend/src/runtime/codex/effect/render-skill-modal.ts:191:  Object.assign(skillModalState, { cardId, query: '', selectedSkillName: '', skills: [], loading: true, processing: false, error: '' });
frontend/src/runtime/codex/effect/render-skill-modal.ts:193:  skillModal.showModal?.();
frontend/src/runtime/codex/effect/render-skill-modal.ts:194:  telemetry('codex-skill-modal-open', { cardId });
frontend/src/runtime/codex/effect/render-skill-modal.ts:195:  skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
frontend/src/runtime/codex/effect/render-skill-modal.ts:196:  skillModalState.skills = await loadCodexSkills();
frontend/src/runtime/codex/effect/render-skill-modal.ts:197:  skillModalState.loading = false;
frontend/src/runtime/codex/effect/render-skill-modal.ts:199:  skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
frontend/src/runtime/codex/effect/render-skill-modal.ts:202:export function selectCardSkill(skillName: string): void {
frontend/src/runtime/codex/effect/render-skill-modal.ts:203:  const resultsScrollTop = skillModal?.querySelector<HTMLDivElement>('.skill-results')?.scrollTop;
frontend/src/runtime/codex/effect/render-skill-modal.ts:204:  skillModalState.selectedSkillName = skillName;
frontend/src/runtime/codex/effect/render-skill-modal.ts:205:  skillModalState.error = '';
frontend/src/runtime/codex/effect/render-skill-modal.ts:207:  telemetry('codex-skill-selected', { cardId: skillModalState.cardId, skillName });
frontend/src/runtime/codex/effect/render-skill-modal.ts:210:export async function processSelectedCardSkill(): Promise<void> {
frontend/src/runtime/codex/effect/render-skill-modal.ts:211:  if (!skillModalState.cardId || !skillModalState.selectedSkillName || skillModalState.processing) return;
frontend/src/runtime/codex/effect/render-skill-modal.ts:212:  const resultsScrollTop = skillModal?.querySelector<HTMLDivElement>('.skill-results')?.scrollTop;
frontend/src/runtime/codex/effect/render-skill-modal.ts:213:  skillModalState.processing = true;
frontend/src/runtime/codex/effect/render-skill-modal.ts:214:  skillModalState.error = '';
frontend/src/runtime/codex/effect/render-skill-modal.ts:216:  const ok = await processCardSkillController({
frontend/src/runtime/codex/effect/render-skill-modal.ts:217:    cardId: skillModalState.cardId,
frontend/src/runtime/codex/effect/render-skill-modal.ts:218:    skillName: skillModalState.selectedSkillName,
frontend/src/runtime/codex/effect/render-skill-modal.ts:219:    codexModel: skillModalState.codexModel,
frontend/src/runtime/codex/effect/render-skill-modal.ts:220:    codexEffort: skillModalState.codexEffort,
frontend/src/runtime/codex/effect/render-skill-modal.ts:222:  skillModalState.processing = false;
frontend/src/runtime/codex/effect/render-skill-modal.ts:224:    skillModal?.close?.();
frontend/src/runtime/codex/effect/render-skill-modal.ts:227:  skillModalState.error = 'Process failed';
frontend/src/runtime/codex/effect/render-skill-modal.ts:232:  skillModal?.close?.();
frontend/src/runtime/voice/effect/setup-decision-voice-waves.ts:11:    if (panel.dataset.voiceWaveReady === 'true') return;
frontend/src/runtime/voice/effect/setup-decision-voice-waves.ts:15:    panel.dataset.voiceWaveReady = 'true';
frontend/src/runtime/voice/effect/setup-decision-voice-waves.ts:16:    panel.dataset.frontWaveEnabled = 'false';
frontend/src/runtime/card/effect/create-card-from-rect.ts:35:  element.dataset.cardId = cardId;
frontend/src/runtime/card/effect/create-card-from-rect.ts:36:  element.dataset.threadId = `thread-${cardId}`;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:57:  if (control?.dataset.cardId) return { kind: 'card', id: control.dataset.cardId };
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:58:  if (control?.dataset.zoneId) return { kind: 'zone', id: control.dataset.zoneId };
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:59:  if (control?.dataset.groupId) return { kind: 'group', id: control.dataset.groupId };
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:61:  const canvasNode = node?.closest?.('.canvas-content > .card[data-card-id], .canvas-content > .zone[data-zone-id], .canvas-content > .zone[data-group-id]') as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:62:  if (canvasNode?.dataset.cardId) return { kind: 'card', id: canvasNode.dataset.cardId };
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:63:  if (canvasNode?.dataset.zoneId) return { kind: 'zone', id: canvasNode.dataset.zoneId };
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:64:  if (canvasNode?.dataset.groupId) return { kind: 'group', id: canvasNode.dataset.groupId };
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:70:  if (target.kind === 'card') return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:71:  if (target.kind === 'zone') return content.querySelector(`:scope > .zone[data-zone-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:72:  return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:124:  const cardId = card.dataset.cardId ?? '';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:126:  const persistedStatus = card.dataset.cardStatus === 'done' ? 'done' : 'todo';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:127:  const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:128:  const cardZoneColor = card.dataset.cardZoneColor || card.style.getPropertyValue('--card-zone-color').trim();
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:130:  group.dataset.cardId = cardId;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:136:  edit.dataset.action = 'edit-card-title';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:137:  edit.dataset.cardId = cardId;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:138:  edit.title = card.dataset.targetLedgerId ? 'Edit ledger name' : 'Edit card title';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:144:  editBody.dataset.action = 'edit-card-description';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:145:  editBody.dataset.cardId = cardId;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:149:  const skill = document.createElement('button');
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:150:  skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:151:  skill.type = 'button';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:152:  skill.dataset.action = 'open-card-skill-modal';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:153:  skill.dataset.cardId = cardId;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:154:  skill.title = 'Run Codex skill';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:155:  skill.setAttribute('aria-label', skill.title);
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:156:  skill.textContent = 'fx';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:157:  const controls = card.dataset.targetLedgerId
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:159:    : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:165:  const id = kind === 'zone' ? zone.dataset.zoneId ?? '' : zone.dataset.groupId ?? '';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:168:  if (kind === 'zone') group.dataset.zoneId = id;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:169:  else group.dataset.groupId = id;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:174:  edit.dataset.action = 'edit-zone';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:175:  if (kind === 'zone') edit.dataset.zoneId = id;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:176:  else edit.dataset.groupId = id;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:186:    color.dataset.action = 'edit-zone-color';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:187:    color.dataset.zoneId = id;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:195:    deleteButton.dataset.action = 'confirm-delete-group';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:196:    deleteButton.dataset.groupId = id;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:219:    let control = overlay.querySelector(`[data-control-key="${CSS.escape(key)}"]`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:223:      control.dataset.controlKey = key;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:239:    if (!activeKeys.has(control.dataset.controlKey ?? '')) scheduleRemoval(control);
frontend/src/runtime/voice/effect/render-voice-status.ts:42:    document.querySelectorAll('[data-action="voice-cancel"]').forEach((button) => {
frontend/src/runtime/voice/effect/render-voice-status.ts:45:    document.querySelectorAll('[data-action="voice-toggle"]').forEach((button) => {
frontend/src/runtime/selection/effect/render-selection-state.ts:7:  document.querySelectorAll('[data-card-id]').forEach((node) => {
frontend/src/runtime/selection/effect/render-selection-state.ts:9:    element.classList.toggle('selected', state.selection.cardIds.includes(element.dataset.cardId));
frontend/src/runtime/selection/effect/render-selection-state.ts:10:    element.classList.toggle('connected', connectedIds.includes(element.dataset.cardId ?? ''));
frontend/src/runtime/selection/effect/render-selection-state.ts:12:  document.querySelectorAll('[data-zone-id]').forEach((node) => {
frontend/src/runtime/selection/effect/render-selection-state.ts:14:    element.classList.toggle('selected', state.selection.zoneIds.includes(element.dataset.zoneId));
frontend/src/runtime/selection/effect/render-selection-state.ts:16:  document.querySelectorAll('[data-group-id]').forEach((node) => {
frontend/src/runtime/selection/effect/render-selection-state.ts:18:    element.classList.toggle('selected', state.selection.groupIds.includes(element.dataset.groupId));
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:16:    const relationships = Array.from(overlay.querySelectorAll('path[data-relationship-id]')) as SVGPathElement[];
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:29:    relationshipId: path.dataset.relationshipId ?? '',
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:30:    sourceId: path.dataset.source ?? '',
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:31:    targetId: path.dataset.target ?? ''
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:36:    const relationshipId = path.dataset.relationshipId ?? '';
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:37:    const sourceId = path.dataset.source ?? '';
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:38:    const targetId = path.dataset.target ?? '';
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:45:    path.dataset.routeVersion = String(Number(path.dataset.routeVersion ?? '0') + 1);
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:46:    const relationshipLabel = path.dataset.relationshipLabelText || relationshipId;
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:59:    for (const cardId of [path.dataset.source ?? '', path.dataset.target ?? '']) {
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:61:      const element = document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null;
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:68:    relationshipId: path.dataset.relationshipId ?? '',
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:69:    sourceId: path.dataset.source ?? '',
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:70:    targetId: path.dataset.target ?? ''
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:75:    const relationshipId = path.dataset.relationshipId ?? '';
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:76:    const sourceId = path.dataset.source ?? '';
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:77:    const targetId = path.dataset.target ?? '';
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:84:    path.dataset.routeVersion = String(Number(path.dataset.routeVersion ?? '0') + 1);
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:85:    const relationshipLabel = path.dataset.relationshipLabelText || relationshipId;
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:108:  let label = overlay.querySelector(`[data-relationship-label="${labelId}"]`) as SVGTextElement | null;
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:111:    label.dataset.relationshipLabel = labelId;
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:112:    label.dataset.relationshipId = relationshipId;
frontend/src/runtime/relationship/effect/render-relationship-overlay.ts:113:    label.dataset.labelKind = kind;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:159:    '.ledger-card-media-shell, .ledger-card-media-placeholder[data-media-promotion-key]'
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:165:  const promotion = promotedMediaShells.get(node.dataset.mediaPromotionKey ?? '');
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:184:  const changed = placeholder.dataset.mediaPlaceholderWidth !== nextWidth
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:185:    || placeholder.dataset.mediaPlaceholderAspectRatio !== nextAspectRatio;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:187:  placeholder.dataset.mediaPlaceholderWidth = nextWidth;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:188:  placeholder.dataset.mediaPlaceholderAspectRatio = nextAspectRatio;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:195:  const configured = Number(placeholder.dataset.mediaPlaceholderWidth);
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:206:  const scale = Number(promotion.shell.dataset.mediaPromotionScale);
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:255:    delete promotion.shell.dataset.mediaPromoted;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:256:    delete promotion.shell.dataset.mediaPromotionKey;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:257:    delete promotion.shell.dataset.mediaPromotionScale;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:258:    delete promotion.shell.dataset.mediaLocalMaxWidth;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:308:  return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(cardId)}"].ledger-node`) as HTMLElement | null;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:321:  return cardElement.dataset.cardZoneColor
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:329:  placeholder.dataset.mediaPromotionKey = key;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:359:    shell.dataset.mediaPromoted = 'true';
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:360:    shell.dataset.mediaPromotionKey = key;
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:385:    promotion.shell.dataset.mediaPromotionScale = String(promotionScale);
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:386:    promotion.shell.dataset.mediaLocalMaxWidth = String(localMediaMaxWidth(promotion));
frontend/src/runtime/canvas/effect/render-canvas-media-overlay.ts:445:        const promotion = promotedMediaShells.get(slotNode.dataset.mediaPromotionKey ?? '');
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:2: * WHAT: Renders the live status widget for a Codex skill output card.
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:6:import { cardCodexRunId } from '../helper/card-codex-run-id.js';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:7:import { bindCardSkillRunWidget } from '../effect/poll-card-skill-run.js';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:11:  item.className = 'codex-run-metric';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:13:  name.className = 'codex-run-metric-label';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:16:  count.dataset[key] = '';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:29:  widget.className = 'codex-run-widget';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:30:  widget.dataset.runId = runId;
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:31:  widget.dataset.runStatus = 'running';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:34:  body.className = 'codex-run-body';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:37:  header.className = 'codex-run-header';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:39:  status.className = 'codex-run-status';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:40:  status.dataset.codexRunStatus = '';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:44:  cancel.className = 'codex-run-cancel terminal-button terminal-button--stop terminal-button--compact';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:45:  cancel.dataset.codexRunCancel = '';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:52:  timer.className = 'codex-run-timer';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:53:  timer.dataset.codexRunTimer = '';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:57:  metrics.className = 'codex-run-metrics';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:59:    metric('Tools', '0', 'codexRunTools'),
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:60:    metric('Text', '0', 'codexRunMessages'),
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:61:    metric('Files', '0', 'codexRunFiles')
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:65:  latest.className = 'codex-run-latest';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:66:  latest.dataset.codexRunLatest = '';
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:51:    let path = overlay.querySelector(`[data-relationship-id="${id}"]`) as SVGPathElement | null;
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:56:    path.dataset.relationshipId = id;
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:57:    path.dataset.source = String(relationship.from ?? relationship.source ?? '');
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:58:    path.dataset.target = String(relationship.to ?? relationship.target ?? '');
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:59:    path.dataset.relationshipLabelText = String(relationship.label ?? '');
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:65:      let label = overlay.querySelector(`[data-relationship-label="${labelId}"]`) as SVGTextElement | null;
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:70:      label.dataset.relationshipLabel = labelId;
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:71:      label.dataset.relationshipId = id;
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:72:      label.dataset.labelKind = kind;
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:78:  overlay.querySelectorAll('path[data-relationship-id]').forEach((node) => {
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:79:    if (!activeRelationshipIds.has((node as SVGPathElement).dataset.relationshipId ?? '')) node.remove();
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:81:  overlay.querySelectorAll('[data-relationship-label]').forEach((node) => {
frontend/src/runtime/relationship/component/create-ledger-relationship-overlay.ts:82:    if (!activeLabelIds.has((node as SVGTextElement).dataset.relationshipLabel ?? '')) node.remove();
frontend/src/runtime/ledger/component/render-ledger-card-tab-frame.ts:13:  frame.dataset.activeCardTab = activeTab;
frontend/src/runtime/ledger/component/render-ledger-card-tab-frame.ts:14:  frame.dataset.spec = 'd0b7e3a9 e4c1b8f5 c6e3b7d1';
frontend/src/runtime/ledger/component/render-ledger-card-tab-frame.ts:15:  frame.dataset.wheelCapture = 'true';
frontend/src/runtime/ledger/component/render-ledger-card-tab-frame.ts:20:  description.dataset.cardPanel = 'description';
frontend/src/runtime/ledger/component/render-ledger-card-tab-frame.ts:25:  fieldPanel.dataset.cardPanel = 'fields';
frontend/src/runtime/selection/helper/elements-intersecting-box.ts:8:    .map((node) => (node as HTMLElement).dataset[key])
frontend/src/runtime/selection/helper/elements-intersecting-canvas-rect.ts:13:    .map((node) => (node as HTMLElement).dataset[key])
frontend/src/runtime/selection/effect/move-selected.ts:31:    patchNodePosition(document.querySelector(`[data-card-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
frontend/src/runtime/selection/effect/move-selected.ts:38:    patchNodePosition(document.querySelector(`[data-zone-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
frontend/src/runtime/selection/effect/move-selected.ts:45:    patchNodePosition(document.querySelector(`[data-group-id="${CSS.escape(id)}"]`) as HTMLElement | null, geometry.x + dx, geometry.y + dy);
frontend/src/runtime/selection/effect/move-selected.ts:51:    ...state.selection.cardIds.map((id: string) => document.querySelector(`[data-card-id="${id}"]`)),
frontend/src/runtime/selection/effect/move-selected.ts:52:    ...state.selection.zoneIds.map((id: string) => document.querySelector(`[data-zone-id="${id}"]`)),
frontend/src/runtime/selection/effect/move-selected.ts:53:    ...state.selection.groupIds.map((id: string) => document.querySelector(`[data-group-id="${id}"]`))
frontend/src/runtime/selection/effect/select-intersecting.ts:8:  state.selection.cardIds = elementsIntersectingCanvasRect(rect, '[data-card-id]', 'cardId');
frontend/src/runtime/selection/effect/select-intersecting.ts:9:  state.selection.zoneIds = elementsIntersectingCanvasRect(rect, '[data-zone-id]', 'zoneId');
frontend/src/runtime/selection/effect/select-intersecting.ts:10:  state.selection.groupIds = elementsIntersectingCanvasRect(rect, '[data-group-id]', 'groupId');
frontend/src/runtime/card/component/create-card-resize-handles.ts:5:    handle.dataset.spec = '60000006';
frontend/src/runtime/ledger/component/patch-ledger-zone.ts:9:  delete element.dataset.groupId;
frontend/src/runtime/ledger/component/patch-ledger-zone.ts:10:  delete element.dataset.zoneId;
frontend/src/runtime/ledger/component/patch-ledger-zone.ts:11:  if (isGroup) element.dataset.groupId = id;
frontend/src/runtime/ledger/component/patch-ledger-zone.ts:12:  else element.dataset.zoneId = id;
frontend/src/runtime/ledger/component/patch-ledger-zone.ts:13:  element.dataset.threadId = `thread-${id}`;
frontend/src/runtime/ledger/component/patch-ledger-zone.ts:14:  element.dataset.ledgerNode = 'zone';
frontend/src/runtime/ledger/component/render-ledger-card-code-block.ts:7:  if (block.language) pre.dataset.language = block.language;
frontend/src/runtime/ledger/component/render-ledger-card-delete-button.ts:9:  button.dataset.action = 'confirm-delete-card';
frontend/src/runtime/ledger/component/render-ledger-card-delete-button.ts:10:  button.dataset.cardId = cardId;
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:8:  button.dataset.action = 'toggle-card-status';
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:9:  button.dataset.cardId = cardId;
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:10:  button.dataset.cardCurrentStatus = visibleStatus;
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:11:  button.dataset.cardPersistedStatus = persistedStatus;
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:12:  button.dataset.nextStatus = nextStatus;
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:13:  button.disabled = visibleStatus === 'processing';
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:14:  button.title = button.disabled ? 'Current status: processing. Waiting for agent response' : `Current status: ${visibleStatus}. Mark card ${nextStatus}`;
frontend/src/runtime/ledger/component/append-title-text.ts:9:  delete parent.dataset.titleHeading;
frontend/src/runtime/ledger/component/append-title-text.ts:10:  if (heading) parent.dataset.titleHeading = String(heading[1].length);
frontend/src/runtime/ledger/component/patch-ledger-card.ts:34:  element.dataset.cardId = id;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:35:  if (cardType) element.dataset.cardType = cardType;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:36:  else delete element.dataset.cardType;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:37:  if (targetLedgerId) element.dataset.targetLedgerId = targetLedgerId;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:38:  else delete element.dataset.targetLedgerId;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:39:  element.dataset.activeCardTab = activeTab;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:40:  element.dataset.threadId = `thread-${id}`;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:41:  element.dataset.ledgerNode = 'card';
frontend/src/runtime/ledger/component/patch-ledger-card.ts:42:  element.dataset.cardStatus = persistedStatus;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:43:  element.dataset.cardWorkStatus = visibleStatus;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:44:  delete element.dataset.agentLastAnswer;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:45:  if (labels.length > 0) element.dataset.cardLabels = labels.join(',');
frontend/src/runtime/ledger/component/patch-ledger-card.ts:46:  else delete element.dataset.cardLabels;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:58:  element.dataset.sizeCacheWidth = String(width);
frontend/src/runtime/ledger/component/patch-ledger-card.ts:59:  element.dataset.sizeCacheHeight = String(fixedHeight);
frontend/src/runtime/voice/component/control-dock.ts:10:      <button class="terminal-button terminal-button--stop terminal-button--stack" type="button" data-action="voice-cancel" disabled><span class="terminal-button__key">Esc</span><span class="terminal-button__glyph">&#9632;</span><span class="terminal-button__label">STOP</span></button>
frontend/src/runtime/voice/component/control-dock.ts:13:      <button class="terminal-button terminal-button--send terminal-button--stack" type="button" data-action="voice-toggle"><span class="terminal-button__key">X</span><span class="terminal-button__glyph">&#10095;</span><span class="terminal-button__label">REC</span></button>
frontend/src/runtime/voice/component/voice-dock-surface.ts:10:    <section class="voice-style-surface" data-voice-style-surface>
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:6:import { renderCardSkillRunWidget } from '../../codex/component/render-card-skill-run-widget.js';
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:32:  edit.dataset.action = 'edit-card-title';
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:33:  edit.dataset.cardId = id;
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:50:  statusIndicator.dataset.spec = 'c4e8b91a';
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:89:  const codexRunWidget = renderCardSkillRunWidget(card);
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:92:  detailLayer.replaceChildren(...(linkedLedgerCard ? [] : [createCardStatusIndicator(visibleStatus)]), ...labelNodes, createLedgerCardTitleRow(card, id), ...(codexRunWidget ? [codexRunWidget] : []), ...tabs, body);
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:67:  const promotedMaxWidth = Number(element.dataset.mediaLocalMaxWidth);
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:97:    const promotionScale = Number(element.dataset.mediaPromotionScale);
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:131:    const noteMax = note?.classList.contains('is-agent') ? Math.min(listWidth * 0.92, 640) : Math.min(listWidth * 0.86, 520);
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:231:  button.dataset.imageSrc = image.src;
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:232:  button.dataset.carouselSlideIndex = String(index);
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:233:  button.dataset.carouselSources = JSON.stringify(images.map((entry) => entry.src));
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:243:  deleteButton.dataset.action = 'confirm-delete-card-image';
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:244:  deleteButton.dataset.cardId = options.cardId;
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:273:    const active = button.dataset.slideIndex === String(index);
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:341:  button.dataset.slideIndex = String(index);
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:342:  button.dataset.imageSrc = image.src;
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:362:  shell.dataset.ledgerCardMedia = 'true';
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:363:  shell.dataset.wheelCapture = 'true';
frontend/src/runtime/ledger/component/render-ledger-card-media.ts:365:  shell.dataset.imageSizeId = sizeSource;
frontend/src/runtime/ledger/component/append-inline-nodes.ts:83:      frame.dataset.ledgerCardMedia = 'true';
frontend/src/runtime/ledger/component/append-inline-nodes.ts:84:      frame.dataset.imageSizeId = node.src;
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:4:  tabs.dataset.spec = 'a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7';
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:10:    tab.dataset.action = 'switch-card-tab';
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:11:    tab.dataset.cardTab = tabId;
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:12:    tab.dataset.cardId = cardId;
frontend/src/runtime/voice/component/terminal-composer.ts:13:          <button class="terminal-button terminal-button--attach terminal-button--compact" type="button" data-action="thread-file-picker" title="Upload files"><span class="terminal-button__key">+</span><span class="terminal-button__label">FILE</span></button>
frontend/src/runtime/voice/component/terminal-composer.ts:14:          <button class="terminal-button terminal-button--record terminal-button--compact" type="button" data-action="voice-toggle"><span class="terminal-button__key">X</span><span class="terminal-button__label">REC</span></button>
frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts:91:    const active = button.dataset.slideIndex === String(index);
frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts:159:  button.dataset.slideIndex = String(index);
frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts:160:  button.dataset.htmlSrc = embed.src;
frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts:304:  shell.dataset.ledgerCardMedia = 'true';
frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts:305:  shell.dataset.wheelCapture = 'true';
frontend/src/runtime/ledger/component/render-ledger-card-labels.ts:4:  wrapper.dataset.spec = 'aa42ff94';
frontend/src/runtime/boot/controller/boot-surface.ts:29:  telemetry('map-spec-implementation-surface', { specs: SPEC_IMPLEMENTATION_SURFACE.length });
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-9","timestamp":"2026-07-07T17:00:47.700Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"9","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_4","codexTool":"/usr/bin/zsh -lc \"rg --files frontend backend | sed -n '1,240p'\""} -->

**Tool call** `/usr/bin/zsh -lc "rg --files frontend backend | sed -n '1,240p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-10","timestamp":"2026-07-07T17:00:47.701Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"10","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_4","codexTool":"/usr/bin/zsh -lc \"rg --files frontend backend | sed -n '1,240p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg --files frontend backend | sed -n '1,240p'"`
Status: completed
Exit code: 0

````text
backend/package.json
backend/README.md
frontend/package.json
backend/tsconfig.json
frontend/index.html
backend/package-lock.json
frontend/README.md
backend/test/codex/start-card-skill-process-controller.test.ts
backend/test/codex/scan-codex-skills.test.ts
backend/test/codex/read-card-skill-run-controller.test.ts
backend/test/codex/resolve-codex-command.test.ts
backend/generated/test-results.json
backend/generated/report-config.json
backend/generated/dependency-graph.json
frontend/test/zone/zone-model.integration.test.ts
frontend/test/zone/zone-lifecycle.integration.test.ts
frontend/test/selection/selection-tool-safety.integration.test.ts
backend/test/refresh/server-refresh.integration.test.ts
frontend/test/thread/thread-and-selection-actions.integration.test.ts
backend/test/unit/routing/helper/parse-http-request.test.ts
backend/test/unit/routing/helper/resolve-ledger-route.test.ts
backend/test/routing/server-ledger-routing.integration.test.ts
backend/test/unit/routing/controller/dispatch-route-controller.test.ts
backend/test/ledger/decision-os-default-tabs.integration.test.ts
backend/test/unit/routing/effect/send-json-response.test.ts
backend/test/server/decision-os-ledgers-canvas.integration.test.ts
backend/test/server/decision-os-zone-mutations.integration.test.ts
backend/test/server/front-back-stack-contracts.integration.test.ts
backend/test/server/decision-os-ledger-create.integration.test.ts
backend/test/server/decision-os-content-files.integration.test.ts
frontend/test/unit/zone/helper/resolve-zone-selection-membership.test.ts
backend/src/business/codex/helper/build-card-skill-prompt.ts
backend/src/business/codex/helper/resolve-codex-command.ts
frontend/test/unit/zone/helper/validate-zone-draft.test.ts
backend/src/business/codex/helper/scan-codex-skills.ts
frontend/test/unit/zone/helper/confirm-zone-deletion.test.ts
frontend/test/unit/zone/helper/calculate-zone-geometry.test.ts
backend/test/unit/persistence/helper/validate-ledger-edit-payload.test.ts
backend/test/unit/ledger/helper/read-ledger-json-file.test.ts
backend/test/unit/ledger/helper/read-decision-os-state.test.ts
backend/test/unit/ledger/helper/validate-ledger-document.test.ts
backend/test/unit/ledger/helper/card-content-file-delete-image.test.ts
frontend/test/unit/zone/controller/edit-zone-controller.test.ts
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts
backend/src/business/codex/controller/read-card-skill-run-controller.ts
backend/src/business/codex/controller/start-card-skill-process-controller.ts
backend/test/unit/refresh/helper/watch-ledger-directory.test.ts
backend/test/unit/refresh/helper/debounce-refresh-event.test.ts
backend/test/unit/server/helper/resolve-decision-os-root.test.ts
backend/test/unit/ledger/controller/load-tab-ledgers-controller.test.ts
frontend/test/unit/zone/effect/render-zone-layer.test.ts
backend/test/unit/server/helper/create-http-server.test.ts
backend/test/unit/server/helper/read-decision-os-settings.test.ts
backend/test/unit/persistence/controller/commit-ledger-edit-controller.test.ts
backend/test/unit/server/controller/start-http-server-controller.test.ts
backend/test/unit/ledger/effect/write-decision-os-state.test.ts
backend/src/business/routing/helper/parse-http-request.ts
backend/src/business/routing/helper/resolve-ledger-route.ts
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts
frontend/test/unit/navigation/helper/derive-route-state.test.ts
backend/test/unit/refresh/controller/publish-server-refresh-controller.test.ts
backend/test/unit/persistence/effect/write-ledger-json-file.test.ts
backend/src/business/routing/controller/dispatch-route-controller.ts
frontend/test/unit/selection/helper/copy-selection-payload.test.ts
frontend/test/unit/selection/helper/selection-includes-target.test.ts
frontend/test/unit/selection/helper/elements-intersecting-canvas-rect.test.ts
frontend/test/unit/selection/helper/clear-transient-selection.test.ts
frontend/test/unit/selection/helper/resolve-selection-target.test.ts
frontend/test/unit/selection/helper/calculate-marquee-selection.test.ts
backend/test/unit/transcription/effect/call-openai-transcription.test.ts
backend/test/unit/transcription/effect/persist-uploaded-voice-audio.test.ts
backend/test/unit/transcription/effect/load-uploaded-voice-audio.test.ts
backend/test/unit/transcription/effect/persist-transcribed-text.test.ts
backend/test/unit/transcription/effect/clear-uploaded-voice-audio.test.ts
backend/test/unit/transcription/controller/transcribe-voice-controller.test.ts
backend/src/business/routing/effect/send-json-response.ts
frontend/test/unit/navigation/controller/navigate-tab-controller.test.ts
backend/test/unit/refresh/effect/publish-refresh-event.test.ts
frontend/test/unit/group/helper/resolve-group-membership.test.ts
frontend/test/unit/group/helper/resolve-click-precedence.test.ts
frontend/package-lock.json
backend/src/business/transcription/helper/resolve-transcription-config.ts
frontend/test/unit/thread/helper/resolve-thread-target.test.ts
frontend/test/refresh/client-refresh.integration.test.ts
frontend/test/unit/group/controller/edit-group-controller.test.ts
frontend/test/unit/navigation/effect/render-tab-registry.test.ts
frontend/test/unit/thread/controller/edit-thread-controller.test.ts
backend/src/business/transcription/controller/transcribe-voice-controller.ts
frontend/test/relationship/relationship-rendering.integration.test.ts
frontend/test/unit/group/effect/render-group-layer.test.ts
frontend/test/runtime/selection-direct-card-click.integration.test.ts
frontend/test/runtime/card-markdown-zoom-editing.integration.test.ts
frontend/test/unit/thread/effect/render-thread-panel.test.ts
frontend/test/runtime/zone-label-overlay.integration.test.ts
frontend/test/runtime/card-zone-color-ownership.integration.test.ts
frontend/test/runtime/voice-transcription-runtime.integration.test.ts
frontend/test/runtime/card-markdown-html-embeds.integration.test.ts
backend/src/business/transcription/effect/load-uploaded-voice-audio.ts
backend/src/business/transcription/effect/persist-uploaded-voice-audio.ts
backend/src/business/transcription/effect/persist-transcribed-text.ts
backend/src/business/transcription/effect/call-openai-transcription.ts
backend/src/business/transcription/effect/clear-uploaded-voice-audio.ts
backend/src/business/ledger/helper/apply-ledger-mutation.ts
backend/src/business/ledger/helper/relationship-references-card.ts
backend/src/business/ledger/helper/read-decision-os-state.ts
backend/src/business/ledger/helper/delete-linked-ledger.ts
backend/src/business/ledger/helper/normalize-decision-os-state.ts
backend/src/business/ledger/helper/rename-linked-ledger.ts
backend/src/business/ledger/helper/card-content-file.ts
backend/src/business/ledger/helper/read-ledger-json-file.ts
backend/src/business/ledger/helper/thread-content-file.ts
backend/src/business/ledger/helper/ledger-slug.ts
backend/src/business/ledger/helper/validate-ledger-document.ts
backend/src/business/ledger/helper/create-linked-ledger.ts
backend/src/business/ledger/helper/ensure-ledgers-canvas-document.ts
backend/src/business/ledger/helper/read-canonical-decision-os-state.ts
frontend/test/navigation/navigation-tab-switch.integration.test.ts
frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts
frontend/test/unit/ledger/helper/zone-attribution-cache.test.ts
backend/src/business/ledger/controller/load-tab-ledgers-controller.ts
frontend/test/unit/voice/helper/resolve-voice-session.test.ts
frontend/test/unit/voice/helper/capture-voice-audio.test.ts
frontend/test/unit/canvas/helper/calculate-viewport-transform.test.ts
frontend/test/voice/voice-thread.integration.test.ts
frontend/test/runtime/ledger-card-markdown-rendering.integration.test.ts
frontend/test/runtime/card-work-status-rendering.integration.test.ts
frontend/test/runtime/card-markdown-images.integration.test.ts
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts
frontend/test/runtime/codex-skill-request.integration.test.ts
frontend/test/runtime/zoom-detail-and-zone-controls.integration.test.ts
frontend/test/runtime/voice-processing-footer.integration.test.ts
frontend/test/runtime/keyboard-card-resize-shortcut.integration.test.ts
frontend/test/runtime/ledgers-canvas-navigation.integration.test.ts
frontend/test/runtime/zone-color-input-preview.integration.test.ts
frontend/test/runtime/real-ledger-tabs.integration.test.ts
frontend/test/runtime/zone-intersection-performance.integration.test.ts
frontend/test/runtime/thread-selection-runtime.integration.test.ts
frontend/test/runtime/canvas-pan-performance.integration.test.ts
frontend/test/runtime/card-tab-wheel-layout.integration.test.ts
frontend/test/runtime/relationship-ledger-geometry-performance.integration.test.ts
frontend/test/runtime/input-controller-routing.integration.test.ts
frontend/src/business/zone/helper/resolve-zone-selection-membership.ts
frontend/test/runtime/canvas-zoom-range.integration.test.ts
frontend/test/runtime/ledger-content-refresh.integration.test.ts
frontend/test/runtime/visible-card-quality-refresh.integration.test.ts
frontend/test/runtime/thread-accent-runtime.integration.test.ts
frontend/src/business/zone/helper/confirm-zone-deletion.ts
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts
frontend/test/runtime/card-label-chips-style.integration.test.ts
frontend/src/business/zone/helper/calculate-zone-geometry.ts
frontend/test/runtime/relationship-label-color-and-margin.integration.test.ts
frontend/test/runtime/document-title.integration.test.ts
frontend/src/business/zone/helper/validate-zone-draft.ts
frontend/test/runtime/drag-release-freeze.integration.test.ts
frontend/test/runtime/card-media-carousel-state.integration.test.ts
frontend/test/runtime/voice-wave-accumulation.integration.test.ts
backend/src/business/server/helper/read-decision-os-settings.ts
backend/src/business/server/helper/resolve-decision-os-root.ts
backend/src/business/server/helper/read-request-buffer.ts
backend/src/business/server/helper/create-http-server.ts
backend/src/business/ledger/effect/write-decision-os-state.ts
backend/src/business/server/helper/normalize-ledger-notes.ts
backend/src/business/ledger/effect/write-canonical-decision-os-state.ts
backend/src/business/server/helper/content-type-for.ts
frontend/test/unit/canvas/effect/render-canvas-surface.test.ts
frontend/assets/canvas/terminal-button.css
frontend/assets/canvas/terminal-chat.css
frontend/assets/canvas/objects.css
frontend/assets/canvas/thread.css
frontend/assets/canvas/debug.css
frontend/assets/canvas/dialogs.css
frontend/assets/canvas/shell.css
frontend/assets/canvas/terminal-chat-controls.css
frontend/assets/canvas/tokens.css
frontend/assets/canvas/canvas-layer.css
backend/src/business/server/controller/start-http-server-controller.ts
frontend/test/unit/voice/controller/record-voice-controller.test.ts
frontend/test/boot/boot-surface.integration.test.ts
frontend/src/business/zone/controller/edit-zone-controller.ts
frontend/test/unit/toolbox/helper/resolve-tool-mode.test.ts
frontend/assets/vendor/highlight.min.js
frontend/assets/vendor/highlight-atom-one-dark.css
frontend/assets/canvas.css
backend/src/business/persistence/helper/validate-ledger-edit-payload.ts
frontend/test/card/card-lifecycle.integration.test.ts
frontend/test/card/card-labels.integration.test.ts
frontend/src/business/zone/effect/render-zone-layer.ts
frontend/test/unit/boot/helper/load-ledger-state.test.ts
frontend/test/unit/toolbox/controller/operate-toolbox-controller.test.ts
frontend/test/unit/relationship/helper/route-relationship-path.test.ts
frontend/test/unit/voice/effect/render-voice-status.test.ts
backend/src/business/persistence/controller/commit-ledger-edit-controller.ts
frontend/test/unit/relationship/helper/calculate-relationship-ports.test.ts
backend/src/business/refresh/helper/debounce-refresh-event.ts
backend/src/business/refresh/helper/watch-card-content-files.ts
backend/src/business/refresh/helper/watch-ledger-directory.ts
frontend/test/unit/voice/effect/fill-thread-draft.test.ts
frontend/test/unit/voice/effect/upload-voice-audio.test.ts
frontend/test/unit/voice/effect/request-transcription.test.ts
frontend/test/group/group-selection.integration.test.ts
frontend/test/unit/boot/controller/boot-surface-controller.test.ts
backend/src/business/persistence/effect/write-ledger-json-file.ts
frontend/test/unit/toolbox/effect/render-toolbox.test.ts
frontend/test/toolbox/toolbox-navigation-zone.integration.test.ts
backend/src/business/refresh/controller/publish-server-refresh-controller.ts
frontend/src/business/persistence/effect/commit-ledger-edit.ts
frontend/src/business/selection/helper/calculate-marquee-selection.ts
frontend/src/business/selection/helper/copy-selection-payload.ts
frontend/src/business/selection/helper/clear-transient-selection.ts
frontend/src/business/selection/helper/resolve-selection-target.ts
frontend/test/unit/relationship/controller/render-relationship-controller.test.ts
frontend/test/canvas/canvas-interaction.integration.test.ts
frontend/test/unit/persistence/effect/apply-persisted-geometry-to-ledger.test.ts
frontend/test/unit/persistence/effect/commit-ledger-edit.test.ts
backend/src/business/refresh/effect/publish-refresh-event.ts
frontend/test/unit/gesture/helper/derive-gesture-intent.test.ts
frontend/test/unit/gesture/helper/calculate-drag-delta.test.ts
frontend/src/business/relationship/helper/route-relationship-path.ts
frontend/src/business/relationship/helper/calculate-relationship-ports.ts
frontend/test/unit/refresh/effect/subscribe-server-refresh.test.ts
frontend/test/unit/refresh/helper/merge-refresh-state.test.ts
backend/src/telemetry/harness.ts
frontend/src/business/thread/helper/resolve-thread-target.ts
frontend/test/unit/relationship/effect/render-relationship-overlay.test.ts
backend/src/server.ts
frontend/test/unit/gesture/controller/handle-canvas-gesture-controller.test.ts
frontend/test/unit/refresh/controller/handle-client-refresh-controller.test.ts
frontend/src/business/navigation/helper/derive-route-state.ts
frontend/src/business/thread/controller/edit-thread-controller.ts
frontend/src/business/relationship/controller/render-relationship-controller.ts
frontend/test/unit/runtime/voice/helper/format-voice-duration.test.ts
frontend/test/unit/runtime/voice/helper/encode-wav-blob.test.ts
frontend/test/unit/runtime/input/helper/is-card-editing-keyboard-target.test.ts
frontend/src/test/spec-assertions.js
frontend/src/business/thread/effect/render-thread-panel.ts
frontend/test/unit/card/helper/resolve-card-y-overlap.test.ts
frontend/test/unit/card/helper/parse-card-markdown.test.ts
frontend/src/business/relationship/effect/render-relationship-overlay.ts
frontend/test/unit/card/effect/resize-selected-card.test.ts
frontend/test/unit/card/effect/render-card-layer.test.ts
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-11","timestamp":"2026-07-07T17:00:47.702Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"11","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_5","codexTool":"/usr/bin/zsh -lc \"find . -maxdepth 3 -type f \\\\( -path './backend/*' -o -path './frontend/*' -o -path './bin/*' \\\\) | sort | sed -n '1,240p'\""} -->

**Tool call** `/usr/bin/zsh -lc "find . -maxdepth 3 -type f \\( -path './backend/*' -o -path './frontend/*' -o -path './bin/*' \\) | sort | sed -n '1,240p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-12","timestamp":"2026-07-07T17:00:47.703Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"12","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_5","codexTool":"/usr/bin/zsh -lc \"find . -maxdepth 3 -type f \\\\( -path './backend/*' -o -path './frontend/*' -o -path './bin/*' \\\\) | sort | sed -n '1,240p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "find . -maxdepth 3 -type f \\( -path './backend/*' -o -path './frontend/*' -o -path './bin/*' \\) | sort | sed -n '1,240p'"`
Status: completed
Exit code: 0

````text
./backend/README.md
./backend/generated/dependency-graph.json
./backend/generated/report-config.json
./backend/generated/test-results.json
./backend/node_modules/.package-lock.json
./backend/package-lock.json
./backend/package.json
./backend/src/server.ts
./backend/tsconfig.json
./bin/decision-os-server.mjs
./bin/ledger-cli.mjs
./bin/normalize-card-heights.mjs
./bin/save-html.mjs
./frontend/README.md
./frontend/assets/canvas.css
./frontend/index.html
./frontend/node_modules/.package-lock.json
./frontend/package-lock.json
./frontend/package.json
./frontend/tsconfig.json
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-13","timestamp":"2026-07-07T17:00:47.704Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"13","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_6"} -->

The code already contains a single-card skill-run path: backend Codex controllers, a frontend skill request runtime, and tests around creating linked output cards. I’m reading those areas now to distinguish existing support from the new pipeline/tab requirement.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-14","timestamp":"2026-07-07T17:00:47.705Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"14","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_7","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/controller/start-card-skill-process-controller.ts | sed -n '1,260p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/controller/start-card-skill-process-controller.ts | sed -n '1,260p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-15","timestamp":"2026-07-07T17:00:47.706Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"15","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_7","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/controller/start-card-skill-process-controller.ts | sed -n '1,260p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/controller/start-card-skill-process-controller.ts | sed -n '1,260p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Creates a linked output card and starts a headless Codex skill process for the source card.
     3	 * WHY: Card-scoped skill processing must persist the result target before the asynchronous Codex run begins.
     4	 */
     5	import { spawn, type ChildProcess } from 'node:child_process';
     6	import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, type WriteStream } from 'node:fs';
     7	import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
     8	import { randomUUID } from 'node:crypto';
     9	import { applyLedgerMutation } from '@backend/business/ledger/helper/apply-ledger-mutation.js';
    10	import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
    11	import { hydrateLedgerCardContent, resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
    12	import { stripHydratedThreadNotes } from '@backend/business/ledger/helper/thread-content-file.js';
    13	import { scanCodexSkills } from '../helper/scan-codex-skills.js';
    14	import { buildCardSkillPrompt } from '../helper/build-card-skill-prompt.js';
    15	import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from '../helper/resolve-codex-command.js';
    16	import { readCardSkillRunController } from './read-card-skill-run-controller.js';
    17	
    18	type AnyRecord = Record<string, unknown>;
    19	type ProcessStatus = 'running' | 'complete' | 'failed' | 'cancelled';
    20	
    21	function safeSegment(value: unknown): string {
    22	  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
    23	}
    24	
    25	function isInside(parent: string, child: string): boolean {
    26	  const inner = relative(parent, child);
    27	  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
    28	}
    29	
    30	function workspaceRootForDecisionOsRoot(decisionOsRoot: string): string {
    31	  return dirname(decisionOsRoot);
    32	}
    33	
    34	function ledgerStem(ledgerPath: string): string {
    35	  return basename(ledgerPath, extname(ledgerPath));
    36	}
    37	
    38	function sourceCardContent(input: { rawLedger: AnyRecord; decisionOsRoot: string; cardId: string }): string {
    39	  const hydrated = hydrateLedgerCardContent(JSON.parse(JSON.stringify(input.rawLedger)), input.decisionOsRoot) as { cards?: AnyRecord[] };
    40	  const card = (hydrated.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
    41	  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
    42	  return String(comment.what ?? comment.body ?? comment.description ?? '');
    43	}
    44	
    45	function persistLedger(ledgerPath: string, ledger: AnyRecord): void {
    46	  stripHydratedThreadNotes(ledger);
    47	  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
    48	}
    49	
    50	function notifyLedgerChange(callback: unknown, event: AnyRecord): void {
    51	  if (typeof callback === 'function') callback(event);
    52	}
    53	
    54	function appendRunStatus(filePath: string, status: ProcessStatus, detail: string): void {
    55	  const heading = status === 'complete' ? 'Completed' : status === 'failed' ? 'Failed' : status === 'cancelled' ? 'Cancelled' : 'Running';
    56	  const markdown = [``, `---`, ``, `Codex run ${heading.toLowerCase()}: ${detail}`].join('\n');
    57	  try {
    58	    writeFileSync(filePath, `${existsSync(filePath) ? readFileSync(filePath, 'utf8').replace(/\s+$/g, '') : ''}${markdown}\n`, 'utf8');
    59	  } catch {
    60	    // The run log remains the fallback status record when the output file cannot be patched.
    61	  }
    62	}
    63	
    64	function updateRuntimeRun(runtime: AnyRecord, runId: string, patch: AnyRecord): void {
    65	  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
    66	    ? runtime.codexSkillRuns as Record<string, AnyRecord>
    67	    : {};
    68	  runtime.codexSkillRuns = runs;
    69	  runs[runId] = { ...(runs[runId] ?? {}), ...patch };
    70	}
    71	
    72	function attachRuntimeRunChild(runtime: AnyRecord, runId: string, child: ChildProcess): void {
    73	  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
    74	  const run = runs[runId];
    75	  if (!run) return;
    76	  Object.defineProperty(run, 'child', { value: child, writable: true, configurable: true, enumerable: false });
    77	}
    78	
    79	function runtimeRunStatus(runtime: AnyRecord, runId: string): string {
    80	  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
    81	  return String(runs[runId]?.status ?? '');
    82	}
    83	
    84	function finishRunStreams(stdout: WriteStream, stderr: WriteStream, callback: () => void): void {
    85	  let pending = 2;
    86	  const done = (): void => {
    87	    pending -= 1;
    88	    if (pending === 0) callback();
    89	  };
    90	  for (const stream of [stdout, stderr]) {
    91	    if (stream.destroyed || stream.writableEnded) done();
    92	    else stream.end(done);
    93	  }
    94	}
    95	
    96	function optionalText(value: unknown): string {
    97	  return typeof value === 'string' ? value.trim() : '';
    98	}
    99	
   100	export async function startCardSkillProcessController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
   101	  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
   102	  const payload = (envelope.action_payload ?? input) as AnyRecord;
   103	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
   104	  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
   105	  const workspaceRoot = workspaceRootForDecisionOsRoot(decisionOsRoot);
   106	  const ledgerId = String(payload.ledgerId ?? '').trim();
   107	  const cardId = String(payload.cardId ?? '').trim();
   108	  const skillName = String(payload.skillName ?? '').trim();
   109	  if (!ledgerId || !cardId || !skillName) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or skillName.' };
   110	  const requestedCodexModel = optionalText(payload.codexModel);
   111	  const requestedCodexEffort = optionalText(payload.codexEffort);
   112	  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedCodexModel };
   113	  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedCodexEffort };
   114	
   115	  const skill = scanCodexSkills({ workspaceRoot }).find((entry) => entry.name === skillName);
   116	  if (!skill) return { ok: false, statusCode: 404, error: 'Skill not found.', skillName };
   117	
   118	  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json'), writeBack: true }, runtime_state: runtime });
   119	  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
   120	  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };
   121	
   122	  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
   123	  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
   124	  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };
   125	
   126	  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[]; relationships?: AnyRecord[] };
   127	  const source = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
   128	  if (!source) return { ok: false, statusCode: 404, error: 'Source card not found.', cardId };
   129	
   130	  const runId = `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
   131	  const outputCardId = `card-${safeSegment(runId)}`;
   132	  const outputTitle = `${skillName} result`;
   133	  const command = resolveCodexCommand({ workspaceRoot, runtime, codexModel: requestedCodexModel, codexEffort: requestedCodexEffort });
   134	  const outputMarkdown = [
   135	    `# ${outputTitle}`,
   136	    '',
   137	    `Status: processing`,
   138	    '',
   139	    `Source card: ${String(source.title ?? cardId)}`,
   140	    `Codex run: ${runId}`,
   141	    `Codex model: ${command.model}`,
   142	    `Codex effort: ${command.effort}`,
   143	  ].join('\n');
   144	  const outputCard = {
   145	    id: outputCardId,
   146	    title: outputTitle,
   147	    cardType: 'codex-skill-run',
   148	    x: Number(source.x ?? 0) + Math.max(220, Number(source.w ?? 360)) + 96,
   149	    y: Number(source.y ?? 0),
   150	    w: Math.max(360, Number(source.w ?? 360)),
   151	    h: 260,
   152	    status: 'todo',
   153	    comment: { what: outputMarkdown },
   154	    facts: [],
   155	    fields: [],
   156	  };
   157	  const relationship = {
   158	    id: `rel-${safeSegment(cardId)}-${safeSegment(outputCardId)}`.slice(0, 180),
   159	    from: cardId,
   160	    to: outputCardId,
   161	    label: skillName,
   162	  };
   163	
   164	  let mutation = applyLedgerMutation({ decisionOsRoot, ledgerPath, ledger, mutation: { action: 'create-card', card: outputCard } });
   165	  if (mutation.ok === false) return { ok: false, statusCode: mutation.error?.statusCode ?? 400, error: mutation.error?.body?.error ?? 'Could not create output card.' };
   166	  mutation = applyLedgerMutation({ decisionOsRoot, ledgerPath, ledger, mutation: { action: 'create-relationship', relationship } });
   167	  if (mutation.ok === false) return { ok: false, statusCode: mutation.error?.statusCode ?? 400, error: mutation.error?.body?.error ?? 'Could not create relationship.' };
   168	  persistLedger(ledgerPath, ledger);
   169	
   170	  const outputComment = outputCard.comment && typeof outputCard.comment === 'object' ? outputCard.comment as AnyRecord : {};
   171	  const outputFile = resolveCardContentFile(decisionOsRoot, outputComment.contentFile);
   172	  if (!outputFile) return { ok: false, statusCode: 500, error: 'Output card content file was not created.' };
   173	
   174	  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
   175	  mkdirSync(runDirectory, { recursive: true });
   176	  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
   177	  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
   178	  const prompt = buildCardSkillPrompt({
   179	    skillName,
   180	    sourceCardId: cardId,
   181	    sourceCardTitle: String(source.title ?? cardId),
   182	    sourceCardContent: sourceCardContent({ rawLedger: ledger, decisionOsRoot, cardId }),
   183	    outputMarkdownFile: outputFile,
   184	  });
   185	
   186	  const child = spawn(command.command, command.args, { cwd: workspaceRoot, stdio: ['pipe', 'pipe', 'pipe'] });
   187	  const stdout = createWriteStream(stdoutFile, { flags: 'a' });
   188	  const stderr = createWriteStream(stderrFile, { flags: 'a' });
   189	  child.stdout.pipe(stdout, { end: false });
   190	  child.stderr.pipe(stderr, { end: false });
   191	  child.stdin.end(prompt);
   192	
   193	  const run = {
   194	    id: runId,
   195	    skillName,
   196	    ledgerId,
   197	    sourceCardId: cardId,
   198	    outputCardId,
   199	    outputFile,
   200	    stdoutFile,
   201	    stderrFile,
   202	    codexModel: command.model,
   203	    codexEffort: command.effort,
   204	    pid: child.pid ?? 0,
   205	    status: 'running',
   206	    startedAt: new Date().toISOString(),
   207	  };
   208	  updateRuntimeRun(runtime, runId, run);
   209	  attachRuntimeRunChild(runtime, runId, child);
   210	  notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-started', ledgerId, sourceCardId: cardId, outputCardId, runId, codexModel: command.model, codexEffort: command.effort });
   211	
   212	  let settled = false;
   213	  child.on('error', (error) => {
   214	    if (settled) return;
   215	    settled = true;
   216	    const finishedAt = new Date().toISOString();
   217	    appendRunStatus(outputFile, 'failed', error.message);
   218	    updateRuntimeRun(runtime, runId, { status: 'failed', error: error.message, finishedAt });
   219	    finishRunStreams(stdout, stderr, () => {
   220	      void readCardSkillRunController({ action_payload: { ledgerId, cardId: outputCardId, runId }, runtime_state: runtime })
   221	        .catch(() => undefined)
   222	        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-failed', ledgerId, sourceCardId: cardId, outputCardId, runId }));
   223	    });
   224	  });
   225	  child.on('close', (exitCode) => {
   226	    if (settled) return;
   227	    settled = true;
   228	    const finishedAt = new Date().toISOString();
   229	    const status: ProcessStatus = runtimeRunStatus(runtime, runId) === 'cancelled' ? 'cancelled' : exitCode === 0 ? 'complete' : 'failed';
   230	    const detail = status === 'cancelled' ? 'terminated by operator' : `exit code ${exitCode ?? 'unknown'}`;
   231	    appendRunStatus(outputFile, status, detail);
   232	    updateRuntimeRun(runtime, runId, { status, exitCode, finishedAt });
   233	    finishRunStreams(stdout, stderr, () => {
   234	      if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
   235	      void readCardSkillRunController({ action_payload: { ledgerId, cardId: outputCardId, runId }, runtime_state: runtime })
   236	        .catch(() => undefined)
   237	        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: status === 'cancelled' ? 'codex-skill-cancelled' : 'codex-skill-finished', ledgerId, sourceCardId: cardId, outputCardId, runId, exitCode }));
   238	    });
   239	  });
   240	
   241	  return { ok: true, statusCode: 202, run };
   242	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-16","timestamp":"2026-07-07T17:00:47.707Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"16","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_8","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/helper/scan-codex-skills.ts | sed -n '1,260p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/helper/scan-codex-skills.ts | sed -n '1,260p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-17","timestamp":"2026-07-07T17:00:47.708Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"17","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_8","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/helper/scan-codex-skills.ts | sed -n '1,260p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/helper/scan-codex-skills.ts | sed -n '1,260p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Discovers Codex skills available to the workspace.
     3	 * WHY: The browser should list skill names and descriptions without accepting filesystem paths from the client.
     4	 */
     5	import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from 'node:fs';
     6	import { homedir } from 'node:os';
     7	import { join, resolve } from 'node:path';
     8	
     9	export type CodexSkillSource = 'workspace' | 'user' | 'plugin';
    10	
    11	export type CodexSkillSummary = {
    12	  name: string;
    13	  description: string;
    14	  source: CodexSkillSource;
    15	  skillFile: string;
    16	};
    17	
    18	type SkillRoot = {
    19	  directory: string;
    20	  source: CodexSkillSource;
    21	  maxDepth: number;
    22	};
    23	
    24	function uniqueValues(values: string[]): string[] {
    25	  return Array.from(new Set(values.filter(Boolean)));
    26	}
    27	
    28	function codexHome(): string {
    29	  return resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
    30	}
    31	
    32	function candidateSkillRoots(workspaceRoot: string): SkillRoot[] {
    33	  const home = codexHome();
    34	  const workspaceSkills = resolve(workspaceRoot, '.skills');
    35	  const cwdSkills = resolve(process.cwd(), '.skills');
    36	  return [
    37	    ...uniqueValues([workspaceSkills, cwdSkills]).map((directory) => ({ directory, source: 'workspace' as const, maxDepth: 5 })),
    38	    { directory: resolve(home, 'skills'), source: 'user' as const, maxDepth: 6 },
    39	    { directory: resolve(home, 'plugins', 'cache'), source: 'plugin' as const, maxDepth: 10 },
    40	  ];
    41	}
    42	
    43	function collectSkillFiles(directory: string, maxDepth: number, depth = 0): string[] {
    44	  if (depth > maxDepth || !existsSync(directory)) return [];
    45	  let entries: Dirent[];
    46	  try {
    47	    entries = readdirSync(directory, { withFileTypes: true });
    48	  } catch {
    49	    return [];
    50	  }
    51	  const files: string[] = [];
    52	  for (const entry of entries) {
    53	    const child = resolve(directory, entry.name);
    54	    if (entry.isFile() && entry.name === 'SKILL.md') files.push(child);
    55	    if (entry.isDirectory()) files.push(...collectSkillFiles(child, maxDepth, depth + 1));
    56	  }
    57	  return files;
    58	}
    59	
    60	function unquote(value: string): string {
    61	  const trimmed = value.trim();
    62	  const quote = trimmed[0];
    63	  return (quote === '"' || quote === "'") && trimmed.endsWith(quote)
    64	    ? trimmed.slice(1, -1)
    65	    : trimmed;
    66	}
    67	
    68	function parseSkillFrontmatter(markdown: string): { name: string; description: string } | null {
    69	  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    70	  if (lines[0]?.trim() !== '---') return null;
    71	  const metadata: Record<string, string> = {};
    72	  for (let index = 1; index < lines.length; index += 1) {
    73	    const line = lines[index];
    74	    if (line.trim() === '---') break;
    75	    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    76	    if (!match) continue;
    77	    metadata[match[1]] = unquote(match[2] ?? '');
    78	  }
    79	  const name = String(metadata.name ?? '').trim();
    80	  if (!name) return null;
    81	  return { name, description: String(metadata.description ?? '').trim() };
    82	}
    83	
    84	function readSkillSummary(skillFile: string, source: CodexSkillSource): CodexSkillSummary | null {
    85	  try {
    86	    if (!statSync(skillFile).isFile()) return null;
    87	    const metadata = parseSkillFrontmatter(readFileSync(skillFile, 'utf8'));
    88	    if (!metadata) return null;
    89	    return { ...metadata, source, skillFile };
    90	  } catch {
    91	    return null;
    92	  }
    93	}
    94	
    95	export function scanCodexSkills(input: { workspaceRoot: string }): CodexSkillSummary[] {
    96	  const byName = new Map<string, CodexSkillSummary>();
    97	  for (const root of candidateSkillRoots(input.workspaceRoot)) {
    98	    for (const skillFile of collectSkillFiles(root.directory, root.maxDepth)) {
    99	      const summary = readSkillSummary(skillFile, root.source);
   100	      if (!summary || byName.has(summary.name)) continue;
   101	      byName.set(summary.name, summary);
   102	    }
   103	  }
   104	  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
   105	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-18","timestamp":"2026-07-07T17:00:47.709Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"18","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_9","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/helper/build-card-skill-prompt.ts | sed -n '1,240p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/helper/build-card-skill-prompt.ts | sed -n '1,240p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-19","timestamp":"2026-07-07T17:00:47.710Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"19","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_9","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/helper/build-card-skill-prompt.ts | sed -n '1,240p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/helper/build-card-skill-prompt.ts | sed -n '1,240p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Builds the stdin prompt for a card-scoped Codex skill run.
     3	 * WHY: Headless Codex needs the selected skill, source card content, and output file contract in one deterministic payload.
     4	 */
     5	export function buildCardSkillPrompt(input: {
     6	  skillName: string;
     7	  sourceCardId: string;
     8	  sourceCardTitle: string;
     9	  sourceCardContent: string;
    10	  outputMarkdownFile: string;
    11	}): string {
    12	  return [
    13	    `$${input.skillName}`,
    14	    '',
    15	    'You are processing one decision-os card from the active workspace.',
    16	    '',
    17	    'Treat the following source card as the complete incoming card content for this run.',
    18	    '',
    19	    `Source card id: ${input.sourceCardId}`,
    20	    `Source card title: ${input.sourceCardTitle}`,
    21	    '',
    22	    'Source card content:',
    23	    '```markdown',
    24	    input.sourceCardContent,
    25	    '```',
    26	    '',
    27	    `Write the final result to this Markdown file: ${input.outputMarkdownFile}`,
    28	    '',
    29	    'Use English only.',
    30	    'Do not edit the source card.',
    31	    'Do not edit ledger JSON manually.',
    32	    'Keep unrelated files unchanged.',
    33	    'When finished, ensure the Markdown file contains the useful result for the operator.',
    34	  ].join('\n');
    35	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-20","timestamp":"2026-07-07T17:00:47.711Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"20","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_10","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/helper/resolve-codex-command.ts | sed -n '1,180p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/helper/resolve-codex-command.ts | sed -n '1,180p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-21","timestamp":"2026-07-07T17:00:47.712Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"21","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_10","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/helper/resolve-codex-command.ts | sed -n '1,180p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/helper/resolve-codex-command.ts | sed -n '1,180p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Resolves the Codex CLI command and arguments for a headless workspace run.
     3	 * WHY: The server process may not inherit the operator's interactive shell PATH.
     4	 */
     5	import { accessSync, constants, readdirSync } from 'node:fs';
     6	import { homedir } from 'node:os';
     7	import { delimiter, dirname, isAbsolute, resolve } from 'node:path';
     8	
     9	type AnyRecord = Record<string, unknown>;
    10	
    11	export const codexModelOptions = ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'] as const;
    12	export const codexEffortOptions = ['low', 'medium', 'high', 'xhigh'] as const;
    13	
    14	export type CodexCommand = {
    15	  command: string;
    16	  args: string[];
    17	  model: string;
    18	  effort: string;
    19	};
    20	
    21	function settingsRecord(runtime: AnyRecord): AnyRecord {
    22	  return runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object'
    23	    ? runtime.decisionOsSettings as AnyRecord
    24	    : {};
    25	}
    26	
    27	function isExecutable(file: string): boolean {
    28	  try {
    29	    accessSync(file, constants.X_OK);
    30	    return true;
    31	  } catch {
    32	    return false;
    33	  }
    34	}
    35	
    36	function pathCandidates(command: string, workspaceRoot: string): string[] {
    37	  if (!command) return [];
    38	  if (isAbsolute(command)) return [command];
    39	  if (command.includes('/')) return [resolve(workspaceRoot, command)];
    40	  return String(process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => resolve(directory, command));
    41	}
    42	
    43	function nvmCodexCandidates(): string[] {
    44	  const versionsRoot = resolve(homedir(), '.nvm', 'versions', 'node');
    45	  try {
    46	    return readdirSync(versionsRoot, { withFileTypes: true })
    47	      .filter((entry) => entry.isDirectory())
    48	      .map((entry) => entry.name)
    49	      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    50	      .map((version) => resolve(versionsRoot, version, 'bin', 'codex'));
    51	  } catch {
    52	    return [];
    53	  }
    54	}
    55	
    56	function defaultCodexCandidates(): string[] {
    57	  return [
    58	    resolve(dirname(process.execPath), 'codex'),
    59	    ...nvmCodexCandidates(),
    60	    resolve(homedir(), '.local', 'bin', 'codex'),
    61	    '/usr/local/bin/codex',
    62	    '/usr/bin/codex',
    63	  ];
    64	}
    65	
    66	function resolveExecutable(command: string, workspaceRoot: string): string {
    67	  for (const candidate of [...pathCandidates(command, workspaceRoot), ...defaultCodexCandidates()]) {
    68	    if (isExecutable(candidate)) return candidate;
    69	  }
    70	  return command || 'codex';
    71	}
    72	
    73	function allowedValue(value: unknown, options: readonly string[]): string {
    74	  const text = typeof value === 'string' ? value.trim() : '';
    75	  return options.includes(text) ? text : '';
    76	}
    77	
    78	function firstAllowed(values: unknown[], options: readonly string[], fallback: string): string {
    79	  for (const value of values) {
    80	    const allowed = allowedValue(value, options);
    81	    if (allowed) return allowed;
    82	  }
    83	  return fallback;
    84	}
    85	
    86	export function isAllowedCodexModel(value: unknown): boolean {
    87	  return Boolean(allowedValue(value, codexModelOptions));
    88	}
    89	
    90	export function isAllowedCodexEffort(value: unknown): boolean {
    91	  return Boolean(allowedValue(value, codexEffortOptions));
    92	}
    93	
    94	export function resolveCodexCommand(input: { workspaceRoot: string; runtime: AnyRecord; codexModel?: unknown; codexEffort?: unknown }): CodexCommand {
    95	  const settings = settingsRecord(input.runtime);
    96	  const configuredCommand = String(process.env.CODEX_BIN || settings.codexBin || settings.CODEX_BIN || 'codex');
    97	  const model = firstAllowed([input.codexModel, process.env.CODEX_MODEL, settings.codexModel, settings.CODEX_MODEL], codexModelOptions, 'gpt-5.5');
    98	  const effort = firstAllowed([input.codexEffort, process.env.CODEX_EFFORT, settings.codexEffort, settings.codexReasoningEffort, settings.CODEX_EFFORT], codexEffortOptions, 'high');
    99	  return {
   100	    command: resolveExecutable(configuredCommand, input.workspaceRoot),
   101	    args: [
   102	      'exec',
   103	      '--dangerously-bypass-approvals-and-sandbox',
   104	      '--json',
   105	      '-C',
   106	      input.workspaceRoot,
   107	      '-c',
   108	      `model_reasoning_effort="${effort}"`,
   109	      '--model',
   110	      model,
   111	      '-',
   112	    ],
   113	    model,
   114	    effort,
   115	  };
   116	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-22","timestamp":"2026-07-07T17:00:47.713Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"22","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_11"} -->

The backend path is card-scoped, not pipeline-scoped: it validates one `ledgerId/cardId/skillName`, creates one output card, launches one Codex `exec`, and streams status into that output. I’m checking the frontend surface and route wiring for how operators currently trigger that.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-23","timestamp":"2026-07-07T17:00:47.714Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"23","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/test/runtime/codex-skill-request.integration.test.ts | sed -n '1,280p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/test/runtime/codex-skill-request.integration.test.ts | sed -n '1,280p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-24","timestamp":"2026-07-07T17:00:47.715Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"24","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/test/runtime/codex-skill-request.integration.test.ts | sed -n '1,280p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/test/runtime/codex-skill-request.integration.test.ts | sed -n '1,280p'"`
Status: completed
Exit code: 0

````text
     1	import test from 'node:test';
     2	import assert from 'node:assert/strict';
     3	import { loadCodexSkills } from '../../src/runtime/codex/effect/load-codex-skills.js';
     4	import { requestCardSkillProcess } from '../../src/runtime/codex/effect/request-card-skill-process.js';
     5	import { requestCardSkillRunStatus } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
     6	import { cardCodexRunId } from '../../src/runtime/codex/helper/card-codex-run-id.js';
     7	
     8	test('loadCodexSkills returns server skill summaries', async () => {
     9	  const previousFetch = globalThis.fetch;
    10	  try {
    11	    globalThis.fetch = (async (url: string) => {
    12	      assert.equal(url, '/api/codex/skills');
    13	      return new Response(JSON.stringify({ ok: true, skills: [{ name: 'analysis', description: 'Analyze code', source: 'workspace' }] }), {
    14	        status: 200,
    15	        headers: { 'content-type': 'application/json' }
    16	      });
    17	    }) as typeof fetch;
    18	
    19	    const skills = await loadCodexSkills();
    20	    assert.deepEqual(skills, [{ name: 'analysis', description: 'Analyze code', source: 'workspace' }]);
    21	  } finally {
    22	    globalThis.fetch = previousFetch;
    23	  }
    24	});
    25	
    26	test('requestCardSkillProcess posts active card skill payload', async () => {
    27	  const previousFetch = globalThis.fetch;
    28	  try {
    29	    globalThis.fetch = (async (url: string, init?: RequestInit) => {
    30	      assert.equal(url, '/api/codex/skills/process');
    31	      assert.equal(init?.method, 'POST');
    32	      const headers = init?.headers as Record<string, string>;
    33	      assert.equal(headers['content-type'], 'application/json');
    34	      assert.deepEqual(JSON.parse(String(init?.body ?? '{}')), {
    35	        ledgerId: 'specs',
    36	        cardId: 'card-a',
    37	        skillName: 'analysis',
    38	        codexModel: 'gpt-5.5',
    39	        codexEffort: 'xhigh'
    40	      });
    41	      return new Response(JSON.stringify({ ok: true, run: { id: 'run-a' } }), {
    42	        status: 202,
    43	        headers: { 'content-type': 'application/json' }
    44	      });
    45	    }) as typeof fetch;
    46	
    47	    const result = await requestCardSkillProcess({ ledgerId: 'specs', cardId: 'card-a', skillName: 'analysis', codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
    48	    assert.equal(result.ok, true);
    49	    assert.equal(result.run?.id, 'run-a');
    50	  } finally {
    51	    globalThis.fetch = previousFetch;
    52	  }
    53	});
    54	
    55	test('requestCardSkillRunStatus queries derived run progress', async () => {
    56	  const previousFetch = globalThis.fetch;
    57	  try {
    58	    globalThis.fetch = (async (url: string) => {
    59	      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd?ledgerId=specs&cardId=card-a&since=4');
    60	      return new Response(JSON.stringify({
    61	        ok: true,
    62	        status: 'running',
    63	        elapsedMs: 1200,
    64	        lineCount: 8,
    65	        nextSince: 8,
    66	        toolCallCount: 2,
    67	        agentMessageCount: 1,
    68	        fileChangeCount: 0,
    69	        thinkingCount: 1,
    70	        persistedEventCount: 2,
    71	        latestEvent: { title: 'rg TODO' },
    72	        events: []
    73	      }), {
    74	        status: 200,
    75	        headers: { 'content-type': 'application/json' }
    76	      });
    77	    }) as typeof fetch;
    78	
    79	    const result = await requestCardSkillRunStatus({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd', since: 4 });
    80	    assert.equal(result.ok, true);
    81	    assert.equal(result.status, 'running');
    82	    assert.equal(result.toolCallCount, 2);
    83	    assert.equal(result.nextSince, 8);
    84	  } finally {
    85	    globalThis.fetch = previousFetch;
    86	  }
    87	});
    88	
    89	test('cardCodexRunId falls back to the durable output card id', () => {
    90	  assert.equal(cardCodexRunId({
    91	    id: 'card-codex-skill-1000-abcd',
    92	    comment: { what: '# Finished result without run metadata' }
    93	  }), 'codex-skill-1000-abcd');
    94	  assert.equal(cardCodexRunId({
    95	    id: 'card-result',
    96	    comment: { what: 'Codex run: codex-skill-2000-efgh' }
    97	  }), 'codex-skill-2000-efgh');
    98	});
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-25","timestamp":"2026-07-07T17:00:47.716Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"25","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_13","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/routing/controller/dispatch-route-controller.ts | sed -n '1,260p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/routing/controller/dispatch-route-controller.ts | sed -n '1,260p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-26","timestamp":"2026-07-07T17:00:47.717Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"26","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_13","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/routing/controller/dispatch-route-controller.ts | sed -n '1,260p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/routing/controller/dispatch-route-controller.ts | sed -n '1,260p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Implements the dispatch-route-controller controller from the front/back master ledger.
     3	 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
     4	 */
     5	import { parseHttpRequest } from '@backend/business/routing/helper/parse-http-request.js';
     6	import { resolveLedgerRoute } from '@backend/business/routing/helper/resolve-ledger-route.js';
     7	import { readLedgerJsonFile } from '@backend/business/ledger/helper/read-ledger-json-file.js';
     8	import { sendJsonResponse } from '@backend/business/routing/effect/send-json-response.js';
     9	
    10	type AnyRecord = Record<string, unknown>;
    11	
    12	export async function dispatchRouteController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
    13	  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
    14	  const payload = (envelope.action_payload ?? input) as AnyRecord;
    15	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
    16	  const data = (envelope.data_model ?? {}) as AnyRecord;
    17	  const request = parseHttpRequest({ action_payload: payload, runtime_state: runtime, data_model: data });
    18	  const route = resolveLedgerRoute({ action_payload: { ...payload, ...request }, runtime_state: runtime, data_model: data });
    19	  const ledger = route.ok === false ? { ok: false, document: null } : readLedgerJsonFile({ action_payload: { ...payload, ...route }, runtime_state: runtime, data_model: data });
    20	  sendJsonResponse({ action_payload: { ...payload, status: route.ok === false ? 404 : 200, body: ledger }, runtime_state: runtime, data_model: data });
    21	  return { ok: route.ok !== false, request, route, ledger };
    22	}
    23	
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-27","timestamp":"2026-07-07T17:00:47.718Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"27","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_14","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"codex|skill-modal|skills/process|codexSkill|cardType: 'codex-skill-run'|codex-skill-run\\\" frontend/src frontend/assets backend/src/backend src backend/src tests -g '\"'!**/node_modules/**'\"'\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"codex|skill-modal|skills/process|codexSkill|cardType: 'codex-skill-run'|codex-skill-run\" frontend/src frontend/assets backend/src/backend src backend/src tests -g '"'!**/node_modules/**'"'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-28","timestamp":"2026-07-07T17:00:47.719Z","status":"failed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"28","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_14","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"codex|skill-modal|skills/process|codexSkill|cardType: 'codex-skill-run'|codex-skill-run\\\" frontend/src frontend/assets backend/src/backend src backend/src tests -g '\"'!**/node_modules/**'\"'\"","codexExitCode":"2"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"codex|skill-modal|skills/process|codexSkill|cardType: 'codex-skill-run'|codex-skill-run\" frontend/src frontend/assets backend/src/backend src backend/src tests -g '"'!**/node_modules/**'"'"`
Status: failed
Exit code: 2

````text
rg: backend/src/backend: No such file or directory (os error 2)
rg: src: No such file or directory (os error 2)
frontend/assets/canvas/objects.css:466:.codex-run-widget {
frontend/assets/canvas/objects.css:480:.codex-run-body {
frontend/assets/canvas/objects.css:487:.codex-run-header,
frontend/assets/canvas/objects.css:488:.codex-run-metrics {
frontend/assets/canvas/objects.css:496:.codex-run-cancel {
frontend/assets/canvas/objects.css:504:.codex-run-cancel:disabled {
frontend/assets/canvas/objects.css:509:.codex-run-status,
frontend/assets/canvas/objects.css:510:.codex-run-timer,
frontend/assets/canvas/objects.css:511:.codex-run-metric {
frontend/assets/canvas/objects.css:521:.codex-run-timer {
frontend/assets/canvas/objects.css:536:.codex-run-metrics {
frontend/assets/canvas/objects.css:541:.codex-run-metric {
frontend/assets/canvas/objects.css:547:.codex-run-metric strong {
frontend/assets/canvas/objects.css:553:.codex-run-latest {
frontend/assets/canvas/objects.css:564:.codex-run-widget[data-run-status="complete"] {
frontend/assets/canvas/objects.css:570:.codex-run-widget[data-run-status="failed"] {
frontend/assets/canvas/objects.css:576:.codex-run-widget[data-run-status="cancelled"] {
frontend/assets/canvas/objects.css:582:.codex-run-widget[data-run-status="unknown"] {
frontend/assets/canvas/objects.css:588:.codex-run-widget:not([data-run-status="running"]) .codex-run-timer {
frontend/assets/canvas/thread.css:147:.thread-note.is-codex-run-event {
frontend/assets/canvas/thread.css:155:.thread-note.is-codex-run-event .thread-note-meta {
frontend/assets/canvas/thread.css:169:.thread-note.is-codex-tool_call {
frontend/assets/canvas/thread.css:173:.thread-note.is-codex-thinking {
frontend/assets/canvas/thread.css:177:.thread-note.is-codex-file_change {
frontend/assets/canvas/thread.css:181:.thread-note.is-codex-run_status {
frontend/assets/canvas/thread.css:185:.thread-note.is-codex-tool_call .ledger-card-code-block {
frontend/assets/canvas/dialogs.css:17:.skill-modal button {
frontend/assets/canvas/dialogs.css:33:.skill-modal button:hover,
frontend/assets/canvas/dialogs.css:34:.skill-modal button:focus-visible {
frontend/assets/canvas/dialogs.css:42:.skill-modal {
frontend/assets/canvas/dialogs.css:54:.skill-modal h2 {
frontend/assets/canvas/dialogs.css:59:.skill-modal {
backend/src/business/codex/helper/resolve-codex-command.ts:11:export const codexModelOptions = ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'] as const;
backend/src/business/codex/helper/resolve-codex-command.ts:12:export const codexEffortOptions = ['low', 'medium', 'high', 'xhigh'] as const;
backend/src/business/codex/helper/resolve-codex-command.ts:50:      .map((version) => resolve(versionsRoot, version, 'bin', 'codex'));
backend/src/business/codex/helper/resolve-codex-command.ts:58:    resolve(dirname(process.execPath), 'codex'),
backend/src/business/codex/helper/resolve-codex-command.ts:60:    resolve(homedir(), '.local', 'bin', 'codex'),
backend/src/business/codex/helper/resolve-codex-command.ts:61:    '/usr/local/bin/codex',
backend/src/business/codex/helper/resolve-codex-command.ts:62:    '/usr/bin/codex',
backend/src/business/codex/helper/resolve-codex-command.ts:70:  return command || 'codex';
backend/src/business/codex/helper/resolve-codex-command.ts:87:  return Boolean(allowedValue(value, codexModelOptions));
backend/src/business/codex/helper/resolve-codex-command.ts:91:  return Boolean(allowedValue(value, codexEffortOptions));
backend/src/business/codex/helper/resolve-codex-command.ts:94:export function resolveCodexCommand(input: { workspaceRoot: string; runtime: AnyRecord; codexModel?: unknown; codexEffort?: unknown }): CodexCommand {
backend/src/business/codex/helper/resolve-codex-command.ts:96:  const configuredCommand = String(process.env.CODEX_BIN || settings.codexBin || settings.CODEX_BIN || 'codex');
backend/src/business/codex/helper/resolve-codex-command.ts:97:  const model = firstAllowed([input.codexModel, process.env.CODEX_MODEL, settings.codexModel, settings.CODEX_MODEL], codexModelOptions, 'gpt-5.5');
backend/src/business/codex/helper/resolve-codex-command.ts:98:  const effort = firstAllowed([input.codexEffort, process.env.CODEX_EFFORT, settings.codexEffort, settings.codexReasoningEffort, settings.CODEX_EFFORT], codexEffortOptions, 'high');
backend/src/business/codex/helper/scan-codex-skills.ts:28:function codexHome(): string {
backend/src/business/codex/helper/scan-codex-skills.ts:29:  return resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
backend/src/business/codex/helper/scan-codex-skills.ts:33:  const home = codexHome();
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:10:  return runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/read-card-skill-run-controller.ts:47:  const match = runId.match(/^codex-skill-(\d+)-/);
backend/src/business/codex/controller/read-card-skill-run-controller.ts:152:  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/read-card-skill-run-controller.ts:175:  const runs = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/read-card-skill-run-controller.ts:188:  if (String(card.cardType ?? '') === 'codex-skill-run' && input.cardId === `card-${safeSegment(input.runId)}`) return true;
backend/src/business/codex/controller/read-card-skill-run-controller.ts:207:    const id = `codex-${safeSegment(input.runId)}-line-${event.line}`;
backend/src/business/codex/controller/read-card-skill-run-controller.ts:214:      codexRunId: input.runId,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:215:      codexLine: String(event.line),
backend/src/business/codex/controller/read-card-skill-run-controller.ts:216:      codexKind: event.kind,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:217:      codexEventType: event.type,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:218:      codexItemId: event.itemId,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:219:      codexTool: event.tool,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:220:      codexExitCode: event.exitCode,
backend/src/business/codex/controller/read-card-skill-run-controller.ts:264:  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
backend/src/business/server/helper/create-http-server.ts:25:import { scanCodexSkills } from '../../codex/helper/scan-codex-skills.js';
backend/src/business/server/helper/create-http-server.ts:26:import { startCardSkillProcessController } from '../../codex/controller/start-card-skill-process-controller.js';
backend/src/business/server/helper/create-http-server.ts:27:import { readCardSkillRunController } from '../../codex/controller/read-card-skill-run-controller.js';
backend/src/business/server/helper/create-http-server.ts:28:import { cancelCardSkillRunController } from '../../codex/controller/cancel-card-skill-run-controller.js';
backend/src/business/server/helper/create-http-server.ts:173:    if (url === '/api/codex/skills' && request.method === 'GET') {
backend/src/business/server/helper/create-http-server.ts:185:    if (url === '/api/codex/skills/process' && request.method === 'POST') {
backend/src/business/server/helper/create-http-server.ts:203:    if (url.startsWith('/api/codex/skills/runs/') && request.method === 'GET') {
backend/src/business/server/helper/create-http-server.ts:205:      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length));
backend/src/business/server/helper/create-http-server.ts:220:    if (url.startsWith('/api/codex/skills/runs/') && url.endsWith('/cancel') && request.method === 'POST') {
backend/src/business/server/helper/create-http-server.ts:229:      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length, -'/cancel'.length));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:13:import { scanCodexSkills } from '../helper/scan-codex-skills.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:15:import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from '../helper/resolve-codex-command.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:65:  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object'
backend/src/business/codex/controller/start-card-skill-process-controller.ts:66:    ? runtime.codexSkillRuns as Record<string, AnyRecord>
backend/src/business/codex/controller/start-card-skill-process-controller.ts:68:  runtime.codexSkillRuns = runs;
backend/src/business/codex/controller/start-card-skill-process-controller.ts:73:  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/start-card-skill-process-controller.ts:80:  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
backend/src/business/codex/controller/start-card-skill-process-controller.ts:110:  const requestedCodexModel = optionalText(payload.codexModel);
backend/src/business/codex/controller/start-card-skill-process-controller.ts:111:  const requestedCodexEffort = optionalText(payload.codexEffort);
backend/src/business/codex/controller/start-card-skill-process-controller.ts:112:  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedCodexModel };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:113:  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedCodexEffort };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:130:  const runId = `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
backend/src/business/codex/controller/start-card-skill-process-controller.ts:133:  const command = resolveCodexCommand({ workspaceRoot, runtime, codexModel: requestedCodexModel, codexEffort: requestedCodexEffort });
backend/src/business/codex/controller/start-card-skill-process-controller.ts:147:    cardType: 'codex-skill-run',
backend/src/business/codex/controller/start-card-skill-process-controller.ts:174:  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:202:    codexModel: command.model,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:203:    codexEffort: command.effort,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:210:  notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-started', ledgerId, sourceCardId: cardId, outputCardId, runId, codexModel: command.model, codexEffort: command.effort });
backend/src/business/codex/controller/start-card-skill-process-controller.ts:222:        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-failed', ledgerId, sourceCardId: cardId, outputCardId, runId }));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:237:        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: status === 'cancelled' ? 'codex-skill-cancelled' : 'codex-skill-finished', ledgerId, sourceCardId: cardId, outputCardId, runId, exitCode }));
backend/src/business/ledger/helper/thread-content-file.ts:54:  for (const key of ['id', 'timestamp', 'voiceFileRef', 'status', 'transcriptionStartedAt', 'error', 'codexRunId', 'codexLine', 'codexKind', 'codexEventType', 'codexItemId', 'codexTool', 'codexExitCode']) {
frontend/src/runtime/input/controller/handle-action-click.ts:34:import { closeCardSkillModal, openCardSkillModal, processSelectedCardSkill, selectCardSkill } from '../../codex/effect/render-skill-modal.js';
frontend/src/runtime/input/controller/handle-action-click.ts:119:  if (action === 'open-card-skill-modal') {
frontend/src/runtime/input/controller/handle-action-click.ts:131:  if (action === 'close-card-skill-modal') {
frontend/src/runtime/codex/helper/card-codex-run-id.ts:8:  const bodyMatch = ledgerCardBody(card).match(/^Codex run:\s*(codex-skill-[^\s]+)/m);
frontend/src/runtime/codex/helper/card-codex-run-id.ts:10:  const idMatch = String(card.id ?? '').match(/^card-(codex-skill-[^\s]+)$/);
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:10:export async function processCardSkillController(input: { cardId: string; skillName: string; codexModel?: string; codexEffort?: string }): Promise<boolean> {
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:13:  telemetry('codex-skill-process-start', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '' });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:14:  const result = await requestCardSkillProcess({ ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel, codexEffort: input.codexEffort });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:16:    telemetry('codex-skill-process-failed', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', error: result.error ?? '' });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:20:  telemetry('codex-skill-process-created-card', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', run: result.run?.id ?? '' });
frontend/src/runtime/codex/effect/request-card-skill-process.ts:9:  codexModel?: string;
frontend/src/runtime/codex/effect/request-card-skill-process.ts:10:  codexEffort?: string;
frontend/src/runtime/codex/effect/request-card-skill-process.ts:14:  const response = await fetch('/api/codex/skills/process', {
frontend/src/runtime/codex/effect/load-codex-skills.ts:12:  const response = await fetch('/api/codex/skills').catch(() => undefined);
frontend/src/runtime/codex/effect/request-card-skill-run-cancel.ts:6:  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}/cancel`, {
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:6:import { renderCardSkillRunWidget } from '../../codex/component/render-card-skill-run-widget.js';
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:89:  const codexRunWidget = renderCardSkillRunWidget(card);
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:92:  detailLayer.replaceChildren(...(linkedLedgerCard ? [] : [createCardStatusIndicator(visibleStatus)]), ...labelNodes, createLedgerCardTitleRow(card, id), ...(codexRunWidget ? [codexRunWidget] : []), ...tabs, body);
frontend/src/runtime/dom.ts:11:export const skillModal = runtimeDocument?.querySelector('.skill-modal') as HTMLDialogElement;
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:47:  const match = runId.match(/^codex-skill-(\d+)-/);
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:58:  element.querySelector('[data-codex-run-timer]')?.remove();
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:62:  return element.querySelector<HTMLButtonElement>('[data-codex-run-cancel]');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:80:  setText(element, '[data-codex-run-status]', statusLabel(summary.status));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:85:  setText(element, '[data-codex-run-tools]', String(summary.toolCallCount));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:86:  setText(element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:87:  setText(element, '[data-codex-run-files]', String(summary.fileChangeCount));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:88:  setText(element, '[data-codex-run-latest]', latestEventLabel(summary));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:93:  setText(poller.element, '[data-codex-run-timer]', durationLabel(Date.now() - runStartedAt(poller.runId)));
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:158:  setText(poller.element, '[data-codex-run-latest]', 'Cancelling run');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:163:    setText(poller.element, '[data-codex-run-latest]', result.error || 'Cancel failed');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:196:    setText(poller.element, '[data-codex-run-status]', 'UNKNOWN');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:197:    setText(poller.element, '[data-codex-run-latest]', summary.error || 'Run unavailable');
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:203:  telemetry('codex-skill-run-polled', { runId: poller.runId, status: summary.status, lineCount: summary.lineCount });
frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:42:  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}?${params.toString()}`).catch(() => undefined);
frontend/src/runtime/codex/effect/render-skill-modal.ts:8:import { loadCodexSkills, type CodexSkillSummary } from './load-codex-skills.js';
frontend/src/runtime/codex/effect/render-skill-modal.ts:14:  codexModel: string;
frontend/src/runtime/codex/effect/render-skill-modal.ts:15:  codexEffort: string;
frontend/src/runtime/codex/effect/render-skill-modal.ts:30:  codexModel: 'gpt-5.5',
frontend/src/runtime/codex/effect/render-skill-modal.ts:31:  codexEffort: 'high',
frontend/src/runtime/codex/effect/render-skill-modal.ts:38:const codexModelOptions = ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'];
frontend/src/runtime/codex/effect/render-skill-modal.ts:39:const codexEffortOptions = ['low', 'medium', 'high', 'xhigh'];
frontend/src/runtime/codex/effect/render-skill-modal.ts:99:  title.id = 'skill-modal-title';
frontend/src/runtime/codex/effect/render-skill-modal.ts:119:    value: skillModalState.codexModel,
frontend/src/runtime/codex/effect/render-skill-modal.ts:120:    options: codexModelOptions,
frontend/src/runtime/codex/effect/render-skill-modal.ts:122:      skillModalState.codexModel = value;
frontend/src/runtime/codex/effect/render-skill-modal.ts:123:      telemetry('codex-skill-model-selected', { cardId: skillModalState.cardId, codexModel: value });
frontend/src/runtime/codex/effect/render-skill-modal.ts:128:    value: skillModalState.codexEffort,
frontend/src/runtime/codex/effect/render-skill-modal.ts:129:    options: codexEffortOptions,
frontend/src/runtime/codex/effect/render-skill-modal.ts:131:      skillModalState.codexEffort = value;
frontend/src/runtime/codex/effect/render-skill-modal.ts:132:      telemetry('codex-skill-effort-selected', { cardId: skillModalState.cardId, codexEffort: value });
frontend/src/runtime/codex/effect/render-skill-modal.ts:180:  close.dataset.action = 'close-card-skill-modal';
frontend/src/runtime/codex/effect/render-skill-modal.ts:184:  skillModal.setAttribute('aria-labelledby', 'skill-modal-title');
frontend/src/runtime/codex/effect/render-skill-modal.ts:194:  telemetry('codex-skill-modal-open', { cardId });
frontend/src/runtime/codex/effect/render-skill-modal.ts:207:  telemetry('codex-skill-selected', { cardId: skillModalState.cardId, skillName });
frontend/src/runtime/codex/effect/render-skill-modal.ts:219:    codexModel: skillModalState.codexModel,
frontend/src/runtime/codex/effect/render-skill-modal.ts:220:    codexEffort: skillModalState.codexEffort,
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:6:import { cardCodexRunId } from '../helper/card-codex-run-id.js';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:11:  item.className = 'codex-run-metric';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:13:  name.className = 'codex-run-metric-label';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:29:  widget.className = 'codex-run-widget';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:34:  body.className = 'codex-run-body';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:37:  header.className = 'codex-run-header';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:39:  status.className = 'codex-run-status';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:40:  status.dataset.codexRunStatus = '';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:44:  cancel.className = 'codex-run-cancel terminal-button terminal-button--stop terminal-button--compact';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:45:  cancel.dataset.codexRunCancel = '';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:52:  timer.className = 'codex-run-timer';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:53:  timer.dataset.codexRunTimer = '';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:57:  metrics.className = 'codex-run-metrics';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:59:    metric('Tools', '0', 'codexRunTools'),
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:60:    metric('Text', '0', 'codexRunMessages'),
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:61:    metric('Files', '0', 'codexRunFiles')
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:65:  latest.className = 'codex-run-latest';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:66:  latest.dataset.codexRunLatest = '';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:152:  skill.dataset.action = 'open-card-skill-modal';
frontend/src/runtime/thread/effect/render-thread-notes.ts:15:function codexNoteClass(note: Record<string, unknown>): string {
frontend/src/runtime/thread/effect/render-thread-notes.ts:16:  const kind = String(note.codexKind ?? '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
frontend/src/runtime/thread/effect/render-thread-notes.ts:17:  return kind ? `is-codex-run-event is-codex-${kind}` : '';
frontend/src/runtime/thread/effect/render-thread-notes.ts:75:    item.className = ['thread-note', note.voiceFileRef ? 'voice-note' : '', note.optimistic ? 'is-optimistic' : '', busy ? 'is-busy' : '', retryable ? 'is-retryable' : '', codexNoteClass(note), agentOwned ? 'is-agent' : 'is-operator'].filter(Boolean).join(' ');
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-29","timestamp":"2026-07-07T17:00:47.720Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"29","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_15","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/server.ts | sed -n '1,260p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/server.ts | sed -n '1,260p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-30","timestamp":"2026-07-07T17:00:47.721Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"30","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_15","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/server.ts | sed -n '1,260p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/server.ts | sed -n '1,260p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Starts the backend root block HTTP server.
     3	 * WHY: Operators need a direct runtime entrypoint for the implemented server controller.
     4	 */
     5	import { startHttpServerController } from '@backend/business/server/controller/start-http-server-controller.js';
     6	import { readDecisionOsSettings } from '@backend/business/server/helper/read-decision-os-settings.js';
     7	
     8	const runtime_state: Record<string, unknown> = {};
     9	const startupSettings = readDecisionOsSettings({ runtime_state });
    10	const settings = startupSettings.settings as Record<string, unknown>;
    11	const port = Number(process.env.PORT ?? settings.port ?? 4173);
    12	const host = String(process.env.HOST ?? settings.host ?? '127.0.0.1');
    13	
    14	const result = await startHttpServerController({
    15	  action_payload: { mode: 'serve', port, host },
    16	  runtime_state
    17	});
    18	
    19	console.log(JSON.stringify({ server: 'backend', ok: result.ok, url: `http://${host}:${port}` }));
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-31","timestamp":"2026-07-07T17:00:47.722Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"31","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_16"} -->

The UI trigger is currently a card overlay action opening a skill modal. I’m also checking how ledger tabs are derived, because the request says the “process” view should become a two-tab system.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-32","timestamp":"2026-07-07T17:00:47.723Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"32","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_17","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/server/helper/create-http-server.ts | sed -n '130,250p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/server/helper/create-http-server.ts | sed -n '130,250p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-33","timestamp":"2026-07-07T17:00:47.724Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"33","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_17","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/server/helper/create-http-server.ts | sed -n '130,250p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/server/helper/create-http-server.ts | sed -n '130,250p'"`
Status: completed
Exit code: 0

````text
   130	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
   131	  const port = Number(payload.port ?? runtime.port ?? 0);
   132	  const configuredFrontendRoot = payload.decisionOsFrontendRoot ?? payload.frontendRoot ?? process.env.DECISION_OS_FRONTEND_ROOT ?? runtime.decisionOsFrontendRoot;
   133	  const frontendRoot = configuredFrontendRoot
   134	    ? resolve(String(configuredFrontendRoot))
   135	    : existsSync(resolve(process.cwd(), 'frontend'))
   136	      ? resolve(process.cwd(), 'frontend')
   137	      : resolve(process.cwd(), '..', 'frontend');
   138	  const decisionOsRoot = resolveDecisionOsRoot({ action_payload: payload, runtime_state: runtime });
   139	  runtime.decisionOsRoot = decisionOsRoot;
   140	  if (payload.mode === 'dry-run') {
   141	    return { ok: true, port, server: { listening: false, port } };
   142	  }
   143	  const contentEventClients = new Set<ServerResponse>();
   144	  const publishCardContentChange = (event: CardContentChange): void => {
   145	    const message = `event: card-content-change\ndata: ${JSON.stringify(event)}\n\n`;
   146	    for (const client of contentEventClients) client.write(message);
   147	  };
   148	  const publishLedgerContentChange = (event: AnyRecord): void => {
   149	    const message = `event: ledger-content-change\ndata: ${JSON.stringify(event)}\n\n`;
   150	    for (const client of contentEventClients) client.write(message);
   151	  };
   152	  const loadLedgerContentFiles = (ledger: AnyRecord): AnyRecord => hydrateLedgerCardContent(hydrateLedgerThreadNotes(ledger, decisionOsRoot), decisionOsRoot);
   153	  const persistLedgerAndRespond = (ledgerPath: string, ledger: AnyRecord, response: ServerResponse): void => {
   154	    stripHydratedThreadNotes(ledger);
   155	    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
   156	    response.end(JSON.stringify(loadLedgerContentFiles(ledger)));
   157	  };
   158	  const cardContentWatcher = watchCardContentFiles({ decisionOsRoot, onChange: publishCardContentChange });
   159	  const server = createServer(async (request, response) => {
   160	    const url = (request.url ?? '/').split('?')[0];
   161	    if (tryServeDecisionOsAsset({ url, decisionOsRoot, response })) return;
   162	    if (url === '/api/ledger-content-events' && request.method === 'GET') {
   163	      response.writeHead(200, {
   164	        'cache-control': 'no-store',
   165	        connection: 'keep-alive',
   166	        'content-type': 'text/event-stream',
   167	      });
   168	      response.write(': connected\n\n');
   169	      contentEventClients.add(response);
   170	      request.on('close', () => contentEventClients.delete(response));
   171	      return;
   172	    }
   173	    if (url === '/api/codex/skills' && request.method === 'GET') {
   174	      const workspaceRoot = dirname(decisionOsRoot);
   175	      const skills = scanCodexSkills({ workspaceRoot }).map((skill) => ({
   176	        name: skill.name,
   177	        description: skill.description,
   178	        source: skill.source
   179	      }));
   180	      response.setHeader('content-type', 'application/json');
   181	      response.statusCode = 200;
   182	      response.end(JSON.stringify({ ok: true, skills }));
   183	      return;
   184	    }
   185	    if (url === '/api/codex/skills/process' && request.method === 'POST') {
   186	      const bodyBuffer = await readRequestBuffer(request);
   187	      const processPayload = (() => {
   188	        try {
   189	          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
   190	        } catch {
   191	          return {};
   192	        }
   193	      })();
   194	      const result = await startCardSkillProcessController({
   195	        action_payload: { ...processPayload, onLedgerChange: publishLedgerContentChange },
   196	        runtime_state: runtime
   197	      });
   198	      response.setHeader('content-type', 'application/json');
   199	      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
   200	      response.end(JSON.stringify(result));
   201	      return;
   202	    }
   203	    if (url.startsWith('/api/codex/skills/runs/') && request.method === 'GET') {
   204	      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
   205	      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length));
   206	      const result = await readCardSkillRunController({
   207	        action_payload: {
   208	          runId,
   209	          ledgerId: requestUrl.searchParams.get('ledgerId') ?? '',
   210	          cardId: requestUrl.searchParams.get('cardId') ?? '',
   211	          since: requestUrl.searchParams.get('since') ?? '0'
   212	        },
   213	        runtime_state: runtime
   214	      });
   215	      response.setHeader('content-type', 'application/json');
   216	      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
   217	      response.end(JSON.stringify(result));
   218	      return;
   219	    }
   220	    if (url.startsWith('/api/codex/skills/runs/') && url.endsWith('/cancel') && request.method === 'POST') {
   221	      const bodyBuffer = await readRequestBuffer(request);
   222	      const cancelPayload = (() => {
   223	        try {
   224	          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
   225	        } catch {
   226	          return {};
   227	        }
   228	      })();
   229	      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length, -'/cancel'.length));
   230	      const result = await cancelCardSkillRunController({
   231	        action_payload: { ...cancelPayload, runId },
   232	        runtime_state: runtime
   233	      });
   234	      response.setHeader('content-type', 'application/json');
   235	      response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 202));
   236	      response.end(JSON.stringify(result));
   237	      return;
   238	    }
   239	    if (url === '/api/transcribe' && request.method === 'POST') {
   240	      const audioBuffer = await readRequestBuffer(request);
   241	      await transcribeVoiceController({
   242	        action_payload: {
   243	          method: request.method,
   244	          url,
   245	          response,
   246	          audioBuffer,
   247	          mimeType: request.headers['content-type'] ?? 'audio/webm',
   248	          threadId: request.headers['x-thread-id'] ?? ''
   249	        },
   250	        runtime_state: runtime
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-34","timestamp":"2026-07-07T17:00:47.725Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"34","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_18","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/codex/effect/render-skill-modal.ts | sed -n '1,260p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/codex/effect/render-skill-modal.ts | sed -n '1,260p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-35","timestamp":"2026-07-07T17:00:47.726Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"35","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_18","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/codex/effect/render-skill-modal.ts | sed -n '1,260p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/codex/effect/render-skill-modal.ts | sed -n '1,260p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Renders and updates the card Codex skill picker modal.
     3	 * WHY: Operators need searchable skill descriptions before launching a card-scoped process.
     4	 */
     5	import { skillModal } from '../../dom.js';
     6	import { telemetry } from '../../telemetry/effect/telemetry.js';
     7	import { processCardSkillController } from '../controller/process-card-skill-controller.js';
     8	import { loadCodexSkills, type CodexSkillSummary } from './load-codex-skills.js';
     9	
    10	type SkillModalState = {
    11	  cardId: string;
    12	  query: string;
    13	  selectedSkillName: string;
    14	  codexModel: string;
    15	  codexEffort: string;
    16	  skills: CodexSkillSummary[];
    17	  loading: boolean;
    18	  processing: boolean;
    19	  error: string;
    20	};
    21	
    22	type RenderSkillModalOptions = {
    23	  resultsScrollTop?: number;
    24	};
    25	
    26	const skillModalState: SkillModalState = {
    27	  cardId: '',
    28	  query: '',
    29	  selectedSkillName: '',
    30	  codexModel: 'gpt-5.5',
    31	  codexEffort: 'high',
    32	  skills: [],
    33	  loading: false,
    34	  processing: false,
    35	  error: '',
    36	};
    37	
    38	const codexModelOptions = ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'];
    39	const codexEffortOptions = ['low', 'medium', 'high', 'xhigh'];
    40	
    41	function renderSelect(input: {
    42	  label: string;
    43	  value: string;
    44	  options: string[];
    45	  onChange: (value: string) => void;
    46	}): HTMLLabelElement {
    47	  const label = document.createElement('label');
    48	  label.className = 'skill-run-field';
    49	  const labelText = document.createElement('span');
    50	  labelText.textContent = input.label;
    51	  const select = document.createElement('select');
    52	  select.setAttribute('aria-label', input.label);
    53	  for (const optionValue of input.options) {
    54	    const option = document.createElement('option');
    55	    option.value = optionValue;
    56	    option.textContent = optionValue;
    57	    select.append(option);
    58	  }
    59	  select.value = input.options.includes(input.value) ? input.value : input.options[0] ?? '';
    60	  select.addEventListener('change', () => input.onChange(select.value));
    61	  label.replaceChildren(labelText, select);
    62	  return label;
    63	}
    64	
    65	function filteredSkills(): CodexSkillSummary[] {
    66	  const query = skillModalState.query.trim().toLowerCase();
    67	  if (!query) return skillModalState.skills;
    68	  return skillModalState.skills.filter((skill) => {
    69	    const text = `${skill.name} ${skill.description} ${skill.source}`.toLowerCase();
    70	    return text.includes(query);
    71	  });
    72	}
    73	
    74	function renderSkillRow(skill: CodexSkillSummary): HTMLButtonElement {
    75	  const selected = skill.name === skillModalState.selectedSkillName;
    76	  const button = document.createElement('button');
    77	  button.className = `skill-result${selected ? ' is-selected' : ''}`;
    78	  button.type = 'button';
    79	  button.dataset.action = 'select-card-skill';
    80	  button.dataset.skillName = skill.name;
    81	  button.setAttribute('aria-pressed', String(selected));
    82	
    83	  const title = document.createElement('span');
    84	  title.className = 'skill-result-name';
    85	  title.textContent = skill.name;
    86	  const source = document.createElement('span');
    87	  source.className = 'skill-result-source';
    88	  source.textContent = skill.source;
    89	  const description = document.createElement('span');
    90	  description.className = 'skill-result-description';
    91	  description.textContent = skill.description || 'No description.';
    92	  button.replaceChildren(title, source, description);
    93	  return button;
    94	}
    95	
    96	function renderSkillModal(options: RenderSkillModalOptions = {}): void {
    97	  if (!skillModal) return;
    98	  const title = document.createElement('h2');
    99	  title.id = 'skill-modal-title';
   100	  title.textContent = 'Codex Skills';
   101	
   102	  const search = document.createElement('input');
   103	  search.className = 'skill-search';
   104	  search.type = 'search';
   105	  search.placeholder = 'Search skills';
   106	  search.value = skillModalState.query;
   107	  search.autocomplete = 'off';
   108	  search.setAttribute('aria-label', 'Search skills');
   109	  search.addEventListener('input', () => {
   110	    skillModalState.query = search.value;
   111	    renderSkillModal();
   112	    skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
   113	  });
   114	
   115	  const runControls = document.createElement('div');
   116	  runControls.className = 'skill-run-controls';
   117	  const modelSelect = renderSelect({
   118	    label: 'Model',
   119	    value: skillModalState.codexModel,
   120	    options: codexModelOptions,
   121	    onChange: (value) => {
   122	      skillModalState.codexModel = value;
   123	      telemetry('codex-skill-model-selected', { cardId: skillModalState.cardId, codexModel: value });
   124	    },
   125	  });
   126	  const effortSelect = renderSelect({
   127	    label: 'Effort',
   128	    value: skillModalState.codexEffort,
   129	    options: codexEffortOptions,
   130	    onChange: (value) => {
   131	      skillModalState.codexEffort = value;
   132	      telemetry('codex-skill-effort-selected', { cardId: skillModalState.cardId, codexEffort: value });
   133	    },
   134	  });
   135	  runControls.replaceChildren(modelSelect, effortSelect);
   136	
   137	  const results = document.createElement('div');
   138	  results.className = 'skill-results';
   139	  if (skillModalState.loading) {
   140	    const loading = document.createElement('p');
   141	    loading.className = 'skill-empty';
   142	    loading.textContent = 'Loading skills';
   143	    results.replaceChildren(loading);
   144	  } else {
   145	    const rows = filteredSkills().map(renderSkillRow);
   146	    if (rows.length > 0) results.replaceChildren(...rows);
   147	    else {
   148	      const empty = document.createElement('p');
   149	      empty.className = 'skill-empty';
   150	      empty.textContent = 'No matching skills';
   151	      results.replaceChildren(empty);
   152	    }
   153	  }
   154	
   155	  const actions = document.createElement('div');
   156	  actions.className = 'skill-actions';
   157	  if (skillModalState.error) {
   158	    const error = document.createElement('p');
   159	    error.className = 'skill-error';
   160	    error.textContent = skillModalState.error;
   161	    actions.append(error);
   162	  }
   163	  if (skillModalState.selectedSkillName) {
   164	    const selectedName = document.createElement('span');
   165	    selectedName.className = 'skill-selected-name';
   166	    selectedName.title = skillModalState.selectedSkillName;
   167	    selectedName.textContent = skillModalState.selectedSkillName;
   168	    actions.append(selectedName);
   169	
   170	    const process = document.createElement('button');
   171	    process.className = 'skill-process-button';
   172	    process.type = 'button';
   173	    process.dataset.action = 'process-card-skill';
   174	    process.disabled = skillModalState.processing;
   175	    process.textContent = skillModalState.processing ? 'Processing' : 'Process';
   176	    actions.append(process);
   177	  }
   178	  const close = document.createElement('button');
   179	  close.type = 'button';
   180	  close.dataset.action = 'close-card-skill-modal';
   181	  close.textContent = 'Close';
   182	  actions.append(close);
   183	
   184	  skillModal.setAttribute('aria-labelledby', 'skill-modal-title');
   185	  skillModal.replaceChildren(title, search, runControls, results, actions);
   186	  if (options.resultsScrollTop !== undefined) results.scrollTop = options.resultsScrollTop;
   187	}
   188	
   189	export async function openCardSkillModal(cardId: string): Promise<void> {
   190	  if (!skillModal || !cardId) return;
   191	  Object.assign(skillModalState, { cardId, query: '', selectedSkillName: '', skills: [], loading: true, processing: false, error: '' });
   192	  renderSkillModal();
   193	  skillModal.showModal?.();
   194	  telemetry('codex-skill-modal-open', { cardId });
   195	  skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
   196	  skillModalState.skills = await loadCodexSkills();
   197	  skillModalState.loading = false;
   198	  renderSkillModal();
   199	  skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
   200	}
   201	
   202	export function selectCardSkill(skillName: string): void {
   203	  const resultsScrollTop = skillModal?.querySelector<HTMLDivElement>('.skill-results')?.scrollTop;
   204	  skillModalState.selectedSkillName = skillName;
   205	  skillModalState.error = '';
   206	  renderSkillModal({ resultsScrollTop });
   207	  telemetry('codex-skill-selected', { cardId: skillModalState.cardId, skillName });
   208	}
   209	
   210	export async function processSelectedCardSkill(): Promise<void> {
   211	  if (!skillModalState.cardId || !skillModalState.selectedSkillName || skillModalState.processing) return;
   212	  const resultsScrollTop = skillModal?.querySelector<HTMLDivElement>('.skill-results')?.scrollTop;
   213	  skillModalState.processing = true;
   214	  skillModalState.error = '';
   215	  renderSkillModal({ resultsScrollTop });
   216	  const ok = await processCardSkillController({
   217	    cardId: skillModalState.cardId,
   218	    skillName: skillModalState.selectedSkillName,
   219	    codexModel: skillModalState.codexModel,
   220	    codexEffort: skillModalState.codexEffort,
   221	  });
   222	  skillModalState.processing = false;
   223	  if (ok) {
   224	    skillModal?.close?.();
   225	    return;
   226	  }
   227	  skillModalState.error = 'Process failed';
   228	  renderSkillModal({ resultsScrollTop });
   229	}
   230	
   231	export function closeCardSkillModal(): void {
   232	  skillModal?.close?.();
   233	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-36","timestamp":"2026-07-07T17:00:47.727Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"36","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_19","codexTool":"/usr/bin/zsh -lc 'nl -ba frontend/src/runtime/codex/controller/process-card-skill-controller.ts && nl -ba frontend/src/runtime/codex/effect/request-card-skill-process.ts && nl -ba frontend/src/runtime/codex/effect/load-codex-skills.ts'"} -->

**Tool call** `/usr/bin/zsh -lc 'nl -ba frontend/src/runtime/codex/controller/process-card-skill-controller.ts && nl -ba frontend/src/runtime/codex/effect/request-card-skill-process.ts && nl -ba frontend/src/runtime/codex/effect/load-codex-skills.ts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-37","timestamp":"2026-07-07T17:00:47.728Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"37","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_19","codexTool":"/usr/bin/zsh -lc 'nl -ba frontend/src/runtime/codex/controller/process-card-skill-controller.ts && nl -ba frontend/src/runtime/codex/effect/request-card-skill-process.ts && nl -ba frontend/src/runtime/codex/effect/load-codex-skills.ts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'nl -ba frontend/src/runtime/codex/controller/process-card-skill-controller.ts && nl -ba frontend/src/runtime/codex/effect/request-card-skill-process.ts && nl -ba frontend/src/runtime/codex/effect/load-codex-skills.ts'`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Starts a selected card skill run and refreshes the active canvas.
     3	 * WHY: The new output card and relationship are server-authored ledger state.
     4	 */
     5	import { state } from '../../state.js';
     6	import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
     7	import { telemetry } from '../../telemetry/effect/telemetry.js';
     8	import { requestCardSkillProcess } from '../effect/request-card-skill-process.js';
     9	
    10	export async function processCardSkillController(input: { cardId: string; skillName: string; codexModel?: string; codexEffort?: string }): Promise<boolean> {
    11	  const ledgerId = String(state.activeTab ?? '').trim();
    12	  if (!ledgerId || !input.cardId || !input.skillName) return false;
    13	  telemetry('codex-skill-process-start', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '' });
    14	  const result = await requestCardSkillProcess({ ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel, codexEffort: input.codexEffort });
    15	  if (!result.ok) {
    16	    telemetry('codex-skill-process-failed', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', error: result.error ?? '' });
    17	    return false;
    18	  }
    19	  await refreshRuntimeState();
    20	  telemetry('codex-skill-process-created-card', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', run: result.run?.id ?? '' });
    21	  return true;
    22	}
     1	/**
     2	 * WHAT: Starts a backend Codex skill process for one card.
     3	 * WHY: The UI should delegate output card creation and process ownership to the server.
     4	 */
     5	export type CardSkillProcessRequest = {
     6	  ledgerId: string;
     7	  cardId: string;
     8	  skillName: string;
     9	  codexModel?: string;
    10	  codexEffort?: string;
    11	};
    12	
    13	export async function requestCardSkillProcess(input: CardSkillProcessRequest): Promise<{ ok: boolean; run?: Record<string, unknown>; error?: string }> {
    14	  const response = await fetch('/api/codex/skills/process', {
    15	    method: 'POST',
    16	    headers: { 'content-type': 'application/json' },
    17	    body: JSON.stringify(input),
    18	  }).catch(() => undefined);
    19	  if (!response) return { ok: false, error: 'Request failed.' };
    20	  const body = await response.json().catch(() => ({})) as { ok?: boolean; run?: Record<string, unknown>; error?: string };
    21	  return { ok: response.ok && body.ok !== false, run: body.run, error: body.error };
    22	}
     1	/**
     2	 * WHAT: Loads Codex skill summaries from the backend.
     3	 * WHY: The skill modal needs server-authoritative names and descriptions.
     4	 */
     5	export type CodexSkillSummary = {
     6	  name: string;
     7	  description: string;
     8	  source: string;
     9	};
    10	
    11	export async function loadCodexSkills(): Promise<CodexSkillSummary[]> {
    12	  const response = await fetch('/api/codex/skills').catch(() => undefined);
    13	  if (!response?.ok) return [];
    14	  const body = await response.json().catch(() => null) as { skills?: CodexSkillSummary[] } | null;
    15	  return Array.isArray(body?.skills) ? body.skills : [];
    16	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-38","timestamp":"2026-07-07T17:00:47.729Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"38","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_20","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts | sed -n '120,180p' && nl -ba frontend/src/runtime/input/controller/handle-action-click.ts | sed -n '100,145p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts | sed -n '120,180p' && nl -ba frontend/src/runtime/input/controller/handle-action-click.ts | sed -n '100,145p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-39","timestamp":"2026-07-07T17:00:47.730Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"39","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_20","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts | sed -n '120,180p' && nl -ba frontend/src/runtime/input/controller/handle-action-click.ts | sed -n '100,145p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts | sed -n '120,180p' && nl -ba frontend/src/runtime/input/controller/handle-action-click.ts | sed -n '100,145p'"`
Status: completed
Exit code: 0

````text
   120	}
   121	
   122	function syncCardControls(group: HTMLElement, card: HTMLElement): boolean {
   123	  if (!card.classList.contains('ledger-node')) return false;
   124	  const cardId = card.dataset.cardId ?? '';
   125	  if (!cardId) return false;
   126	  const persistedStatus = card.dataset.cardStatus === 'done' ? 'done' : 'todo';
   127	  const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;
   128	  const cardZoneColor = card.dataset.cardZoneColor || card.style.getPropertyValue('--card-zone-color').trim();
   129	  group.className = 'canvas-control canvas-control--card';
   130	  group.dataset.cardId = cardId;
   131	  if (cardZoneColor) group.style.setProperty('--card-zone-color', cardZoneColor);
   132	  else group.style.removeProperty('--card-zone-color');
   133	  const edit = document.createElement('button');
   134	  edit.className = 'icon-button terminal-button terminal-button--compact';
   135	  edit.type = 'button';
   136	  edit.dataset.action = 'edit-card-title';
   137	  edit.dataset.cardId = cardId;
   138	  edit.title = card.dataset.targetLedgerId ? 'Edit ledger name' : 'Edit card title';
   139	  edit.ariaLabel = edit.title;
   140	  edit.textContent = '✎';
   141	  const editBody = document.createElement('button');
   142	  editBody.className = 'ledger-card-edit-toggle terminal-button terminal-button--compact';
   143	  editBody.type = 'button';
   144	  editBody.dataset.action = 'edit-card-description';
   145	  editBody.dataset.cardId = cardId;
   146	  editBody.title = 'Edit card content';
   147	  editBody.setAttribute('aria-label', editBody.title);
   148	  editBody.textContent = 'edit';
   149	  const skill = document.createElement('button');
   150	  skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';
   151	  skill.type = 'button';
   152	  skill.dataset.action = 'open-card-skill-modal';
   153	  skill.dataset.cardId = cardId;
   154	  skill.title = 'Run Codex skill';
   155	  skill.setAttribute('aria-label', skill.title);
   156	  skill.textContent = 'fx';
   157	  const controls = card.dataset.targetLedgerId
   158	    ? [edit, renderLedgerCardDeleteButton(cardId)]
   159	    : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];
   160	  group.replaceChildren(...controls);
   161	  return placeControlGroup(group, card, 'right');
   162	}
   163	
   164	function syncZoneControls(group: HTMLElement, zone: HTMLElement, kind: 'zone' | 'group'): boolean {
   165	  const id = kind === 'zone' ? zone.dataset.zoneId ?? '' : zone.dataset.groupId ?? '';
   166	  if (!id) return false;
   167	  group.className = `canvas-control canvas-control--${kind}`;
   168	  if (kind === 'zone') group.dataset.zoneId = id;
   169	  else group.dataset.groupId = id;
   170	
   171	  const edit = document.createElement('button');
   172	  edit.className = 'icon-button terminal-button terminal-button--compact';
   173	  edit.type = 'button';
   174	  edit.dataset.action = 'edit-zone';
   175	  if (kind === 'zone') edit.dataset.zoneId = id;
   176	  else edit.dataset.groupId = id;
   177	  edit.title = kind === 'zone' ? 'Edit zone name' : 'Edit group name';
   178	  edit.ariaLabel = edit.title;
   179	  edit.textContent = '✎';
   180	  const controls: HTMLElement[] = [edit];
   100	  }
   101	  if (action === 'confirm-delete-card') {
   102	    confirmCardDeletionController({ cardId: actionTarget.dataset.cardId ?? '' });
   103	    return;
   104	  }
   105	  if (action === 'confirm-delete-card-image') {
   106	    confirmCardImageDeletionController({
   107	      cardId: actionTarget.dataset.cardId ?? '',
   108	      imageSrc: actionTarget.dataset.imageSrc ?? '',
   109	      carouselSources: actionTarget.dataset.carouselSources,
   110	      carouselSlideIndex: actionTarget.dataset.carouselSlideIndex
   111	    });
   112	    return;
   113	  }
   114	  if (action === 'toggle-card-status') {
   115	    const status = actionTarget.dataset.nextStatus === 'todo' ? 'todo' : 'done';
   116	    await toggleCardStatusController({ cardId: actionTarget.dataset.cardId ?? '', status });
   117	    return;
   118	  }
   119	  if (action === 'open-card-skill-modal') {
   120	    await openCardSkillModal(actionTarget.dataset.cardId ?? '');
   121	    return;
   122	  }
   123	  if (action === 'select-card-skill') {
   124	    selectCardSkill(actionTarget.dataset.skillName ?? '');
   125	    return;
   126	  }
   127	  if (action === 'process-card-skill') {
   128	    await processSelectedCardSkill();
   129	    return;
   130	  }
   131	  if (action === 'close-card-skill-modal') {
   132	    closeCardSkillModal();
   133	    return;
   134	  }
   135	  if (action === 'edit-card-title') {
   136	    const cardId = actionTarget.dataset.cardId ?? '';
   137	    const card = cardId
   138	      ? document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`) as HTMLElement | null
   139	      : targetElement.closest('[data-card-id]') as HTMLElement | null;
   140	    if (card) beginLedgerCardTitleEdit(card);
   141	    return;
   142	  }
   143	  if (action === 'edit-card-description') {
   144	    const cardId = actionTarget.dataset.cardId ?? '';
   145	    const card = cardId
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-40","timestamp":"2026-07-07T17:00:47.731Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"40","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_21"} -->

There is no evidence yet of a pipeline object or staged execution queue; the current model is one operator action to one selected skill run. I’m checking tab/state handling to locate where a two-tab process surface would fit.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-41","timestamp":"2026-07-07T17:00:47.732Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"41","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_22","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/ledger/helper/normalize-decision-os-state.ts | sed -n '1,260p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/ledger/helper/normalize-decision-os-state.ts | sed -n '1,260p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-42","timestamp":"2026-07-07T17:00:47.733Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"42","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_23","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/ledger/controller/load-tab-ledgers-controller.ts | sed -n '1,220p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/ledger/controller/load-tab-ledgers-controller.ts | sed -n '1,220p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-43","timestamp":"2026-07-07T17:00:47.734Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"43","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_23","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/ledger/controller/load-tab-ledgers-controller.ts | sed -n '1,220p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/ledger/controller/load-tab-ledgers-controller.ts | sed -n '1,220p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Implements the load-tab-ledgers-controller controller from the front/back master ledger.
     3	 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
     4	 */
     5	import { readDecisionOsState } from '@backend/business/ledger/helper/read-decision-os-state.js';
     6	import { readLedgerJsonFile } from '@backend/business/ledger/helper/read-ledger-json-file.js';
     7	import { validateLedgerDocument } from '@backend/business/ledger/helper/validate-ledger-document.js';
     8	import { writeDecisionOsState } from '@backend/business/ledger/effect/write-decision-os-state.js';
     9	
    10	type AnyRecord = Record<string, unknown>;
    11	
    12	export async function loadTabLedgersController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
    13	  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
    14	  const payload = (envelope.action_payload ?? input) as AnyRecord;
    15	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
    16	  const data = (envelope.data_model ?? {}) as AnyRecord;
    17	  const state = readDecisionOsState({ action_payload: payload, runtime_state: runtime, data_model: data });
    18	  const ledger = readLedgerJsonFile({ action_payload: { ...payload, ...state }, runtime_state: runtime, data_model: data });
    19	  const validation = validateLedgerDocument({ action_payload: { ...payload, document: ledger.document }, runtime_state: runtime, data_model: data });
    20	  writeDecisionOsState({ action_payload: { ...payload, state, ledger, validation }, runtime_state: runtime, data_model: data });
    21	  return { ok: state.ok !== false && ledger.ok !== false && validation.ok !== false, state, ledger, validation };
    22	}
    23	
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-44","timestamp":"2026-07-07T17:00:47.735Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"44","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_22","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/ledger/helper/normalize-decision-os-state.ts | sed -n '1,260p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/ledger/helper/normalize-decision-os-state.ts | sed -n '1,260p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Normalizes decision-os workspace state to the canonical ledgers registry.
     3	 * WHY: The app no longer exposes tabs as the model name; legacy tabs are read only for migration.
     4	 */
     5	export type DecisionOsLedgerEntry = {
     6	  id: string;
     7	  title: string;
     8	  ledgerFile: string;
     9	  cardId?: string;
    10	};
    11	
    12	type AnyRecord = Record<string, unknown>;
    13	
    14	function isRecord(value: unknown): value is AnyRecord {
    15	  return value !== null && typeof value === 'object' && !Array.isArray(value);
    16	}
    17	
    18	export function normalizeDecisionOsState(rawState: unknown): { state: { ledgers: DecisionOsLedgerEntry[] }; migrated: boolean } {
    19	  const source = isRecord(rawState) ? rawState : {};
    20	  const rawLedgers = Array.isArray(source.ledgers) ? source.ledgers : Array.isArray(source.tabs) ? source.tabs : [];
    21	  const ledgers = rawLedgers.map((entry) => {
    22	    const record = isRecord(entry) ? entry : {};
    23	    const id = String(record.id ?? '').trim();
    24	    const title = String(record.title ?? id).trim();
    25	    const ledgerFile = String(record.ledgerFile ?? '').trim();
    26	    if (!id || !title || !ledgerFile) return null;
    27	    const cardId = String(record.cardId ?? '').trim();
    28	    return { id, title, ledgerFile, ...(cardId ? { cardId } : {}) };
    29	  }).filter(Boolean) as DecisionOsLedgerEntry[];
    30	  const migrated = !Array.isArray(source.ledgers) || Array.isArray(source.tabs);
    31	  return { state: { ledgers }, migrated };
    32	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-45","timestamp":"2026-07-07T17:00:47.736Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"45","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_24","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/boot/controller/boot-surface.ts | sed -n '1,120p' && nl -ba frontend/src/runtime/state.ts | sed -n '1,180p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/boot/controller/boot-surface.ts | sed -n '1,120p' && nl -ba frontend/src/runtime/state.ts | sed -n '1,180p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-46","timestamp":"2026-07-07T17:00:47.737Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"46","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_24","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/boot/controller/boot-surface.ts | sed -n '1,120p' && nl -ba frontend/src/runtime/state.ts | sed -n '1,180p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/boot/controller/boot-surface.ts | sed -n '1,120p' && nl -ba frontend/src/runtime/state.ts | sed -n '1,180p'"`
Status: completed
Exit code: 0

````text
     1	import { state } from '../../state.js';
     2	import { SPEC_IMPLEMENTATION_SURFACE } from '../../spec-implementation-surface.js';
     3	import { bindInputs } from '../../input/effect/bind-inputs.js';
     4	import { hydratePersistedGeometry } from '../../persistence/effect/hydrate-persisted-geometry.js';
     5	import { loadDecisionOsState } from '../../ledger/effect/load-decision-os-state.js';
     6	import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
     7	import { readPersistedState } from '../../persistence/helper/read-persisted-state.js';
     8	import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
     9	import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
    10	import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
    11	import { subscribeLedgerContentEvents } from '../../refresh/effect/subscribe-ledger-content-events.js';
    12	import { routeCanvasMode } from '../../navigation/helper/route-canvas-mode.js';
    13	import { routeTab } from '../../navigation/helper/route-tab.js';
    14	import { applyRailCollapsedState } from '../../toolbox/effect/apply-rail-collapsed-state.js';
    15	import { telemetry } from '../../telemetry/effect/telemetry.js';
    16	
    17	export function bootSurface(): void {
    18	  const persisted = readPersistedState();
    19	  state.canvasMode = routeCanvasMode(window.location.pathname);
    20	  state.activeTab = routeTab(window.location.pathname);
    21	  state.activeLedgerId = state.activeTab;
    22	  state.viewports = persisted.viewports && typeof persisted.viewports === 'object' ? persisted.viewports : state.viewports;
    23	  const restoredViewport = state.canvasMode === 'ledgers' ? {} : state.viewports?.[state.activeTab] ?? persisted.viewport ?? {};
    24	  Object.assign(state.viewport, restoredViewport);
    25	  applyRailCollapsedState(persisted.railCollapsed === true);
    26	  telemetry('browser-load', { routePath: state.routePath });
    27	  telemetry('derive-route-state', { activeTab: state.activeTab });
    28	  telemetry('load-ledger-state', { restored: Boolean(persisted.viewport) });
    29	  telemetry('map-spec-implementation-surface', { specs: SPEC_IMPLEMENTATION_SURFACE.length });
    30	  hydratePersistedGeometry(persisted.geometry);
    31	  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    32	  telemetry('clear-transient-selection', { reason: 'boot' });
    33	  bindInputs();
    34	  subscribeLedgerContentEvents();
    35	  renderTabRegistry();
    36	  void loadDecisionOsState().then(loadActiveLedgerState).then(renderCanvasSurface);
    37	  renderCanvasSurface();
    38	  renderThreadPanel();
    39	}
     1	export const state: any = {
     2	  routePath: globalThis.window?.location?.pathname ?? '/',
     3	  projectName: 'Project',
     4	  canvasMode: 'ledger',
     5	  activeLedgerId: 'specs',
     6	  activeTab: 'specs',
     7	  ledgers: [
     8	    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
     9	    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
    10	  ],
    11	  ledgerTabs: [
    12	    { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
    13	    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' }
    14	  ],
    15	  activeLedger: null,
    16	  activeTool: 'select',
    17	  railCollapsed: false,
    18	  zoneColor: '#55b8ff',
    19	  cardCounter: 1,
    20	  zoneCounter: 3,
    21	  groupCounter: 2,
    22	  viewport: { x: 0, y: 0, scale: 1 },
    23	  surfaceViewport: { x: 0, y: 0, scale: 1 },
    24	  viewports: { specs: { x: 0, y: 0, scale: 1 }, data: { x: 0, y: 0, scale: 1 } },
    25	  cardUi: { openCardIds: [], activeTabByCardId: {} },
    26	  zoneAttributionCache: null,
    27	  selection: { cardIds: [], zoneIds: [], groupIds: [] },
    28	  pointer: null,
    29	  clipboard: null,
    30	  threadId: '',
    31	  renderedThreadId: '',
    32	  threadScrollTopByThreadId: {},
    33	  threadPanelOpen: false,
    34	  voice: { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'idle' },
    35	  telemetry: []
    36	};
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-47","timestamp":"2026-07-07T17:00:47.738Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"47","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_25","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/business/navigation/helper/derive-route-state.ts | sed -n '1,220p' && nl -ba frontend/src/business/navigation/effect/render-tab-registry.ts | sed -n '1,220p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/business/navigation/helper/derive-route-state.ts | sed -n '1,220p' && nl -ba frontend/src/business/navigation/effect/render-tab-registry.ts | sed -n '1,220p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-48","timestamp":"2026-07-07T17:00:47.739Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"48","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_25","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/business/navigation/helper/derive-route-state.ts | sed -n '1,220p' && nl -ba frontend/src/business/navigation/effect/render-tab-registry.ts | sed -n '1,220p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/business/navigation/helper/derive-route-state.ts | sed -n '1,220p' && nl -ba frontend/src/business/navigation/effect/render-tab-registry.ts | sed -n '1,220p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Implements the derive-route-state helper from the front/back master ledger.
     3	 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
     4	 */
     5	import { telemetry } from '@frontend/telemetry/harness.js';
     6	
     7	type AnyRecord = Record<string, unknown>;
     8	
     9	export function deriveRouteState(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
    10	  telemetry('derive-route-state', { role: 'helper', action: 'derive-route-state' });
    11	  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
    12	  const payload = (envelope.action_payload ?? input) as AnyRecord;
    13	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
    14	  const data = (envelope.data_model ?? {}) as AnyRecord;
    15	  const activeNavTabId = String(payload.activeNavTabId ?? payload.tabId ?? runtime.activeNavTabId ?? 'default');
    16	  const activeCanvasId = String(payload.activeCanvasId ?? payload.canvasId ?? runtime.activeCanvasId ?? 'main');
    17	  return { ok: activeNavTabId.length > 0 && activeCanvasId.length > 0, activeNavTabId, activeCanvasId, route: { tabId: activeNavTabId, canvasId: activeCanvasId } };
    18	}
    19	
     1	/**
     2	 * WHAT: Implements the render-tab-registry effect from the front/back master ledger.
     3	 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
     4	 */
     5	import { telemetry } from '@frontend/telemetry/harness.js';
     6	
     7	type AnyRecord = Record<string, unknown>;
     8	
     9	export function renderTabRegistry(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
    10	  telemetry('render-tab-registry', { role: 'effect', action: 'render-tab-registry' });
    11	  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
    12	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
    13	  const payload = (envelope.action_payload ?? input) as AnyRecord;
    14	  runtime.last_effect = 'render-tab-registry';
    15	  runtime.last_payload = payload;
    16	}
    17	
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-49","timestamp":"2026-07-07T17:00:47.740Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"49","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_26","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/navigation/effect/render-tab-registry.ts | sed -n '1,260p' && nl -ba frontend/src/runtime/navigation/helper/route-tab.ts | sed -n '1,160p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/navigation/effect/render-tab-registry.ts | sed -n '1,260p' && nl -ba frontend/src/runtime/navigation/helper/route-tab.ts | sed -n '1,160p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-50","timestamp":"2026-07-07T17:00:47.741Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"50","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_27","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"function renderTabRegistry|export function renderTabRegistry|routeTab|tabs\\\" frontend/src/runtime frontend/src/business/navigation tests/browser/navigation tests/browser/refresh backend/test/ledger backend/test/server -g '\"'!**/node_modules/**'\"'\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"function renderTabRegistry|export function renderTabRegistry|routeTab|tabs\" frontend/src/runtime frontend/src/business/navigation tests/browser/navigation tests/browser/refresh backend/test/ledger backend/test/server -g '"'!**/node_modules/**'"'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-51","timestamp":"2026-07-07T17:00:47.742Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"51","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_26","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/navigation/effect/render-tab-registry.ts | sed -n '1,260p' && nl -ba frontend/src/runtime/navigation/helper/route-tab.ts | sed -n '1,160p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/navigation/effect/render-tab-registry.ts | sed -n '1,260p' && nl -ba frontend/src/runtime/navigation/helper/route-tab.ts | sed -n '1,160p'"`
Status: completed
Exit code: 0

````text
     1	import { state } from '../../state.js';
     2	import { activeLedgers } from '../../ledger/helper/active-ledgers.js';
     3	import { telemetry } from '../../telemetry/effect/telemetry.js';
     4	
     5	export function renderTabRegistry(): void {
     6	  const ledgers = activeLedgers().filter((ledger: { id: string }, index: number, list: Array<{ id: string }>) => (
     7	    list.findIndex((candidate) => candidate.id === ledger.id) === index
     8	  ));
     9	  const activeLedgerTitle = ledgers.find((ledger: { id: string }) => ledger.id === state.activeTab)?.title;
    10	  const projectName = String(state.projectName || 'Project').trim() || 'Project';
    11	  const ledgerTitle = state.canvasMode === 'ledgers'
    12	    ? 'Ledgers'
    13	    : typeof activeLedgerTitle === 'string' && activeLedgerTitle.trim()
    14	      ? activeLedgerTitle
    15	      : state.activeTab;
    16	  const identityTitle = `${projectName} | ${ledgerTitle}`;
    17	  document.title = identityTitle;
    18	
    19	  const titleAction = document.querySelector('.topbar-title-action') as HTMLElement | null;
    20	  if (titleAction) titleAction.textContent = ledgerTitle;
    21	  const kicker = document.querySelector('.topbar .kicker') as HTMLElement | null;
    22	  if (kicker) kicker.textContent = projectName;
    23	
    24	  const registry = document.querySelector('.tabs') as HTMLElement | null;
    25	  if (registry) {
    26	    registry.replaceChildren();
    27	  }
    28	  document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('active', state.canvasMode === 'ledger' && (tab as HTMLElement).dataset.tab === state.activeTab));
    29	  telemetry('render-tab-registry', { activeTab: state.activeTab, canvasMode: state.canvasMode, projectName, ledgers: ledgers.map((ledger: { id: string }) => ledger.id), source: 'decision-os-state' });
    30	}
     1	import { state } from '../../state.js';
     2	import { activeLedgers } from '../../ledger/helper/active-ledgers.js';
     3	
     4	export function routeTab(path: string): string {
     5	  const tab = path.split('/').filter(Boolean)[0];
     6	  const tabs = activeLedgers().map((entry: { id: string }) => entry.id);
     7	  return tabs.includes(tab) ? tab : tabs[0] ?? 'specs';
     8	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-52","timestamp":"2026-07-07T17:00:47.743Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"52","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_27","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"function renderTabRegistry|export function renderTabRegistry|routeTab|tabs\\\" frontend/src/runtime frontend/src/business/navigation tests/browser/navigation tests/browser/refresh backend/test/ledger backend/test/server -g '\"'!**/node_modules/**'\"'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"function renderTabRegistry|export function renderTabRegistry|routeTab|tabs\" frontend/src/runtime frontend/src/business/navigation tests/browser/navigation tests/browser/refresh backend/test/ledger backend/test/server -g '"'!**/node_modules/**'"'"`
Status: completed
Exit code: 0

````text
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:18:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:47:test('ledgers canvas migrates tabs to ledgers and persists overview edits', async () => {
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:57:    const state = JSON.parse(readFileSync(join(workspace, '.decision-os', 'state.json'), 'utf8')) as { tabs?: unknown; ledgers: Array<Record<string, unknown>> };
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:58:    assert.equal(state.tabs, undefined);
backend/test/ledger/decision-os-default-tabs.integration.test.ts:9:test('Ledgers in .decision-os load as default tabs unless invalid', async () => {
backend/test/ledger/decision-os-default-tabs.integration.test.ts:32:  console.log(JSON.stringify({ specId: '9c31f0a4', suiteName: 'Ledgers in .decision-os load as default tabs unless invalid', controllerName: ["load-tab-ledgers-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
backend/test/server/decision-os-zone-mutations.integration.test.ts:17:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/server/decision-os-zone-mutations.integration.test.ts:330:    tabs: [{ id: 'game-design', title: 'Game Design', ledgerFile: '.decision-os/game-design.json' }]
backend/test/server/decision-os-ledger-create.integration.test.ts:16:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
backend/test/server/decision-os-ledger-create.integration.test.ts:47:    const state = JSON.parse(readFileSync(join(workspace, '.decision-os', 'state.json'), 'utf8')) as { tabs?: unknown; ledgers: Array<{ id: string }> };
backend/test/server/decision-os-ledger-create.integration.test.ts:48:    assert.equal(state.tabs, undefined);
tests/browser/navigation/tab-click-loads-the-active-ledger-graph-into-the-canvas.spec.ts:3: * WHY: Navigation tabs must run the full derive-route, load-ledger-state, render-canvas-surface flow.
backend/test/server/decision-os-content-files.integration.test.ts:16:    tabs: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:2: * WHAT: Integration test for spec e6a91d34: decision-os state drives ledger tabs and routes.
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:3: * WHY: Specs and data tabs must map to the hidden decision-os .decision-os ledgers.
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:9:test('decision-os state drives ledger tabs and routes.', async () => {
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:10:  await assertFrontendSpec('decision-os state drives ledger tabs and routes.', 'e6a91d34', 'navigation');
frontend/src/business/navigation/effect/render-tab-registry.ts:9:export function renderTabRegistry(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): void {
frontend/src/runtime/navigation/helper/route-tab.ts:4:export function routeTab(path: string): string {
frontend/src/runtime/navigation/helper/route-tab.ts:6:  const tabs = activeLedgers().map((entry: { id: string }) => entry.id);
frontend/src/runtime/navigation/helper/route-tab.ts:7:  return tabs.includes(tab) ? tab : tabs[0] ?? 'specs';
frontend/src/runtime/refresh/controller/refresh-runtime-state.ts:8:import { routeTab } from '../../navigation/helper/route-tab.js';
frontend/src/runtime/refresh/controller/refresh-runtime-state.ts:17:  if (state.canvasMode === 'ledger') state.activeTab = routeTab(window.location.pathname);
frontend/src/runtime/boot/controller/boot-surface.ts:13:import { routeTab } from '../../navigation/helper/route-tab.js';
frontend/src/runtime/boot/controller/boot-surface.ts:20:  state.activeTab = routeTab(window.location.pathname);
frontend/src/runtime/input/effect/bind-inputs.ts:28:import { routeTab } from '../../navigation/helper/route-tab.js';
frontend/src/runtime/input/effect/bind-inputs.ts:50:  document.querySelector('.tabs')?.addEventListener('click', async (event) => {
frontend/src/runtime/input/effect/bind-inputs.ts:101:      const nextLedger = routeTab(window.location.pathname);
frontend/src/runtime/navigation/effect/render-tab-registry.ts:5:export function renderTabRegistry(): void {
frontend/src/runtime/navigation/effect/render-tab-registry.ts:24:  const registry = document.querySelector('.tabs') as HTMLElement | null;
frontend/src/runtime/ledger/effect/create-new-ledger.ts:12:  state?: { ledgers?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }>; tabs?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }> };
frontend/src/runtime/ledger/effect/create-new-ledger.ts:35:  const ledgers = payload.state?.ledgers ?? payload.state?.tabs;
frontend/src/runtime/ledger/effect/load-decision-os-state.ts:4:import { routeTab } from '../../navigation/helper/route-tab.js';
frontend/src/runtime/ledger/effect/load-decision-os-state.ts:13:  const blueprintState = await response.json().catch(() => undefined) as { projectName?: string; ledgers?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }>; tabs?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }> } | undefined;
frontend/src/runtime/ledger/effect/load-decision-os-state.ts:16:  const ledgers = (blueprintState?.ledgers ?? blueprintState?.tabs ?? []).filter((ledger) => ledger.id && ledger.title);
frontend/src/runtime/ledger/effect/load-decision-os-state.ts:23:    state.activeTab = routeTab(window.location.pathname);
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:15:import { renderLedgerCardTabs } from './render-ledger-card-tabs.js';
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:88:  const tabs = fields.length > 0 ? [renderLedgerCardTabs(id, activeTab)] : [];
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:92:  detailLayer.replaceChildren(...(linkedLedgerCard ? [] : [createCardStatusIndicator(visibleStatus)]), ...labelNodes, createLedgerCardTitleRow(card, id), ...(codexRunWidget ? [codexRunWidget] : []), ...tabs, body);
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:2:  const tabs = document.createElement('div');
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:3:  tabs.className = 'ledger-card-tabs';
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:4:  tabs.dataset.spec = 'a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7';
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:5:  tabs.role = 'tablist';
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:17:    tabs.appendChild(tab);
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:19:  return tabs;
frontend/src/runtime/ledger/component/patch-ledger-card.ts:3: * WHY: Ledger cards own geometry, thread identity, tabs, labels, and markdown body rendering.
frontend/src/runtime/canvas/effect/set-canvas-layer-hidden.ts:3: * WHY: Ledger tabs must suppress static surface layers without relying on element-specific hidden behavior.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-53","timestamp":"2026-07-07T17:00:47.744Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"53","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_28","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/test/ledger/decision-os-default-tabs.integration.test.ts | sed -n '1,220p' && nl -ba tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts | sed -n '1,220p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/test/ledger/decision-os-default-tabs.integration.test.ts | sed -n '1,220p' && nl -ba tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts | sed -n '1,220p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-54","timestamp":"2026-07-07T17:00:47.745Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"54","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_28","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/test/ledger/decision-os-default-tabs.integration.test.ts | sed -n '1,220p' && nl -ba tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts | sed -n '1,220p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/test/ledger/decision-os-default-tabs.integration.test.ts | sed -n '1,220p' && nl -ba tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts | sed -n '1,220p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Integration test for spec 9c31f0a4.
     3	 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
     4	 */
     5	import test from 'node:test';
     6	import { traces } from '@backend/telemetry/harness.js';
     7	import { loadTabLedgersController } from '@backend/business/ledger/controller/load-tab-ledgers-controller.js';
     8	
     9	test('Ledgers in .decision-os load as default tabs unless invalid', async () => {
    10	  traces.length = 0;
    11	  const expectedTelemetry = ["read-decision-os-state","read-ledger-json-file","validate-ledger-document","write-decision-os-state"];
    12	  const argvPayload = {
    13	    ok: true,
    14	    mode: 'dry-run',
    15	    apply_command: true,
    16	    check_ledger_command: true,
    17	    report_command: true,
    18	    patch_doc_command: true,
    19	    ledger_command: 'mutate',
    20	    master_ledger_file: 'generated-master-ledger.md',
    21	    specs_ledger_file: 'generated-specs-ledger.json',
    22	    patch_batch_file: 'generated-patch-batch.json',
    23	    report_file: 'generated-report.json'
    24	  };
    25	  const actionPayload = { ...argvPayload, cli_command_argv: argvPayload, argv: argvPayload };
    26	  try {
    27	    await loadTabLedgersController({ action_payload: actionPayload });
    28	  } catch (error) {
    29	    console.log(JSON.stringify({ specId: '9c31f0a4', controllerName: 'load-tab-ledgers-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    30	  }
    31	  const actualTelemetry = traces.map((trace) => trace.name);
    32	  console.log(JSON.stringify({ specId: '9c31f0a4', suiteName: 'Ledgers in .decision-os load as default tabs unless invalid', controllerName: ["load-tab-ledgers-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
    33	});
     1	/**
     2	 * WHAT: Integration test for spec e6a91d34: decision-os state drives ledger tabs and routes.
     3	 * WHY: Specs and data tabs must map to the hidden decision-os .decision-os ledgers.
     4	 */
     5	
     6	import test from 'node:test';
     7	import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';
     8	
     9	test('decision-os state drives ledger tabs and routes.', async () => {
    10	  await assertFrontendSpec('decision-os state drives ledger tabs and routes.', 'e6a91d34', 'navigation');
    11	});
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-55","timestamp":"2026-07-07T17:00:47.746Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"55","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_29","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/input/effect/bind-inputs.ts | sed -n '40,115p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/input/effect/bind-inputs.ts | sed -n '40,115p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-56","timestamp":"2026-07-07T17:00:47.747Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"56","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_30","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/ledger/effect/load-decision-os-state.ts | sed -n '1,140p' && nl -ba frontend/src/runtime/ledger/helper/active-ledgers.ts | sed -n '1,120p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/ledger/effect/load-decision-os-state.ts | sed -n '1,140p' && nl -ba frontend/src/runtime/ledger/helper/active-ledgers.ts | sed -n '1,120p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-57","timestamp":"2026-07-07T17:00:47.748Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"57","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_29","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/input/effect/bind-inputs.ts | sed -n '40,115p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/input/effect/bind-inputs.ts | sed -n '40,115p'"`
Status: completed
Exit code: 0

````text
    40	      if (state.activeTool === 'thread') openThreadPanel();
    41	      renderCanvasSurface();
    42	    });
    43	  });
    44	
    45	  document.querySelector('[data-action="zone-color"]')?.addEventListener('input', (event) => {
    46	    state.zoneColor = (event.target as HTMLInputElement).value;
    47	    telemetry('resolve-tool-mode', { activeTool: 'zone', zoneColor: state.zoneColor });
    48	  });
    49	
    50	  document.querySelector('.tabs')?.addEventListener('click', async (event) => {
    51	    const overviewButton = (event.target as HTMLElement).closest('[data-action="open-ledgers-canvas"]') as HTMLElement | null;
    52	    if (overviewButton) {
    53	      await enterLedgersCanvasController();
    54	      return;
    55	    }
    56	    const createButton = (event.target as HTMLElement).closest('[data-action="create-ledger"]') as HTMLElement | null;
    57	    if (createButton) {
    58	      await createNewLedger();
    59	      return;
    60	    }
    61	    const button = (event.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
    62	    if (!button?.dataset.tab) return;
    63	    state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
    64	    persistState();
    65	    state.activeTab = button.dataset.tab;
    66	    history.pushState({}, '', `/${state.activeTab}`);
    67	    telemetry('browser-route-change', { activeTab: state.activeTab });
    68	    telemetry('derive-route-state', { activeTab: state.activeTab });
    69	    await loadActiveLedgerState();
    70	    renderTabRegistry();
    71	    renderCanvasSurface();
    72	  });
    73	
    74	  canvas.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    75	  canvas.addEventListener('pointerdown', handlePointerDown);
    76	  canvas.addEventListener('pointermove', handlePointerMove);
    77	  canvas.addEventListener('pointerup', handlePointerUp);
    78	  canvas.addEventListener('pointercancel', finishPointer);
    79	  canvas.addEventListener('dragstart', handleNativeDragStart);
    80	  document.addEventListener('keydown', handleKeyboard);
    81	  document.addEventListener('paste', (event) => {
    82	    void pasteThreadImageController(event);
    83	  });
    84	  document.addEventListener('click', handleActionClick);
    85	  document.addEventListener('input', handleRegionColorInput);
    86	  document.addEventListener('input', (event) => {
    87	    if ((event.target as HTMLElement | null)?.closest('.thread-draft')) saveThreadDraft();
    88	  });
    89	  document.addEventListener('change', (event) => {
    90	    const input = event.target as HTMLInputElement | null;
    91	    if (input?.matches('.thread-file-input')) void uploadThreadFileController(input);
    92	  });
    93	  document.addEventListener('change', handleRegionColorChange);
    94	  window.addEventListener('popstate', () => {
    95	    state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
    96	    persistState();
    97	    state.canvasMode = routeCanvasMode(window.location.pathname);
    98	    if (state.canvasMode === 'ledgers') {
    99	      void enterLedgersCanvasController({ replace: true });
   100	    } else {
   101	      const nextLedger = routeTab(window.location.pathname);
   102	      telemetry('browser-route-change', { activeTab: nextLedger });
   103	      void enterLedgerController(nextLedger, { replace: true, canonicalMinScale: false });
   104	    }
   105	  });
   106	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-58","timestamp":"2026-07-07T17:00:47.749Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"58","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_30","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/ledger/effect/load-decision-os-state.ts | sed -n '1,140p' && nl -ba frontend/src/runtime/ledger/helper/active-ledgers.ts | sed -n '1,120p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/ledger/effect/load-decision-os-state.ts | sed -n '1,140p' && nl -ba frontend/src/runtime/ledger/helper/active-ledgers.ts | sed -n '1,120p'"`
Status: completed
Exit code: 0

````text
     1	import { state } from '../../state.js';
     2	import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
     3	import { routeCanvasMode } from '../../navigation/helper/route-canvas-mode.js';
     4	import { routeTab } from '../../navigation/helper/route-tab.js';
     5	import { telemetry } from '../../telemetry/effect/telemetry.js';
     6	
     7	export async function loadDecisionOsState(): Promise<void> {
     8	  const response = await fetch('/decision-os/state').catch(() => undefined);
     9	  if (!response?.ok) {
    10	    telemetry('load-decision-os-state', { ok: false });
    11	    return;
    12	  }
    13	  const blueprintState = await response.json().catch(() => undefined) as { projectName?: string; ledgers?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }>; tabs?: Array<{ id?: string; title?: string; ledgerFile?: string; cardId?: string }> } | undefined;
    14	  const projectName = String(blueprintState?.projectName ?? '').trim();
    15	  if (projectName) state.projectName = projectName;
    16	  const ledgers = (blueprintState?.ledgers ?? blueprintState?.tabs ?? []).filter((ledger) => ledger.id && ledger.title);
    17	  if (ledgers.length > 0) {
    18	    state.ledgers = ledgers;
    19	    state.ledgerTabs = ledgers;
    20	  }
    21	  state.canvasMode = routeCanvasMode(window.location.pathname);
    22	  if (state.canvasMode === 'ledger') {
    23	    state.activeTab = routeTab(window.location.pathname);
    24	    state.activeLedgerId = state.activeTab;
    25	  }
    26	  if (state.canvasMode === 'ledger' && !state.ledgers.some((ledger: { id: string }) => ledger.id === state.activeTab)) {
    27	    state.activeTab = state.ledgers[0]?.id ?? state.activeTab;
    28	    state.activeLedgerId = state.activeTab;
    29	    history.replaceState?.({}, '', `/${state.activeTab}`);
    30	  }
    31	  telemetry('load-decision-os-state', { ok: true, ledgers: state.ledgers.map((ledger: { id: string }) => ledger.id), canvasMode: state.canvasMode });
    32	  renderTabRegistry();
    33	}
     1	/**
     2	 * WHAT: Returns the canonical frontend ledger registry with legacy fallback.
     3	 * WHY: Runtime code is migrating from tab language to ledger language without breaking older call sites.
     4	 */
     5	import { state } from '../../state.js';
     6	
     7	export function activeLedgers(): Array<{ id: string; title?: string; ledgerFile?: string; cardId?: string }> {
     8	  const ledgers = Array.isArray(state.ledgers) ? state.ledgers : [];
     9	  const legacyTabs = Array.isArray(state.ledgerTabs) ? state.ledgerTabs : [];
    10	  const ledgerIds = new Set(ledgers.map((entry: { id?: string }) => entry.id));
    11	  if (legacyTabs.some((entry: { id?: string }) => entry.id && !ledgerIds.has(entry.id))) return legacyTabs;
    12	  return ledgers.length > 0 ? ledgers : legacyTabs;
    13	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-59","timestamp":"2026-07-07T17:00:47.750Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"59","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_31","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/navigation/helper/route-canvas-mode.ts | sed -n '1,100p' && nl -ba backend/src/business/routing/helper/resolve-ledger-route.ts | sed -n '1,160p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/navigation/helper/route-canvas-mode.ts | sed -n '1,100p' && nl -ba backend/src/business/routing/helper/resolve-ledger-route.ts | sed -n '1,160p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-60","timestamp":"2026-07-07T17:00:47.751Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"60","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_31","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/navigation/helper/route-canvas-mode.ts | sed -n '1,100p' && nl -ba backend/src/business/routing/helper/resolve-ledger-route.ts | sed -n '1,160p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/navigation/helper/route-canvas-mode.ts | sed -n '1,100p' && nl -ba backend/src/business/routing/helper/resolve-ledger-route.ts | sed -n '1,160p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Resolves whether the current route is a real ledger or the ledgers overview.
     3	 * WHY: `/ledgers` is a canvas mode, not a selectable ledger id.
     4	 */
     5	export function routeCanvasMode(path: string): 'ledger' | 'ledgers' {
     6	  return path.split('/').filter(Boolean)[0] === 'ledgers' ? 'ledgers' : 'ledger';
     7	}
     1	/**
     2	 * WHAT: Implements the resolve-ledger-route helper from the front/back master ledger.
     3	 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
     4	 */
     5	import { existsSync, readFileSync } from 'node:fs';
     6	import { resolve } from 'node:path';
     7	import { telemetry } from '@backend/telemetry/harness.js';
     8	
     9	type AnyRecord = Record<string, unknown>;
    10	
    11	export function resolveLedgerRoute(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
    12	  telemetry('resolve-ledger-route', { role: 'helper', action: 'resolve-ledger-route' });
    13	  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
    14	  const payload = (envelope.action_payload ?? input) as AnyRecord;
    15	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
    16	  const data = (envelope.data_model ?? {}) as AnyRecord;
    17	  const url = String(payload.url ?? payload.path ?? '/ledgers/default');
    18	  const isLedgerRoute = url.startsWith('/ledgers') || url.includes('ledger');
    19	  return { ok: isLedgerRoute, route: isLedgerRoute ? 'ledger-read' : 'not-found', ledgerFile: payload.ledgerFile ?? payload.master_ledger_file ?? 'generated-master-ledger.json' };
    20	}
    21	
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-61","timestamp":"2026-07-07T17:00:47.752Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"61","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_32"} -->

Tab state is driven by `.decision-os/state.json` through `state.ledgers`, with route IDs mapping directly to ledger IDs. I’m doing one more pass over tests/spec markers so the “linked specs” section can use actual IDs and titles instead of inferred names.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-62","timestamp":"2026-07-07T17:00:47.753Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"62","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_33","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/test/codex/read-card-skill-run-controller.test.ts | sed -n '1,260p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/test/codex/read-card-skill-run-controller.test.ts | sed -n '1,260p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-63","timestamp":"2026-07-07T17:00:47.754Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"63","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_33","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/test/codex/read-card-skill-run-controller.test.ts | sed -n '1,260p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/test/codex/read-card-skill-run-controller.test.ts | sed -n '1,260p'"`
Status: completed
Exit code: 0

````text
     1	import test from 'node:test';
     2	import assert from 'node:assert/strict';
     3	import { once } from 'node:events';
     4	import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
     5	import { tmpdir } from 'node:os';
     6	import { join } from 'node:path';
     7	import type { AddressInfo } from 'node:net';
     8	import type { Server } from 'node:http';
     9	import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
    10	
    11	test('card skill run route derives JSONL progress and persists thread notes', async () => {
    12	  const originalCwd = process.cwd();
    13	  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-'));
    14	  const startedAt = Date.now() - 600000;
    15	  const completedAt = new Date(startedAt + 90000);
    16	  const runId = `codex-skill-${startedAt}-feed1234`;
    17	  const outputCardId = `card-${runId}`;
    18	  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
    19	  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
    20	  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    21	    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
    22	  }, null, 2));
    23	  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    24	    cards: [{
    25	      id: outputCardId,
    26	      title: 'Skill Result',
    27	      cardType: 'codex-skill-run',
    28	      comment: { what: '# Finished Skill Result\n\nThe final card body replaced the initial run metadata.' },
    29	      facts: [],
    30	      fields: []
    31	    }],
    32	    annotations: [],
    33	    relationships: [],
    34	    notes: {}
    35	  }, null, 2));
    36	  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
    37	  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
    38	  writeFileSync(jsonlPath, [
    39	    JSON.stringify({ type: 'thread.started' }),
    40	    JSON.stringify({ type: 'item.completed', item: { id: 'msg-1', type: 'agent_message', text: 'Thinking text persisted.' } }),
    41	    JSON.stringify({ type: 'item.completed', item: { id: 'cmd-1', type: 'command_execution', command: 'rg TODO', aggregated_output: 'found TODO', exit_code: 0, status: 'completed' } }),
    42	    JSON.stringify({ type: 'item.completed', item: { id: 'file-1', type: 'file_change', changes: [{ path: 'result.md', kind: 'updated' }], status: 'completed' } }),
    43	    JSON.stringify({ type: 'turn.completed' }),
    44	  ].join('\n'));
    45	  writeFileSync(logPath, '');
    46	  utimesSync(jsonlPath, completedAt, completedAt);
    47	  utimesSync(logPath, completedAt, completedAt);
    48	
    49	  process.chdir(workspace);
    50	  const runtime: Record<string, unknown> = {};
    51	  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
    52	  const server = runtime.server as Server;
    53	  await once(server, 'listening');
    54	  const address = server.address() as AddressInfo;
    55	
    56	  try {
    57	    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}&since=2`);
    58	    assert.equal(response.status, 200);
    59	    const body = await response.json() as {
    60	      ok: boolean;
    61	      status: string;
    62	      lineCount: number;
    63	      elapsedMs: number;
    64	      toolCallCount: number;
    65	      agentMessageCount: number;
    66	      fileChangeCount: number;
    67	      events: Array<{ line: number }>;
    68	    };
    69	    assert.equal(body.ok, true);
    70	    assert.equal(body.status, 'complete');
    71	    assert.equal(body.lineCount, 5);
    72	    assert.ok(body.elapsedMs >= 89000 && body.elapsedMs <= 91000);
    73	    assert.equal(body.toolCallCount, 1);
    74	    assert.equal(body.agentMessageCount, 1);
    75	    assert.equal(body.fileChangeCount, 1);
    76	    assert.deepEqual(body.events.map((event) => event.line), [3, 4, 5]);
    77	
    78	    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as { threadFiles?: Record<string, string> };
    79	    assert.equal(ledger.threadFiles?.[`thread-${outputCardId}`], `.decision-os/threads/specs/thread-${outputCardId}.md`);
    80	    const thread = readFileSync(join(workspace, '.decision-os', 'threads', 'specs', `thread-${outputCardId}.md`), 'utf8');
    81	    assert.match(thread, /"codexKind":"agent_message"/);
    82	    assert.match(thread, /"codexKind":"tool_call"/);
    83	    assert.match(thread, /Tool call/);
    84	    assert.match(thread, /found TODO/);
    85	    assert.match(thread, /"codexKind":"file_change"/);
    86	    assert.match(thread, /Codex turn completed\./);
    87	  } finally {
    88	    server.close();
    89	    process.chdir(originalCwd);
    90	    rmSync(workspace, { recursive: true, force: true });
    91	  }
    92	});
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-64","timestamp":"2026-07-07T17:00:47.755Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"64","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_34","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"Codex|skill|process|pipeline|stage|headless|output card|linked output|two tabs|2 tabs|tab system|state drives|default tabs|active ledger|card-scoped\\\" tests frontend/test backend/test frontend/src backend/src -g '\"'!**/node_modules/**'\"'\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"Codex|skill|process|pipeline|stage|headless|output card|linked output|two tabs|2 tabs|tab system|state drives|default tabs|active ledger|card-scoped\" tests frontend/test backend/test frontend/src backend/src -g '"'!**/node_modules/**'"'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-65","timestamp":"2026-07-07T17:00:47.756Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"65","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_34","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"Codex|skill|process|pipeline|stage|headless|output card|linked output|two tabs|2 tabs|tab system|state drives|default tabs|active ledger|card-scoped\\\" tests frontend/test backend/test frontend/src backend/src -g '\"'!**/node_modules/**'\"'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"Codex|skill|process|pipeline|stage|headless|output card|linked output|two tabs|2 tabs|tab system|state drives|default tabs|active ledger|card-scoped\" tests frontend/test backend/test frontend/src backend/src -g '"'!**/node_modules/**'"'"`
Status: completed
Exit code: 0

````text
backend/src/business/codex/helper/build-card-skill-prompt.ts:2: * WHAT: Builds the stdin prompt for a card-scoped Codex skill run.
backend/src/business/codex/helper/build-card-skill-prompt.ts:3: * WHY: Headless Codex needs the selected skill, source card content, and output file contract in one deterministic payload.
backend/src/business/codex/helper/build-card-skill-prompt.ts:6:  skillName: string;
backend/src/business/codex/helper/build-card-skill-prompt.ts:13:    `$${input.skillName}`,
backend/src/business/codex/helper/build-card-skill-prompt.ts:15:    'You are processing one decision-os card from the active workspace.',
tests/launcher/decision-os-server-launcher.spec.mjs:7:import { execFileSync } from 'node:child_process';
tests/launcher/decision-os-server-launcher.spec.mjs:15:    const output = execFileSync(process.execPath, [resolve('bin/decision-os-server.mjs'), '--print-command'], { cwd: workspace, encoding: 'utf8' });
backend/src/business/codex/helper/resolve-codex-command.ts:2: * WHAT: Resolves the Codex CLI command and arguments for a headless workspace run.
backend/src/business/codex/helper/resolve-codex-command.ts:3: * WHY: The server process may not inherit the operator's interactive shell PATH.
backend/src/business/codex/helper/resolve-codex-command.ts:14:export type CodexCommand = {
backend/src/business/codex/helper/resolve-codex-command.ts:40:  return String(process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => resolve(directory, command));
backend/src/business/codex/helper/resolve-codex-command.ts:43:function nvmCodexCandidates(): string[] {
backend/src/business/codex/helper/resolve-codex-command.ts:56:function defaultCodexCandidates(): string[] {
backend/src/business/codex/helper/resolve-codex-command.ts:58:    resolve(dirname(process.execPath), 'codex'),
backend/src/business/codex/helper/resolve-codex-command.ts:59:    ...nvmCodexCandidates(),
backend/src/business/codex/helper/resolve-codex-command.ts:67:  for (const candidate of [...pathCandidates(command, workspaceRoot), ...defaultCodexCandidates()]) {
backend/src/business/codex/helper/resolve-codex-command.ts:86:export function isAllowedCodexModel(value: unknown): boolean {
backend/src/business/codex/helper/resolve-codex-command.ts:90:export function isAllowedCodexEffort(value: unknown): boolean {
backend/src/business/codex/helper/resolve-codex-command.ts:94:export function resolveCodexCommand(input: { workspaceRoot: string; runtime: AnyRecord; codexModel?: unknown; codexEffort?: unknown }): CodexCommand {
backend/src/business/codex/helper/resolve-codex-command.ts:96:  const configuredCommand = String(process.env.CODEX_BIN || settings.codexBin || settings.CODEX_BIN || 'codex');
backend/src/business/codex/helper/resolve-codex-command.ts:97:  const model = firstAllowed([input.codexModel, process.env.CODEX_MODEL, settings.codexModel, settings.CODEX_MODEL], codexModelOptions, 'gpt-5.5');
backend/src/business/codex/helper/resolve-codex-command.ts:98:  const effort = firstAllowed([input.codexEffort, process.env.CODEX_EFFORT, settings.codexEffort, settings.codexReasoningEffort, settings.CODEX_EFFORT], codexEffortOptions, 'high');
backend/test/codex/start-card-skill-process-controller.test.ts:20:test('card skill process route creates a linked output card and launches codex', async () => {
backend/test/codex/start-card-skill-process-controller.test.ts:21:  const originalCwd = process.cwd();
backend/test/codex/start-card-skill-process-controller.test.ts:22:  const previousCodexBin = process.env.CODEX_BIN;
backend/test/codex/start-card-skill-process-controller.test.ts:23:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-'));
backend/test/codex/start-card-skill-process-controller.test.ts:24:  const fakeCodex = join(workspace, 'fake-codex.mjs');
backend/test/codex/start-card-skill-process-controller.test.ts:26:  mkdirSync(join(workspace, '.skills', 'test-skill'), { recursive: true });
backend/test/codex/start-card-skill-process-controller.test.ts:27:  writeFileSync(join(workspace, '.skills', 'test-skill', 'SKILL.md'), [
backend/test/codex/start-card-skill-process-controller.test.ts:29:    'name: test-skill',
backend/test/codex/start-card-skill-process-controller.test.ts:30:    'description: Test skill description',
backend/test/codex/start-card-skill-process-controller.test.ts:53:  writeFileSync(fakeCodex, [
backend/test/codex/start-card-skill-process-controller.test.ts:57:    'process.stdin.on("data", (chunk) => { input += chunk; });',
backend/test/codex/start-card-skill-process-controller.test.ts:58:    'process.stdin.on("end", () => {',
backend/test/codex/start-card-skill-process-controller.test.ts:60:    '  if (!match) process.exit(2);',
backend/test/codex/start-card-skill-process-controller.test.ts:61:    '  const args = process.argv.slice(2);',
backend/test/codex/start-card-skill-process-controller.test.ts:64:    '  writeFileSync(match[1].trim(), "# Fake Result\\n\\n" + (input.includes("$test-skill") ? "skill seen" : "skill missing") + "\\nmodel=" + model + "\\neffort=" + effort + "\\n");',
backend/test/codex/start-card-skill-process-controller.test.ts:68:  chmodSync(fakeCodex, 0o755);
backend/test/codex/start-card-skill-process-controller.test.ts:70:  process.chdir(workspace);
backend/test/codex/start-card-skill-process-controller.test.ts:71:  process.env.CODEX_BIN = fakeCodex;
backend/test/codex/start-card-skill-process-controller.test.ts:79:    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/process`, {
backend/test/codex/start-card-skill-process-controller.test.ts:82:      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'test-skill', codexModel: 'gpt-5.4', codexEffort: 'xhigh' })
backend/test/codex/start-card-skill-process-controller.test.ts:97:    assert.equal(ledger.relationships.some((relationship) => relationship.from === 'source-card' && relationship.to === body.run.outputCardId && relationship.label === 'test-skill'), true);
backend/test/codex/start-card-skill-process-controller.test.ts:100:    await waitForText(body.run.outputFile, 'skill seen');
backend/test/codex/start-card-skill-process-controller.test.ts:105:    process.chdir(originalCwd);
backend/test/codex/start-card-skill-process-controller.test.ts:106:    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
backend/test/codex/start-card-skill-process-controller.test.ts:107:    else process.env.CODEX_BIN = previousCodexBin;
backend/test/codex/start-card-skill-process-controller.test.ts:112:test('card skill run cancel route terminates the active codex process', async () => {
backend/test/codex/start-card-skill-process-controller.test.ts:113:  const originalCwd = process.cwd();
backend/test/codex/start-card-skill-process-controller.test.ts:114:  const previousCodexBin = process.env.CODEX_BIN;
backend/test/codex/start-card-skill-process-controller.test.ts:115:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-cancel-'));
backend/test/codex/start-card-skill-process-controller.test.ts:116:  const fakeCodex = join(workspace, 'fake-codex-slow.mjs');
backend/test/codex/start-card-skill-process-controller.test.ts:118:  mkdirSync(join(workspace, '.skills', 'slow-skill'), { recursive: true });
backend/test/codex/start-card-skill-process-controller.test.ts:119:  writeFileSync(join(workspace, '.skills', 'slow-skill', 'SKILL.md'), [
backend/test/codex/start-card-skill-process-controller.test.ts:121:    'name: slow-skill',
backend/test/codex/start-card-skill-process-controller.test.ts:122:    'description: Slow skill description',
backend/test/codex/start-card-skill-process-controller.test.ts:145:  writeFileSync(fakeCodex, [
backend/test/codex/start-card-skill-process-controller.test.ts:149:    'process.stdin.on("data", (chunk) => { input += chunk; });',
backend/test/codex/start-card-skill-process-controller.test.ts:150:    'process.stdin.on("end", () => {',
backend/test/codex/start-card-skill-process-controller.test.ts:152:    '  if (!match) process.exit(2);',
backend/test/codex/start-card-skill-process-controller.test.ts:156:    'process.on("SIGTERM", () => {',
backend/test/codex/start-card-skill-process-controller.test.ts:158:    '  process.exit(0);',
backend/test/codex/start-card-skill-process-controller.test.ts:162:  chmodSync(fakeCodex, 0o755);
backend/test/codex/start-card-skill-process-controller.test.ts:164:  process.chdir(workspace);
backend/test/codex/start-card-skill-process-controller.test.ts:165:  process.env.CODEX_BIN = fakeCodex;
backend/test/codex/start-card-skill-process-controller.test.ts:173:    const startResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/process`, {
backend/test/codex/start-card-skill-process-controller.test.ts:176:      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'slow-skill' })
backend/test/codex/start-card-skill-process-controller.test.ts:183:    const cancelResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${started.run.id}/cancel`, {
backend/test/codex/start-card-skill-process-controller.test.ts:193:    await waitForText(started.run.outputFile, 'Codex run cancelled: terminated by operator');
backend/test/codex/start-card-skill-process-controller.test.ts:194:    const statusResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${started.run.id}?ledgerId=specs&cardId=${started.run.outputCardId}&since=0`);
backend/test/codex/start-card-skill-process-controller.test.ts:201:    process.chdir(originalCwd);
backend/test/codex/start-card-skill-process-controller.test.ts:202:    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
backend/test/codex/start-card-skill-process-controller.test.ts:203:    else process.env.CODEX_BIN = previousCodexBin;
backend/src/business/codex/helper/scan-codex-skills.ts:2: * WHAT: Discovers Codex skills available to the workspace.
backend/src/business/codex/helper/scan-codex-skills.ts:3: * WHY: The browser should list skill names and descriptions without accepting filesystem paths from the client.
backend/src/business/codex/helper/scan-codex-skills.ts:9:export type CodexSkillSource = 'workspace' | 'user' | 'plugin';
backend/src/business/codex/helper/scan-codex-skills.ts:11:export type CodexSkillSummary = {
backend/src/business/codex/helper/scan-codex-skills.ts:14:  source: CodexSkillSource;
backend/src/business/codex/helper/scan-codex-skills.ts:15:  skillFile: string;
backend/src/business/codex/helper/scan-codex-skills.ts:20:  source: CodexSkillSource;
backend/src/business/codex/helper/scan-codex-skills.ts:29:  return resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
backend/src/business/codex/helper/scan-codex-skills.ts:34:  const workspaceSkills = resolve(workspaceRoot, '.skills');
backend/src/business/codex/helper/scan-codex-skills.ts:35:  const cwdSkills = resolve(process.cwd(), '.skills');
backend/src/business/codex/helper/scan-codex-skills.ts:38:    { directory: resolve(home, 'skills'), source: 'user' as const, maxDepth: 6 },
backend/src/business/codex/helper/scan-codex-skills.ts:84:function readSkillSummary(skillFile: string, source: CodexSkillSource): CodexSkillSummary | null {
backend/src/business/codex/helper/scan-codex-skills.ts:86:    if (!statSync(skillFile).isFile()) return null;
backend/src/business/codex/helper/scan-codex-skills.ts:87:    const metadata = parseSkillFrontmatter(readFileSync(skillFile, 'utf8'));
backend/src/business/codex/helper/scan-codex-skills.ts:89:    return { ...metadata, source, skillFile };
backend/src/business/codex/helper/scan-codex-skills.ts:95:export function scanCodexSkills(input: { workspaceRoot: string }): CodexSkillSummary[] {
backend/src/business/codex/helper/scan-codex-skills.ts:96:  const byName = new Map<string, CodexSkillSummary>();
backend/src/business/codex/helper/scan-codex-skills.ts:98:    for (const skillFile of collectSkillFiles(root.directory, root.maxDepth)) {
backend/src/business/codex/helper/scan-codex-skills.ts:99:      const summary = readSkillSummary(skillFile, root.source);
backend/test/codex/scan-codex-skills.test.ts:6:import { scanCodexSkills } from '@backend/business/codex/helper/scan-codex-skills.js';
backend/test/codex/scan-codex-skills.test.ts:8:test('scanCodexSkills reads workspace user and plugin skill frontmatter', () => {
backend/test/codex/scan-codex-skills.test.ts:9:  const previousCodexHome = process.env.CODEX_HOME;
backend/test/codex/scan-codex-skills.test.ts:10:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skills-workspace-'));
backend/test/codex/scan-codex-skills.test.ts:11:  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-skills-home-'));
backend/test/codex/scan-codex-skills.test.ts:14:    process.env.CODEX_HOME = codexHome;
backend/test/codex/scan-codex-skills.test.ts:15:    mkdirSync(join(workspace, '.skills', 'duplicate-skill'), { recursive: true });
backend/test/codex/scan-codex-skills.test.ts:16:    mkdirSync(join(codexHome, 'skills', 'duplicate-skill'), { recursive: true });
backend/test/codex/scan-codex-skills.test.ts:17:    mkdirSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill'), { recursive: true });
backend/test/codex/scan-codex-skills.test.ts:19:    writeFileSync(join(workspace, '.skills', 'duplicate-skill', 'SKILL.md'), [
backend/test/codex/scan-codex-skills.test.ts:21:      'name: duplicate-skill',
backend/test/codex/scan-codex-skills.test.ts:22:      'description: Workspace skill wins',
backend/test/codex/scan-codex-skills.test.ts:26:    writeFileSync(join(codexHome, 'skills', 'duplicate-skill', 'SKILL.md'), [
backend/test/codex/scan-codex-skills.test.ts:28:      'name: duplicate-skill',
backend/test/codex/scan-codex-skills.test.ts:29:      'description: User skill loses',
backend/test/codex/scan-codex-skills.test.ts:33:    writeFileSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill', 'SKILL.md'), [
backend/test/codex/scan-codex-skills.test.ts:35:      'name: plugin-skill',
backend/test/codex/scan-codex-skills.test.ts:36:      'description: Plugin skill description',
backend/test/codex/scan-codex-skills.test.ts:41:    const skills = scanCodexSkills({ workspaceRoot: workspace });
backend/test/codex/scan-codex-skills.test.ts:42:    const duplicate = skills.find((skill) => skill.name === 'duplicate-skill');
backend/test/codex/scan-codex-skills.test.ts:43:    const plugin = skills.find((skill) => skill.name === 'plugin-skill');
backend/test/codex/scan-codex-skills.test.ts:45:    assert.equal(duplicate?.description, 'Workspace skill wins');
backend/test/codex/scan-codex-skills.test.ts:47:    assert.equal(plugin?.description, 'Plugin skill description');
backend/test/codex/scan-codex-skills.test.ts:50:    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
backend/test/codex/scan-codex-skills.test.ts:51:    else process.env.CODEX_HOME = previousCodexHome;
backend/src/business/transcription/helper/resolve-transcription-config.ts:15:  const apiKey = String(payload.openaiApiKey ?? process.env.OPENAI_API_KEY ?? runtime.openaiApiKey ?? settings.openaiApiKey ?? '');
backend/src/business/transcription/helper/resolve-transcription-config.ts:16:  const model = String(payload.transcriptionModel ?? process.env.OPENAI_TRANSCRIPTION_MODEL ?? runtime.transcriptionModel ?? settings.transcriptionModel ?? 'gpt-4o-mini-transcribe');
backend/test/codex/read-card-skill-run-controller.test.ts:11:test('card skill run route derives JSONL progress and persists thread notes', async () => {
backend/test/codex/read-card-skill-run-controller.test.ts:12:  const originalCwd = process.cwd();
backend/test/codex/read-card-skill-run-controller.test.ts:13:  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-run-'));
backend/test/codex/read-card-skill-run-controller.test.ts:16:  const runId = `codex-skill-${startedAt}-feed1234`;
backend/test/codex/read-card-skill-run-controller.test.ts:18:  mkdirSync(join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs'), { recursive: true });
backend/test/codex/read-card-skill-run-controller.test.ts:27:      cardType: 'codex-skill-run',
backend/test/codex/read-card-skill-run-controller.test.ts:36:  const jsonlPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.jsonl`);
backend/test/codex/read-card-skill-run-controller.test.ts:37:  const logPath = join(workspace, '.decision-os', 'runs', 'codex-skills', 'specs', `${runId}.log`);
backend/test/codex/read-card-skill-run-controller.test.ts:49:  process.chdir(workspace);
backend/test/codex/read-card-skill-run-controller.test.ts:57:    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/runs/${runId}?ledgerId=specs&cardId=${outputCardId}&since=2`);
backend/test/codex/read-card-skill-run-controller.test.ts:86:    assert.match(thread, /Codex turn completed\./);
backend/test/codex/read-card-skill-run-controller.test.ts:89:    process.chdir(originalCwd);
backend/test/codex/resolve-codex-command.test.ts:6:import { resolveCodexCommand } from '@backend/business/codex/helper/resolve-codex-command.js';
backend/test/codex/resolve-codex-command.test.ts:8:test('resolveCodexCommand honors an explicit executable setting', () => {
backend/test/codex/resolve-codex-command.test.ts:11:  const previousCodexBin = process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:12:  const previousCodexModel = process.env.CODEX_MODEL;
backend/test/codex/resolve-codex-command.test.ts:13:  const previousCodexEffort = process.env.CODEX_EFFORT;
backend/test/codex/resolve-codex-command.test.ts:15:    delete process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:16:    delete process.env.CODEX_MODEL;
backend/test/codex/resolve-codex-command.test.ts:17:    delete process.env.CODEX_EFFORT;
backend/test/codex/resolve-codex-command.test.ts:20:    const command = resolveCodexCommand({ workspaceRoot: workspace, runtime: { decisionOsSettings: { codexBin: bin, codexModel: 'gpt-5.4', codexReasoningEffort: 'low' } } });
backend/test/codex/resolve-codex-command.test.ts:27:    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:28:    else process.env.CODEX_BIN = previousCodexBin;
backend/test/codex/resolve-codex-command.test.ts:29:    if (previousCodexModel === undefined) delete process.env.CODEX_MODEL;
backend/test/codex/resolve-codex-command.test.ts:30:    else process.env.CODEX_MODEL = previousCodexModel;
backend/test/codex/resolve-codex-command.test.ts:31:    if (previousCodexEffort === undefined) delete process.env.CODEX_EFFORT;
backend/test/codex/resolve-codex-command.test.ts:32:    else process.env.CODEX_EFFORT = previousCodexEffort;
backend/test/codex/resolve-codex-command.test.ts:37:test('resolveCodexCommand lets run payload override settings model and effort', () => {
backend/test/codex/resolve-codex-command.test.ts:40:    const command = resolveCodexCommand({
backend/test/codex/resolve-codex-command.test.ts:56:test('resolveCodexCommand can find Codex beside the running Node executable when PATH is sparse', () => {
backend/test/codex/resolve-codex-command.test.ts:57:  const adjacentCodex = resolve(dirname(process.execPath), 'codex');
backend/test/codex/resolve-codex-command.test.ts:58:  if (!existsSync(adjacentCodex)) return;
backend/test/codex/resolve-codex-command.test.ts:59:  const previousPath = process.env.PATH;
backend/test/codex/resolve-codex-command.test.ts:60:  const previousCodexBin = process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:62:    process.env.PATH = '/usr/bin';
backend/test/codex/resolve-codex-command.test.ts:63:    delete process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:64:    const command = resolveCodexCommand({ workspaceRoot: process.cwd(), runtime: {} });
backend/test/codex/resolve-codex-command.test.ts:65:    assert.equal(command.command, adjacentCodex);
backend/test/codex/resolve-codex-command.test.ts:67:    if (previousPath === undefined) delete process.env.PATH;
backend/test/codex/resolve-codex-command.test.ts:68:    else process.env.PATH = previousPath;
backend/test/codex/resolve-codex-command.test.ts:69:    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
backend/test/codex/resolve-codex-command.test.ts:70:    else process.env.CODEX_BIN = previousCodexBin;
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:2: * WHAT: Cancels one active card-scoped Codex skill run.
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:3: * WHY: The canvas widget needs a direct stop control for the server-owned child process.
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:5:import type { ChildProcess } from 'node:child_process';
backend/src/business/codex/controller/cancel-card-skill-run-controller.ts:37:    return { ok: false, statusCode: 409, error: 'Run is not cancellable in this server process.', runId };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:2: * WHAT: Reads one card-scoped Codex skill run from its derived JSONL/log files.
backend/src/business/codex/controller/read-card-skill-run-controller.ts:3: * WHY: The output card and run id are enough to hydrate live progress without a persisted run manifest.
backend/src/business/codex/controller/read-card-skill-run-controller.ts:47:  const match = runId.match(/^codex-skill-(\d+)-/);
backend/src/business/codex/controller/read-card-skill-run-controller.ts:92:    return { line: line.line, type, kind: 'run_status', title: 'Turn completed', text: 'Codex turn completed.', status: 'complete', itemId, tool: '', exitCode: '', persist: true };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:95:    return { line: line.line, type, kind: 'run_status', title: 'Turn started', text: 'Codex turn started.', status: 'running', itemId, tool: '', exitCode: '', persist: false };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:98:    return { line: line.line, type, kind: 'run_status', title: 'Thread started', text: 'Codex thread started.', status: 'running', itemId, tool: '', exitCode: '', persist: false };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:102:    return { line: line.line, type, kind: 'agent_message', title: 'Codex message', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:106:    return { line: line.line, type, kind: 'thinking', title: 'Codex thinking', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
backend/src/business/codex/controller/read-card-skill-run-controller.ts:128:    title: itemType || type || 'Codex event',
backend/src/business/codex/controller/read-card-skill-run-controller.ts:188:  if (String(card.cardType ?? '') === 'codex-skill-run' && input.cardId === `card-${safeSegment(input.runId)}`) return true;
backend/src/business/codex/controller/read-card-skill-run-controller.ts:191:  return body.includes(`Codex run: ${input.runId}`);
backend/src/business/codex/controller/read-card-skill-run-controller.ts:246:  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
backend/src/business/codex/controller/read-card-skill-run-controller.ts:264:  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
backend/src/business/transcription/effect/load-uploaded-voice-audio.ts:20:  const uploadRoot = resolve(String(payload.voiceUploadRoot ?? process.env.DECISION_OS_VOICE_UPLOAD_ROOT ?? resolve(blueprintRoot, 'voice-uploads')));
backend/src/business/transcription/effect/persist-uploaded-voice-audio.ts:21:  const uploadRoot = resolve(String(payload.voiceUploadRoot ?? process.env.DECISION_OS_VOICE_UPLOAD_ROOT ?? resolve(blueprintRoot, 'voice-uploads')));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:2: * WHAT: Creates a linked output card and starts a headless Codex skill process for the source card.
backend/src/business/codex/controller/start-card-skill-process-controller.ts:3: * WHY: Card-scoped skill processing must persist the result target before the asynchronous Codex run begins.
backend/src/business/codex/controller/start-card-skill-process-controller.ts:5:import { spawn, type ChildProcess } from 'node:child_process';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:13:import { scanCodexSkills } from '../helper/scan-codex-skills.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:14:import { buildCardSkillPrompt } from '../helper/build-card-skill-prompt.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:15:import { isAllowedCodexEffort, isAllowedCodexModel, resolveCodexCommand } from '../helper/resolve-codex-command.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:16:import { readCardSkillRunController } from './read-card-skill-run-controller.js';
backend/src/business/codex/controller/start-card-skill-process-controller.ts:56:  const markdown = [``, `---`, ``, `Codex run ${heading.toLowerCase()}: ${detail}`].join('\n');
backend/src/business/codex/controller/start-card-skill-process-controller.ts:104:  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:108:  const skillName = String(payload.skillName ?? '').trim();
backend/src/business/codex/controller/start-card-skill-process-controller.ts:109:  if (!ledgerId || !cardId || !skillName) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or skillName.' };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:110:  const requestedCodexModel = optionalText(payload.codexModel);
backend/src/business/codex/controller/start-card-skill-process-controller.ts:111:  const requestedCodexEffort = optionalText(payload.codexEffort);
backend/src/business/codex/controller/start-card-skill-process-controller.ts:112:  if (requestedCodexModel && !isAllowedCodexModel(requestedCodexModel)) return { ok: false, statusCode: 400, error: 'Unsupported Codex model.', codexModel: requestedCodexModel };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:113:  if (requestedCodexEffort && !isAllowedCodexEffort(requestedCodexEffort)) return { ok: false, statusCode: 400, error: 'Unsupported Codex effort.', codexEffort: requestedCodexEffort };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:115:  const skill = scanCodexSkills({ workspaceRoot }).find((entry) => entry.name === skillName);
backend/src/business/codex/controller/start-card-skill-process-controller.ts:116:  if (!skill) return { ok: false, statusCode: 404, error: 'Skill not found.', skillName };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:130:  const runId = `codex-skill-${Date.now()}-${randomUUID().slice(0, 8)}`;
backend/src/business/codex/controller/start-card-skill-process-controller.ts:132:  const outputTitle = `${skillName} result`;
backend/src/business/codex/controller/start-card-skill-process-controller.ts:133:  const command = resolveCodexCommand({ workspaceRoot, runtime, codexModel: requestedCodexModel, codexEffort: requestedCodexEffort });
backend/src/business/codex/controller/start-card-skill-process-controller.ts:137:    `Status: processing`,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:140:    `Codex run: ${runId}`,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:141:    `Codex model: ${command.model}`,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:142:    `Codex effort: ${command.effort}`,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:147:    cardType: 'codex-skill-run',
backend/src/business/codex/controller/start-card-skill-process-controller.ts:161:    label: skillName,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:165:  if (mutation.ok === false) return { ok: false, statusCode: mutation.error?.statusCode ?? 400, error: mutation.error?.body?.error ?? 'Could not create output card.' };
backend/src/business/codex/controller/start-card-skill-process-controller.ts:174:  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:179:    skillName,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:195:    skillName,
backend/src/business/codex/controller/start-card-skill-process-controller.ts:210:  notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-started', ledgerId, sourceCardId: cardId, outputCardId, runId, codexModel: command.model, codexEffort: command.effort });
backend/src/business/codex/controller/start-card-skill-process-controller.ts:222:        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: 'codex-skill-failed', ledgerId, sourceCardId: cardId, outputCardId, runId }));
backend/src/business/codex/controller/start-card-skill-process-controller.ts:234:      if (status === 'cancelled') appendFileSync(stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
backend/src/business/codex/controller/start-card-skill-process-controller.ts:237:        .finally(() => notifyLedgerChange(payload.onLedgerChange, { reason: status === 'cancelled' ? 'codex-skill-cancelled' : 'codex-skill-finished', ledgerId, sourceCardId: cardId, outputCardId, runId, exitCode }));
backend/src/business/server/helper/resolve-decision-os-root.ts:16:  const configuredRoot = String(payload.decisionOsRoot ?? runtime.decisionOsRoot ?? process.env.DECISION_OS_ROOT ?? '');
backend/src/business/server/helper/resolve-decision-os-root.ts:18:  let current = resolve(String(payload.cwd ?? runtime.cwd ?? process.cwd()));
backend/src/business/server/helper/resolve-decision-os-root.ts:27:  return isAbsolute(fallback) ? fallback : resolve(process.cwd(), fallback);
backend/src/business/server/helper/create-http-server.ts:25:import { scanCodexSkills } from '../../codex/helper/scan-codex-skills.js';
backend/src/business/server/helper/create-http-server.ts:26:import { startCardSkillProcessController } from '../../codex/controller/start-card-skill-process-controller.js';
backend/src/business/server/helper/create-http-server.ts:27:import { readCardSkillRunController } from '../../codex/controller/read-card-skill-run-controller.js';
backend/src/business/server/helper/create-http-server.ts:28:import { cancelCardSkillRunController } from '../../codex/controller/cancel-card-skill-run-controller.js';
backend/src/business/server/helper/create-http-server.ts:132:  const configuredFrontendRoot = payload.decisionOsFrontendRoot ?? payload.frontendRoot ?? process.env.DECISION_OS_FRONTEND_ROOT ?? runtime.decisionOsFrontendRoot;
backend/src/business/server/helper/create-http-server.ts:135:    : existsSync(resolve(process.cwd(), 'frontend'))
backend/src/business/server/helper/create-http-server.ts:136:      ? resolve(process.cwd(), 'frontend')
backend/src/business/server/helper/create-http-server.ts:137:      : resolve(process.cwd(), '..', 'frontend');
backend/src/business/server/helper/create-http-server.ts:173:    if (url === '/api/codex/skills' && request.method === 'GET') {
backend/src/business/server/helper/create-http-server.ts:175:      const skills = scanCodexSkills({ workspaceRoot }).map((skill) => ({
backend/src/business/server/helper/create-http-server.ts:176:        name: skill.name,
backend/src/business/server/helper/create-http-server.ts:177:        description: skill.description,
backend/src/business/server/helper/create-http-server.ts:178:        source: skill.source
backend/src/business/server/helper/create-http-server.ts:182:      response.end(JSON.stringify({ ok: true, skills }));
backend/src/business/server/helper/create-http-server.ts:185:    if (url === '/api/codex/skills/process' && request.method === 'POST') {
backend/src/business/server/helper/create-http-server.ts:187:      const processPayload = (() => {
backend/src/business/server/helper/create-http-server.ts:195:        action_payload: { ...processPayload, onLedgerChange: publishLedgerContentChange },
backend/src/business/server/helper/create-http-server.ts:203:    if (url.startsWith('/api/codex/skills/runs/') && request.method === 'GET') {
backend/src/business/server/helper/create-http-server.ts:205:      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length));
backend/src/business/server/helper/create-http-server.ts:220:    if (url.startsWith('/api/codex/skills/runs/') && url.endsWith('/cancel') && request.method === 'POST') {
backend/src/business/server/helper/create-http-server.ts:229:      const runId = decodeURIComponent(url.slice('/api/codex/skills/runs/'.length, -'/cancel'.length));
backend/src/business/server/helper/content-type-for.ts:22:  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
backend/test/ledger/decision-os-default-tabs.integration.test.ts:9:test('Ledgers in .decision-os load as default tabs unless invalid', async () => {
backend/test/ledger/decision-os-default-tabs.integration.test.ts:32:  console.log(JSON.stringify({ specId: '9c31f0a4', suiteName: 'Ledgers in .decision-os load as default tabs unless invalid', controllerName: ["load-tab-ledgers-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:12:  const originalCwd = process.cwd();
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:32:  process.chdir(workspace);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:37:  process.chdir(originalCwd);
backend/test/server/decision-os-ledgers-canvas.integration.test.ts:43:    restore: () => process.chdir(originalCwd)
backend/test/server/decision-os-zone-mutations.integration.test.ts:12:  const originalCwd = process.cwd();
backend/test/server/decision-os-zone-mutations.integration.test.ts:30:  process.chdir(workspace);
backend/test/server/decision-os-zone-mutations.integration.test.ts:318:    process.chdir(originalCwd);
backend/test/server/decision-os-zone-mutations.integration.test.ts:324:  const originalCwd = process.cwd();
backend/test/server/decision-os-zone-mutations.integration.test.ts:339:  process.chdir(nested);
backend/test/server/decision-os-zone-mutations.integration.test.ts:378:    process.chdir(originalCwd);
backend/test/server/decision-os-ledger-create.integration.test.ts:12:  const originalCwd = process.cwd();
backend/test/server/decision-os-ledger-create.integration.test.ts:20:  process.chdir(workspace);
backend/test/server/decision-os-ledger-create.integration.test.ts:53:    process.chdir(originalCwd);
frontend/test/runtime/relationship-ledger-geometry-performance.integration.test.ts:15:test('ledger relationship routing uses active ledger geometry instead of card DOM measurement', () => {
frontend/test/runtime/relationship-ledger-geometry-performance.integration.test.ts:32:test('selected ledger geometry commits from active ledger state instead of DOM snapshots', () => {
frontend/test/runtime/input-controller-routing.integration.test.ts:205:  assert.match(controlOverlay, /skill\.dataset\.action = 'open-card-skill-modal'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:206:  assert.match(controlOverlay, /skill\.textContent = 'fx'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:208:  assert.match(controlOverlay, /\[skill, renderLedgerCardStatusButton\(cardId, persistedStatus, visibleStatus\), editBody, renderLedgerCardDeleteButton\(cardId\)\]/);
frontend/test/runtime/input-controller-routing.integration.test.ts:215:  const skillModal = source('frontend/src/runtime/codex/effect/render-skill-modal.ts');
frontend/test/runtime/input-controller-routing.integration.test.ts:216:  const cardDetailSkillRunWidget = source('frontend/src/runtime/codex/component/render-card-skill-run-widget.ts');
frontend/test/runtime/input-controller-routing.integration.test.ts:217:  const cardDetailSkillRunPoller = source('frontend/src/runtime/codex/effect/poll-card-skill-run.ts');
frontend/test/runtime/input-controller-routing.integration.test.ts:219:  assert.match(skillModal, /resultsScrollTop/);
frontend/test/runtime/input-controller-routing.integration.test.ts:220:  assert.match(skillModal, /querySelector<HTMLDivElement>\('\.skill-results'\)\?\.scrollTop/);
frontend/test/runtime/input-controller-routing.integration.test.ts:221:  assert.match(skillModal, /className = 'skill-selected-name'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:222:  assert.match(skillModal, /selectedName\.textContent = skillModalState\.selectedSkillName/);
frontend/test/runtime/input-controller-routing.integration.test.ts:223:  assert.match(skillModal, /const codexModelOptions = \['gpt-5\.5', 'gpt-5\.4', 'gpt-5\.3-codex', 'gpt-5\.2-codex', 'gpt-5\.2'\]/);
frontend/test/runtime/input-controller-routing.integration.test.ts:224:  assert.match(skillModal, /const codexEffortOptions = \['low', 'medium', 'high', 'xhigh'\]/);
frontend/test/runtime/input-controller-routing.integration.test.ts:225:  assert.match(skillModal, /className = 'skill-run-controls'/);
frontend/test/runtime/input-controller-routing.integration.test.ts:227:  assert.match(cardDetailSkillRunWidget, /cardCodexRunId\(card\)/);
frontend/test/runtime/input-controller-routing.integration.test.ts:260:  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\)\[data-card-work-status="processing"\] \.ledger-card-overview-status\s*{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*justify-content:\s*center;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--inverse-viewport-scale, 1\)\);/s);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:9:  const file = resolve(process.cwd(), path);
frontend/test/runtime/ledger-content-refresh.integration.test.ts:11:  return readFileSync(resolve(process.cwd(), '..', path), 'utf8');
backend/test/server/decision-os-content-files.integration.test.ts:12:  const originalCwd = process.cwd();
backend/test/server/decision-os-content-files.integration.test.ts:26:  process.chdir(workspace);
backend/test/server/decision-os-content-files.integration.test.ts:31:  process.chdir(originalCwd);
frontend/test/runtime/card-work-status-rendering.integration.test.ts:61:test('ledger card chrome renders todo processing and done workflow statuses', async () => {
frontend/test/runtime/card-work-status-rendering.integration.test.ts:75:        'thread-card-processing': [{ role: 'operator', message: 'Operator sent work.' }],
frontend/test/runtime/card-work-status-rendering.integration.test.ts:81:    const processing = patchLedgerCard({ id: 'card-processing', title: 'Processing', comment: { what: 'Processing.' } }) as unknown as FakeElement;
frontend/test/runtime/card-work-status-rendering.integration.test.ts:85:    const processingIndicator = findElementByClass(processing, 'card-status-indicator') as FakeElement;
frontend/test/runtime/card-work-status-rendering.integration.test.ts:86:    const processingButton = renderLedgerCardStatusButton('card-processing', 'todo', 'processing') as unknown as FakeElement;
frontend/test/runtime/card-work-status-rendering.integration.test.ts:92:    assert.equal(processing.dataset.cardStatus, 'todo');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:93:    assert.equal(processing.dataset.cardWorkStatus, 'processing');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:94:    assert.equal(processingIndicator.textContent, 'processing');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:95:    assert.equal(processingButton.disabled, true);
frontend/test/runtime/card-work-status-rendering.integration.test.ts:96:    assert.equal(processingButton.dataset.cardCurrentStatus, 'processing');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:97:    assert.equal(processingButton.attributes['aria-label'], 'Current status: processing. Waiting for agent response');
frontend/test/runtime/card-work-status-rendering.integration.test.ts:98:    assert.equal(processing.children.some((child) => child instanceof FakeElement && child.className.includes('ledger-card-status-toggle')), false);
frontend/test/runtime/card-label-chips-style.integration.test.ts:24:  assert.match(canvasLayerCss, /\.canvas \.card:not\(\.detail-visible\)\[data-card-work-status="processing"\] \.ledger-card-overview-status\s*{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*justify-content:\s*center;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--inverse-viewport-scale, 1\)\);/s);
frontend/test/runtime/card-label-chips-style.integration.test.ts:25:  assert.match(canvasLayerCss, /\.canvas\.low-detail \.card:not\(\.detail-visible\)\[data-card-work-status="processing"\] \.ledger-card-overview-status\s*{[^}]*border-color:\s*color-mix\(in srgb, #f4c542, white 18%\);[^}]*background:\s*color-mix\(in srgb, #f4c542, rgba\(3, 4, 5, 0\.94\) 38%\);/s);
frontend/test/runtime/voice-transcription-runtime.integration.test.ts:431:test('active ledger reload keeps optimistic thread notes missing from stale server state', async () => {
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:57:test('resolve-card-work-status derives processing from latest operator notes and lets done win', () => {
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:68:    assert.equal(resolveCardWorkStatus({ id: 'card-b' }), 'processing');
frontend/test/runtime/thread-title-and-agent-indicator.integration.test.ts:70:    assert.equal(resolveCardWorkStatus({ id: 'card-d' }), 'processing');
frontend/test/runtime/card-markdown-html-embeds.integration.test.ts:42:  assert.match(htmlRenderer, /HTML embed must live under the active ledger card assets directory\./);
frontend/test/runtime/voice-processing-footer.integration.test.ts:2: * WHAT: Runtime coverage for voice processing footer visibility.
frontend/test/runtime/codex-skill-request.integration.test.ts:3:import { loadCodexSkills } from '../../src/runtime/codex/effect/load-codex-skills.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:4:import { requestCardSkillProcess } from '../../src/runtime/codex/effect/request-card-skill-process.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:5:import { requestCardSkillRunCancel } from '../../src/runtime/codex/effect/request-card-skill-run-cancel.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:6:import { requestCardSkillRunStatus } from '../../src/runtime/codex/effect/request-card-skill-run-status.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:7:import { cardCodexRunId } from '../../src/runtime/codex/helper/card-codex-run-id.js';
frontend/test/runtime/codex-skill-request.integration.test.ts:9:test('loadCodexSkills returns server skill summaries', async () => {
frontend/test/runtime/codex-skill-request.integration.test.ts:13:      assert.equal(url, '/api/codex/skills');
frontend/test/runtime/codex-skill-request.integration.test.ts:14:      return new Response(JSON.stringify({ ok: true, skills: [{ name: 'analysis', description: 'Analyze code', source: 'workspace' }] }), {
frontend/test/runtime/codex-skill-request.integration.test.ts:20:    const skills = await loadCodexSkills();
frontend/test/runtime/codex-skill-request.integration.test.ts:21:    assert.deepEqual(skills, [{ name: 'analysis', description: 'Analyze code', source: 'workspace' }]);
frontend/test/runtime/codex-skill-request.integration.test.ts:27:test('requestCardSkillProcess posts active card skill payload', async () => {
frontend/test/runtime/codex-skill-request.integration.test.ts:31:      assert.equal(url, '/api/codex/skills/process');
frontend/test/runtime/codex-skill-request.integration.test.ts:38:        skillName: 'analysis',
frontend/test/runtime/codex-skill-request.integration.test.ts:48:    const result = await requestCardSkillProcess({ ledgerId: 'specs', cardId: 'card-a', skillName: 'analysis', codexModel: 'gpt-5.5', codexEffort: 'xhigh' });
frontend/test/runtime/codex-skill-request.integration.test.ts:60:      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd?ledgerId=specs&cardId=card-a&since=4');
frontend/test/runtime/codex-skill-request.integration.test.ts:80:    const result = await requestCardSkillRunStatus({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd', since: 4 });
frontend/test/runtime/codex-skill-request.integration.test.ts:94:      assert.equal(url, '/api/codex/skills/runs/codex-skill-1000-abcd/cancel');
frontend/test/runtime/codex-skill-request.integration.test.ts:105:    const result = await requestCardSkillRunCancel({ ledgerId: 'specs', cardId: 'card-a', runId: 'codex-skill-1000-abcd' });
frontend/test/runtime/codex-skill-request.integration.test.ts:113:test('cardCodexRunId falls back to the durable output card id', () => {
frontend/test/runtime/codex-skill-request.integration.test.ts:114:  assert.equal(cardCodexRunId({
frontend/test/runtime/codex-skill-request.integration.test.ts:115:    id: 'card-codex-skill-1000-abcd',
frontend/test/runtime/codex-skill-request.integration.test.ts:117:  }), 'codex-skill-1000-abcd');
frontend/test/runtime/codex-skill-request.integration.test.ts:118:  assert.equal(cardCodexRunId({
frontend/test/runtime/codex-skill-request.integration.test.ts:120:    comment: { what: 'Codex run: codex-skill-2000-efgh' }
frontend/test/runtime/codex-skill-request.integration.test.ts:121:  }), 'codex-skill-2000-efgh');
frontend/test/runtime/active-ledger-zone-lifecycle.integration.test.ts:226:test('active ledger load keeps server geometry authoritative over stale browser persistence', async () => {
backend/src/server.ts:11:const port = Number(process.env.PORT ?? settings.port ?? 4173);
backend/src/server.ts:12:const host = String(process.env.HOST ?? settings.host ?? '127.0.0.1');
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:36:  const previousKey = process.env.OPENAI_API_KEY;
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:37:  delete process.env.OPENAI_API_KEY;
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:48:    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
backend/test/unit/transcription/helper/resolve-transcription-config.test.ts:49:    else process.env.OPENAI_API_KEY = previousKey;
frontend/src/runtime/card/helper/resolve-card-work-status.ts:3: * WHY: Card chrome needs one status indicator while processing remains derived from thread ownership.
frontend/src/runtime/card/helper/resolve-card-work-status.ts:8:export type CardVisibleWorkStatus = CardPersistedWorkStatus | 'processing';
frontend/src/runtime/card/helper/resolve-card-work-status.ts:26:  if (role === 'operator') return 'processing';
frontend/src/runtime/input/controller/handle-action-click.ts:34:import { closeCardSkillModal, openCardSkillModal, processSelectedCardSkill, selectCardSkill } from '../../codex/effect/render-skill-modal.js';
frontend/src/runtime/input/controller/handle-action-click.ts:119:  if (action === 'open-card-skill-modal') {
frontend/src/runtime/input/controller/handle-action-click.ts:123:  if (action === 'select-card-skill') {
frontend/src/runtime/input/controller/handle-action-click.ts:124:    selectCardSkill(actionTarget.dataset.skillName ?? '');
frontend/src/runtime/input/controller/handle-action-click.ts:127:  if (action === 'process-card-skill') {
frontend/src/runtime/input/controller/handle-action-click.ts:128:    await processSelectedCardSkill();
frontend/src/runtime/input/controller/handle-action-click.ts:131:  if (action === 'close-card-skill-modal') {
frontend/src/runtime/card/controller/delete-card-image-controller.ts:2: * WHAT: Deletes one markdown image from a card through the active ledger mutation path.
frontend/src/runtime/codex/helper/card-codex-run-id.ts:2: * WHAT: Extracts the Codex run id embedded in a skill output card body.
frontend/src/runtime/codex/helper/card-codex-run-id.ts:3: * WHY: The output card is the durable anchor for live run hydration.
frontend/src/runtime/codex/helper/card-codex-run-id.ts:7:export function cardCodexRunId(card: Record<string, unknown>): string {
frontend/src/runtime/codex/helper/card-codex-run-id.ts:8:  const bodyMatch = ledgerCardBody(card).match(/^Codex run:\s*(codex-skill-[^\s]+)/m);
frontend/src/runtime/codex/helper/card-codex-run-id.ts:10:  const idMatch = String(card.id ?? '').match(/^card-(codex-skill-[^\s]+)$/);
frontend/src/runtime/card/controller/delete-card-controller.ts:2: * WHAT: Deletes one card from the active ledger through the server mutation path.
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:2: * WHAT: Starts a selected card skill run and refreshes the active canvas.
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:3: * WHY: The new output card and relationship are server-authored ledger state.
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:8:import { requestCardSkillProcess } from '../effect/request-card-skill-process.js';
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:10:export async function processCardSkillController(input: { cardId: string; skillName: string; codexModel?: string; codexEffort?: string }): Promise<boolean> {
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:12:  if (!ledgerId || !input.cardId || !input.skillName) return false;
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:13:  telemetry('codex-skill-process-start', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '' });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:14:  const result = await requestCardSkillProcess({ ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel, codexEffort: input.codexEffort });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:16:    telemetry('codex-skill-process-failed', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', error: result.error ?? '' });
frontend/src/runtime/codex/controller/process-card-skill-controller.ts:20:  telemetry('codex-skill-process-created-card', { ledgerId, cardId: input.cardId, skillName: input.skillName, codexModel: input.codexModel ?? '', codexEffort: input.codexEffort ?? '', run: result.run?.id ?? '' });
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:2: * WHAT: Integration test for spec e6a91d34: decision-os state drives ledger tabs and routes.
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:9:test('decision-os state drives ledger tabs and routes.', async () => {
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:10:  await assertFrontendSpec('decision-os state drives ledger tabs and routes.', 'e6a91d34', 'navigation');
tests/browser/toolbox/zone-confirmation-modal-can-process-keyboard-shortcuts.spec.ts:2: * WHAT: Integration test for spec 20000015: zone confirmation modal can process keyboard shortcuts.
tests/browser/toolbox/zone-confirmation-modal-can-process-keyboard-shortcuts.spec.ts:9:test('zone confirmation modal can process keyboard shortcuts', async () => {
tests/browser/toolbox/zone-confirmation-modal-can-process-keyboard-shortcuts.spec.ts:10:  await assertFrontendSpec('zone confirmation modal can process keyboard shortcuts', '20000015', 'zone');
frontend/src/runtime/codex/effect/request-card-skill-process.ts:2: * WHAT: Starts a backend Codex skill process for one card.
frontend/src/runtime/codex/effect/request-card-skill-process.ts:3: * WHY: The UI should delegate output card creation and process ownership to the server.
frontend/src/runtime/codex/effect/request-card-skill-process.ts:8:  skillName: string;
frontend/src/runtime/codex/effect/request-card-skill-process.ts:14:  const response = await fetch('/api/codex/skills/process', {
tests/browser/navigation/tab-click-loads-the-active-ledger-graph-into-the-canvas.spec.ts:2: * WHAT: Integration test for spec f2d6c8b1: Tab click loads the active ledger graph into the canvas.
tests/browser/navigation/tab-click-loads-the-active-ledger-graph-into-the-canvas.spec.ts:9:test('Tab click loads the active ledger graph into the canvas.', async () => {
tests/browser/navigation/tab-click-loads-the-active-ledger-graph-into-the-canvas.spec.ts:10:  await assertFrontendSpec('Tab click loads the active ledger graph into the canvas.', 'f2d6c8b1', 'navigation');
tests/tools/save-html.spec.mjs:7:import { execFile } from 'node:child_process';
tests/tools/save-html.spec.mjs:32:    const { stdout } = await execFileAsync(process.execPath, [resolve('bin/save-html.mjs'), `http://127.0.0.1:${address.port}/page`, outputPath], { encoding: 'utf8' });
tests/tools/save-html.spec.mjs:44:    execFileAsync(process.execPath, [resolve('bin/save-html.mjs'), 'http://127.0.0.1/'], { encoding: 'utf8' }),
frontend/src/runtime/codex/effect/load-codex-skills.ts:2: * WHAT: Loads Codex skill summaries from the backend.
frontend/src/runtime/codex/effect/load-codex-skills.ts:3: * WHY: The skill modal needs server-authoritative names and descriptions.
frontend/src/runtime/codex/effect/load-codex-skills.ts:5:export type CodexSkillSummary = {
frontend/src/runtime/codex/effect/load-codex-skills.ts:11:export async function loadCodexSkills(): Promise<CodexSkillSummary[]> {
frontend/src/runtime/codex/effect/load-codex-skills.ts:12:  const response = await fetch('/api/codex/skills').catch(() => undefined);
frontend/src/runtime/codex/effect/load-codex-skills.ts:14:  const body = await response.json().catch(() => null) as { skills?: CodexSkillSummary[] } | null;
frontend/src/runtime/codex/effect/load-codex-skills.ts:15:  return Array.isArray(body?.skills) ? body.skills : [];
frontend/src/runtime/codex/effect/request-card-skill-run-cancel.ts:2: * WHAT: Requests cancellation for one active card-scoped Codex skill run.
frontend/src/runtime/codex/effect/request-card-skill-run-cancel.ts:3: * WHY: The widget stop button must delegate process ownership to the backend.
frontend/src/runtime/codex/effect/request-card-skill-run-cancel.ts:6:  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}/cancel`, {
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:2: * WHAT: Polls one rendered Codex run widget while its backend run is active.
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:6:import { requestCardSkillRunStatus, type CardSkillRunSummary } from './request-card-skill-run-status.js';
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:7:import { requestCardSkillRunCancel } from './request-card-skill-run-cancel.js';
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:47:  const match = runId.match(/^codex-skill-(\d+)-/);
frontend/src/runtime/codex/effect/poll-card-skill-run.ts:203:  telemetry('codex-skill-run-polled', { runId: poller.runId, status: summary.status, lineCount: summary.lineCount });
frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:2: * WHAT: Requests the derived status for one card-scoped Codex skill run.
frontend/src/runtime/codex/effect/request-card-skill-run-status.ts:42:  const response = await fetch(`/api/codex/skills/runs/${encodeURIComponent(input.runId)}?${params.toString()}`).catch(() => undefined);
frontend/src/runtime/dom.ts:11:export const skillModal = runtimeDocument?.querySelector('.skill-modal') as HTMLDialogElement;
frontend/src/runtime/voice/controller/cancel-voice-recording.ts:13:  const processor = state.voice.processor as ScriptProcessorNode | undefined;
frontend/src/runtime/voice/controller/cancel-voice-recording.ts:14:  processor?.disconnect();
frontend/src/runtime/voice/controller/stop-voice-recording.ts:19:  const processor = state.voice.processor as ScriptProcessorNode | undefined;
frontend/src/runtime/voice/controller/stop-voice-recording.ts:20:  processor?.disconnect();
frontend/src/runtime/voice/controller/start-voice-recording.ts:30:    const processor = audioContext.createScriptProcessor(1024, 1, 1);
frontend/src/runtime/voice/controller/start-voice-recording.ts:33:    processor.onaudioprocess = (event) => {
frontend/src/runtime/voice/controller/start-voice-recording.ts:40:    source.connect(processor);
frontend/src/runtime/voice/controller/start-voice-recording.ts:41:    processor.connect(silentGain);
frontend/src/runtime/voice/controller/start-voice-recording.ts:50:    state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, pendingVoicePeak: 0, waveSamples: [], transcriptionStatus: 'recording', threadId, stream, audioContext, analyser, recorder, chunks, mimeType: 'audio/wav', recorderMimeType: recorder.mimeType || 'audio/webm', pcmChunks, sampleRate: audioContext.sampleRate, processor, silentGain, error: '' };
frontend/src/runtime/codex/effect/render-skill-modal.ts:2: * WHAT: Renders and updates the card Codex skill picker modal.
frontend/src/runtime/codex/effect/render-skill-modal.ts:3: * WHY: Operators need searchable skill descriptions before launching a card-scoped process.
frontend/src/runtime/codex/effect/render-skill-modal.ts:5:import { skillModal } from '../../dom.js';
frontend/src/runtime/codex/effect/render-skill-modal.ts:7:import { processCardSkillController } from '../controller/process-card-skill-controller.js';
frontend/src/runtime/codex/effect/render-skill-modal.ts:8:import { loadCodexSkills, type CodexSkillSummary } from './load-codex-skills.js';
frontend/src/runtime/codex/effect/render-skill-modal.ts:16:  skills: CodexSkillSummary[];
frontend/src/runtime/codex/effect/render-skill-modal.ts:18:  processing: boolean;
frontend/src/runtime/codex/effect/render-skill-modal.ts:26:const skillModalState: SkillModalState = {
frontend/src/runtime/codex/effect/render-skill-modal.ts:32:  skills: [],
frontend/src/runtime/codex/effect/render-skill-modal.ts:34:  processing: false,
frontend/src/runtime/codex/effect/render-skill-modal.ts:48:  label.className = 'skill-run-field';
frontend/src/runtime/codex/effect/render-skill-modal.ts:65:function filteredSkills(): CodexSkillSummary[] {
frontend/src/runtime/codex/effect/render-skill-modal.ts:66:  const query = skillModalState.query.trim().toLowerCase();
frontend/src/runtime/codex/effect/render-skill-modal.ts:67:  if (!query) return skillModalState.skills;
frontend/src/runtime/codex/effect/render-skill-modal.ts:68:  return skillModalState.skills.filter((skill) => {
frontend/src/runtime/codex/effect/render-skill-modal.ts:69:    const text = `${skill.name} ${skill.description} ${skill.source}`.toLowerCase();
frontend/src/runtime/codex/effect/render-skill-modal.ts:74:function renderSkillRow(skill: CodexSkillSummary): HTMLButtonElement {
frontend/src/runtime/codex/effect/render-skill-modal.ts:75:  const selected = skill.name === skillModalState.selectedSkillName;
frontend/src/runtime/codex/effect/render-skill-modal.ts:77:  button.className = `skill-result${selected ? ' is-selected' : ''}`;
frontend/src/runtime/codex/effect/render-skill-modal.ts:79:  button.dataset.action = 'select-card-skill';
frontend/src/runtime/codex/effect/render-skill-modal.ts:80:  button.dataset.skillName = skill.name;
frontend/src/runtime/codex/effect/render-skill-modal.ts:84:  title.className = 'skill-result-name';
frontend/src/runtime/codex/effect/render-skill-modal.ts:85:  title.textContent = skill.name;
frontend/src/runtime/codex/effect/render-skill-modal.ts:87:  source.className = 'skill-result-source';
frontend/src/runtime/codex/effect/render-skill-modal.ts:88:  source.textContent = skill.source;
frontend/src/runtime/codex/effect/render-skill-modal.ts:90:  description.className = 'skill-result-description';
frontend/src/runtime/codex/effect/render-skill-modal.ts:91:  description.textContent = skill.description || 'No description.';
frontend/src/runtime/codex/effect/render-skill-modal.ts:97:  if (!skillModal) return;
frontend/src/runtime/codex/effect/render-skill-modal.ts:99:  title.id = 'skill-modal-title';
frontend/src/runtime/codex/effect/render-skill-modal.ts:100:  title.textContent = 'Codex Skills';
frontend/src/runtime/codex/effect/render-skill-modal.ts:103:  search.className = 'skill-search';
frontend/src/runtime/codex/effect/render-skill-modal.ts:105:  search.placeholder = 'Search skills';
frontend/src/runtime/codex/effect/render-skill-modal.ts:106:  search.value = skillModalState.query;
frontend/src/runtime/codex/effect/render-skill-modal.ts:108:  search.setAttribute('aria-label', 'Search skills');
frontend/src/runtime/codex/effect/render-skill-modal.ts:110:    skillModalState.query = search.value;
frontend/src/runtime/codex/effect/render-skill-modal.ts:112:    skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
frontend/src/runtime/codex/effect/render-skill-modal.ts:116:  runControls.className = 'skill-run-controls';
frontend/src/runtime/codex/effect/render-skill-modal.ts:119:    value: skillModalState.codexModel,
frontend/src/runtime/codex/effect/render-skill-modal.ts:122:      skillModalState.codexModel = value;
frontend/src/runtime/codex/effect/render-skill-modal.ts:123:      telemetry('codex-skill-model-selected', { cardId: skillModalState.cardId, codexModel: value });
frontend/src/runtime/codex/effect/render-skill-modal.ts:128:    value: skillModalState.codexEffort,
frontend/src/runtime/codex/effect/render-skill-modal.ts:131:      skillModalState.codexEffort = value;
frontend/src/runtime/codex/effect/render-skill-modal.ts:132:      telemetry('codex-skill-effort-selected', { cardId: skillModalState.cardId, codexEffort: value });
frontend/src/runtime/codex/effect/render-skill-modal.ts:138:  results.className = 'skill-results';
frontend/src/runtime/codex/effect/render-skill-modal.ts:139:  if (skillModalState.loading) {
frontend/src/runtime/codex/effect/render-skill-modal.ts:141:    loading.className = 'skill-empty';
frontend/src/runtime/codex/effect/render-skill-modal.ts:142:    loading.textContent = 'Loading skills';
frontend/src/runtime/codex/effect/render-skill-modal.ts:149:      empty.className = 'skill-empty';
frontend/src/runtime/codex/effect/render-skill-modal.ts:150:      empty.textContent = 'No matching skills';
frontend/src/runtime/codex/effect/render-skill-modal.ts:156:  actions.className = 'skill-actions';
frontend/src/runtime/codex/effect/render-skill-modal.ts:157:  if (skillModalState.error) {
frontend/src/runtime/codex/effect/render-skill-modal.ts:159:    error.className = 'skill-error';
frontend/src/runtime/codex/effect/render-skill-modal.ts:160:    error.textContent = skillModalState.error;
frontend/src/runtime/codex/effect/render-skill-modal.ts:163:  if (skillModalState.selectedSkillName) {
frontend/src/runtime/codex/effect/render-skill-modal.ts:165:    selectedName.className = 'skill-selected-name';
frontend/src/runtime/codex/effect/render-skill-modal.ts:166:    selectedName.title = skillModalState.selectedSkillName;
frontend/src/runtime/codex/effect/render-skill-modal.ts:167:    selectedName.textContent = skillModalState.selectedSkillName;
frontend/src/runtime/codex/effect/render-skill-modal.ts:170:    const process = document.createElement('button');
frontend/src/runtime/codex/effect/render-skill-modal.ts:171:    process.className = 'skill-process-button';
frontend/src/runtime/codex/effect/render-skill-modal.ts:172:    process.type = 'button';
frontend/src/runtime/codex/effect/render-skill-modal.ts:173:    process.dataset.action = 'process-card-skill';
frontend/src/runtime/codex/effect/render-skill-modal.ts:174:    process.disabled = skillModalState.processing;
frontend/src/runtime/codex/effect/render-skill-modal.ts:175:    process.textContent = skillModalState.processing ? 'Processing' : 'Process';
frontend/src/runtime/codex/effect/render-skill-modal.ts:176:    actions.append(process);
frontend/src/runtime/codex/effect/render-skill-modal.ts:180:  close.dataset.action = 'close-card-skill-modal';
frontend/src/runtime/codex/effect/render-skill-modal.ts:184:  skillModal.setAttribute('aria-labelledby', 'skill-modal-title');
frontend/src/runtime/codex/effect/render-skill-modal.ts:185:  skillModal.replaceChildren(title, search, runControls, results, actions);
frontend/src/runtime/codex/effect/render-skill-modal.ts:190:  if (!skillModal || !cardId) return;
frontend/src/runtime/codex/effect/render-skill-modal.ts:191:  Object.assign(skillModalState, { cardId, query: '', selectedSkillName: '', skills: [], loading: true, processing: false, error: '' });
frontend/src/runtime/codex/effect/render-skill-modal.ts:193:  skillModal.showModal?.();
frontend/src/runtime/codex/effect/render-skill-modal.ts:194:  telemetry('codex-skill-modal-open', { cardId });
frontend/src/runtime/codex/effect/render-skill-modal.ts:195:  skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
frontend/src/runtime/codex/effect/render-skill-modal.ts:196:  skillModalState.skills = await loadCodexSkills();
frontend/src/runtime/codex/effect/render-skill-modal.ts:197:  skillModalState.loading = false;
frontend/src/runtime/codex/effect/render-skill-modal.ts:199:  skillModal.querySelector<HTMLInputElement>('.skill-search')?.focus();
frontend/src/runtime/codex/effect/render-skill-modal.ts:202:export function selectCardSkill(skillName: string): void {
frontend/src/runtime/codex/effect/render-skill-modal.ts:203:  const resultsScrollTop = skillModal?.querySelector<HTMLDivElement>('.skill-results')?.scrollTop;
frontend/src/runtime/codex/effect/render-skill-modal.ts:204:  skillModalState.selectedSkillName = skillName;
frontend/src/runtime/codex/effect/render-skill-modal.ts:205:  skillModalState.error = '';
frontend/src/runtime/codex/effect/render-skill-modal.ts:207:  telemetry('codex-skill-selected', { cardId: skillModalState.cardId, skillName });
frontend/src/runtime/codex/effect/render-skill-modal.ts:210:export async function processSelectedCardSkill(): Promise<void> {
frontend/src/runtime/codex/effect/render-skill-modal.ts:211:  if (!skillModalState.cardId || !skillModalState.selectedSkillName || skillModalState.processing) return;
frontend/src/runtime/codex/effect/render-skill-modal.ts:212:  const resultsScrollTop = skillModal?.querySelector<HTMLDivElement>('.skill-results')?.scrollTop;
frontend/src/runtime/codex/effect/render-skill-modal.ts:213:  skillModalState.processing = true;
frontend/src/runtime/codex/effect/render-skill-modal.ts:214:  skillModalState.error = '';
frontend/src/runtime/codex/effect/render-skill-modal.ts:216:  const ok = await processCardSkillController({
frontend/src/runtime/codex/effect/render-skill-modal.ts:217:    cardId: skillModalState.cardId,
frontend/src/runtime/codex/effect/render-skill-modal.ts:218:    skillName: skillModalState.selectedSkillName,
frontend/src/runtime/codex/effect/render-skill-modal.ts:219:    codexModel: skillModalState.codexModel,
frontend/src/runtime/codex/effect/render-skill-modal.ts:220:    codexEffort: skillModalState.codexEffort,
frontend/src/runtime/codex/effect/render-skill-modal.ts:222:  skillModalState.processing = false;
frontend/src/runtime/codex/effect/render-skill-modal.ts:224:    skillModal?.close?.();
frontend/src/runtime/codex/effect/render-skill-modal.ts:227:  skillModalState.error = 'Process failed';
frontend/src/runtime/codex/effect/render-skill-modal.ts:232:  skillModal?.close?.();
frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts:280:    invalid.textContent = 'HTML embed must live under the active ledger card assets directory.';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:2: * WHAT: Renders the live status widget for a Codex skill output card.
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:6:import { cardCodexRunId } from '../helper/card-codex-run-id.js';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:7:import { bindCardSkillRunWidget } from '../effect/poll-card-skill-run.js';
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:25:  const runId = cardCodexRunId(card);
frontend/src/runtime/codex/component/render-card-skill-run-widget.ts:46:  cancel.title = 'Cancel Codex run';
frontend/src/runtime/ledger/effect/send-active-ledger-mutation.ts:2: * WHAT: Sends an active ledger mutation without replacing local runtime state.
frontend/src/runtime/ledger/component/render-ledger-card-detail-layer.ts:6:import { renderCardSkillRunWidget } from '../../codex/component/render-card-skill-run-widget.js';
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:13:  button.disabled = visibleStatus === 'processing';
frontend/src/runtime/ledger/component/render-ledger-card-status-button.ts:14:  button.title = button.disabled ? 'Current status: processing. Waiting for agent response' : `Current status: ${visibleStatus}. Mark card ${nextStatus}`;
frontend/src/runtime/thread/controller/delete-note-controller.ts:2: * WHAT: Deletes a specific note from a thread through the active ledger mutation path.
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:127:  const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:149:  const skill = document.createElement('button');
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:150:  skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:151:  skill.type = 'button';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:152:  skill.dataset.action = 'open-card-skill-modal';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:153:  skill.dataset.cardId = cardId;
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:154:  skill.title = 'Run Codex skill';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:155:  skill.setAttribute('aria-label', skill.title);
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:156:  skill.textContent = 'fx';
frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts:159:    : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];
frontend/src/runtime/thread/effect/render-thread-notes.ts:108:      spinner.textContent = normalizedStatus || 'processing';
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-66","timestamp":"2026-07-07T17:00:47.757Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"66","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_35","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/test/codex/start-card-skill-process-controller.test.ts | sed -n '1,180p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/test/codex/start-card-skill-process-controller.test.ts | sed -n '1,180p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-67","timestamp":"2026-07-07T17:00:47.758Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"67","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_35","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/test/codex/start-card-skill-process-controller.test.ts | sed -n '1,180p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/test/codex/start-card-skill-process-controller.test.ts | sed -n '1,180p'"`
Status: completed
Exit code: 0

````text
     1	import test from 'node:test';
     2	import assert from 'node:assert/strict';
     3	import { once } from 'node:events';
     4	import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
     5	import { tmpdir } from 'node:os';
     6	import { join } from 'node:path';
     7	import type { AddressInfo } from 'node:net';
     8	import type { Server } from 'node:http';
     9	import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
    10	
    11	async function waitForText(file: string, text: string): Promise<void> {
    12	  const started = Date.now();
    13	  while (Date.now() - started < 3000) {
    14	    if (existsSync(file) && readFileSync(file, 'utf8').includes(text)) return;
    15	    await new Promise((resolve) => setTimeout(resolve, 50));
    16	  }
    17	  assert.fail(`Timed out waiting for ${text} in ${file}`);
    18	}
    19	
    20	test('card skill process route creates a linked output card and launches codex', async () => {
    21	  const originalCwd = process.cwd();
    22	  const previousCodexBin = process.env.CODEX_BIN;
    23	  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-'));
    24	  const fakeCodex = join(workspace, 'fake-codex.mjs');
    25	  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
    26	  mkdirSync(join(workspace, '.skills', 'test-skill'), { recursive: true });
    27	  writeFileSync(join(workspace, '.skills', 'test-skill', 'SKILL.md'), [
    28	    '---',
    29	    'name: test-skill',
    30	    'description: Test skill description',
    31	    '---',
    32	    '',
    33	  ].join('\n'));
    34	  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
    35	    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
    36	  }, null, 2));
    37	  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
    38	    cards: [{
    39	      id: 'source-card',
    40	      title: 'Source Card',
    41	      x: 100,
    42	      y: 120,
    43	      w: 320,
    44	      h: 180,
    45	      comment: { what: 'Incoming card body' },
    46	      facts: [],
    47	      fields: []
    48	    }],
    49	    annotations: [],
    50	    relationships: [],
    51	    notes: {}
    52	  }, null, 2));
    53	  writeFileSync(fakeCodex, [
    54	    '#!/usr/bin/env node',
    55	    'import { writeFileSync } from "node:fs";',
    56	    'let input = "";',
    57	    'process.stdin.on("data", (chunk) => { input += chunk; });',
    58	    'process.stdin.on("end", () => {',
    59	    '  const match = input.match(/Write the final result to this Markdown file: (.+)/);',
    60	    '  if (!match) process.exit(2);',
    61	    '  const args = process.argv.slice(2);',
    62	    '  const model = args[args.indexOf("--model") + 1] || "";',
    63	    '  const effort = args[args.indexOf("-c") + 1] || "";',
    64	    '  writeFileSync(match[1].trim(), "# Fake Result\\n\\n" + (input.includes("$test-skill") ? "skill seen" : "skill missing") + "\\nmodel=" + model + "\\neffort=" + effort + "\\n");',
    65	    '  console.log(JSON.stringify({ type: "fake-codex-done" }));',
    66	    '});',
    67	  ].join('\n'));
    68	  chmodSync(fakeCodex, 0o755);
    69	
    70	  process.chdir(workspace);
    71	  process.env.CODEX_BIN = fakeCodex;
    72	  const runtime: Record<string, unknown> = {};
    73	  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
    74	  const server = runtime.server as Server;
    75	  await once(server, 'listening');
    76	  const address = server.address() as AddressInfo;
    77	
    78	  try {
    79	    const response = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/process`, {
    80	      method: 'POST',
    81	      headers: { 'content-type': 'application/json' },
    82	      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'test-skill', codexModel: 'gpt-5.4', codexEffort: 'xhigh' })
    83	    });
    84	    assert.equal(response.status, 202);
    85	    const body = await response.json() as { ok: boolean; run: { outputCardId: string; outputFile: string; codexModel: string; codexEffort: string } };
    86	    assert.equal(body.ok, true);
    87	    assert.ok(body.run.outputCardId);
    88	    assert.ok(body.run.outputFile.endsWith(`${body.run.outputCardId}.md`));
    89	    assert.equal(body.run.codexModel, 'gpt-5.4');
    90	    assert.equal(body.run.codexEffort, 'xhigh');
    91	
    92	    const ledger = JSON.parse(readFileSync(join(workspace, '.decision-os', 'specs.json'), 'utf8')) as {
    93	      cards: Array<{ id: string; x: number; comment?: { contentFile?: string } }>;
    94	      relationships: Array<{ from: string; to: string; label: string }>;
    95	    };
    96	    assert.equal(ledger.cards.some((card) => card.id === body.run.outputCardId && card.x > 420), true);
    97	    assert.equal(ledger.relationships.some((relationship) => relationship.from === 'source-card' && relationship.to === body.run.outputCardId && relationship.label === 'test-skill'), true);
    98	    assert.equal(ledger.cards.find((card) => card.id === body.run.outputCardId)?.comment?.contentFile?.endsWith(`${body.run.outputCardId}.md`), true);
    99	
   100	    await waitForText(body.run.outputFile, 'skill seen');
   101	    await waitForText(body.run.outputFile, 'model=gpt-5.4');
   102	    await waitForText(body.run.outputFile, 'effort=model_reasoning_effort="xhigh"');
   103	  } finally {
   104	    server.close();
   105	    process.chdir(originalCwd);
   106	    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
   107	    else process.env.CODEX_BIN = previousCodexBin;
   108	    rmSync(workspace, { recursive: true, force: true });
   109	  }
   110	});
   111	
   112	test('card skill run cancel route terminates the active codex process', async () => {
   113	  const originalCwd = process.cwd();
   114	  const previousCodexBin = process.env.CODEX_BIN;
   115	  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-card-skill-cancel-'));
   116	  const fakeCodex = join(workspace, 'fake-codex-slow.mjs');
   117	  mkdirSync(join(workspace, '.decision-os'), { recursive: true });
   118	  mkdirSync(join(workspace, '.skills', 'slow-skill'), { recursive: true });
   119	  writeFileSync(join(workspace, '.skills', 'slow-skill', 'SKILL.md'), [
   120	    '---',
   121	    'name: slow-skill',
   122	    'description: Slow skill description',
   123	    '---',
   124	    '',
   125	  ].join('\n'));
   126	  writeFileSync(join(workspace, '.decision-os', 'state.json'), JSON.stringify({
   127	    ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }]
   128	  }, null, 2));
   129	  writeFileSync(join(workspace, '.decision-os', 'specs.json'), JSON.stringify({
   130	    cards: [{
   131	      id: 'source-card',
   132	      title: 'Source Card',
   133	      x: 100,
   134	      y: 120,
   135	      w: 320,
   136	      h: 180,
   137	      comment: { what: 'Incoming card body' },
   138	      facts: [],
   139	      fields: []
   140	    }],
   141	    annotations: [],
   142	    relationships: [],
   143	    notes: {}
   144	  }, null, 2));
   145	  writeFileSync(fakeCodex, [
   146	    '#!/usr/bin/env node',
   147	    'import { writeFileSync } from "node:fs";',
   148	    'let input = "";',
   149	    'process.stdin.on("data", (chunk) => { input += chunk; });',
   150	    'process.stdin.on("end", () => {',
   151	    '  const match = input.match(/Write the final result to this Markdown file: (.+)/);',
   152	    '  if (!match) process.exit(2);',
   153	    '  writeFileSync(match[1].trim(), "# Slow Result\\n\\nstarted\\n");',
   154	    '  console.log(JSON.stringify({ type: "turn.started" }));',
   155	    '});',
   156	    'process.on("SIGTERM", () => {',
   157	    '  console.log(JSON.stringify({ type: "operator.cancelled" }));',
   158	    '  process.exit(0);',
   159	    '});',
   160	    'setInterval(() => undefined, 1000);',
   161	  ].join('\n'));
   162	  chmodSync(fakeCodex, 0o755);
   163	
   164	  process.chdir(workspace);
   165	  process.env.CODEX_BIN = fakeCodex;
   166	  const runtime: Record<string, unknown> = {};
   167	  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
   168	  const server = runtime.server as Server;
   169	  await once(server, 'listening');
   170	  const address = server.address() as AddressInfo;
   171	
   172	  try {
   173	    const startResponse = await fetch(`http://127.0.0.1:${address.port}/api/codex/skills/process`, {
   174	      method: 'POST',
   175	      headers: { 'content-type': 'application/json' },
   176	      body: JSON.stringify({ ledgerId: 'specs', cardId: 'source-card', skillName: 'slow-skill' })
   177	    });
   178	    assert.equal(startResponse.status, 202);
   179	    const started = await startResponse.json() as { ok: boolean; run: { id: string; outputCardId: string; outputFile: string } };
   180	    assert.equal(started.ok, true);
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-68","timestamp":"2026-07-07T17:00:47.759Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"68","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_36","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/test/codex/scan-codex-skills.test.ts | sed -n '1,120p' && nl -ba backend/test/codex/resolve-codex-command.test.ts | sed -n '1,160p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/test/codex/scan-codex-skills.test.ts | sed -n '1,120p' && nl -ba backend/test/codex/resolve-codex-command.test.ts | sed -n '1,160p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-69","timestamp":"2026-07-07T17:00:47.760Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"69","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_36","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/test/codex/scan-codex-skills.test.ts | sed -n '1,120p' && nl -ba backend/test/codex/resolve-codex-command.test.ts | sed -n '1,160p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/test/codex/scan-codex-skills.test.ts | sed -n '1,120p' && nl -ba backend/test/codex/resolve-codex-command.test.ts | sed -n '1,160p'"`
Status: completed
Exit code: 0

````text
     1	import test from 'node:test';
     2	import assert from 'node:assert/strict';
     3	import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
     4	import { tmpdir } from 'node:os';
     5	import { join } from 'node:path';
     6	import { scanCodexSkills } from '@backend/business/codex/helper/scan-codex-skills.js';
     7	
     8	test('scanCodexSkills reads workspace user and plugin skill frontmatter', () => {
     9	  const previousCodexHome = process.env.CODEX_HOME;
    10	  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skills-workspace-'));
    11	  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-skills-home-'));
    12	
    13	  try {
    14	    process.env.CODEX_HOME = codexHome;
    15	    mkdirSync(join(workspace, '.skills', 'duplicate-skill'), { recursive: true });
    16	    mkdirSync(join(codexHome, 'skills', 'duplicate-skill'), { recursive: true });
    17	    mkdirSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill'), { recursive: true });
    18	
    19	    writeFileSync(join(workspace, '.skills', 'duplicate-skill', 'SKILL.md'), [
    20	      '---',
    21	      'name: duplicate-skill',
    22	      'description: Workspace skill wins',
    23	      '---',
    24	      '',
    25	    ].join('\n'));
    26	    writeFileSync(join(codexHome, 'skills', 'duplicate-skill', 'SKILL.md'), [
    27	      '---',
    28	      'name: duplicate-skill',
    29	      'description: User skill loses',
    30	      '---',
    31	      '',
    32	    ].join('\n'));
    33	    writeFileSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill', 'SKILL.md'), [
    34	      '---',
    35	      'name: plugin-skill',
    36	      'description: Plugin skill description',
    37	      '---',
    38	      '',
    39	    ].join('\n'));
    40	
    41	    const skills = scanCodexSkills({ workspaceRoot: workspace });
    42	    const duplicate = skills.find((skill) => skill.name === 'duplicate-skill');
    43	    const plugin = skills.find((skill) => skill.name === 'plugin-skill');
    44	
    45	    assert.equal(duplicate?.description, 'Workspace skill wins');
    46	    assert.equal(duplicate?.source, 'workspace');
    47	    assert.equal(plugin?.description, 'Plugin skill description');
    48	    assert.equal(plugin?.source, 'plugin');
    49	  } finally {
    50	    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    51	    else process.env.CODEX_HOME = previousCodexHome;
    52	    rmSync(workspace, { recursive: true, force: true });
    53	    rmSync(codexHome, { recursive: true, force: true });
    54	  }
    55	});
     1	import test from 'node:test';
     2	import assert from 'node:assert/strict';
     3	import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
     4	import { tmpdir } from 'node:os';
     5	import { dirname, join, resolve } from 'node:path';
     6	import { resolveCodexCommand } from '@backend/business/codex/helper/resolve-codex-command.js';
     7	
     8	test('resolveCodexCommand honors an explicit executable setting', () => {
     9	  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-command-'));
    10	  const bin = join(workspace, 'codex-bin');
    11	  const previousCodexBin = process.env.CODEX_BIN;
    12	  const previousCodexModel = process.env.CODEX_MODEL;
    13	  const previousCodexEffort = process.env.CODEX_EFFORT;
    14	  try {
    15	    delete process.env.CODEX_BIN;
    16	    delete process.env.CODEX_MODEL;
    17	    delete process.env.CODEX_EFFORT;
    18	    writeFileSync(bin, '#!/bin/sh\nexit 0\n');
    19	    chmodSync(bin, 0o755);
    20	    const command = resolveCodexCommand({ workspaceRoot: workspace, runtime: { decisionOsSettings: { codexBin: bin, codexModel: 'gpt-5.4', codexReasoningEffort: 'low' } } });
    21	
    22	    assert.equal(command.command, bin);
    23	    assert.deepEqual(command.args.slice(0, 5), ['exec', '--dangerously-bypass-approvals-and-sandbox', '--json', '-C', workspace]);
    24	    assert.equal(command.args.includes('gpt-5.4'), true);
    25	    assert.equal(command.args.includes('model_reasoning_effort="low"'), true);
    26	  } finally {
    27	    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    28	    else process.env.CODEX_BIN = previousCodexBin;
    29	    if (previousCodexModel === undefined) delete process.env.CODEX_MODEL;
    30	    else process.env.CODEX_MODEL = previousCodexModel;
    31	    if (previousCodexEffort === undefined) delete process.env.CODEX_EFFORT;
    32	    else process.env.CODEX_EFFORT = previousCodexEffort;
    33	    rmSync(workspace, { recursive: true, force: true });
    34	  }
    35	});
    36	
    37	test('resolveCodexCommand lets run payload override settings model and effort', () => {
    38	  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-codex-command-'));
    39	  try {
    40	    const command = resolveCodexCommand({
    41	      workspaceRoot: workspace,
    42	      runtime: { decisionOsSettings: { codexModel: 'gpt-5.4', codexReasoningEffort: 'low' } },
    43	      codexModel: 'gpt-5.5',
    44	      codexEffort: 'xhigh'
    45	    });
    46	
    47	    assert.equal(command.model, 'gpt-5.5');
    48	    assert.equal(command.effort, 'xhigh');
    49	    assert.equal(command.args.includes('gpt-5.5'), true);
    50	    assert.equal(command.args.includes('model_reasoning_effort="xhigh"'), true);
    51	  } finally {
    52	    rmSync(workspace, { recursive: true, force: true });
    53	  }
    54	});
    55	
    56	test('resolveCodexCommand can find Codex beside the running Node executable when PATH is sparse', () => {
    57	  const adjacentCodex = resolve(dirname(process.execPath), 'codex');
    58	  if (!existsSync(adjacentCodex)) return;
    59	  const previousPath = process.env.PATH;
    60	  const previousCodexBin = process.env.CODEX_BIN;
    61	  try {
    62	    process.env.PATH = '/usr/bin';
    63	    delete process.env.CODEX_BIN;
    64	    const command = resolveCodexCommand({ workspaceRoot: process.cwd(), runtime: {} });
    65	    assert.equal(command.command, adjacentCodex);
    66	  } finally {
    67	    if (previousPath === undefined) delete process.env.PATH;
    68	    else process.env.PATH = previousPath;
    69	    if (previousCodexBin === undefined) delete process.env.CODEX_BIN;
    70	    else process.env.CODEX_BIN = previousCodexBin;
    71	  }
    72	});
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-70","timestamp":"2026-07-07T17:00:47.761Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"70","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_37","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/controller/read-card-skill-run-controller.ts | sed -n '1,340p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/controller/read-card-skill-run-controller.ts | sed -n '1,340p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-71","timestamp":"2026-07-07T17:00:47.762Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"71","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_37","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/controller/read-card-skill-run-controller.ts | sed -n '1,340p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/controller/read-card-skill-run-controller.ts | sed -n '1,340p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Reads one card-scoped Codex skill run from its derived JSONL/log files.
     3	 * WHY: The output card and run id are enough to hydrate live progress without a persisted run manifest.
     4	 */
     5	import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
     6	import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
     7	import { hydrateLedgerCardContent } from '@backend/business/ledger/helper/card-content-file.js';
     8	import { normalizeLedgerNotes } from '@backend/business/server/helper/normalize-ledger-notes.js';
     9	import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
    10	import { hydrateLedgerThreadNotes, stripHydratedThreadNotes, writeThreadNotesFile } from '@backend/business/ledger/helper/thread-content-file.js';
    11	
    12	type AnyRecord = Record<string, unknown>;
    13	type RunStatus = 'running' | 'complete' | 'failed' | 'cancelled' | 'unknown';
    14	
    15	type ParsedRunLine = {
    16	  line: number;
    17	  event: AnyRecord;
    18	};
    19	
    20	type NormalizedRunEvent = {
    21	  line: number;
    22	  type: string;
    23	  kind: string;
    24	  title: string;
    25	  text: string;
    26	  status: string;
    27	  itemId: string;
    28	  tool: string;
    29	  exitCode: string;
    30	  persist: boolean;
    31	};
    32	
    33	function safeSegment(value: unknown): string {
    34	  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
    35	}
    36	
    37	function isInside(parent: string, child: string): boolean {
    38	  const inner = relative(parent, child);
    39	  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
    40	}
    41	
    42	function ledgerStem(ledgerPath: string): string {
    43	  return basename(ledgerPath, extname(ledgerPath));
    44	}
    45	
    46	function runTimestamp(runId: string): number {
    47	  const match = runId.match(/^codex-skill-(\d+)-/);
    48	  const timestamp = Number(match?.[1] ?? 0);
    49	  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
    50	}
    51	
    52	function commandText(command: unknown): string {
    53	  if (Array.isArray(command)) return command.map((entry) => String(entry)).join(' ');
    54	  return String(command ?? '').trim();
    55	}
    56	
    57	function textBlock(value: unknown): string {
    58	  if (Array.isArray(value)) {
    59	    return value.map((entry) => {
    60	      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return String(entry ?? '');
    61	      const record = entry as AnyRecord;
    62	      return String(record.text ?? record.summary ?? record.message ?? JSON.stringify(record));
    63	    }).join('\n').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
    64	  }
    65	  if (value && typeof value === 'object') return JSON.stringify(value, null, 2).replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
    66	  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
    67	}
    68	
    69	function itemRecord(event: AnyRecord): AnyRecord {
    70	  return event.item && typeof event.item === 'object' && !Array.isArray(event.item) ? event.item as AnyRecord : {};
    71	}
    72	
    73	function changesText(changes: unknown): string {
    74	  if (!Array.isArray(changes)) return textBlock(changes) || 'File changes recorded.';
    75	  return changes.map((change) => {
    76	    if (!change || typeof change !== 'object' || Array.isArray(change)) return `- ${String(change)}`;
    77	    const record = change as AnyRecord;
    78	    const path = String(record.path ?? record.file ?? record.name ?? 'file');
    79	    const action = String(record.kind ?? record.type ?? record.action ?? record.status ?? 'changed');
    80	    return `- ${path}: ${action}`;
    81	  }).join('\n');
    82	}
    83	
    84	function normalizeRunEvent(line: ParsedRunLine): NormalizedRunEvent {
    85	  const event = line.event;
    86	  const type = String(event.type ?? '');
    87	  const item = itemRecord(event);
    88	  const itemType = String(item.type ?? '');
    89	  const itemId = String(item.id ?? event.id ?? '');
    90	  const status = String(item.status ?? event.status ?? '');
    91	  if (type === 'turn.completed') {
    92	    return { line: line.line, type, kind: 'run_status', title: 'Turn completed', text: 'Codex turn completed.', status: 'complete', itemId, tool: '', exitCode: '', persist: true };
    93	  }
    94	  if (type === 'turn.started') {
    95	    return { line: line.line, type, kind: 'run_status', title: 'Turn started', text: 'Codex turn started.', status: 'running', itemId, tool: '', exitCode: '', persist: false };
    96	  }
    97	  if (type === 'thread.started') {
    98	    return { line: line.line, type, kind: 'run_status', title: 'Thread started', text: 'Codex thread started.', status: 'running', itemId, tool: '', exitCode: '', persist: false };
    99	  }
   100	  if (itemType === 'agent_message') {
   101	    const text = textBlock(item.text ?? item.message ?? event.text);
   102	    return { line: line.line, type, kind: 'agent_message', title: 'Codex message', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
   103	  }
   104	  if (/reason|thinking|thought/i.test(itemType)) {
   105	    const text = textBlock(item.text ?? item.summary ?? item.message ?? event.text);
   106	    return { line: line.line, type, kind: 'thinking', title: 'Codex thinking', text, status, itemId, tool: '', exitCode: '', persist: Boolean(text) };
   107	  }
   108	  if (itemType === 'command_execution') {
   109	    const tool = commandText(item.command);
   110	    const output = textBlock(item.aggregated_output ?? item.output ?? item.stderr ?? item.stdout);
   111	    const exitCode = item.exit_code === undefined || item.exit_code === null ? '' : String(item.exit_code);
   112	    const command = tool ? `\`${tool}\`` : 'command';
   113	    const parts = [`**Tool call** ${command}`];
   114	    if (status) parts.push(`Status: ${status}`);
   115	    if (exitCode) parts.push(`Exit code: ${exitCode}`);
   116	    if (output) parts.push('', '```text', output, '```');
   117	    return { line: line.line, type, kind: 'tool_call', title: tool || 'Tool call', text: parts.join('\n'), status, itemId, tool, exitCode, persist: true };
   118	  }
   119	  if (itemType === 'file_change') {
   120	    const text = changesText(item.changes);
   121	    return { line: line.line, type, kind: 'file_change', title: 'File changes', text, status, itemId, tool: '', exitCode: '', persist: true };
   122	  }
   123	  const text = textBlock(item.text ?? item.message ?? event.text);
   124	  return {
   125	    line: line.line,
   126	    type,
   127	    kind: itemType || type || 'event',
   128	    title: itemType || type || 'Codex event',
   129	    text,
   130	    status,
   131	    itemId,
   132	    tool: '',
   133	    exitCode: '',
   134	    persist: Boolean(text),
   135	  };
   136	}
   137	
   138	function readJsonlLines(file: string): ParsedRunLine[] {
   139	  if (!existsSync(file)) return [];
   140	  return readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n').flatMap((line, index) => {
   141	    if (!line.trim()) return [];
   142	    try {
   143	      const parsed = JSON.parse(line) as unknown;
   144	      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? [{ line: index + 1, event: parsed as AnyRecord }] : [];
   145	    } catch {
   146	      return [];
   147	    }
   148	  });
   149	}
   150	
   151	function runtimeRunStatus(runtime: AnyRecord, runId: string): RunStatus | null {
   152	  const runs = runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
   153	  const run = runs[runId];
   154	  const status = String(run?.status ?? '');
   155	  return status === 'running' || status === 'complete' || status === 'failed' || status === 'cancelled' ? status : null;
   156	}
   157	
   158	function inferredStatus(input: { runtime: AnyRecord; runId: string; events: NormalizedRunEvent[]; stdoutFile: string; stderrFile: string }): RunStatus {
   159	  const runtimeStatus = runtimeRunStatus(input.runtime, input.runId);
   160	  if (runtimeStatus) return runtimeStatus;
   161	  if (input.events.some((event) => event.type === 'turn.completed')) return 'complete';
   162	  const log = existsSync(input.stderrFile) ? readFileSync(input.stderrFile, 'utf8') : '';
   163	  if (/cancelled|canceled|terminated by operator/i.test(log)) return 'cancelled';
   164	  if (/(spawn|enoent|failed|exit code [1-9]|error:)/i.test(log)) return 'failed';
   165	  if (!existsSync(input.stdoutFile)) return 'unknown';
   166	  const newestWrite = Math.max(statSync(input.stdoutFile).mtimeMs, existsSync(input.stderrFile) ? statSync(input.stderrFile).mtimeMs : 0);
   167	  return Date.now() - newestWrite < 120000 ? 'running' : 'unknown';
   168	}
   169	
   170	function fileMtimeMs(file: string): number {
   171	  return existsSync(file) ? statSync(file).mtimeMs : 0;
   172	}
   173	
   174	function elapsedMs(input: { runtime: AnyRecord; runId: string; status: RunStatus; stdoutFile: string; stderrFile: string }): number {
   175	  const runs = input.runtime.codexSkillRuns && typeof input.runtime.codexSkillRuns === 'object' ? input.runtime.codexSkillRuns as Record<string, AnyRecord> : {};
   176	  const run = runs[input.runId] ?? {};
   177	  const started = Date.parse(String(run.startedAt ?? '')) || runTimestamp(input.runId);
   178	  const finished = Date.parse(String(run.finishedAt ?? ''));
   179	  const terminalFileWrite = Math.max(fileMtimeMs(input.stdoutFile), fileMtimeMs(input.stderrFile));
   180	  const end = finished || (input.status === 'running' ? Date.now() : terminalFileWrite || Date.now());
   181	  return Math.max(0, end - started);
   182	}
   183	
   184	function cardReferencesRun(input: { ledger: AnyRecord; decisionOsRoot: string; cardId: string; runId: string }): boolean {
   185	  const hydrated = hydrateLedgerCardContent(JSON.parse(JSON.stringify(input.ledger)), input.decisionOsRoot) as { cards?: AnyRecord[] };
   186	  const card = (hydrated.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
   187	  if (!card) return false;
   188	  if (String(card.cardType ?? '') === 'codex-skill-run' && input.cardId === `card-${safeSegment(input.runId)}`) return true;
   189	  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
   190	  const body = String(comment.what ?? comment.body ?? comment.description ?? '');
   191	  return body.includes(`Codex run: ${input.runId}`);
   192	}
   193	
   194	function eventTimestamp(runId: string, line: number): string {
   195	  return new Date(runTimestamp(runId) + line).toISOString();
   196	}
   197	
   198	function persistRunEvents(input: { decisionOsRoot: string; ledgerPath: string; ledger: AnyRecord; cardId: string; runId: string; events: NormalizedRunEvent[] }): number {
   199	  hydrateLedgerThreadNotes(input.ledger, input.decisionOsRoot);
   200	  const threadId = `thread-${input.cardId}`;
   201	  const notesByThread = normalizeLedgerNotes(input.ledger);
   202	  const notes = notesByThread[threadId] ?? [];
   203	  const byId = new Map(notes.map((note) => [String(note.id ?? ''), note]));
   204	  let changed = 0;
   205	  for (const event of input.events) {
   206	    if (!event.persist) continue;
   207	    const id = `codex-${safeSegment(input.runId)}-line-${event.line}`;
   208	    const nextNote: AnyRecord = {
   209	      id,
   210	      role: 'agent',
   211	      message: event.text || event.title,
   212	      timestamp: eventTimestamp(input.runId, event.line),
   213	      status: event.status || event.title,
   214	      codexRunId: input.runId,
   215	      codexLine: String(event.line),
   216	      codexKind: event.kind,
   217	      codexEventType: event.type,
   218	      codexItemId: event.itemId,
   219	      codexTool: event.tool,
   220	      codexExitCode: event.exitCode,
   221	    };
   222	    const existing = byId.get(id);
   223	    if (existing) {
   224	      const previous = JSON.stringify(existing);
   225	      Object.assign(existing, nextNote);
   226	      if (JSON.stringify(existing) !== previous) changed += 1;
   227	    } else {
   228	      notes.push(nextNote);
   229	      byId.set(id, nextNote);
   230	      changed += 1;
   231	    }
   232	  }
   233	  if (changed > 0) {
   234	    notesByThread[threadId] = notes;
   235	    writeThreadNotesFile({ decisionOsRoot: input.decisionOsRoot, ledger: input.ledger, ledgerPath: input.ledgerPath, threadId, notes });
   236	    stripHydratedThreadNotes(input.ledger);
   237	    writeFileSync(input.ledgerPath, JSON.stringify(input.ledger, null, 2), 'utf8');
   238	  }
   239	  return changed;
   240	}
   241	
   242	export async function readCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
   243	  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
   244	  const payload = (envelope.action_payload ?? input) as AnyRecord;
   245	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
   246	  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
   247	  const ledgerId = String(payload.ledgerId ?? '').trim();
   248	  const cardId = String(payload.cardId ?? '').trim();
   249	  const runId = String(payload.runId ?? '').trim();
   250	  const since = Math.max(0, Number(payload.since ?? 0) || 0);
   251	  if (!ledgerId || !cardId || !runId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };
   252	
   253	  const state = readCanonicalDecisionOsState({ action_payload: { decisionOsFile: resolve(decisionOsRoot, 'state.json') }, runtime_state: runtime });
   254	  const tab = state.ledgers.find((entry) => entry.id === ledgerId);
   255	  if (!tab) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId };
   256	
   257	  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
   258	  const ledgerPath = resolve(decisionOsRoot, ledgerFile);
   259	  if (!isInside(decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return { ok: false, statusCode: 404, error: 'Ledger file not found.', ledgerId };
   260	
   261	  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
   262	  if (!cardReferencesRun({ ledger, decisionOsRoot, cardId, runId })) return { ok: false, statusCode: 404, error: 'Run not found on card.', cardId, runId };
   263	
   264	  const runDirectory = resolve(decisionOsRoot, 'runs', 'codex-skills', safeSegment(ledgerStem(ledgerPath)));
   265	  const stdoutFile = resolve(runDirectory, `${safeSegment(runId)}.jsonl`);
   266	  const stderrFile = resolve(runDirectory, `${safeSegment(runId)}.log`);
   267	  const parsedLines = readJsonlLines(stdoutFile);
   268	  const events = parsedLines.map(normalizeRunEvent);
   269	  const status = inferredStatus({ runtime, runId, events, stdoutFile, stderrFile });
   270	  const persistedEventCount = persistRunEvents({ decisionOsRoot, ledgerPath, ledger, cardId, runId, events });
   271	  const returnedEvents = events.filter((event) => event.line > since);
   272	  return {
   273	    ok: true,
   274	    statusCode: 200,
   275	    ledgerId,
   276	    cardId,
   277	    runId,
   278	    status,
   279	    elapsedMs: elapsedMs({ runtime, runId, status, stdoutFile, stderrFile }),
   280	    lineCount: parsedLines.at(-1)?.line ?? 0,
   281	    nextSince: parsedLines.at(-1)?.line ?? 0,
   282	    toolCallCount: events.filter((event) => event.kind === 'tool_call' && event.type === 'item.completed').length,
   283	    agentMessageCount: events.filter((event) => event.kind === 'agent_message').length,
   284	    fileChangeCount: events.filter((event) => event.kind === 'file_change').length,
   285	    thinkingCount: events.filter((event) => event.kind === 'thinking').length,
   286	    persistedEventCount,
   287	    latestEvent: events.at(-1) ?? null,
   288	    events: returnedEvents,
   289	  };
   290	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-72","timestamp":"2026-07-07T17:00:47.763Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"72","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_38","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/controller/cancel-card-skill-run-controller.ts | sed -n '1,180p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/controller/cancel-card-skill-run-controller.ts | sed -n '1,180p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-73","timestamp":"2026-07-07T17:00:47.764Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"73","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_38","codexTool":"/usr/bin/zsh -lc \"nl -ba backend/src/business/codex/controller/cancel-card-skill-run-controller.ts | sed -n '1,180p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba backend/src/business/codex/controller/cancel-card-skill-run-controller.ts | sed -n '1,180p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Cancels one active card-scoped Codex skill run.
     3	 * WHY: The canvas widget needs a direct stop control for the server-owned child process.
     4	 */
     5	import type { ChildProcess } from 'node:child_process';
     6	
     7	type AnyRecord = Record<string, unknown>;
     8	
     9	function runtimeRuns(runtime: AnyRecord): Record<string, AnyRecord> {
    10	  return runtime.codexSkillRuns && typeof runtime.codexSkillRuns === 'object' ? runtime.codexSkillRuns as Record<string, AnyRecord> : {};
    11	}
    12	
    13	function publicRun(run: AnyRecord): AnyRecord {
    14	  const { child: _child, ...rest } = run;
    15	  return rest;
    16	}
    17	
    18	export async function cancelCardSkillRunController(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Promise<AnyRecord> {
    19	  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
    20	  const payload = (envelope.action_payload ?? input) as AnyRecord;
    21	  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
    22	  const ledgerId = String(payload.ledgerId ?? '').trim();
    23	  const cardId = String(payload.cardId ?? '').trim();
    24	  const runId = String(payload.runId ?? '').trim();
    25	  if (!ledgerId || !cardId || !runId) return { ok: false, statusCode: 400, error: 'Missing ledgerId, cardId, or runId.' };
    26	
    27	  const run = runtimeRuns(runtime)[runId];
    28	  if (!run || String(run.ledgerId ?? '') !== ledgerId || String(run.outputCardId ?? '') !== cardId) {
    29	    return { ok: false, statusCode: 404, error: 'Active run not found.', runId };
    30	  }
    31	  if (String(run.status ?? '') !== 'running') {
    32	    return { ok: true, statusCode: 200, status: String(run.status ?? 'unknown'), run: publicRun(run) };
    33	  }
    34	
    35	  const child = (run as { child?: ChildProcess }).child;
    36	  if (!child || typeof child.kill !== 'function' || child.killed) {
    37	    return { ok: false, statusCode: 409, error: 'Run is not cancellable in this server process.', runId };
    38	  }
    39	
    40	  const finishedAt = new Date().toISOString();
    41	  Object.assign(run, { status: 'cancelled', cancelRequestedAt: finishedAt, finishedAt });
    42	  child.kill('SIGTERM');
    43	  return { ok: true, statusCode: 202, status: 'cancelled', run: publicRun(run) };
    44	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-74","timestamp":"2026-07-07T17:00:47.765Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"74","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_39","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/codex/component/render-card-skill-run-widget.ts | sed -n '1,120p' && nl -ba frontend/src/runtime/codex/effect/poll-card-skill-run.ts | sed -n '1,240p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/codex/component/render-card-skill-run-widget.ts | sed -n '1,120p' && nl -ba frontend/src/runtime/codex/effect/poll-card-skill-run.ts | sed -n '1,240p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-75","timestamp":"2026-07-07T17:00:47.766Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"75","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_39","codexTool":"/usr/bin/zsh -lc \"nl -ba frontend/src/runtime/codex/component/render-card-skill-run-widget.ts | sed -n '1,120p' && nl -ba frontend/src/runtime/codex/effect/poll-card-skill-run.ts | sed -n '1,240p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba frontend/src/runtime/codex/component/render-card-skill-run-widget.ts | sed -n '1,120p' && nl -ba frontend/src/runtime/codex/effect/poll-card-skill-run.ts | sed -n '1,240p'"`
Status: completed
Exit code: 0

````text
     1	/**
     2	 * WHAT: Renders the live status widget for a Codex skill output card.
     3	 * WHY: Operators need progress from the run JSONL while the final card refresh is still pending.
     4	 */
     5	import { state } from '../../state.js';
     6	import { cardCodexRunId } from '../helper/card-codex-run-id.js';
     7	import { bindCardSkillRunWidget } from '../effect/poll-card-skill-run.js';
     8	
     9	function metric(label: string, value: string, key: string): HTMLElement {
    10	  const item = document.createElement('span');
    11	  item.className = 'codex-run-metric';
    12	  const name = document.createElement('span');
    13	  name.className = 'codex-run-metric-label';
    14	  name.textContent = label;
    15	  const count = document.createElement('strong');
    16	  count.dataset[key] = '';
    17	  count.textContent = value;
    18	  item.replaceChildren(name, count);
    19	  return item;
    20	}
    21	
    22	export function renderCardSkillRunWidget(card: Record<string, unknown>): HTMLElement | null {
    23	  const cardId = String(card.id ?? '');
    24	  const ledgerId = String(state.activeTab ?? '').trim();
    25	  const runId = cardCodexRunId(card);
    26	  if (!cardId || !ledgerId || !runId) return null;
    27	
    28	  const widget = document.createElement('section');
    29	  widget.className = 'codex-run-widget';
    30	  widget.dataset.runId = runId;
    31	  widget.dataset.runStatus = 'running';
    32	
    33	  const body = document.createElement('div');
    34	  body.className = 'codex-run-body';
    35	
    36	  const header = document.createElement('div');
    37	  header.className = 'codex-run-header';
    38	  const status = document.createElement('span');
    39	  status.className = 'codex-run-status';
    40	  status.dataset.codexRunStatus = '';
    41	  status.textContent = 'RUNNING';
    42	  const cancel = document.createElement('button');
    43	  cancel.type = 'button';
    44	  cancel.className = 'codex-run-cancel terminal-button terminal-button--stop terminal-button--compact';
    45	  cancel.dataset.codexRunCancel = '';
    46	  cancel.title = 'Cancel Codex run';
    47	  cancel.setAttribute('aria-label', cancel.title);
    48	  cancel.textContent = 'Cancel';
    49	  header.replaceChildren(status, cancel);
    50	
    51	  const timer = document.createElement('time');
    52	  timer.className = 'codex-run-timer';
    53	  timer.dataset.codexRunTimer = '';
    54	  timer.textContent = '0:00';
    55	
    56	  const metrics = document.createElement('div');
    57	  metrics.className = 'codex-run-metrics';
    58	  metrics.replaceChildren(
    59	    metric('Tools', '0', 'codexRunTools'),
    60	    metric('Text', '0', 'codexRunMessages'),
    61	    metric('Files', '0', 'codexRunFiles')
    62	  );
    63	
    64	  const latest = document.createElement('p');
    65	  latest.className = 'codex-run-latest';
    66	  latest.dataset.codexRunLatest = '';
    67	  latest.textContent = 'Waiting for output';
    68	
    69	  body.replaceChildren(header, metrics, latest);
    70	  widget.replaceChildren(body, timer);
    71	  bindCardSkillRunWidget({ ledgerId, cardId, runId, element: widget });
    72	  return widget;
    73	}
     1	/**
     2	 * WHAT: Polls one rendered Codex run widget while its backend run is active.
     3	 * WHY: The widget needs live JSONL-derived progress without storing a separate run model.
     4	 */
     5	import { telemetry } from '../../telemetry/effect/telemetry.js';
     6	import { requestCardSkillRunStatus, type CardSkillRunSummary } from './request-card-skill-run-status.js';
     7	import { requestCardSkillRunCancel } from './request-card-skill-run-cancel.js';
     8	
     9	type Poller = {
    10	  ledgerId: string;
    11	  cardId: string;
    12	  runId: string;
    13	  element: HTMLElement;
    14	  since: number;
    15	  timer: ReturnType<typeof setTimeout> | null;
    16	  clock: ClockHandle | null;
    17	  lastClockPaintMs: number;
    18	  inFlight: boolean;
    19	  cancelInFlight: boolean;
    20	  detachedChecks: number;
    21	  terminal: boolean;
    22	};
    23	
    24	type ClockHandle =
    25	  | { kind: 'animation'; id: number }
    26	  | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };
    27	
    28	const pollers = new Map<string, Poller>();
    29	const terminalSummaries = new Map<string, CardSkillRunSummary>();
    30	
    31	function pollerKey(input: { ledgerId: string; cardId: string; runId: string }): string {
    32	  return `${input.ledgerId}:${input.cardId}:${input.runId}`;
    33	}
    34	
    35	function statusLabel(status: string): string {
    36	  return status ? status.toUpperCase() : 'UNKNOWN';
    37	}
    38	
    39	function durationLabel(ms: number): string {
    40	  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    41	  const minutes = Math.floor(totalSeconds / 60);
    42	  const seconds = totalSeconds % 60;
    43	  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    44	}
    45	
    46	function runStartedAt(runId: string): number {
    47	  const match = runId.match(/^codex-skill-(\d+)-/);
    48	  const timestamp = Number(match?.[1] ?? 0);
    49	  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
    50	}
    51	
    52	function setText(element: HTMLElement, selector: string, text: string): void {
    53	  const target = element.querySelector(selector);
    54	  if (target) target.textContent = text;
    55	}
    56	
    57	function removeTimer(element: HTMLElement): void {
    58	  element.querySelector('[data-codex-run-timer]')?.remove();
    59	}
    60	
    61	function cancelButton(element: HTMLElement): HTMLButtonElement | null {
    62	  return element.querySelector<HTMLButtonElement>('[data-codex-run-cancel]');
    63	}
    64	
    65	function removeCancelButton(element: HTMLElement): void {
    66	  cancelButton(element)?.remove();
    67	}
    68	
    69	function latestEventLabel(summary: CardSkillRunSummary): string {
    70	  const latest = summary.latestEvent;
    71	  if (summary.status === 'cancelled') return `Run Cancelled in ${durationLabel(summary.elapsedMs)}`;
    72	  if (!latest) return summary.status === 'running' ? 'Waiting for output' : statusLabel(summary.status);
    73	  if (summary.status === 'complete' && latest.title.toLowerCase() === 'turn completed') return `Turn Completed in ${durationLabel(summary.elapsedMs)}`;
    74	  if (latest.tool) return latest.tool;
    75	  return latest.title || latest.kind || latest.type || statusLabel(summary.status);
    76	}
    77	
    78	function paintWidget(element: HTMLElement, summary: CardSkillRunSummary): void {
    79	  element.dataset.runStatus = summary.status;
    80	  setText(element, '[data-codex-run-status]', statusLabel(summary.status));
    81	  if (summary.status !== 'running') {
    82	    removeTimer(element);
    83	    removeCancelButton(element);
    84	  }
    85	  setText(element, '[data-codex-run-tools]', String(summary.toolCallCount));
    86	  setText(element, '[data-codex-run-messages]', String(summary.agentMessageCount + summary.thinkingCount));
    87	  setText(element, '[data-codex-run-files]', String(summary.fileChangeCount));
    88	  setText(element, '[data-codex-run-latest]', latestEventLabel(summary));
    89	}
    90	
    91	function paintFrontendClock(poller: Poller): void {
    92	  if (poller.terminal) return;
    93	  setText(poller.element, '[data-codex-run-timer]', durationLabel(Date.now() - runStartedAt(poller.runId)));
    94	}
    95	
    96	function scheduleClockFrame(poller: Poller): void {
    97	  if (poller.clock || poller.terminal) return;
    98	  const tick = (): void => {
    99	    poller.clock = null;
   100	    if (poller.terminal) return;
   101	    if (!globalThis.document?.contains(poller.element)) return;
   102	    const now = Date.now();
   103	    if (now - poller.lastClockPaintMs >= 33) {
   104	      poller.lastClockPaintMs = now;
   105	      paintFrontendClock(poller);
   106	    }
   107	    scheduleClockFrame(poller);
   108	  };
   109	  if (typeof globalThis.requestAnimationFrame === 'function') {
   110	    poller.clock = { kind: 'animation', id: globalThis.requestAnimationFrame(tick) };
   111	  } else {
   112	    poller.clock = { kind: 'timeout', id: setTimeout(tick, 33) };
   113	  }
   114	}
   115	
   116	function startFrontendClock(poller: Poller): void {
   117	  paintFrontendClock(poller);
   118	  scheduleClockFrame(poller);
   119	}
   120	
   121	function schedulePoll(poller: Poller, delayMs = 1000): void {
   122	  if (poller.timer) clearTimeout(poller.timer);
   123	  poller.timer = setTimeout(() => void poll(poller), delayMs);
   124	}
   125	
   126	function stopPoller(key: string): void {
   127	  const poller = pollers.get(key);
   128	  if (!poller) return;
   129	  if (poller.timer) clearTimeout(poller.timer);
   130	  if (poller.clock?.kind === 'animation') globalThis.cancelAnimationFrame?.(poller.clock.id);
   131	  if (poller.clock?.kind === 'timeout') clearTimeout(poller.clock.id);
   132	  poller.clock = null;
   133	  pollers.delete(key);
   134	}
   135	
   136	function setCancelButtonState(button: HTMLButtonElement, state: 'ready' | 'stopping'): void {
   137	  button.disabled = state === 'stopping';
   138	  button.textContent = state === 'stopping' ? 'Stopping' : 'Cancel';
   139	}
   140	
   141	function bindCancelButton(poller: Poller): void {
   142	  const button = cancelButton(poller.element);
   143	  if (!button) return;
   144	  button.onclick = (event): void => {
   145	    event.preventDefault();
   146	    event.stopPropagation();
   147	    void cancelRun(poller);
   148	  };
   149	  setCancelButtonState(button, poller.cancelInFlight ? 'stopping' : 'ready');
   150	}
   151	
   152	async function cancelRun(poller: Poller): Promise<void> {
   153	  if (poller.terminal || poller.cancelInFlight) return;
   154	  const button = cancelButton(poller.element);
   155	  if (!button) return;
   156	  poller.cancelInFlight = true;
   157	  setCancelButtonState(button, 'stopping');
   158	  setText(poller.element, '[data-codex-run-latest]', 'Cancelling run');
   159	  const result = await requestCardSkillRunCancel({ ledgerId: poller.ledgerId, cardId: poller.cardId, runId: poller.runId });
   160	  poller.cancelInFlight = false;
   161	  if (!result.ok) {
   162	    setCancelButtonState(button, 'ready');
   163	    setText(poller.element, '[data-codex-run-latest]', result.error || 'Cancel failed');
   164	    return;
   165	  }
   166	  setCancelButtonState(button, 'stopping');
   167	  schedulePoll(poller, 0);
   168	}
   169	
   170	async function poll(poller: Poller): Promise<void> {
   171	  const key = pollerKey(poller);
   172	  if (!globalThis.document?.contains(poller.element)) {
   173	    poller.detachedChecks += 1;
   174	    if (poller.detachedChecks < 4) schedulePoll(poller, 250);
   175	    else stopPoller(key);
   176	    return;
   177	  }
   178	  poller.detachedChecks = 0;
   179	  startFrontendClock(poller);
   180	  if (poller.inFlight) {
   181	    schedulePoll(poller);
   182	    return;
   183	  }
   184	  poller.inFlight = true;
   185	  const summary = await requestCardSkillRunStatus({
   186	    ledgerId: poller.ledgerId,
   187	    cardId: poller.cardId,
   188	    runId: poller.runId,
   189	    since: poller.since
   190	  });
   191	  poller.inFlight = false;
   192	  if (!summary.ok) {
   193	    poller.element.dataset.runStatus = 'unknown';
   194	    removeTimer(poller.element);
   195	    removeCancelButton(poller.element);
   196	    setText(poller.element, '[data-codex-run-status]', 'UNKNOWN');
   197	    setText(poller.element, '[data-codex-run-latest]', summary.error || 'Run unavailable');
   198	    stopPoller(key);
   199	    return;
   200	  }
   201	  poller.since = Math.max(poller.since, summary.nextSince, summary.lineCount);
   202	  paintWidget(poller.element, summary);
   203	  telemetry('codex-skill-run-polled', { runId: poller.runId, status: summary.status, lineCount: summary.lineCount });
   204	  if (summary.status === 'running') schedulePoll(poller);
   205	  else {
   206	    poller.terminal = true;
   207	    terminalSummaries.set(key, summary);
   208	    stopPoller(key);
   209	  }
   210	}
   211	
   212	export function bindCardSkillRunWidget(input: { ledgerId: string; cardId: string; runId: string; element: HTMLElement }): void {
   213	  const key = pollerKey(input);
   214	  const terminalSummary = terminalSummaries.get(key);
   215	  if (terminalSummary) {
   216	    paintWidget(input.element, terminalSummary);
   217	    return;
   218	  }
   219	  const existing = pollers.get(key);
   220	  if (existing) {
   221	    existing.element = input.element;
   222	    existing.ledgerId = input.ledgerId;
   223	    existing.cardId = input.cardId;
   224	    existing.runId = input.runId;
   225	    existing.terminal = false;
   226	    bindCancelButton(existing);
   227	    startFrontendClock(existing);
   228	    if (!existing.timer && !existing.inFlight) schedulePoll(existing, 0);
   229	    return;
   230	  }
   231	  const poller: Poller = { ...input, since: 0, timer: null, clock: null, lastClockPaintMs: 0, inFlight: false, cancelInFlight: false, detachedChecks: 0, terminal: false };
   232	  pollers.set(key, poller);
   233	  bindCancelButton(poller);
   234	  startFrontendClock(poller);
   235	  schedulePoll(poller, 0);
   236	}
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-76","timestamp":"2026-07-07T17:00:47.767Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"76","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_40","codexTool":"/usr/bin/zsh -lc 'for id in a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7 d0b7e3a9 c6e3b7d1 12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1; do echo \"$id\"; rg -n \"$id\" tests frontend/src frontend/index.html backend/test -g '\"'\"'!**/node_modules/**'\"'; done\""} -->

**Tool call** `/usr/bin/zsh -lc 'for id in a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7 d0b7e3a9 c6e3b7d1 12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1; do echo "$id"; rg -n "$id" tests frontend/src frontend/index.html backend/test -g '"'"'!**/node_modules/**'"'; done"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-77","timestamp":"2026-07-07T17:00:47.768Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"77","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_40","codexTool":"/usr/bin/zsh -lc 'for id in a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7 d0b7e3a9 c6e3b7d1 12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1; do echo \"$id\"; rg -n \"$id\" tests frontend/src frontend/index.html backend/test -g '\"'\"'!**/node_modules/**'\"'; done\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'for id in a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7 d0b7e3a9 c6e3b7d1 12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1; do echo "$id"; rg -n "$id" tests frontend/src frontend/index.html backend/test -g '"'"'!**/node_modules/**'"'; done"`
Status: completed
Exit code: 0

````text
a6f4c2e1
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:4:  tabs.dataset.spec = 'a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7';
e4c1b8f5
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:4:  tabs.dataset.spec = 'a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7';
frontend/src/runtime/ledger/component/render-ledger-card-tab-frame.ts:14:  frame.dataset.spec = 'd0b7e3a9 e4c1b8f5 c6e3b7d1';
b0f6a1c3
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:4:  tabs.dataset.spec = 'a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7';
f8d2c4a7
frontend/src/runtime/ledger/component/render-ledger-card-tabs.ts:4:  tabs.dataset.spec = 'a6f4c2e1 e4c1b8f5 b0f6a1c3 f8d2c4a7';
d0b7e3a9
frontend/src/runtime/ledger/component/render-ledger-card-tab-frame.ts:14:  frame.dataset.spec = 'd0b7e3a9 e4c1b8f5 c6e3b7d1';
c6e3b7d1
frontend/src/runtime/ledger/component/render-ledger-card-tab-frame.ts:14:  frame.dataset.spec = 'd0b7e3a9 e4c1b8f5 c6e3b7d1';
12749dcd
frontend/index.html:35:          <nav class="tabs" aria-label="Open ledgers" data-spec="12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1"></nav>
tests/browser/navigation/the-navbar-renders-the-tab-registry.spec.ts:2: * WHAT: Integration test for spec 12749dcd: The navbar renders the tab registry..
tests/browser/navigation/the-navbar-renders-the-tab-registry.spec.ts:10:  await assertFrontendSpec('The navbar renders the tab registry.', '12749dcd', 'navigation');
frontend/src/runtime/spec-implementation-surface.ts:19:  '30000007', '667ae9a9', '6000000d', '12749dcd', '9d1b7c36', '93f778a8', 'eaced0c9', '5f8c7152', 'c5a84d77',
ac137fe2
frontend/index.html:35:          <nav class="tabs" aria-label="Open ledgers" data-spec="12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1"></nav>
tests/browser/navigation/tabs-are-route-addressable.spec.ts:2: * WHAT: Integration test for spec ac137fe2: Tabs are route-addressable..
tests/browser/navigation/tabs-are-route-addressable.spec.ts:10:  await assertFrontendSpec('Tabs are route-addressable.', 'ac137fe2', 'navigation');
frontend/src/runtime/spec-implementation-surface.ts:18:  '9f9279ff', '40000006', '33c20993', '8b1ff788', 'f93e1bb7', '50000002', 'ac137fe2', '51a6af83',
51a6af83
frontend/index.html:35:          <nav class="tabs" aria-label="Open ledgers" data-spec="12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1"></nav>
tests/browser/navigation/the-active-tab-is-derived-from-the-browser-path.spec.ts:2: * WHAT: Integration test for spec 51a6af83: The active tab is derived from the browser path..
tests/browser/navigation/the-active-tab-is-derived-from-the-browser-path.spec.ts:10:  await assertFrontendSpec('The active tab is derived from the browser path.', '51a6af83', 'navigation');
frontend/src/runtime/spec-implementation-surface.ts:18:  '9f9279ff', '40000006', '33c20993', '8b1ff788', 'f93e1bb7', '50000002', 'ac137fe2', '51a6af83',
e6a91d34
frontend/index.html:35:          <nav class="tabs" aria-label="Open ledgers" data-spec="12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1"></nav>
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:2: * WHAT: Integration test for spec e6a91d34: decision-os state drives ledger tabs and routes.
tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts:10:  await assertFrontendSpec('decision-os state drives ledger tabs and routes.', 'e6a91d34', 'navigation');
frontend/src/runtime/spec-implementation-surface.ts:7:  'b7c2e91f', 'e6a91d34', 'f2d6c8b1', 'a4f8d2c9',
f2d6c8b1
frontend/index.html:35:          <nav class="tabs" aria-label="Open ledgers" data-spec="12749dcd ac137fe2 51a6af83 e6a91d34 f2d6c8b1"></nav>
frontend/src/runtime/spec-implementation-surface.ts:7:  'b7c2e91f', 'e6a91d34', 'f2d6c8b1', 'a4f8d2c9',
tests/browser/navigation/tab-click-loads-the-active-ledger-graph-into-the-canvas.spec.ts:2: * WHAT: Integration test for spec f2d6c8b1: Tab click loads the active ledger graph into the canvas.
tests/browser/navigation/tab-click-loads-the-active-ledger-graph-into-the-canvas.spec.ts:10:  await assertFrontendSpec('Tab click loads the active ledger graph into the canvas.', 'f2d6c8b1', 'navigation');
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-78","timestamp":"2026-07-07T17:00:47.769Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"78","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_41","codexTool":"/usr/bin/zsh -lc \"test -f /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md && nl -ba /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md | sed -n '1,220p' || true\""} -->

**Tool call** `/usr/bin/zsh -lc "test -f /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md && nl -ba /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md | sed -n '1,220p' || true"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-79","timestamp":"2026-07-07T17:00:47.770Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"79","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_41","codexTool":"/usr/bin/zsh -lc \"test -f /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md && nl -ba /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md | sed -n '1,220p' || true\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "test -f /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md && nl -ba /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md | sed -n '1,220p' || true"`
Status: completed
Exit code: 0

````text
     1	# product-analysis result
     2	
     3	Status: processing
     4	
     5	Source card: Goal
     6	Codex run: codex-skill-1783443647691-91eae060
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-80","timestamp":"2026-07-07T17:00:47.771Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"80","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_42","codexTool":"/usr/bin/zsh -lc 'git status --short -- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system'"} -->

**Tool call** `/usr/bin/zsh -lc 'git status --short -- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-81","timestamp":"2026-07-07T17:00:47.772Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"81","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_42","codexTool":"/usr/bin/zsh -lc 'git status --short -- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git status --short -- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system'`
Status: completed
Exit code: 0

````text
?? .decision-os/cards/tasks-system/card-5483453a-172e-44cb-9f25-3d9ad69c36cf.md
?? .decision-os/cards/tasks-system/card-83a2bf48-f8b7-4d7a-b566-b6133b1520c8.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783443352880-df6faf0b.md
?? .decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-82","timestamp":"2026-07-07T17:00:47.773Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"82","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_43"} -->

I have enough code evidence now. I’m replacing the placeholder output with the product-analysis result, keeping it limited to observed behavior, implied missing specs, and gaps.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-83","timestamp":"2026-07-07T17:00:47.774Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"83","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_44"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-84","timestamp":"2026-07-07T17:00:47.775Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"84","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_44"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-85","timestamp":"2026-07-07T17:00:47.776Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"85","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_45"} -->

The target Markdown card has been updated. I’m doing a quick read-back to verify the placeholder is gone and the required analysis sections are present.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-86","timestamp":"2026-07-07T17:00:47.777Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"86","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_46","codexTool":"/usr/bin/zsh -lc \"nl -ba /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md | sed -n '1,260p'\""} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md | sed -n '1,260p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-87","timestamp":"2026-07-07T17:00:47.778Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"87","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_46","codexTool":"/usr/bin/zsh -lc \"nl -ba /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md | sed -n '1,260p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "nl -ba /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md | sed -n '1,260p'"`
Status: completed
Exit code: 0

````text
     1	# Product Analysis: Staged Skill Pipeline For Process View
     2	
     3	Source card: `card-83a2bf48-f8b7-4d7a-b566-b6133b1520c8` / `Goal`
     4	
     5	Evidence boundary: this analysis uses the provided source card and code/test evidence only. No decision-os ledgers, existing cards, threads, README files, or generated docs were used as product evidence.
     6	
     7	## 1. Goal/Spec Link
     8	
     9	Goal need: transform the current process-oriented workflow into a two-tab system where an operator can create an ordered pipeline of staged Codex skills.
    10	
    11	Affected product area: decision-os canvas/workflow execution, especially card-scoped Codex skill processing and ledger/tab navigation.
    12	
    13	Affected workflow: an operator starts from a card or process view, selects multiple skills as ordered stages, runs them sequentially, and receives one output card per stage.
    14	
    15	Affected actor or role: operator using the browser canvas. The headless Codex sessions are system-executed workers launched by the backend.
    16	
    17	Relevant context facts from code:
    18	
    19	- The existing skill workflow is card-scoped, not pipeline-scoped. `frontend/src/runtime/canvas/effect/render-canvas-control-overlay.ts` adds a `Run Codex skill` card control for a single card.
    20	- `frontend/src/runtime/codex/effect/render-skill-modal.ts` renders one searchable skill picker with one selected `skillName`, model, and effort.
    21	- `frontend/src/runtime/codex/controller/process-card-skill-controller.ts` posts the active `ledgerId`, one `cardId`, one `skillName`, and optional model/effort.
    22	- `backend/src/business/codex/controller/start-card-skill-process-controller.ts` validates one source card and one skill, creates one output card with `cardType: 'codex-skill-run'`, creates one relationship labeled by the skill name, and spawns one `codex exec` child process.
    23	- `backend/src/business/codex/helper/build-card-skill-prompt.ts` tells headless Codex to treat one source card as the complete incoming card content and write the result to one output Markdown file.
    24	- `backend/src/business/codex/controller/read-card-skill-run-controller.ts` derives one run's progress from one JSONL/log pair and persists run events into the output card thread.
    25	- `backend/src/business/codex/controller/cancel-card-skill-run-controller.ts` cancels one active run held in the current server runtime.
    26	- Ledger navigation is driven by `.decision-os/state.json` ledgers via `frontend/src/runtime/ledger/effect/load-decision-os-state.ts`, `frontend/src/runtime/navigation/helper/route-tab.ts`, and `frontend/src/runtime/navigation/effect/render-tab-registry.ts`.
    27	
    28	Current behavior: the product supports running one skill against one card, creating one linked output card, polling that output card's run status, and cancelling that one active run while the backend process still owns the child process.
    29	
    30	Expected behavior from the source card: the process view supports a two-tab system and an ordered staged-skill pipeline. Stages run one after another in independent headless Codex sessions, and each stage creates one card.
    31	
    32	Acceptance signal: for a pipeline with `N` stages, the operator can define `N` ordered skills, start the pipeline, and observe `N` stage output cards, `N` distinct Codex run IDs/logs, and sequential execution where stage `i + 1` starts only after stage `i` has produced its output.
    33	
    34	## 2. Linked Specs
    35	
    36	| Spec id | Title | Source | Relationship | Goal relevance |
    37	|---|---|---|---|---|
    38	| `12749dcd` | The navbar renders the tab registry. | `tests/browser/navigation/the-navbar-renders-the-tab-registry.spec.ts`; `frontend/index.html` `data-spec` | Constrain | A process two-tab system must not conflict with the existing tab registry surface. |
    39	| `ac137fe2` | Tabs are route-addressable. | `tests/browser/navigation/tabs-are-route-addressable.spec.ts`; `frontend/index.html` `data-spec` | Constrain | If the two process tabs are route-level tabs, their route behavior must align with existing tab-addressability rules. |
    40	| `51a6af83` | The active tab is derived from the browser path. | `tests/browser/navigation/the-active-tab-is-derived-from-the-browser-path.spec.ts`; `frontend/index.html` `data-spec` | Constrain | Existing active-tab derivation is path-based; process sub-tabs need a specified relationship to path state. |
    41	| `e6a91d34` | decision-os state drives ledger tabs and routes. | `tests/browser/navigation/decision-os-state-drives-ledger-tabs-and-routes.spec.ts`; `frontend/index.html` `data-spec` | Constrain | Current top-level tabs come from decision-os ledger state; process tabs are not currently represented separately in code evidence. |
    42	| `f2d6c8b1` | Tab click loads the active ledger graph into the canvas. | `tests/browser/navigation/tab-click-loads-the-active-ledger-graph-into-the-canvas.spec.ts`; `frontend/index.html` `data-spec` | Constrain | Existing tab clicks load a ledger graph; a process two-tab system needs a defined canvas-load behavior. |
    43	| `9c31f0a4` | Ledgers in `.decision-os` load as default tabs unless invalid. | `backend/test/ledger/decision-os-default-tabs.integration.test.ts` | Constrain | The current default tab model is ledger-based, not process-view-based. |
    44	| Unknown | Card skill process route creates a linked output card and launches Codex. | `backend/test/codex/start-card-skill-process-controller.test.ts` | Support / source gap | Supports one-card/one-skill execution, but no spec id was found in code/test markers. |
    45	| Unknown | Card skill run route derives JSONL progress and persists thread notes. | `backend/test/codex/read-card-skill-run-controller.test.ts` | Support / source gap | Supports per-stage progress if each stage remains a card-scoped run, but no pipeline aggregation spec exists in code evidence. |
    46	| Unknown | Skill discovery reads workspace, user, and plugin skill frontmatter. | `backend/test/codex/scan-codex-skills.test.ts` | Support / source gap | Supports selecting stage skills by discovered skill names/descriptions, but only frontmatter summaries are available. |
    47	
    48	## 3. Missing Specs
    49	
    50	Implied requirement: process view has two tabs.
    51	Missing acceptance signal: exact tab names, tab scope, default tab, persistence, and route behavior are unknown.
    52	Missing UX spec: unknown whether the two tabs live in global navigation, inside the process ledger, inside a card, or inside a modal.
    53	
    54	Implied requirement: operator can create a pipeline of staged skills.
    55	Missing acceptance signal: how stages are added, removed, reordered, named, configured, duplicated, or saved is unknown.
    56	Missing UX spec: no observed builder UI for ordered skill stages.
    57	Missing data spec: no observed pipeline/stage schema in runtime state or ledger mutations.
    58	
    59	Implied requirement: staged skills run one after another.
    60	Missing acceptance signal: whether failure, cancellation, empty output, timeout, or invalid skill stops the pipeline or allows retry is unknown.
    61	Missing technical spec: no observed queue/orchestrator controller that starts the next run after the previous run reaches `complete`.
    62	
    63	Implied requirement: each stage runs in an independent Codex headless session.
    64	Missing acceptance signal: each stage should have a distinct process, run ID, stdout JSONL, stderr log, and output card.
    65	Missing operational spec: concurrency limits, process cleanup, restart recovery, log retention, and cancellation semantics for multi-stage runs are unknown.
    66	
    67	Implied requirement: create one card per stage.
    68	Missing acceptance signal: card title format, stage numbering, card placement, relationships between source/stage cards, and status labels are unknown.
    69	Missing data spec: unknown whether the pipeline itself is a card, a card field, a ledger-level object, or an external runtime object.
    70	
    71	Implied requirement: stage output becomes the next stage input.
    72	Missing acceptance signal: unknown whether stage `i + 1` receives the previous output card content, the original source card plus previous output, all prior stage outputs, or a structured context bundle.
    73	Missing technical spec: current prompt builder accepts one source card body and one output file path only.
    74	
    75	## 4. Spec Gaps
    76	
    77	Product-boundary decision: "process view" is not identifiable from code evidence as a distinct runtime surface. The code exposes ledger routes, a ledgers overview mode, card detail tabs, and a card skill modal, but no process-specific view model was found.
    78	
    79	UX constraint: the existing top-level tab system is ledger/navigation-driven. Reusing it for process sub-tabs would intersect specs `12749dcd`, `ac137fe2`, `51a6af83`, `e6a91d34`, and `f2d6c8b1`. A separate process sub-tab surface has no observed spec.
    80	
    81	Technical constraint: `/api/codex/skills/process` accepts one `ledgerId`, one `cardId`, and one `skillName`. There is no observed API for a pipeline definition, ordered stage list, stage dependency, or batch run.
    82	
    83	Technical constraint: current run ownership is in memory under `runtime.codexSkillRuns`, with durable status inferred from output files. This supports single-run polling but does not define persisted pipeline state or restart recovery for a multi-stage chain.
    84	
    85	Data constraint: current output cards use `cardType: 'codex-skill-run'`, a generated `card-codex-skill-*` id, a content file, and a relationship from the source card labeled with the skill name. No observed data shape records stage order, pipeline id, stage id, parent pipeline, or next-stage dependency.
    86	
    87	Dependency constraint: skill discovery exposes only `name`, `description`, `source`, and `skillFile` server-side. No observed metadata defines skill input/output compatibility, whether a skill is valid as a pipeline stage, or required model/effort defaults per stage.
    88	
    89	Operational constraint: cancellation currently targets one active output card/run in the same server process. Pipeline-level cancellation, cancellation of pending stages, and cancellation after server restart are unknown.
    90	
    91	Unverified fact: the source card says "independent codex headless sessions" and "run one after the other." Code can spawn independent child sessions, but the sequencing mechanism between independent sessions is not specified.
    92	
    93	Source gap: the Codex skill-run implementation has tests and code but no visible spec IDs in the inspected test markers. Existing navigation specs are identifiable; pipeline-specific specs are not.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-88","timestamp":"2026-07-07T17:00:47.779Z","status":"in_progress","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"88","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_47","codexTool":"/usr/bin/zsh -lc 'git diff -- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md'"} -->

**Tool call** `/usr/bin/zsh -lc 'git diff -- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-89","timestamp":"2026-07-07T17:00:47.780Z","status":"completed","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"89","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_47","codexTool":"/usr/bin/zsh -lc 'git diff -- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git diff -- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md'`
Status: completed
Exit code: 0

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-90","timestamp":"2026-07-07T17:00:47.781Z","status":"Codex message","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"90","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_48"} -->

Done. I wrote the product-analysis result to [card-codex-skill-1783443647691-91eae060.md](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783443647691-91eae060.md).

I did not edit the source card or ledger JSON. No tests were run because this was an analysis-card write, not an implementation change.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783443647691-91eae060-line-91","timestamp":"2026-07-07T17:00:47.782Z","status":"complete","codexRunId":"codex-skill-1783443647691-91eae060","codexLine":"91","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.

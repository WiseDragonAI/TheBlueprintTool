# OPERATOR
<!-- decision-os:note {"id":"note-1784480968001-dc47b3d83ec03","timestamp":"2026-07-19T17:09:28.004Z"} -->

http://127.0.0.1:50151/p/ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z/ledgers/specs/zones/zone-bfeea07b-da6f-4f04-b230-588a7b31c079/cards/card-dd4b8845-12aa-4be5-847d-a927d6b5422c?replica=workstation

# OPERATOR
<!-- decision-os:note {"id":"note-1784481081672-62d7ae403db088","timestamp":"2026-07-19T17:11:21.675Z"} -->

This codex session found out that we are only linux and that we cant follow the termux instructions. But it found it tool late. Create a workflow for linux using what we already have and update the runbook and the agents.md to follow different set of instructions. add as well to ALL the codex exec startup a system prompt injection giving the platform like `platform: linux || termux` so the agent doesnt have to guess.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784481297432-48d20403-7f6","timestamp":"2026-07-19T17:14:57.432Z"} -->

## A. Intake Result

1. **Master task:** Renamed to `Add platform-aware Codex and browser workflows`; the mandatory zone was retained and renamed.
2. **Implementation split:** Created two relationship-backed subtasks for the central Codex platform injection and the Linux/Termux browser documentation workflow.
3. **Verified basis:** Linux already has root Playwright dependencies and `/snap/bin/chromium`; the Codex command resolver is the shared boundary for fresh and resumed executions.
4. **Status:** Both subtasks remain `todo`; the master task remains open for operator-controlled execution and closeout.

# OPERATOR
<!-- decision-os:note {"id":"note-1784481372255-438bc333c73e2","timestamp":"2026-07-19T17:16:12.259Z"} -->

execute

# AGENT
<!-- decision-os:note {"id":"note-agent-1784481811262-ba97974d-3c0","timestamp":"2026-07-19T17:23:31.262Z"} -->

## A. Execution Result

1. **Implemented:** Every fresh and resumed Decision OS `codex exec` now receives an authoritative `platform: linux` or `platform: termux` developer instruction from the shared command resolver.
2. **Documented:** `BROWSER_RUNBOOK.md` and `AGENTS.md` now dispatch Linux to Playwright with `/snap/bin/chromium` and Termux to the existing Puppeteer helper.
3. **Verified:** Focused Codex tests passed 14 of 14, backend typecheck passed, and Linux Chromium loaded the existing `50151` server with HTTP `200` at `390x844` without restarting it.
4. **Delivery:** Commits `6ef9472d`, `3da100c7`, and `7265fe34` are on `main`; both subtasks are verified `done`.
5. **Suite limitation:** The full backend suite remains at 207 passed and 7 failed on unrelated pipeline-catalog baseline expectations for the seeded `project-synchronization` pipeline.
6. **Master status:** The master task remains open for direct operator closeout.

# OPERATOR
<!-- decision-os:note {"id":"note-1784481875537-e5b485e210d858","timestamp":"2026-07-19T17:24:35.541Z"} -->

resumed doesnt need it since the fresh prompt gave it. It's about pipelines, skills and new sessions. Think twice before doing stuff. This was obvious and you should have understand it naturally. lesson for the future

# AGENT
<!-- decision-os:note {"id":"note-agent-1784482307432-626defa6-9dd","timestamp":"2026-07-19T17:31:47.432Z"} -->

## A. Corrected Session Boundary

1. **Finding:** Your correction is valid. `codex exec resume` continues the original session and does not need the platform developer instruction again.
2. **Fix:** Removed `developer_instructions` from `resolveCodexResumeCommand`; fresh thread, skill, pipeline, project-sync, and fallback new-session launches still inject the platform through `resolveCodexCommand`.
3. **Regression:** Focused tests pass 14 of 14 and assert both sides of the boundary: fresh launch includes the instruction; resume excludes it. Backend typecheck passes.
4. **Delivery:** Corrective commit `18e269d1` is merged by `1568e108`; the affected subtask was reopened during correction and is verified `done` again.
5. **Lesson:** Future prompt-injection changes must classify semantic lifecycle transitions before editing command construction: new session initializes context; resume preserves context; fallback new session initializes context.
6. **Master status:** The master task remains open for direct operator closeout.

# OPERATOR
<!-- decision-os:note {"id":"note-1784538677976-e9ff3fe142d01","timestamp":"2026-07-20T09:11:18.005Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1784538678002-fc5d6feb-033c-4190-be95-fa573d9a5304.wav","status":"transcribed","transcriptionStartedAt":"2026-07-20T09:11:18.065Z","uploadReceivedAt":"2026-07-20T09:11:18.002Z","audioPersistedAt":"2026-07-20T09:11:18.003Z","acceptedAt":"2026-07-20T09:11:18.003Z","providerStartedAt":"2026-07-20T09:11:18.065Z","providerSettledAt":"2026-07-20T09:11:20.262Z","completedAt":"2026-07-20T09:11:20.314Z","revision":4} -->

Donc là, évidemment, il faudra se rappeler de ne pas faire des exécutions stupides et de pas faire des étapes qui ne servent à rien, puisque quand on fait un résumé, c'est évident qu'il n'y a pas besoin de réinjecter le système prompt.

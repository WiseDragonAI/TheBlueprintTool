# OPERATOR
<!-- decision-os:note {"id":"note-1784103249161-40273ee0e537a","timestamp":"2026-07-15T08:14:09.266Z"} -->

http://127.0.0.1:50150/p/ZGVjaXNpb24tb3M/ledgers/specs/zones/zone-5a6dadb6-4c58-4ec9-9b17-1ff5b493245c/cards/card-fe388485-7e75-4392-9117-894936bdb998

# OPERATOR
<!-- decision-os:note {"id":"note-1784103257537-6340af97dfd358","timestamp":"2026-07-15T08:14:18.052Z","voiceFileRef":"/data/data/com.termux/files/home/decision-os/.decision-os/voice-uploads/voice-1784103258042-7fb30079-338e-46cd-95d0-35ec501d994d.wav","status":"transcribed","transcriptionStartedAt":"2026-07-15T08:14:18.059Z"} -->

Pourquoi je ne peux pas relancer cette tâche ? Là, j'appuie sur Run, il ne se passe rien.

# AGENT
<!-- decision-os:note {"id":"note-agent-1784103570636-14f9e90b","timestamp":"2026-07-15T08:19:30.637Z"} -->

## A. Finding

1. **Root cause:** The prior run is complete, but the Run action sends its continuation POST to the unscoped path `/api/codex/skills/runs/codex-skill-1784019156206-af4b348e/continue`.
2. **Server response:** The running server rejects that request with HTTP `400` and `Project id is required in the URL.`
3. **Why nothing appears:** The frontend restores the Run button after the failed request and records the error only in telemetry.

---

## B. Verified State

1. **Previous run:** The project-scoped status endpoint returns `status: complete` and `active: false`; the JSONL ends with `turn.completed`.
2. **First incorrect transition:** `request-card-skill-run-continue.ts` omits `projectScopedRequestPath`, while the status request uses it.
3. **Reproduction:** The exact unscoped POST against port `50150` returns the project-ID error before continuation is enqueued.

---

## C. Required Fix

1. Route the continuation request through `projectScopedRequestPath`.
2. Add a regression for the canonical `/p/:projectId/api/.../continue` URL.
3. Render the backend launch error beside the Run control.
4. **Status:** Diagnosis is complete; product code was not changed because this request asked why the launch fails.

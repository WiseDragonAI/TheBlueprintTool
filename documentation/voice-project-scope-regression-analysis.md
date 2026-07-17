## A. Repository Intent

1. **Decision OS serves multiple projects from one server while keeping project-owned ledger, thread, voice, and Codex state isolated by canonical `/p/:projectId/...` URLs.**

---

## B. Current Iteration Intent

1. **Restore voice-note creation on canonical project card routes without weakening multi-project isolation.**
2. Scope initial upload, transcription retry, and lifecycle polling directly at their request boundaries.

---

## C. Findings

1. **Introducing commit:** `c0238c3397e01471c7cdfecba9bca2740c893dbd` added the backend rejection `Project id is required in the URL.` for ambiguous project-sensitive endpoints.
2. **First incorrect transition:** `uploadVoiceAudio` retained `fetch('/api/voice-upload')`, so voice correctness depended on the global fetch wrapper added by the same commit.
3. **Latent companion defects:** `transcribeUploadedVoiceAudio` retained `/api/transcribe/retry`, and `reconcileVoiceTranscription` retained `/api/voice-transcription-status`.
4. **Coverage gap:** voice tests asserted the legacy root upload path and contained no canonical `/p/:projectId` request assertions.
5. **Backend behavior is correct:** accepting an unscoped voice request with multiple projects would leave the owning project ambiguous.

---

## D. Remediation Paths

1. Apply `projectScopedRequestPath` directly to all three voice network boundaries.
2. Add canonical project-route regression tests for upload, retry, and status polling.
3. Preserve the backend ambiguity rejection and the global wrapper for remaining legacy callers.

---

## E. Operator Decision Summary

1. **Selected remediation:** explicit voice endpoint scoping with no backend contract relaxation.
2. **Result:** voice requests carry the project identity even when a fetch stub, runtime boundary, or future surface bypasses the global wrapper.

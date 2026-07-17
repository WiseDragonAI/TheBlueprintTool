Completed at: 2026-07-17T11:42:40.123Z

Ledger: Specs
Waiting since: 2026-07-17T11:01:01.366Z

## A. Requested behavior

1. **Shift+X** must submit the captured voice note with Codex enqueue intent.
2. The task must enter the Control Room execution column as soon as the backend accepts the queued voice upload, while transcription is still running.
3. A normal voice submission must transcribe without enqueueing Codex.

---

## B. Verified implementation boundary

1. The backend voice-upload orchestration owns the durable voice lifecycle and the post-transcription Codex launch.
2. The Control Room already projects persisted `executionStatus: pending` into the execution column.
3. The required correction is to persist the pending execution marker at queued upload acceptance only when `queueCodex` is true, then preserve existing post-transcription launch and failure reconciliation.

---

## C. Subtasks

1. [Persist Shift+X pending execution before transcription](card:card-6124005d-0d8a-4191-b6e4-84bfc94b72c8)

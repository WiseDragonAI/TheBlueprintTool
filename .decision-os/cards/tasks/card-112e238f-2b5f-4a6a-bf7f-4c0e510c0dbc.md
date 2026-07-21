Ledger: Specs

## A. Incident

1. **Observed failure:** a mobile voice note is transcribed and appended on the receiving node, but the task-hosting node can launch Codex without the new thread content.
2. **Required outcome:** persist the completed operator note on the authoritative hosting node before the remote Codex run consumes the thread.

---

## B. Verification target

1. Trace the voice upload, transcription, thread mutation, federation forwarding, and Codex queue sequence.
2. Add a regression covering a remotely hosted task and verify focused tests, package typecheck, and the full suite.

---

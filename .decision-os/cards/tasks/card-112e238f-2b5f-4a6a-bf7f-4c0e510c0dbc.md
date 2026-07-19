Completed at: 2026-07-19T07:15:46.756Z

Ledger: Specs
Waiting since: 2026-07-18T07:17:54.254Z

## A. Incident

1. **Observed failure:** a mobile voice note is transcribed and appended on the receiving node, but the task-hosting node can launch Codex without the new thread content.
2. **Required outcome:** persist the completed operator note on the authoritative hosting node before the remote Codex run consumes the thread.

---

## B. Verification target

1. Trace the voice upload, transcription, thread mutation, federation forwarding, and Codex queue sequence.
2. Add a regression covering a remotely hosted task and verify focused tests, package typecheck, and the full suite.

---

## C. Subtasks

1. [Identify the first broken federation transition](card:card-71cf2fc2-b189-4a91-9d31-d7e747e1094d)
2. [Implement authoritative remote thread persistence](card:card-93d1c5d0-a995-4961-81e7-73ebcb4cc2a0)
3. [Verify remote voice-note replication and Codex visibility](card:card-e29306ff-9114-4e0c-b665-8a45a1d14acc)

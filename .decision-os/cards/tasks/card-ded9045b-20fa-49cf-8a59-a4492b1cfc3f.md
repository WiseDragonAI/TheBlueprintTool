#task #task-done #backend #codex

## A. Implemented

1. **One server coordinator counts running Codex child processes across every discovered project and every pipeline, direct skill, thread start, and continuation.**
2. **Pending work is durable and promoted by global creation time under the server-wide `maxConcurrentCodexProcesses` limit.**
3. **`GET` and `PATCH /api/settings/codex-processes` read and atomically persist the master-server setting while preserving unrelated settings.**
4. **Settling or cancelling work schedules the oldest pending request; interrupted claims return to `pending` during recovery.**

---

## B. Evidence

1. Focused pipeline scheduling tests passed: `4` passed, `0` failed.
2. Focused settings and global callback tests passed; backend typecheck passed.
3. Implementation is merged into `main` by `2a32780`.

---

## C. Live verification

1. **The restarted server exposes the merged settings endpoint and returns `maxConcurrentCodexProcesses: 5`.**
2. The server catalog setting is persisted as `5` in `/data/data/com.termux/files/home/.decision-os/.settings.json`.
3. Continuation `codex-continuation-1784046392077-8448a12b` persisted at `16:26:32.077Z`, remained queued while capacity was occupied, and was promoted at `16:28:15.636Z`.
4. Automated recovery tests cover interrupted durable claims and cross-kind FIFO ordering.

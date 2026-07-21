#master-task

Ledger: Specs

## A. Diagnostic Result

1. **Root cause:** The Run action correctly recognizes the previous run as complete, then sends its continuation POST to an unscoped `/api/.../continue` URL.
2. **Server response:** The canonical project server rejects that request with HTTP `400` and `Project id is required in the URL.`
3. **Visible behavior:** The client restores the Run button but does not render the response error, so the click appears to do nothing.

---

## B. Verified Evidence

1. **Prior run:** `codex-skill-1784019156206-af4b348e` ends in `turn.completed`; the project-scoped status endpoint reports `complete` and `active: false`.
2. **Request implementation:** `request-card-skill-run-continue.ts` does not use `projectScopedRequestPath`; the status request does.
3. **Reproduction:** An unscoped POST against the running server on port `50150` returns the same project-ID error before continuation logic executes.

---

## C. Required Fix

1. **Scope continuation:** Build the continue URL with `projectScopedRequestPath`.
2. **Regression coverage:** Verify the exact `/p/:projectId/api/.../continue` request path.
3. **Error feedback:** Display the backend launch error beside the Run control.
4. **Implementation status:** Not authorized by this diagnostic request.

---

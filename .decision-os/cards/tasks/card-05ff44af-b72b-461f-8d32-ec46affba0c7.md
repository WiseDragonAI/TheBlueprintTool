## A. Objective

1. Give desktop and responsive surfaces one execution-aware admission, event, polling, and disposal controller.

---

## B. Verified Evidence

1. Responsive continuation omits expected execution and status while desktop supplies them.
2. Server events omit accepted execution and cannot bind without an existing poller.
3. Pollers emit cached summaries and accept responses without a generation check.
4. Deletion and close leave consumers; thread-only keys collide across projects.

---

## C. Implementation Contract

1. Share one start and continuation controller.
2. Publish and consume project, ledger, card, thread, run, execution, and status at every lifecycle event.
3. Bind without a prior poller; attach an expected-execution generation and discard stale cache and responses.
4. Key state by project, ledger, card, thread, and run.
5. Purge exact poller, summary, and selection on close, switch, deletion, and replacement.

---

## D. Acceptance Tests

1. Responsive continuation rejects terminal cache.
2. Old in-flight poll cannot overwrite new execution.
3. Server acceptance binds without preexisting poller.
4. Deletion ignores late callbacks.
5. Duplicate thread IDs across projects stay isolated.
6. Desktop and responsive produce the same state.

## A. Retrospective finding

1. **First incorrect transition:** same-card federation reconciliation re-entered `openCardDetail()` and reapplied viewport defaults. That general render path reopened a thread the operator had closed on desktop and closed the thread and expanded composer the operator had opened on mobile.
2. **Wider ownership failure:** route refreshes, thread refreshes, and accepted-run completions were not consistently bound to the immutable project, ledger, card, thread, route, and presentation generation that initiated them. Late results could therefore mutate a newer screen and navigate to Control Room.
3. **Planning failure:** the responsive default was treated as a local open/close rule instead of tracing its consequences through federation events, route rendering, composer state, browser history, and deferred navigation. The operator's desktop reproduction exposed that the failure crossed viewport boundaries and was not mobile-only.
4. **Correction delivered:** commit `5d5820f0` separates card entry from same-card reconciliation, adds post-await ownership checks, scopes background events, binds deferred navigation to its initiating action, and introduces a mobile card-local history layer.
5. **Verification boundary:** frontend typecheck, all `465/465` frontend tests, the served card route, and the published remote commit were verified. Representative desktop pointer and mobile touch/Back interaction were not browser-verified; this intentional close invocation authorizes completion despite that recorded limitation.

---

## B. Durable lessons saved

1. **Memory `27` — Preserve presentation state during reconciliation:** apply responsive defaults only when route identity changes; same-resource reconciliation preserves operator-owned panel and composer state.
2. **Memory `28` — Revalidate asynchronous UI ownership:** capture immutable initiating identity and recheck ownership after each await before shared-state, DOM, or navigation commits.
3. **Memory `29` — Trace cross-viewport consequences end to end:** trace event, route, render, presentation, history, and deferred-completion boundaries before implementing responsive state behavior.
4. **Deduplication:** project-scoped `code` memory searches found no existing record representing these three rules before insertion.
5. **Sources:** commit `5d5820f0`; implementation run `codex-skill-1784298242473-3d8f31ab`; retrospective run `codex-skill-1784357650123-612dfaaf`.

---

## C. Closure

1. **Gate:** `ledger-cli master-task-gate` returned `ready: true` with no discrepancies and valid thread roles.
2. **Completed:** the canonical completion command ran exactly once and marked master card `card-3595f568-b6c1-4e1c-a2f5-27a1c36d0651` plus all six canonical subtasks `done`.
3. **Closure commit:** `62b5aeb4b7535b45d6daffbdca534c16ee3adb27`.
---

Codex run completed: exit code 0

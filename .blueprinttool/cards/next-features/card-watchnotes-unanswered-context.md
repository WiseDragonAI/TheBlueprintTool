## A. Purpose

1. **Goal.** Define the context payload that the watcher gives to the agent when queued cards move into `processing`.
2. **Current baseline.** Start from what `ledger-cli unanswered --json` returns today: thread id, thread file, target id, title, last note, pending notes, and answer instructions.
3. **Gap.** That payload is enough to answer a note, but not enough for the new watcher to reason cleanly about cards, zones, and process queues.

---

## B. Required Context

1. **Card context.** Include card id, title, status, type, content file, durable markdown content, and current geometry.
2. **Thread context.** Include the full thread file path, pending operator notes, last answered agent note, and the exact answer persistence instruction.
3. **Zone context.** Include the containing zone id, label, neighboring cards in the zone, and relevant zone-level intent.
4. **Ledger context.** Include ledger file, route id, workspace cwd, and active tab title.
5. **Queue context.** Include whether the card is `to_process` or `processing`, the trigger source, and the ordering of all cards in the batch.

---

## C. Output Shape

1. **Machine-readable first.** The watcher payload should be JSON so hooks and tests can validate it.
2. **Prompt-ready summary.** The agent prompt should also include a compact markdown summary generated from the JSON payload.
3. **No hidden workspace assumptions.** All paths must be relative to the active workspace where possible, with the workspace cwd included once at the top.

---

## D. Acceptance

1. **Existing CLI compatibility.** `ledger-cli unanswered --json` keeps its current answer workflow intact.
2. **Extended watcher mode.** A new or extended command can request card content, zone context, and queue metadata for watcher-driven processing.
3. **Tests.** Add coverage for payload shape, missing card files, cards without zones, multiple pending notes, and multiple queued cards in one batch.

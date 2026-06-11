## A. Timestamp Fields

1. **Card lifecycle.** Add `createdAt: string` and `updatedAt: string` to every card record.
2. **Zone lifecycle.** Add `createdAt: string` and `updatedAt: string` to every regular zone annotation.
3. **Creation time.** `createdAt` is set once when the card or zone is created and is preserved by later ledger writes.
4. **Entity update time.** `updatedAt` changes when durable card or zone content changes, including title, label, geometry, content file body, or metadata that affects watcher context.
5. **Existing records.** A migration can initialize missing `createdAt` and `updatedAt` from the ledger file mtime or a single migration timestamp, but must not invent per-record precision it cannot prove.

---

## B. Summary Shape

1. **Card summary.** Add `summary?: LedgerSummary` to card records.
2. **Zone summary.** Add `summary?: LedgerSummary` to regular zone annotations.
3. **Summary text.** `summary.text` stores one to three plain-language sentences.
4. **Summary freshness.** `summary.updatedAt` stores when the summary text was last generated or manually corrected.
5. **Staleness comparison.** A summary is stale when the parent card or zone has `updatedAt` later than `summary.updatedAt`.

---

## C. Proposed Types

1. **Shared summary contract.** Use one object shape for card and zone summaries so missing and stale summary commands can share the same comparison path.

```ts
interface LedgerSummary {
  text: string;
  updatedAt: string;
}

interface LedgerZoneAnnotation {
  id: string;
  variant: "zone";
  label: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  summary?: LedgerSummary;
}

interface LedgerCard {
  id: string;
  title: string;
  cardType?: string;
  status?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: string;
  updatedAt: string;
  comment?: {
    contentFile?: string;
    what?: string;
  };
  summary?: LedgerSummary;
}
```

---

## D. Summary Content Rules

1. **Zone summary.** State the zone's topic, the workflow or problem it contains, and the kind of cards inside it.
2. **Card summary.** State the card's objective, the main contract or decision, and any important implementation boundary.
3. **Avoid restating title only.** A summary must add useful context beyond the visible label or card title.
4. **Avoid transient status.** Do not use summaries for temporary progress notes such as `working`, `blocked today`, or `needs reply`.
5. **Use plain language.** Summaries should be readable in watcher prompts without requiring the full card body.

---

## E. Watcher Freshness Contract

1. **Card file updates.** When the server watcher detects a successful update to `card.comment.contentFile`, it must update that card's `updatedAt`.
2. **No automatic summary rewrite.** The watcher should not silently rewrite `summary.text`; it should only make stale state observable through `updatedAt`.
3. **Zone updates.** When a zone label, color, geometry, or membership-affecting boundary changes, the zone `updatedAt` must advance.
4. **Manual summary updates.** Summary write commands must update only `summary.text` and `summary.updatedAt` unless the caller explicitly mutates other card or zone fields.

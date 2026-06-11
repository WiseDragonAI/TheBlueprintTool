## A. Card Body Contract

1. **Replace comment.** New card records should use `body`, not `comment`, for durable card content.
2. **Body file.** `body.file` points to the card body file that contains the durable content.
3. **Body timestamp.** `body.updatedAt` advances when the card body content changes.
4. **Legacy fields.** `comment.contentFile`, `comment.what`, `comment.body`, and `comment.description` are legacy read/migration inputs only; new writers should not emit them.
5. **Watcher source.** When the server watcher detects a body file write, it updates `body.updatedAt`, not a legacy `comment` field.

---

## B. Entity Timestamp Fields

1. **No card timestamps.** Do not add `createdAt` or `updatedAt` directly to `LedgerCard`; card-body freshness belongs on `LedgerBody.updatedAt`.
2. **No body creation timestamp.** Do not add `body.createdAt`; the stale-summary workflow only needs the last body update time.
3. **Zone lifecycle.** `LedgerZoneAnnotation.createdAt` and `LedgerZoneAnnotation.updatedAt` can describe zone metadata freshness when a zone summary depends on label, color, geometry, or membership-affecting boundaries.
4. **Existing records.** A migration can initialize missing zone timestamps from the ledger file mtime or a single migration timestamp, but must not invent per-record precision it cannot prove.
5. **Summary comparison.** Card summaries compare `body.updatedAt` with `summary.updatedAt`; zone summaries compare `annotation.updatedAt` with `summary.updatedAt`.

---

## C. Summary Shape

1. **Card summary.** Add `summary?: LedgerSummary` to card records.
2. **Zone summary.** Add `summary?: LedgerSummary` to regular zone annotations.
3. **Summary text.** `summary.text` stores one to three plain-language sentences.
4. **Summary freshness.** `summary.updatedAt` stores when the summary text was last generated or manually corrected.
5. **No stale field.** Stale summary state is not persisted in the data model; the CLI derives it at runtime from timestamps.

---

## D. Proposed Types

1. **Shared summary contract.** Use one object shape for card and zone summaries so write commands can share the same persistence path.
2. **Card type field.** `cardType` is the current loose ledger classification string used by existing ledgers and exports, for example `note`, `spec-brief`, `base-class`, `perf-analysis`, or `perf-plan`.
3. **Compatibility.** Keep `cardType?: string` in the proposed type for compatibility, but treat it as a display/workflow kind rather than summary freshness data.

```ts
interface LedgerBody {
  file: string;
  updatedAt: string;
}

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
  body?: LedgerBody;
  summary?: LedgerSummary;
}
```

---

## E. Summary Content Rules

1. **Zone summary.** State the zone's topic, the workflow or problem it contains, and the kind of cards inside it.
2. **Card summary.** State the card's objective, the main contract or decision, and any important implementation boundary.
3. **Avoid restating title only.** A summary must add useful context beyond the visible label or card title.
4. **Avoid transient status.** Do not use summaries for temporary progress notes such as `working`, `blocked today`, or `needs reply`.
5. **Use plain language.** Summaries should be readable in watcher prompts without requiring the full card body.

---

## F. Watcher Freshness Contract

1. **Body file updates.** When the server watcher detects a successful update to `card.body.file`, it must update `card.body.updatedAt`.
2. **Card metadata updates.** Title, geometry, labels, status, or `cardType` changes do not require a `LedgerCard.updatedAt` field in this model.
3. **No automatic summary rewrite.** The watcher should not silently rewrite `summary.text`; it should only make freshness data observable through timestamps.
4. **Zone updates.** When a zone label, color, geometry, or membership-affecting boundary changes, the zone `updatedAt` must advance.
5. **Manual summary updates.** Summary write commands must update only `summary.text` and `summary.updatedAt` unless the caller explicitly mutates other card or zone fields.

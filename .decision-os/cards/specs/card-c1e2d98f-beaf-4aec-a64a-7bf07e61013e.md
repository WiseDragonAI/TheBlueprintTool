## A. Implemented Telemetry Contract

1. **Identity:** version `2` rows include `projectId`, `runId`, deterministic `turnId`, and a turn-scoped unique `callId` across continued segments.
2. **Tool fields:** `tool` is normalized to values such as `shell`, `web_search`, and `file_change`; the complete operation is stored separately as `command`.
3. **Timing:** producer timestamps are preferred; monotonic observer timing is used when producer timestamps are absent; unavailable durations are stored as `null`.
4. **Outcome:** every row records success, status, and output bytes.
5. **Audit:** latency calculations exclude missing and non-positive durations and report incomplete identity and unavailable-duration counts.

---

## B. Verification

1. **Automated:** initial and continued run ingestion regressions pass with normalized tool identity and unique call IDs.
2. **Type safety:** backend and CLI typechecks pass.
3. **Merge:** implementation is included in `5adc394`.

---

## C. Remaining Gate

1. **Production evidence:** keep this card `todo` until post-restart telemetry has complete identity fields and enough valid durations for median and p95 comparisons.

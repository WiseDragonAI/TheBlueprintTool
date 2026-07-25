## A. Scope

1. Generate a `768px` longest-edge preview after the original image is captured locally.
2. Store original and preview as immutable content-addressed objects with explicit dimensions and media types.
3. Make partial generation fail within the owning upload without losing the accepted original or rewriting valid durable state.

---

## B. Verification

1. Prove deterministic derivative identity, bounded memory use, restart recovery, and garbage-collection reachability.

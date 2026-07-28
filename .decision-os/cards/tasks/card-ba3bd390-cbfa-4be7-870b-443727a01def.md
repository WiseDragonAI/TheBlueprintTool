## A. Implementation

1. Begin relay root and bucket reconciliation only after the owning local project store is ready.
2. Keep local project operation independent of relay connectivity.
3. Move skill scanning, pipeline normalization, and project pipeline migration out of listener admission; run the required work after listening with route-level retry where needed.

---

## B. Verification

1. Prove relay-offline local operation.
2. Prove dropped state repairs and roots converge after project readiness.
3. Prove catalog initialization failure is contained without losing diagnostics or unrelated routes.

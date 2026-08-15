# Legacy Coordinated Delivery Reference

## A. Status

1. This file documents the implemented `decision-os-delivery` subsystem for source and historical evidence only.
2. It is not the canonical production deployment procedure.
3. Do not run its `bootstrap-node`, `candidate`, `promote`, `resume`, or `rollback` commands as routine production operations.
4. Canonical production deployment is [Release-Tag Production Deployment](./release-tag-deployment.md). Canonical rollback is [Full Production Rollback](./full-production-rollback.md).

---

## B. Why It Is Noncanonical

1. The subsystem admits a raw development SHA rather than a published annotated `rel-X.Y.Z` release tag.
2. It prepares detached node release worktrees and switches a `current` release pointer.
3. It treats the lightweight application on `50151` and dev relay on `50152` as production admission inputs.
4. Those boundaries do not match the current operator methodology: production uses the canonical primary `main` checkout, release tags, the registered production process, real production state, and an online production peer for synchronization proof.

---

## C. Implemented Historical Surface

1. Launcher: `bin/decision-os-delivery.mjs`.
2. Commands: `bootstrap-node`, `candidate`, `promote`, `status`, `resume`, and `rollback`.
3. Durable records: coordinator run journals, delivery leases, node receipts, relay predecessor and version identities, activation order, and delivery-scoped runtime incidents.
4. Transport: fixed delivery protocol `1` requests over authenticated federation transport.
5. Relay primitives: pinned Wrangler list, upload, activation, rollback, redaction, bounded child processes, and health verification.
6. The tag-owned `decision-os-deploy-relay` command reuses those relay primitives without adopting SHA input, release worktrees, node pointers, or `50151` admission.

---

## D. Diagnostic Use

1. Existing historical journals and node receipts remain evidence. Do not delete or rewrite them.
2. `status` may be used read-only for an existing delivery ID when its journal is relevant to an incident.
3. A historical partial run does not authorize `resume` or `rollback`; follow the canonical rollback procedure and reconcile the journal as retained evidence.
4. Source tests under `backend/test/delivery/` continue to verify the subsystem's implemented contracts. Passing tests do not make this workflow canonical.

---

## E. Current Production Boundary

1. `decision-os-merge-dev` creates the reviewed `main` merge and annotated release tags, then atomically pushes parent `main`, `rel-X.Y.Z`, and `devrel-X.Y.Z`.
2. `decision-os-deploy-relay rel-X.Y.Z --json` deploys the production relay from canonical `main`.
3. Relay health reports the tag's resolved commit as the existing compatibility fingerprint.
4. The relay command does not deploy or restart an application node.
5. Workstation application activation uses the canonical repository launcher under the registered MultiTerm process after explicit restart authorization.
6. Production synchronization proof requires real production state and two online production nodes.

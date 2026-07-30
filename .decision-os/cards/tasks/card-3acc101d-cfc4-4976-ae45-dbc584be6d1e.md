## A. Scope

Add a Wrangler `dev` environment for the existing relay source and protocol. Isolate Worker name, `FEDERATIONS` Durable Object binding, namespace, credentials, URL, logs, and admission records while retaining current compatibility exports and migrations.

---

## B. Result

1. **Environment:** `env.dev` declares a distinct Worker name plus environment-specific Durable Object binding and migrations.
2. **Validation:** relay typecheck and Wrangler `--env dev --dry-run` passed with `FEDERATIONS` bound to `FederationRelay`.
3. **Runtime:** MultiTerm owns the local Wrangler dev relay on loopback port `50152` with persistent dev-only Durable Object state.
4. **Admission:** a distinct `workstation-dev` credential was provisioned for federation `decision-os-canary`.
5. **Convergence:** the canary reports owner `workstation-dev`, converged project roots, empty `runtimeDirty`, and empty `pendingDeliveryIds`.
6. **Production boundary:** no production relay identity, credential, URL, or state was reused. Public `workers.dev` deployment remains gated by the absent non-interactive Cloudflare token and is documented separately from the proven local canary.

---

## Review Reconciliation — 2026-07-30

1. The isolated dev relay remains available on `50152` with environment `dev` and delivery protocol `1`.
2. Its release SHA is blank. Relay availability does not establish a release-admitted application candidate.
3. This card remains complete for dev-relay provisioning.

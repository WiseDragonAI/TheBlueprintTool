## A. Scope

Add a Wrangler `dev` environment for the existing relay implementation. Reuse the current federation protocol and packages while isolating Durable Object bindings, routes, secrets, deployment name, and diagnostic evidence from production.

---

## B. Acceptance

1. The dev relay has distinct bindings and URL.
2. Compatibility exports remain intact.
3. Health, manifest admission, and replication status are verified.
4. Deployment and rollback commands are documented without exposing credentials.

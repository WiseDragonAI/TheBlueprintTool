## A. Scope

Add a Wrangler `dev` environment for the existing relay source and protocol. Isolate Worker name, `FEDERATIONS` Durable Object binding, namespace, credentials, URL, logs, and admission records while retaining current compatibility exports and migrations.

---

## B. Acceptance

1. Dev and production relay identities are distinct.
2. Compatibility exports and the existing protocol remain unchanged.
3. Dev health, manifest admission, package synchronization, and replication status are verified.
4. Production relay health and state remain unchanged.
5. Deployment, credential rotation, rollback, and cleanup commands are documented without secrets.

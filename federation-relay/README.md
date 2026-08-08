## A. Relay Boundary

1. **Runtime:** production Worker `decision-os-federation-relay` owns one SQLite Durable Object per `federationId`.
2. **State:** Cloudflare stores node credential hashes, project manifests, routing state, flow-control state, and task-state relay records. Project files, card content, thread content, uploads, authored prompt bytes, Git objects, delivery journals, and Codex runtime state remain on owner nodes.
3. **Routing:** each Decision OS server opens one authenticated outbound WebSocket. Remote project identities use `${ownerNodeId}:${localProjectId}` and dispatch through the owner's local `/p/:projectId` boundary.
4. **Flow control:** request and response bodies use `64 KiB` chunks, a `1 MiB` credit window, a `25 MiB` body limit, and at most `32` active streams per node.
5. **Delivery transport:** the relay carries fixed node delivery requests. The receiving connector removes caller-supplied delivery capability headers and mints a target-bound, request-bound, one-use internal capability.

---

## B. Production And Dev Identity

1. `wrangler.toml` defines two source-owned environments:
   1. Production Worker `decision-os-federation-relay`
   2. Production namespace identity `decision-os-federations-production`
   3. Dev Worker `decision-os-federation-relay-dev`
   4. Dev namespace identity `decision-os-federations-dev`
2. Production reports `environment: "production"`; dev reports `environment: "dev"`.
3. Production and dev Worker names, Durable Object namespaces, credentials, relay URLs, state, logs, and admission records remain separate.
4. Wrangler is pinned to `4.111.0` in `federation-relay/package.json`.
5. Local canary state is under `.wrangler/state-dev`. The ignored `.dev.vars.dev` owns only the dev administrator secret.
6. Android cannot execute `workerd`. The Termux canary uses `src/termux-local-relay.ts`, `.wrangler/state-termux`, and `.dev.vars.termux` under the same protocol and dev identity boundaries.

---

## C. Release Health

1. `GET /health` returns:

   ```json
   {
     "ok": true,
     "status": "ready",
     "service": "decision-os-federation-relay",
     "observedAt": "<iso-8601>",
     "releaseSha": "<40-character-sha>",
     "deliveryProtocol": 1,
     "protocolVersion": 1,
     "stateProtocol": "<task-state-protocol>",
     "stateSchema": 4,
     "baselineEpoch": 4,
     "environment": "production",
     "workerName": "decision-os-federation-relay",
     "durableObjectNamespace": "decision-os-federations-production"
   }
   ```

2. Canary admission requires the dev health response to identify the exact `origin/dev` SHA, dev Worker, dev namespace, protocol `1`, and current task-state protocol/schema/baseline.
3. Production relay deployment accepts one published annotated `rel-X.Y.Z` tag. Health identifies that tag's resolved commit fingerprint and compatible protocol.
4. Each blank, stale, mismatched, incompatible, non-ready, and wrong-environment health identity blocks admission and delivery progress.

---

## D. Production Delivery Authority

1. Routine relay-only production deployment belongs to `bin/decision-os-deploy-relay.mjs`.
2. Invoke it from the canonical primary `main` checkout with one published annotated release tag: `node bin/decision-os-deploy-relay.mjs rel-X.Y.Z --json`.
3. The command verifies published `main`, the published peeled tag target, tag ancestry, clean relay build inputs, and exact equality of relay source, Wrangler and package manifests, plus `shared/` with the tagged tree.
4. The command reads the current production deployment and health, uploads a Worker version tagged `rel-X.Y.Z`, sets `DECISION_OS_RELEASE_SHA` to the tag's resolved commit fingerprint, activates the version at `100%`, and verifies production `/health`.
5. A post-activation health failure restores the recorded predecessor version and verifies the predecessor release fingerprint.
6. The command uses pinned Wrangler `4.111.0`, fixed argument arrays, finite deadlines, cancellation, bounded output, process settlement, and token redaction.
7. Node activation and node rollback remain separate from relay-only deployment. The complete coordinated node workflow is [Production Delivery Protocol](../documentation/procedure/deployment/production-delivery-protocol.md).
8. Direct `wrangler deploy`, `wrangler versions upload`, `wrangler versions deploy`, and `wrangler rollback` are recovery-only operations.

---

## E. Credentials

1. Production relay delivery reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the process environment or repository `.env`.
2. The token is never accepted as a delivery CLI argument and never persisted in command evidence.
3. Administrator requests use `Authorization: Bearer <ADMIN_SECRET>`. Node WebSockets use node-scoped credentials returned by provisioning.
4. Production, dev, and node credentials remain ignored local state. They are never committed.

---

## F. Node Provisioning

1. Create a credential with `POST /admin/federations/<federationId>/nodes/<nodeId>` and `Authorization: Bearer <ADMIN_SECRET>`.
2. Store the returned credential in the owning node's ignored `.decision-os/.settings.json`:

   ```json
   {
     "federationRelayUrl": "https://decision-os-federation-relay.<account>.workers.dev",
     "federationId": "decision-os-proof",
     "federationNodeId": "workstation",
     "federationNodeCredential": "<node credential>",
     "federationNodeLabel": "Workstation"
   }
   ```

3. The connector is disabled when any required setting is absent.
4. Delivery protocol-1 bootstrap and supervised restart are separate node-owned operations documented in [Production Delivery Protocol](../documentation/procedure/deployment/production-delivery-protocol.md).

---

## G. Delivery Request Transport

1. Coordinator dispatch enters `POST /api/federation/nodes/:nodeId/delivery` through a settings-owned local bearer capability.
2. Remote dispatch uses the authenticated connector's `requestDelivery()` to `POST /api/internal/delivery`.
3. The fixed payload is `{deliveryId, action, targetCommit, expectedCommit}` with `action` in `preflight`, `prepare`, `activate`, `status`, and `rollback`.
4. Requests contain no shell command, path, URL, port, environment value, credential, process command, and supervisor instruction.
5. Delivery request bodies are limited to `4096` bytes, the dispatch deadline is `30,000` ms, and remote response bodies are limited to `64 KiB`.
6. Disconnect, server close, stream replacement, timeout, and cancellation terminate downstream relay streams and node work.

---

## H. Skill And Prompt Synchronization

1. Only clean committed `federated-skill` packages below the canonical server `.skills` root are eligible for the skill manifest and snapshot.
2. Workspace, prompt, user, system, plugin, imported, invalid-store, and recovery-pending content is excluded.
3. A successful federated-skill commit invalidates the export index before manifest publication and bounded skills-first synchronization.
4. Relay failure does not roll back a valid local Git revision. Synchronization retry uses `POST /api/federation/libraries/synchronize`.
5. Pipeline-prompt snapshots travel only in authenticated immutable run installation evidence. They never enter the relay skill library, `.skills`, skill manifests, and federated skill snapshots.
6. No skill-authoring-specific Durable Object class, migration, queue, registry, and package protocol is added.

---

## I. Epoch-3 Project Reset

1. Stop every node participating in the project.
2. Send `POST /admin/federations/<federationId>/projects/<projectId>/reset-state` with `Authorization: Bearer <ADMIN_SECRET>`.
3. HTTP `409 project_nodes_online` identifies connected participating nodes.
4. HTTP `200` deletes only the project's epoch-3 entity and bucket keys, preserves credentials and manifests, records the reset, and returns the empty root.

---

## J. Verification And Canary

1. `npm test` runs authenticated sockets against the Worker and Durable Object runtime, verifies offline-only project reset, publishes manifests, routes requests, and verifies credit in both directions.
2. Relay typecheck and tests run through the repository verification lease:

   ```bash
   node bin/decision-os-verify.mjs -- npm run typecheck --prefix federation-relay
   node bin/decision-os-verify.mjs -- npm test --prefix federation-relay
   ```

3. Production verification includes public `/health`, exact release identity, current deployment identity, and an authenticated two-node WSS exchange.
4. Dev launch, `50152` health, exact candidate identity, convergence proof, and dev-only cleanup are defined in [Canary Skill Authoring Dev Environment](../documentation/procedure/deployment/canary-skill-authoring-dev-environment.md).
5. Phone-specific runit registration, native relay operation, dependency bootstrap, logs, and recovery are defined in [Termux Phone Canary Environment](../documentation/procedure/deployment/canary-termux-phone-environment.md).

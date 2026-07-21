## A. Relay Boundary

1. **Runtime:** `decision-os-federation-relay` is one Cloudflare Worker with one SQLite Durable Object per `federationId`.
2. **State:** Cloudflare stores node credential hashes and project manifests. Project files, card content, thread content, uploads, and Codex state remain on the owner node.
3. **Routing:** Each Decision OS server opens one authenticated outbound WebSocket. Remote project routes use `${ownerNodeId}:${localProjectId}` and dispatch back through the owner's local `/p/:projectId` HTTP boundary.
4. **Flow control:** Request and response bodies use `64 KiB` chunks, a `1 MiB` credit window, a `25 MiB` body limit, and at most `32` active streams per node.

---

## B. Deployment

1. Install dependencies with `npm install` in `federation-relay/`.
2. Supply DroidFleet's Cloudflare token as `CLOUDFLARE_API_TOKEN` and run `npm run deploy`.
3. Generate a random administrator secret and inject it with `npx wrangler secret put ADMIN_SECRET`.
4. Verify `GET /health` before provisioning nodes.

---

## C. Node Provisioning

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

3. Restart that Decision OS server through the normal operator-controlled server procedure. The connector is disabled when any required setting is absent.

---

## D. Epoch-3 Project Reset

1. Stop every node participating in the project.
2. Send `POST /admin/federations/<federationId>/projects/<projectId>/reset-state` with `Authorization: Bearer <ADMIN_SECRET>`.
3. HTTP `409 project_nodes_online` identifies connected nodes that still participate in the project.
4. HTTP `200` deletes only the project's epoch-3 entity and bucket keys, preserves credentials and manifests, records the reset, and returns the empty root.

---

## E. Verification

1. `npm test` runs authenticated sockets against the Worker and Durable Object runtime, verifies the offline-only project reset, publishes manifests, routes a request, and verifies credit in both directions.
2. The backend federation integration test runs two complete local Decision OS servers, reads and mutates a remote ledger, and proves both local project registries remain unchanged.
3. Deployment verification must include the public `/health` probe and an authenticated two-node WSS exchange.

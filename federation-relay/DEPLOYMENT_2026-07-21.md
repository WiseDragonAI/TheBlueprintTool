## A. Release

1. **Worker:** `decision-os-federation-relay`
2. **URL:** `https://decision-os-federation-relay.ardaria.workers.dev`
3. **Cloudflare version:** `fc880e84-8e17-4671-ac5c-ff71617e2ede`
4. **Source commit:** `c7b52764`
5. **Merged main commit:** `6d94adfc`
6. **Deployment time:** `2026-07-21T14:20:00Z`

---

## B. Configuration Evidence

1. Wrangler `4.111.0` authenticated through `CLOUDFLARE_API_TOKEN` from the ignored repository `.env`.
2. The configured Cloudflare account matches `federation-relay/wrangler.toml`.
3. The `FEDERATIONS` Durable Object binding resolved to `FederationRelay` during deployment.
4. The deployed Worker retains the configured `ADMIN_SECRET` secret binding.
5. `/home/jbb/.decision-os/.settings.json` points to the deployed Worker and contains configured federation ID, node ID, node label, and node credential values.

---

## C. Verification Evidence

1. `GET /health` returned HTTP `200` with `{"ok":true,"service":"decision-os-federation-relay","protocolVersion":1}`.
2. An authenticated production WSS connection opened with the configured workstation credential.
3. The first production WSS response was a `catalog` frame containing `3` registered nodes.
4. Relay Worker tests passed `7/7`.
5. Backend current-state delivery tests passed `10/10`.
6. Relay and backend typechecks passed.

---

## D. Remaining Production Proof

1. Execute simultaneous workstation and phone writes after both nodes install schema epoch `3`.
2. Verify reconnect repair, owner-offline reads, exact lazy content demand, and equal relay/node roots.
3. Bootstrap a blank remote-only node from the durable relay while project hosts remain offline.

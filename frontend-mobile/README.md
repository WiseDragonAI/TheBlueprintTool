# decision-os mobile frontend

This is the mobile-first, non-canvas reader for decision-os workspaces. It uses the existing backend endpoints:

- `GET /decision-os/state`
- `GET /decision-os/<ledger-id>`

Launch the normal repository server with this directory selected as its frontend root:

```sh
DECISION_OS_FRONTEND_ROOT="$PWD/frontend-mobile" PORT=50150 ./bin/decision-os-server.mjs
```

The original canvas frontend remains in `frontend/`.

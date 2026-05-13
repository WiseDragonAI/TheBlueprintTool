# Master Ledger front-back 26-05-11-1

Scope:
- Root Blocks: `frontend`, `backend`
- Operator instruction: `executor-spec`
- Source Specs: `documentation/specs.json`
- Source Data Model and Runtime State: `documentation/data.json`
- Stack source: `tmp/executor-analysis-26-05-11-1.md`

Runtime controller-routing invariant:
- Browser input handlers normalize native events into typed actions and route those actions to domain controllers.
- Input handlers must not call helpers or effects directly for domain behavior.
- Controllers resolve the active canvas document context before invoking helpers/effects.
- Integration tests must prove input -> action -> controller routing, not merely that a controller function exists in the scaffold.

Out of scope:
- `archi-generator` implementation and CLI generation specs already covered by `tmp/master-ledger-archi-generator-26-05-10-1.md`.
- `shared/` as a Root Block. `shared/schemas` remains cross-root contract support.
- Generated `.worktrees/` output.

Root Block scaffold:

```text
frontend/
  package.json
  tsconfig.json
  src/
    input/
    route/
    state/
    ui/
      component/
      style/
    business/
      boot/
      navigation/
      canvas/
      selection/
      gesture/
      card/
      zone/
      group/
      relationship/
      thread/
      voice/
      refresh/
      persistence/
      toolbox/
    lib/
    test/
  dist/

backend/
  package.json
  tsconfig.json
  src/
    route/
    business/
      server/
      routing/
      ledger/
      persistence/
      refresh/
      transcription/
    lib/
      http/
      database/
      config/
      telemetry/
      transcription/
    test/
  dist/
```

## Generator Payload

```json
{
  "raw": "",
  "generatedFunctions": [
    {
      "kind": "controller",
      "name": "boot-core",
      "rootBlock": "frontend",
      "domain": "boot",
      "comments": "WHAT boot-core controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function bootCore({ action_payload, runtime_state, data_model }) {\n  telemetry('boot-core-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('boot-core-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "boot-core"
    },
    {
      "kind": "controller",
      "name": "navigate-tabs",
      "rootBlock": "frontend",
      "domain": "navigation",
      "comments": "WHAT navigate-tabs controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function navigateTabs({ action_payload, runtime_state, data_model }) {\n  telemetry('navigate-tabs-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('navigate-tabs-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "navigate-tabs"
    },
    {
      "kind": "controller",
      "name": "handle-canvas-gesture",
      "rootBlock": "frontend",
      "domain": "gesture",
      "comments": "WHAT handle-canvas-gesture controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function handleCanvasGesture({ action_payload, runtime_state, data_model }) {\n  telemetry('handle-canvas-gesture-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('handle-canvas-gesture-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "handle-canvas-gesture"
    },
    {
      "kind": "controller",
      "name": "edit-zone",
      "rootBlock": "frontend",
      "domain": "zone",
      "comments": "WHAT edit-zone controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function editZone({ action_payload, runtime_state, data_model }) {\n  telemetry('edit-zone-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('edit-zone-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "edit-zone"
    },
    {
      "kind": "controller",
      "name": "edit-card",
      "rootBlock": "frontend",
      "domain": "card",
      "comments": "WHAT edit-card controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function editCard({ action_payload, runtime_state, data_model }) {\n  telemetry('edit-card-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('edit-card-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "edit-card"
    },
    {
      "kind": "controller",
      "name": "edit-group",
      "rootBlock": "frontend",
      "domain": "group",
      "comments": "WHAT edit-group controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function editGroup({ action_payload, runtime_state, data_model }) {\n  telemetry('edit-group-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('edit-group-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "edit-group"
    },
    {
      "kind": "controller",
      "name": "render-relationships",
      "rootBlock": "frontend",
      "domain": "relationship",
      "comments": "WHAT render-relationships controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function renderRelationships({ action_payload, runtime_state, data_model }) {\n  telemetry('render-relationships-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('render-relationships-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-relationships"
    },
    {
      "kind": "controller",
      "name": "edit-thread",
      "rootBlock": "frontend",
      "domain": "thread",
      "comments": "WHAT edit-thread controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function editThread({ action_payload, runtime_state, data_model }) {\n  telemetry('edit-thread-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('edit-thread-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "edit-thread"
    },
    {
      "kind": "controller",
      "name": "record-voice-note",
      "rootBlock": "frontend",
      "domain": "voice",
      "comments": "WHAT record-voice-note controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function recordVoiceNote({ action_payload, runtime_state, data_model }) {\n  telemetry('record-voice-note-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('record-voice-note-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "record-voice-note"
    },
    {
      "kind": "controller",
      "name": "handle-client-refresh",
      "rootBlock": "frontend",
      "domain": "refresh",
      "comments": "WHAT handle-client-refresh controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function handleClientRefresh({ action_payload, runtime_state, data_model }) {\n  telemetry('handle-client-refresh-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('handle-client-refresh-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "handle-client-refresh"
    },
    {
      "kind": "controller",
      "name": "operate-toolbox",
      "rootBlock": "frontend",
      "domain": "toolbox",
      "comments": "WHAT operate-toolbox controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function operateToolbox({ action_payload, runtime_state, data_model }) {\n  telemetry('operate-toolbox-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('operate-toolbox-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "operate-toolbox"
    },
    {
      "kind": "controller",
      "name": "start-native-http-server",
      "rootBlock": "backend",
      "domain": "server",
      "comments": "WHAT start-native-http-server controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function startNativeHttpServer({ action_payload, runtime_state, data_model }) {\n  telemetry('start-native-http-server-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('start-native-http-server-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "start-native-http-server"
    },
    {
      "kind": "controller",
      "name": "dispatch-server-route",
      "rootBlock": "backend",
      "domain": "routing",
      "comments": "WHAT dispatch-server-route controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function dispatchServerRoute({ action_payload, runtime_state, data_model }) {\n  telemetry('dispatch-server-route-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('dispatch-server-route-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "dispatch-server-route"
    },
    {
      "kind": "controller",
      "name": "load-tab-ledgers",
      "rootBlock": "backend",
      "domain": "ledger",
      "comments": "WHAT load-tab-ledgers controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function loadTabLedgers({ action_payload, runtime_state, data_model }) {\n  telemetry('load-tab-ledgers-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('load-tab-ledgers-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "load-tab-ledgers"
    },
    {
      "kind": "controller",
      "name": "commit-ledger-edit",
      "rootBlock": "backend",
      "domain": "persistence",
      "comments": "WHAT commit-ledger-edit controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function commitLedgerEdit({ action_payload, runtime_state, data_model }) {\n  telemetry('commit-ledger-edit-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('commit-ledger-edit-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "commit-ledger-edit"
    },
    {
      "kind": "controller",
      "name": "publish-server-refresh",
      "rootBlock": "backend",
      "domain": "refresh",
      "comments": "WHAT publish-server-refresh controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function publishServerRefresh({ action_payload, runtime_state, data_model }) {\n  telemetry('publish-server-refresh-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('publish-server-refresh-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "publish-server-refresh"
    },
    {
      "kind": "controller",
      "name": "transcribe-voice-note",
      "rootBlock": "backend",
      "domain": "transcription",
      "comments": "WHAT transcribe-voice-note controller. WHY the front-back scaffold needs one addressable controller function.",
      "pseudocode": "function transcribeVoiceNote({ action_payload, runtime_state, data_model }) {\n  telemetry('transcribe-voice-note-started')\n  const result = { ok: true, kind: 'controller', action_payload, runtime_state, data_model }\n  telemetry('transcribe-voice-note-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "transcribe-voice-note"
    },
    {
      "kind": "action",
      "name": "boot-core-action",
      "rootBlock": "frontend",
      "domain": "boot",
      "comments": "WHAT boot-core-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function bootCoreAction({ action_payload, runtime_state, data_model }) {\n  telemetry('boot-core-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('boot-core-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "boot-core-action"
    },
    {
      "kind": "action",
      "name": "navigate-tabs-action",
      "rootBlock": "frontend",
      "domain": "navigation",
      "comments": "WHAT navigate-tabs-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function navigateTabsAction({ action_payload, runtime_state, data_model }) {\n  telemetry('navigate-tabs-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('navigate-tabs-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "navigate-tabs-action"
    },
    {
      "kind": "action",
      "name": "handle-canvas-gesture-action",
      "rootBlock": "frontend",
      "domain": "gesture",
      "comments": "WHAT handle-canvas-gesture-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function handleCanvasGestureAction({ action_payload, runtime_state, data_model }) {\n  telemetry('handle-canvas-gesture-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('handle-canvas-gesture-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "handle-canvas-gesture-action"
    },
    {
      "kind": "action",
      "name": "edit-zone-action",
      "rootBlock": "frontend",
      "domain": "zone",
      "comments": "WHAT edit-zone-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function editZoneAction({ action_payload, runtime_state, data_model }) {\n  telemetry('edit-zone-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('edit-zone-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "edit-zone-action"
    },
    {
      "kind": "action",
      "name": "edit-card-action",
      "rootBlock": "frontend",
      "domain": "card",
      "comments": "WHAT edit-card-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function editCardAction({ action_payload, runtime_state, data_model }) {\n  telemetry('edit-card-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('edit-card-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "edit-card-action"
    },
    {
      "kind": "action",
      "name": "edit-group-action",
      "rootBlock": "frontend",
      "domain": "group",
      "comments": "WHAT edit-group-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function editGroupAction({ action_payload, runtime_state, data_model }) {\n  telemetry('edit-group-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('edit-group-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "edit-group-action"
    },
    {
      "kind": "action",
      "name": "render-relationships-action",
      "rootBlock": "frontend",
      "domain": "relationship",
      "comments": "WHAT render-relationships-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function renderRelationshipsAction({ action_payload, runtime_state, data_model }) {\n  telemetry('render-relationships-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('render-relationships-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-relationships-action"
    },
    {
      "kind": "action",
      "name": "edit-thread-action",
      "rootBlock": "frontend",
      "domain": "thread",
      "comments": "WHAT edit-thread-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function editThreadAction({ action_payload, runtime_state, data_model }) {\n  telemetry('edit-thread-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('edit-thread-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "edit-thread-action"
    },
    {
      "kind": "action",
      "name": "record-voice-note-action",
      "rootBlock": "frontend",
      "domain": "voice",
      "comments": "WHAT record-voice-note-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function recordVoiceNoteAction({ action_payload, runtime_state, data_model }) {\n  telemetry('record-voice-note-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('record-voice-note-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "record-voice-note-action"
    },
    {
      "kind": "action",
      "name": "handle-client-refresh-action",
      "rootBlock": "frontend",
      "domain": "refresh",
      "comments": "WHAT handle-client-refresh-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function handleClientRefreshAction({ action_payload, runtime_state, data_model }) {\n  telemetry('handle-client-refresh-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('handle-client-refresh-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "handle-client-refresh-action"
    },
    {
      "kind": "action",
      "name": "operate-toolbox-action",
      "rootBlock": "frontend",
      "domain": "toolbox",
      "comments": "WHAT operate-toolbox-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function operateToolboxAction({ action_payload, runtime_state, data_model }) {\n  telemetry('operate-toolbox-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('operate-toolbox-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "operate-toolbox-action"
    },
    {
      "kind": "action",
      "name": "start-native-http-server-action",
      "rootBlock": "backend",
      "domain": "server",
      "comments": "WHAT start-native-http-server-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function startNativeHttpServerAction({ action_payload, runtime_state, data_model }) {\n  telemetry('start-native-http-server-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('start-native-http-server-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "start-native-http-server-action"
    },
    {
      "kind": "action",
      "name": "dispatch-server-route-action",
      "rootBlock": "backend",
      "domain": "routing",
      "comments": "WHAT dispatch-server-route-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function dispatchServerRouteAction({ action_payload, runtime_state, data_model }) {\n  telemetry('dispatch-server-route-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('dispatch-server-route-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "dispatch-server-route-action"
    },
    {
      "kind": "action",
      "name": "load-tab-ledgers-action",
      "rootBlock": "backend",
      "domain": "ledger",
      "comments": "WHAT load-tab-ledgers-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function loadTabLedgersAction({ action_payload, runtime_state, data_model }) {\n  telemetry('load-tab-ledgers-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('load-tab-ledgers-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "load-tab-ledgers-action"
    },
    {
      "kind": "action",
      "name": "commit-ledger-edit-action",
      "rootBlock": "backend",
      "domain": "persistence",
      "comments": "WHAT commit-ledger-edit-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function commitLedgerEditAction({ action_payload, runtime_state, data_model }) {\n  telemetry('commit-ledger-edit-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('commit-ledger-edit-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "commit-ledger-edit-action"
    },
    {
      "kind": "action",
      "name": "publish-server-refresh-action",
      "rootBlock": "backend",
      "domain": "refresh",
      "comments": "WHAT publish-server-refresh-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function publishServerRefreshAction({ action_payload, runtime_state, data_model }) {\n  telemetry('publish-server-refresh-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('publish-server-refresh-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "publish-server-refresh-action"
    },
    {
      "kind": "action",
      "name": "transcribe-voice-note-action",
      "rootBlock": "backend",
      "domain": "transcription",
      "comments": "WHAT transcribe-voice-note-action action. WHY the front-back scaffold needs one addressable action function.",
      "pseudocode": "function transcribeVoiceNoteAction({ action_payload, runtime_state, data_model }) {\n  telemetry('transcribe-voice-note-action-started')\n  const result = { ok: true, kind: 'action', action_payload, runtime_state, data_model }\n  telemetry('transcribe-voice-note-action-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "transcribe-voice-note-action"
    },
    {
      "kind": "helper",
      "name": "load-ledger-state",
      "rootBlock": "frontend",
      "domain": "boot",
      "comments": "WHAT load-ledger-state helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function loadLedgerState({ action_payload, runtime_state, data_model }) {\n  telemetry('load-ledger-state-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('load-ledger-state-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "load-ledger-state"
    },
    {
      "kind": "helper",
      "name": "derive-route-state",
      "rootBlock": "frontend",
      "domain": "navigation",
      "comments": "WHAT derive-route-state helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function deriveRouteState({ action_payload, runtime_state, data_model }) {\n  telemetry('derive-route-state-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('derive-route-state-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "derive-route-state"
    },
    {
      "kind": "helper",
      "name": "clear-transient-selection",
      "rootBlock": "frontend",
      "domain": "selection",
      "comments": "WHAT clear-transient-selection helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function clearTransientSelection({ action_payload, runtime_state, data_model }) {\n  telemetry('clear-transient-selection-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('clear-transient-selection-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "clear-transient-selection"
    },
    {
      "kind": "helper",
      "name": "derive-gesture-intent",
      "rootBlock": "frontend",
      "domain": "gesture",
      "comments": "WHAT derive-gesture-intent helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function deriveGestureIntent({ action_payload, runtime_state, data_model }) {\n  telemetry('derive-gesture-intent-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('derive-gesture-intent-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "derive-gesture-intent"
    },
    {
      "kind": "helper",
      "name": "resolve-selection-target",
      "rootBlock": "frontend",
      "domain": "selection",
      "comments": "WHAT resolve-selection-target helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function resolveSelectionTarget({ action_payload, runtime_state, data_model }) {\n  telemetry('resolve-selection-target-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('resolve-selection-target-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "resolve-selection-target"
    },
    {
      "kind": "helper",
      "name": "calculate-marquee-selection",
      "rootBlock": "frontend",
      "domain": "selection",
      "comments": "WHAT calculate-marquee-selection helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function calculateMarqueeSelection({ action_payload, runtime_state, data_model }) {\n  telemetry('calculate-marquee-selection-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('calculate-marquee-selection-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "calculate-marquee-selection"
    },
    {
      "kind": "helper",
      "name": "calculate-viewport-transform",
      "rootBlock": "frontend",
      "domain": "canvas",
      "comments": "WHAT calculate-viewport-transform helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function calculateViewportTransform({ action_payload, runtime_state, data_model }) {\n  telemetry('calculate-viewport-transform-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('calculate-viewport-transform-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "calculate-viewport-transform"
    },
    {
      "kind": "helper",
      "name": "calculate-drag-delta",
      "rootBlock": "frontend",
      "domain": "gesture",
      "comments": "WHAT calculate-drag-delta helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function calculateDragDelta({ action_payload, runtime_state, data_model }) {\n  telemetry('calculate-drag-delta-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('calculate-drag-delta-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "calculate-drag-delta"
    },
    {
      "kind": "helper",
      "name": "validate-zone-draft",
      "rootBlock": "frontend",
      "domain": "zone",
      "comments": "WHAT validate-zone-draft helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function validateZoneDraft({ action_payload, runtime_state, data_model }) {\n  telemetry('validate-zone-draft-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('validate-zone-draft-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "validate-zone-draft"
    },
    {
      "kind": "helper",
      "name": "calculate-zone-geometry",
      "rootBlock": "frontend",
      "domain": "zone",
      "comments": "WHAT calculate-zone-geometry helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function calculateZoneGeometry({ action_payload, runtime_state, data_model }) {\n  telemetry('calculate-zone-geometry-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('calculate-zone-geometry-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "calculate-zone-geometry"
    },
    {
      "kind": "helper",
      "name": "resolve-zone-selection-membership",
      "rootBlock": "frontend",
      "domain": "zone",
      "comments": "WHAT resolve-zone-selection-membership helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function resolveZoneSelectionMembership({ action_payload, runtime_state, data_model }) {\n  telemetry('resolve-zone-selection-membership-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('resolve-zone-selection-membership-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "resolve-zone-selection-membership"
    },
    {
      "kind": "helper",
      "name": "confirm-zone-deletion",
      "rootBlock": "frontend",
      "domain": "zone",
      "comments": "WHAT confirm-zone-deletion helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function confirmZoneDeletion({ action_payload, runtime_state, data_model }) {\n  telemetry('confirm-zone-deletion-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('confirm-zone-deletion-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "confirm-zone-deletion"
    },
    {
      "kind": "helper",
      "name": "parse-card-markdown",
      "rootBlock": "frontend",
      "domain": "card",
      "comments": "WHAT parse-card-markdown helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function parseCardMarkdown({ action_payload, runtime_state, data_model }) {\n  telemetry('parse-card-markdown-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('parse-card-markdown-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "parse-card-markdown"
    },
    {
      "kind": "helper",
      "name": "resolve-group-membership",
      "rootBlock": "frontend",
      "domain": "group",
      "comments": "WHAT resolve-group-membership helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function resolveGroupMembership({ action_payload, runtime_state, data_model }) {\n  telemetry('resolve-group-membership-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('resolve-group-membership-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "resolve-group-membership"
    },
    {
      "kind": "helper",
      "name": "resolve-click-precedence",
      "rootBlock": "frontend",
      "domain": "group",
      "comments": "WHAT resolve-click-precedence helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function resolveClickPrecedence({ action_payload, runtime_state, data_model }) {\n  telemetry('resolve-click-precedence-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('resolve-click-precedence-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "resolve-click-precedence"
    },
    {
      "kind": "helper",
      "name": "calculate-relationship-ports",
      "rootBlock": "frontend",
      "domain": "relationship",
      "comments": "WHAT calculate-relationship-ports helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function calculateRelationshipPorts({ action_payload, runtime_state, data_model }) {\n  telemetry('calculate-relationship-ports-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('calculate-relationship-ports-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "calculate-relationship-ports"
    },
    {
      "kind": "helper",
      "name": "route-relationship-path",
      "rootBlock": "frontend",
      "domain": "relationship",
      "comments": "WHAT route-relationship-path helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function routeRelationshipPath({ action_payload, runtime_state, data_model }) {\n  telemetry('route-relationship-path-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('route-relationship-path-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "route-relationship-path"
    },
    {
      "kind": "helper",
      "name": "resolve-thread-target",
      "rootBlock": "frontend",
      "domain": "thread",
      "comments": "WHAT resolve-thread-target helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function resolveThreadTarget({ action_payload, runtime_state, data_model }) {\n  telemetry('resolve-thread-target-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('resolve-thread-target-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "resolve-thread-target"
    },
    {
      "kind": "helper",
      "name": "resolve-voice-session",
      "rootBlock": "frontend",
      "domain": "voice",
      "comments": "WHAT resolve-voice-session helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function resolveVoiceSession({ action_payload, runtime_state, data_model }) {\n  telemetry('resolve-voice-session-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('resolve-voice-session-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "resolve-voice-session"
    },
    {
      "kind": "helper",
      "name": "capture-voice-audio",
      "rootBlock": "frontend",
      "domain": "voice",
      "comments": "WHAT capture-voice-audio helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function captureVoiceAudio({ action_payload, runtime_state, data_model }) {\n  telemetry('capture-voice-audio-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('capture-voice-audio-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "capture-voice-audio"
    },
    {
      "kind": "helper",
      "name": "merge-refresh-state",
      "rootBlock": "frontend",
      "domain": "refresh",
      "comments": "WHAT merge-refresh-state helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function mergeRefreshState({ action_payload, runtime_state, data_model }) {\n  telemetry('merge-refresh-state-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('merge-refresh-state-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "merge-refresh-state"
    },
    {
      "kind": "helper",
      "name": "resolve-tool-mode",
      "rootBlock": "frontend",
      "domain": "toolbox",
      "comments": "WHAT resolve-tool-mode helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function resolveToolMode({ action_payload, runtime_state, data_model }) {\n  telemetry('resolve-tool-mode-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('resolve-tool-mode-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "resolve-tool-mode"
    },
    {
      "kind": "helper",
      "name": "copy-selection-payload",
      "rootBlock": "frontend",
      "domain": "selection",
      "comments": "WHAT copy-selection-payload helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function copySelectionPayload({ action_payload, runtime_state, data_model }) {\n  telemetry('copy-selection-payload-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('copy-selection-payload-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "copy-selection-payload"
    },
    {
      "kind": "helper",
      "name": "create-http-server",
      "rootBlock": "backend",
      "domain": "server",
      "comments": "WHAT create-http-server helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function createHttpServer({ action_payload, runtime_state, data_model }) {\n  telemetry('create-http-server-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('create-http-server-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "create-http-server"
    },
    {
      "kind": "helper",
      "name": "parse-http-request",
      "rootBlock": "backend",
      "domain": "routing",
      "comments": "WHAT parse-http-request helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function parseHttpRequest({ action_payload, runtime_state, data_model }) {\n  telemetry('parse-http-request-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('parse-http-request-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "parse-http-request"
    },
    {
      "kind": "helper",
      "name": "resolve-ledger-route",
      "rootBlock": "backend",
      "domain": "routing",
      "comments": "WHAT resolve-ledger-route helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function resolveLedgerRoute({ action_payload, runtime_state, data_model }) {\n  telemetry('resolve-ledger-route-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('resolve-ledger-route-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "resolve-ledger-route"
    },
    {
      "kind": "helper",
      "name": "read-blueprinttool-state",
      "rootBlock": "backend",
      "domain": "ledger",
      "comments": "WHAT read-blueprinttool-state helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function readBlueprinttoolState({ action_payload, runtime_state, data_model }) {\n  telemetry('read-blueprinttool-state-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('read-blueprinttool-state-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "read-blueprinttool-state"
    },
    {
      "kind": "helper",
      "name": "read-ledger-json-file",
      "rootBlock": "backend",
      "domain": "ledger",
      "comments": "WHAT read-ledger-json-file helper. WHY the front-back scaffold needs one addressable helper function.",
      "pseudocode": "function readLedgerJsonFile({ action_payload, runtime_state, data_model }) {\n  telemetry('read-ledger-json-file-started')\n  const result = { ok: true, kind: 'helper', action_payload, runtime_state, data_model }\n  telemetry('read-ledger-json-file-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "read-ledger-json-file"
    },
    {
      "kind": "effect",
      "name": "render-canvas-dom",
      "rootBlock": "frontend",
      "domain": "canvas",
      "comments": "WHAT render-canvas-dom effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderCanvasDom({ action_payload, runtime_state, data_model }) {\n  telemetry('render-canvas-dom-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-canvas-dom-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-canvas-dom"
    },
    {
      "kind": "effect",
      "name": "render-tab-registry",
      "rootBlock": "frontend",
      "domain": "navigation",
      "comments": "WHAT render-tab-registry effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderTabRegistry({ action_payload, runtime_state, data_model }) {\n  telemetry('render-tab-registry-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-tab-registry-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-tab-registry"
    },
    {
      "kind": "effect",
      "name": "commit-ledger-edit",
      "rootBlock": "frontend",
      "domain": "persistence",
      "comments": "WHAT commit-ledger-edit effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function commitLedgerEdit({ action_payload, runtime_state, data_model }) {\n  telemetry('commit-ledger-edit-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('commit-ledger-edit-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "commit-ledger-edit"
    },
    {
      "kind": "effect",
      "name": "render-zone-layer",
      "rootBlock": "frontend",
      "domain": "zone",
      "comments": "WHAT render-zone-layer effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderZoneLayer({ action_payload, runtime_state, data_model }) {\n  telemetry('render-zone-layer-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-zone-layer-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-zone-layer"
    },
    {
      "kind": "effect",
      "name": "render-card-layer",
      "rootBlock": "frontend",
      "domain": "card",
      "comments": "WHAT render-card-layer effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderCardLayer({ action_payload, runtime_state, data_model }) {\n  telemetry('render-card-layer-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-card-layer-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-card-layer"
    },
    {
      "kind": "effect",
      "name": "render-group-layer",
      "rootBlock": "frontend",
      "domain": "group",
      "comments": "WHAT render-group-layer effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderGroupLayer({ action_payload, runtime_state, data_model }) {\n  telemetry('render-group-layer-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-group-layer-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-group-layer"
    },
    {
      "kind": "effect",
      "name": "render-relationship-overlay",
      "rootBlock": "frontend",
      "domain": "relationship",
      "comments": "WHAT render-relationship-overlay effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderRelationshipOverlay({ action_payload, runtime_state, data_model }) {\n  telemetry('render-relationship-overlay-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-relationship-overlay-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-relationship-overlay"
    },
    {
      "kind": "effect",
      "name": "render-thread-panel",
      "rootBlock": "frontend",
      "domain": "thread",
      "comments": "WHAT render-thread-panel effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderThreadPanel({ action_payload, runtime_state, data_model }) {\n  telemetry('render-thread-panel-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-thread-panel-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-thread-panel"
    },
    {
      "kind": "effect",
      "name": "upload-voice-audio",
      "rootBlock": "frontend",
      "domain": "voice",
      "comments": "WHAT upload-voice-audio effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function uploadVoiceAudio({ action_payload, runtime_state, data_model }) {\n  telemetry('upload-voice-audio-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('upload-voice-audio-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "upload-voice-audio"
    },
    {
      "kind": "effect",
      "name": "request-transcription",
      "rootBlock": "frontend",
      "domain": "voice",
      "comments": "WHAT request-transcription effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function requestTranscription({ action_payload, runtime_state, data_model }) {\n  telemetry('request-transcription-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('request-transcription-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "request-transcription"
    },
    {
      "kind": "effect",
      "name": "fill-thread-draft",
      "rootBlock": "frontend",
      "domain": "voice",
      "comments": "WHAT fill-thread-draft effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function fillThreadDraft({ action_payload, runtime_state, data_model }) {\n  telemetry('fill-thread-draft-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('fill-thread-draft-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "fill-thread-draft"
    },
    {
      "kind": "effect",
      "name": "render-voice-status",
      "rootBlock": "frontend",
      "domain": "voice",
      "comments": "WHAT render-voice-status effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderVoiceStatus({ action_payload, runtime_state, data_model }) {\n  telemetry('render-voice-status-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-voice-status-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-voice-status"
    },
    {
      "kind": "effect",
      "name": "subscribe-server-refresh",
      "rootBlock": "frontend",
      "domain": "refresh",
      "comments": "WHAT subscribe-server-refresh effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function subscribeServerRefresh({ action_payload, runtime_state, data_model }) {\n  telemetry('subscribe-server-refresh-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('subscribe-server-refresh-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "subscribe-server-refresh"
    },
    {
      "kind": "effect",
      "name": "render-toolbox",
      "rootBlock": "frontend",
      "domain": "toolbox",
      "comments": "WHAT render-toolbox effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function renderToolbox({ action_payload, runtime_state, data_model }) {\n  telemetry('render-toolbox-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('render-toolbox-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "render-toolbox"
    },
    {
      "kind": "effect",
      "name": "write-ledger-json-file",
      "rootBlock": "backend",
      "domain": "persistence",
      "comments": "WHAT write-ledger-json-file effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function writeLedgerJsonFile({ action_payload, runtime_state, data_model }) {\n  telemetry('write-ledger-json-file-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('write-ledger-json-file-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "write-ledger-json-file"
    },
    {
      "kind": "effect",
      "name": "write-blueprinttool-state",
      "rootBlock": "backend",
      "domain": "ledger",
      "comments": "WHAT write-blueprinttool-state effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function writeBlueprinttoolState({ action_payload, runtime_state, data_model }) {\n  telemetry('write-blueprinttool-state-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('write-blueprinttool-state-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "write-blueprinttool-state"
    },
    {
      "kind": "effect",
      "name": "send-json-response",
      "rootBlock": "backend",
      "domain": "routing",
      "comments": "WHAT send-json-response effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function sendJsonResponse({ action_payload, runtime_state, data_model }) {\n  telemetry('send-json-response-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('send-json-response-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "send-json-response"
    },
    {
      "kind": "effect",
      "name": "publish-refresh-event",
      "rootBlock": "backend",
      "domain": "refresh",
      "comments": "WHAT publish-refresh-event effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function publishRefreshEvent({ action_payload, runtime_state, data_model }) {\n  telemetry('publish-refresh-event-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('publish-refresh-event-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "publish-refresh-event"
    },
    {
      "kind": "effect",
      "name": "call-openai-transcription",
      "rootBlock": "backend",
      "domain": "transcription",
      "comments": "WHAT call-openai-transcription effect. WHY the front-back scaffold needs one addressable effect function.",
      "pseudocode": "function callOpenaiTranscription({ action_payload, runtime_state, data_model }) {\n  telemetry('call-openai-transcription-started')\n  const result = { ok: true, kind: 'effect', action_payload, runtime_state, data_model }\n  telemetry('call-openai-transcription-completed')\n  return result\n}",
      "body": "",
      "sourceSpecIds": [],
      "telemetryName": "call-openai-transcription"
    }
  ],
  "runtimeData": [
    {
      "kind": "State",
      "name": "FrontendRootState",
      "shape": {
        "routeState": "RouteState",
        "canvasState": "CanvasState",
        "selectionState": "SelectionState",
        "gestureState": "GestureState",
        "toolState": "ToolState",
        "threadPanelState": "ThreadPanelState",
        "voiceState": "VoiceState",
        "refreshState": "RefreshState"
      },
      "usage": "frontend runtime state machine"
    },
    {
      "kind": "State",
      "name": "BackendServerState",
      "shape": {
        "tabRegistry": "NavTab[]",
        "ledgerIndex": "Ledger[]",
        "watcherState": "object"
      },
      "usage": "backend server durable and refresh state"
    },
    {
      "kind": "Action",
      "name": "FrontendAction",
      "shape": {
        "type": "string",
        "payload": "object"
      },
      "usage": "frontend controller action payload"
    },
    {
      "kind": "Action",
      "name": "BackendAction",
      "shape": {
        "type": "string",
        "payload": "object"
      },
      "usage": "backend controller action payload"
    }
  ],
  "testSuites": [
    {
      "suiteName": "boot",
      "specId": "10000001",
      "integrationPath": "./frontend/test/canvas/boot.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "navigation",
      "specId": "10000002",
      "integrationPath": "./frontend/test/navigation/navigation.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "navigation"
    },
    {
      "suiteName": "zones are first-class canvas objects",
      "specId": "20000001",
      "integrationPath": "./frontend/test/zone/zones-are-first-class-canvas-objects.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zones can be created on the canvas",
      "specId": "20000002",
      "integrationPath": "./frontend/test/zone/zones-can-be-created-on-the-canvas.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zones can be named",
      "specId": "20000003",
      "integrationPath": "./frontend/test/zone/zones-can-be-named.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zones have a color",
      "specId": "20000004",
      "integrationPath": "./frontend/test/zone/zones-have-a-color.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zone resizing uses drag n drop from zone corners when the zone is selected",
      "specId": "20000005",
      "integrationPath": "./frontend/test/zone/zone-resizing-uses-drag-n-drop-from-zone-corners-when-the-zone-is-selected.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zones can be resized",
      "specId": "20000006",
      "integrationPath": "./frontend/test/zone/zones-can-be-resized.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zones can be moved",
      "specId": "20000007",
      "integrationPath": "./frontend/test/zone/zones-can-be-moved.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zones can contain cards",
      "specId": "20000008",
      "integrationPath": "./frontend/test/zone/zones-can-contain-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zones are rendered behind the cards",
      "specId": "20000009",
      "integrationPath": "./frontend/test/zone/zones-are-rendered-behind-the-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "selecting a zone selects all the cards intersecting with the zone",
      "specId": "2000000a",
      "integrationPath": "./frontend/test/zone/selecting-a-zone-selects-all-the-cards-intersecting-with-the-zone.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "moving a zone moves the zone and the intersecting cards",
      "specId": "2000000b",
      "integrationPath": "./frontend/test/zone/moving-a-zone-moves-the-zone-and-the-intersecting-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "a zone has an edit button",
      "specId": "2000000c",
      "integrationPath": "./frontend/test/zone/a-zone-has-an-edit-button.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "a zone has a notes button linked to a thread",
      "specId": "2000000d",
      "integrationPath": "./frontend/test/zone/a-zone-has-a-notes-button-linked-to-a-thread.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zone labels are always visible at the same size for any zoom level",
      "specId": "2000000e",
      "integrationPath": "./frontend/test/zone/zone-labels-are-always-visible-at-the-same-size-for-any-zoom-level.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "a zone can be deleted from the edit panel",
      "specId": "2000000f",
      "integrationPath": "./frontend/test/zone/a-zone-can-be-deleted-from-the-edit-panel.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "a zone can be deleted by pressing Del while selected",
      "specId": "20000010",
      "integrationPath": "./frontend/test/zone/a-zone-can-be-deleted-by-pressing-del-while-selected.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "deleting a zone does not delete the intersecting cards",
      "specId": "20000011",
      "integrationPath": "./frontend/test/zone/deleting-a-zone-does-not-delete-the-intersecting-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zone deletion by pressing Del requires a confirmation modal",
      "specId": "20000012",
      "integrationPath": "./frontend/test/zone/zone-deletion-by-pressing-del-requires-a-confirmation-modal.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "a selected zone has its border rendered in white glow and the resize icon at corners",
      "specId": "20000013",
      "integrationPath": "./frontend/test/zone/a-selected-zone-has-its-border-rendered-in-white-glow-and-the-resize-icon-at-cor.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zones can be drawn from the tool box zone tool",
      "specId": "20000014",
      "integrationPath": "./frontend/test/zone/zones-can-be-drawn-from-the-tool-box-zone-tool.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "zone confirmation modal can process keyboard shortcuts",
      "specId": "20000015",
      "integrationPath": "./frontend/test/zone/zone-confirmation-modal-can-process-keyboard-shortcuts.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "suppression confirmation modal uses escape and enter keyboard to cancel or validate",
      "specId": "20000016",
      "integrationPath": "./frontend/test/canvas/suppression-confirmation-modal-uses-escape-and-enter-keyboard-to-cancel-or-valid.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "zone position and geometry is persisted",
      "specId": "20000017",
      "integrationPath": "./frontend/test/zone/zone-position-and-geometry-is-persisted.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Zone is a primary model and has a persistent ID",
      "specId": "20000018",
      "integrationPath": "./frontend/test/zone/zone-is-a-primary-model-and-has-a-persistent-id.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Ctrl-click can select multiple zones and cards",
      "specId": "30000001",
      "integrationPath": "./frontend/test/zone/ctrl-click-can-select-multiple-zones-and-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "holding Ctrl + left-click and dragging draws a selection box",
      "specId": "30000002",
      "integrationPath": "./frontend/test/selection/holding-ctrl-left-click-and-dragging-draws-a-selection-box.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "selection"
    },
    {
      "suiteName": "left-clicking naked canvas and dragging pans the canvas",
      "specId": "30000003",
      "integrationPath": "./frontend/test/canvas/left-clicking-naked-canvas-and-dragging-pans-the-canvas.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "left-clicking an unselected zone and dragging pans the canvas",
      "specId": "30000004",
      "integrationPath": "./frontend/test/zone/left-clicking-an-unselected-zone-and-dragging-pans-the-canvas.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "scrolling the mouse wheel zooms the canvas",
      "specId": "30000005",
      "integrationPath": "./frontend/test/canvas/scrolling-the-mouse-wheel-zooms-the-canvas.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "holding Ctrl and scrolling the mouse wheel moves the canvas viewport",
      "specId": "30000006",
      "integrationPath": "./frontend/test/canvas/holding-ctrl-and-scrolling-the-mouse-wheel-moves-the-canvas-viewport.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "the canvas has a dark honeycomb background",
      "specId": "30000007",
      "integrationPath": "./frontend/test/canvas/the-canvas-has-a-dark-honeycomb-background.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "canvas card rendering is optimized for high performance",
      "specId": "30000008",
      "integrationPath": "./frontend/test/card/canvas-card-rendering-is-optimized-for-high-performance.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "canvas cards do not render high definition when it is not needed",
      "specId": "30000009",
      "integrationPath": "./frontend/test/card/canvas-cards-do-not-render-high-definition-when-it-is-not-needed.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "invalid action safety",
      "specId": "40000002",
      "integrationPath": "./frontend/test/canvas/invalid-action-safety.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "mixed selection",
      "specId": "40000005",
      "integrationPath": "./frontend/test/selection/mixed-selection.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "selection"
    },
    {
      "suiteName": "selection clear",
      "specId": "40000006",
      "integrationPath": "./frontend/test/selection/selection-clear.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "selection"
    },
    {
      "suiteName": "tool mode switch",
      "specId": "40000007",
      "integrationPath": "./frontend/test/toolbox/tool-mode-switch.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "toolbox"
    },
    {
      "suiteName": "navigation persistence",
      "specId": "40000012",
      "integrationPath": "./frontend/test/navigation/navigation-persistence.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "navigation"
    },
    {
      "suiteName": "tab switch",
      "specId": "50000002",
      "integrationPath": "./frontend/test/navigation/tab-switch.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "navigation"
    },
    {
      "suiteName": "refresh",
      "specId": "50000006",
      "integrationPath": "./frontend/test/refresh/refresh.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "refresh"
    },
    {
      "suiteName": "marquee select",
      "specId": "5000000b",
      "integrationPath": "./frontend/test/selection/marquee-select.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "selection"
    },
    {
      "suiteName": "escape clear",
      "specId": "5000000c",
      "integrationPath": "./frontend/test/canvas/escape-clear.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "open conversation drawer",
      "specId": "50000013",
      "integrationPath": "./frontend/test/thread/open-conversation-drawer.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "create note",
      "specId": "50000014",
      "integrationPath": "./frontend/test/thread/create-note.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "delete note",
      "specId": "50000015",
      "integrationPath": "./frontend/test/thread/delete-note.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "copy selection",
      "specId": "50000016",
      "integrationPath": "./frontend/test/selection/copy-selection.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "selection"
    },
    {
      "suiteName": "a selected card has a white glowy border",
      "specId": "60000001",
      "integrationPath": "./frontend/test/card/a-selected-card-has-a-white-glowy-border.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "a card is drag-and-drop enabled",
      "specId": "60000002",
      "integrationPath": "./frontend/test/card/a-card-is-drag-and-drop-enabled.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "card positions are persisted in a JSON ledger",
      "specId": "60000003",
      "integrationPath": "./frontend/test/card/card-positions-are-persisted-in-a-json-ledger.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "card position is persisted",
      "specId": "60000004",
      "integrationPath": "./frontend/test/card/card-position-is-persisted.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "persisted card positions are restored on reload",
      "specId": "60000005",
      "integrationPath": "./frontend/test/card/persisted-card-positions-are-restored-on-reload.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "cards from the base card class can be extended for sub-modules",
      "specId": "60000009",
      "integrationPath": "./frontend/test/card/cards-from-the-base-card-class-can-be-extended-for-sub-modules.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "an open card is shown on top of everything with max z-index",
      "specId": "6000000a",
      "integrationPath": "./frontend/test/card/an-open-card-is-shown-on-top-of-everything-with-max-z-index.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "selecting a card highlights its directly connected cards",
      "specId": "6000000b",
      "integrationPath": "./frontend/test/card/selecting-a-card-highlights-its-directly-connected-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "cards have a tab system",
      "specId": "6000000c",
      "integrationPath": "./frontend/test/card/cards-have-a-tab-system.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "the default tab for the base card class is notes",
      "specId": "6000000d",
      "integrationPath": "./frontend/test/card/the-default-tab-for-the-base-card-class-is-notes.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "clicking on card notes opens the card thread in the right panel",
      "specId": "6000000e",
      "integrationPath": "./frontend/test/card/clicking-on-card-notes-opens-the-card-thread-in-the-right-panel.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "cards have a discussion thread",
      "specId": "6000000f",
      "integrationPath": "./frontend/test/card/cards-have-a-discussion-thread.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Card is a primary model and has a persistent ID",
      "specId": "60000010",
      "integrationPath": "./frontend/test/card/card-is-a-primary-model-and-has-a-persistent-id.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "server routes are reachable by direct URL slug",
      "specId": "70000001",
      "integrationPath": "./backend/test/navigation/server-routes-are-reachable-by-direct-url-slug.integration.test.ts",
      "rootBlock": "backend",
      "domain": "navigation"
    },
    {
      "suiteName": "the server serves the committed JSON ledger for each tab",
      "specId": "70000002",
      "integrationPath": "./backend/test/navigation/the-server-serves-the-committed-json-ledger-for-each-tab.integration.test.ts",
      "rootBlock": "backend",
      "domain": "navigation"
    },
    {
      "suiteName": "the server exposes an API for ledger edits",
      "specId": "70000003",
      "integrationPath": "./backend/test/server/the-server-exposes-an-api-for-ledger-edits.integration.test.ts",
      "rootBlock": "backend",
      "domain": "server"
    },
    {
      "suiteName": "ledger edits are persisted to JSON files",
      "specId": "70000004",
      "integrationPath": "./backend/test/ledger/ledger-edits-are-persisted-to-json-files.integration.test.ts",
      "rootBlock": "backend",
      "domain": "ledger"
    },
    {
      "suiteName": "the server exposes a route to create a new persisted ledger",
      "specId": "70000005",
      "integrationPath": "./backend/test/navigation/the-server-exposes-a-route-to-create-a-new-persisted-ledger.integration.test.ts",
      "rootBlock": "backend",
      "domain": "navigation"
    },
    {
      "suiteName": "navigation tabs represent all the available ledgers in server state",
      "specId": "70000006",
      "integrationPath": "./backend/test/navigation/navigation-tabs-represent-all-the-available-ledgers-in-server-state.integration.test.ts",
      "rootBlock": "backend",
      "domain": "navigation"
    },
    {
      "suiteName": "server state is saved in ./.blueprinttool",
      "specId": "70000007",
      "integrationPath": "./backend/test/toolbox/server-state-is-saved-in-blueprinttool.integration.test.ts",
      "rootBlock": "backend",
      "domain": "toolbox"
    },
    {
      "suiteName": "ledgers in ./.blueprinttool load as default tabs",
      "specId": "9c31f0a4",
      "integrationPath": "./backend/test/navigation/ledgers-in-blueprinttool-load-as-default-tabs.integration.test.ts",
      "rootBlock": "backend",
      "domain": "navigation"
    },
    {
      "suiteName": "Normal zone click replaces selection with intersecting cards",
      "specId": "d5c8ece7",
      "integrationPath": "./frontend/test/zone/normal-zone-click-replaces-selection-with-intersecting-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Ctrl-click zone adds intersecting cards to the existing selection",
      "specId": "ce0c5d80",
      "integrationPath": "./frontend/test/zone/ctrl-click-zone-adds-intersecting-cards-to-the-existing-selection.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Dragging an unselected card selects the card and drags it",
      "specId": "61261091",
      "integrationPath": "./frontend/test/card/dragging-an-unselected-card-selects-the-card-and-drags-it.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "A zone must be selected before being draggable",
      "specId": "86e67c0e",
      "integrationPath": "./frontend/test/zone/a-zone-must-be-selected-before-being-draggable.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Zone Drawing Button",
      "specId": "e0b4d11a",
      "integrationPath": "./frontend/test/zone/zone-drawing-button.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Shortcut Help Button",
      "specId": "33c20993",
      "integrationPath": "./frontend/test/toolbox/shortcut-help-button.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "toolbox"
    },
    {
      "suiteName": "Runbook Button",
      "specId": "676c6a7a",
      "integrationPath": "./frontend/test/toolbox/runbook-button.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "toolbox"
    },
    {
      "suiteName": "Conversation Ledger Button",
      "specId": "7abd939e",
      "integrationPath": "./frontend/test/thread/conversation-ledger-button.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "Refresh Button",
      "specId": "cfed85d3",
      "integrationPath": "./frontend/test/refresh/refresh-button.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "refresh"
    },
    {
      "suiteName": "Selecting the zone tool opens the color picker.",
      "specId": "9f9279ff",
      "integrationPath": "./frontend/test/zone/selecting-the-zone-tool-opens-the-color-picker.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "The toolbox background is transparent.",
      "specId": "93f778a8",
      "integrationPath": "./frontend/test/toolbox/the-toolbox-background-is-transparent.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "toolbox"
    },
    {
      "suiteName": "Hovering the toolbox animates the background to dark grey.",
      "specId": "3159faad",
      "integrationPath": "./frontend/test/toolbox/hovering-the-toolbox-animates-the-background-to-dark-grey.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "toolbox"
    },
    {
      "suiteName": "Tabs are route-addressable.",
      "specId": "ac137fe2",
      "integrationPath": "./frontend/test/navigation/tabs-are-route-addressable.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "navigation"
    },
    {
      "suiteName": "The active tab is derived from the browser path.",
      "specId": "51a6af83",
      "integrationPath": "./frontend/test/navigation/the-active-tab-is-derived-from-the-browser-path.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "navigation"
    },
    {
      "suiteName": "The navbar renders the tab registry.",
      "specId": "12749dcd",
      "integrationPath": "./frontend/test/navigation/the-navbar-renders-the-tab-registry.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "navigation"
    },
    {
      "suiteName": "Threads are a primary model.",
      "specId": "eaced0c9",
      "integrationPath": "./frontend/test/thread/threads-are-a-primary-model.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "The conversation ledger aggregates card and zone threads.",
      "specId": "667ae9a9",
      "integrationPath": "./frontend/test/zone/the-conversation-ledger-aggregates-card-and-zone-threads.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Threads preserve operator and assistant history.",
      "specId": "5f8c7152",
      "integrationPath": "./frontend/test/thread/threads-preserve-operator-and-assistant-history.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "Notes opened from a card target that card thread.",
      "specId": "cc7ed3b4",
      "integrationPath": "./frontend/test/card/notes-opened-from-a-card-target-that-card-thread.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Notes opened from a zone target that zone thread.",
      "specId": "7984a4f3",
      "integrationPath": "./frontend/test/zone/notes-opened-from-a-zone-target-that-zone-thread.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Threads support voice recording.",
      "specId": "d38927c1",
      "integrationPath": "./frontend/test/thread/threads-support-voice-recording.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "Voice recording is thread-scoped.",
      "specId": "747b461e",
      "integrationPath": "./frontend/test/thread/voice-recording-is-thread-scoped.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "Only one voice recording is active at a time.",
      "specId": "3d074416",
      "integrationPath": "./frontend/test/voice/only-one-voice-recording-is-active-at-a-time.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "voice"
    },
    {
      "suiteName": "Stopping a voice recording routes the captured audio to transcription.",
      "specId": "8b1ff788",
      "integrationPath": "./frontend/test/voice/stopping-a-voice-recording-routes-the-captured-audio-to-transcription.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "voice"
    },
    {
      "suiteName": "Transcribed voice text fills the active thread draft.",
      "specId": "6cc37b58",
      "integrationPath": "./frontend/test/thread/transcribed-voice-text-fills-the-active-thread-draft.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "thread"
    },
    {
      "suiteName": "Voice recording shows live duration and level telemetry.",
      "specId": "040cef84",
      "integrationPath": "./frontend/test/voice/voice-recording-shows-live-duration-and-level-telemetry.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "voice"
    },
    {
      "suiteName": "Voice recording failures are surfaced to the operator.",
      "specId": "828e6225",
      "integrationPath": "./frontend/test/voice/voice-recording-failures-are-surfaced-to-the-operator.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "voice"
    },
    {
      "suiteName": "Voice transcription is optional and configuration-gated.",
      "specId": "c0c42d20",
      "integrationPath": "./frontend/test/voice/voice-transcription-is-optional-and-configuration-gated.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "voice"
    },
    {
      "suiteName": "Voice transcription upload is optimistic.",
      "specId": "5c4e5c22",
      "integrationPath": "./frontend/test/voice/voice-transcription-upload-is-optimistic.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "voice"
    },
    {
      "suiteName": "Voice audio is transient until transcription completes.",
      "specId": "21b2b050",
      "integrationPath": "./frontend/test/voice/voice-audio-is-transient-until-transcription-completes.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "voice"
    },
    {
      "suiteName": "Voice transcription status is visible in the UI.",
      "specId": "b5a783cd",
      "integrationPath": "./frontend/test/voice/voice-transcription-status-is-visible-in-the-ui.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "voice"
    },
    {
      "suiteName": "hovering a card shows its hash id",
      "specId": "a946fbe0",
      "integrationPath": "./frontend/test/card/hovering-a-card-shows-its-hash-id.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "cards have labels show top right",
      "specId": "aa42ff94",
      "integrationPath": "./frontend/test/card/cards-have-labels-show-top-right.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "selected cards show their hash id top right",
      "specId": "4dfbf38c",
      "integrationPath": "./frontend/test/card/selected-cards-show-their-hash-id-top-right.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "hash id is displayed top right in a smaller font grey",
      "specId": "d0936729",
      "integrationPath": "./frontend/test/canvas/hash-id-is-displayed-top-right-in-a-smaller-font-grey.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "External ledger updates trigger a server refresh flow.",
      "specId": "b7e4dfd1",
      "integrationPath": "./backend/test/refresh/external-ledger-updates-trigger-a-server-refresh-flow.integration.test.ts",
      "rootBlock": "backend",
      "domain": "refresh"
    },
    {
      "suiteName": "Client-originated ledger updates do not trigger a client refresh.",
      "specId": "2e4c6d2b",
      "integrationPath": "./frontend/test/refresh/client-originated-ledger-updates-do-not-trigger-a-client-refresh.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "refresh"
    },
    {
      "suiteName": "Client refresh is triggered by server-side refresh events.",
      "specId": "10f4a4c7",
      "integrationPath": "./backend/test/refresh/client-refresh-is-triggered-by-server-side-refresh-events.integration.test.ts",
      "rootBlock": "backend",
      "domain": "refresh"
    },
    {
      "suiteName": "External ledger updates preserve the live client interaction state when possible.",
      "specId": "689842e0",
      "integrationPath": "./frontend/test/persistence/external-ledger-updates-preserve-the-live-client-interaction-state-when-possible.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "persistence"
    },
    {
      "suiteName": "Server-side refresh can target one surface.",
      "specId": "929342ae",
      "integrationPath": "./backend/test/refresh/server-side-refresh-can-target-one-surface.integration.test.ts",
      "rootBlock": "backend",
      "domain": "refresh"
    },
    {
      "suiteName": "Server-side refresh can target all surfaces.",
      "specId": "ac07dc1b",
      "integrationPath": "./backend/test/refresh/server-side-refresh-can-target-all-surfaces.integration.test.ts",
      "rootBlock": "backend",
      "domain": "refresh"
    },
    {
      "suiteName": "The refresh system preserves canvas continuity during operator work.",
      "specId": "9d1b7c36",
      "integrationPath": "./frontend/test/refresh/the-refresh-system-preserves-canvas-continuity-during-operator-work.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "refresh"
    },
    {
      "suiteName": "Live ledger editing from outside the client is first-class.",
      "specId": "0f361538",
      "integrationPath": "./frontend/test/persistence/live-ledger-editing-from-outside-the-client-is-first-class.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "persistence"
    },
    {
      "suiteName": "Server refresh can force a full client state reload when required.",
      "specId": "be4ec9c2",
      "integrationPath": "./backend/test/refresh/server-refresh-can-force-a-full-client-state-reload-when-required.integration.test.ts",
      "rootBlock": "backend",
      "domain": "refresh"
    },
    {
      "suiteName": "Selected zones and card can be copied with ctrl C and pasted with ctrl V",
      "specId": "6583c446",
      "integrationPath": "./frontend/test/zone/selected-zones-and-card-can-be-copied-with-ctrl-c-and-pasted-with-ctrl-v.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Group tool is present next to Zone in the Core toolbar",
      "specId": "53d49146",
      "integrationPath": "./frontend/test/zone/group-tool-is-present-next-to-zone-in-the-core-toolbar.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Clicking Group arms the tool",
      "specId": "90d84349",
      "integrationPath": "./frontend/test/group/clicking-group-arms-the-tool.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "group"
    },
    {
      "suiteName": "Group background is transparent",
      "specId": "1d444573",
      "integrationPath": "./frontend/test/group/group-background-is-transparent.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "group"
    },
    {
      "suiteName": "Group border is thicker than a normal zone border",
      "specId": "796827d0",
      "integrationPath": "./frontend/test/zone/group-border-is-thicker-than-a-normal-zone-border.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Group uses the same title structure and title sizing rules as zones",
      "specId": "4801e6c7",
      "integrationPath": "./frontend/test/zone/group-uses-the-same-title-structure-and-title-sizing-rules-as-zones.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Group renders behind regular zones",
      "specId": "85c81d67",
      "integrationPath": "./frontend/test/zone/group-renders-behind-regular-zones.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Group renders behind cards",
      "specId": "0421d906",
      "integrationPath": "./frontend/test/card/group-renders-behind-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Click precedence is currently: card -> regular zone -> group background",
      "specId": "dff19657",
      "integrationPath": "./frontend/test/zone/click-precedence-is-currently-card-regular-zone-group-background.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Clicking a card inside a group targets the card",
      "specId": "d9d57c2c",
      "integrationPath": "./frontend/test/card/clicking-a-card-inside-a-group-targets-the-card.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Clicking a regular zone inside a group targets the zone",
      "specId": "2476bfa1",
      "integrationPath": "./frontend/test/zone/clicking-a-regular-zone-inside-a-group-targets-the-zone.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Clicking exposed group background targets the group",
      "specId": "d2fbfa28",
      "integrationPath": "./frontend/test/group/clicking-exposed-group-background-targets-the-group.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "group"
    },
    {
      "suiteName": "Selecting a group expands selection to cards and zones in the grouped selection scope",
      "specId": "612afeda",
      "integrationPath": "./frontend/test/zone/selecting-a-group-expands-selection-to-cards-and-zones-in-the-grouped-selection-.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Ctrl+click on a group toggles that expanded membership as one unit",
      "specId": "8a05ef46",
      "integrationPath": "./frontend/test/group/ctrl-click-on-a-group-toggles-that-expanded-membership-as-one-unit.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "group"
    },
    {
      "suiteName": "After group selection, dragging a selected inner zone moves the full grouped selection together",
      "specId": "5b918cd3",
      "integrationPath": "./frontend/test/zone/after-group-selection-dragging-a-selected-inner-zone-moves-the-full-grouped-sele.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Group selection participates in the existing mixed-selection drag system",
      "specId": "d4f90f42",
      "integrationPath": "./frontend/test/group/group-selection-participates-in-the-existing-mixed-selection-drag-system.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "group"
    },
    {
      "suiteName": "Groups do not project zone visual theming onto cards",
      "specId": "abad6dcb",
      "integrationPath": "./frontend/test/zone/groups-do-not-project-zone-visual-theming-onto-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "zone"
    },
    {
      "suiteName": "Relationships render as SVG bezier arrows between card borders",
      "specId": "61bea65c",
      "integrationPath": "./frontend/test/card/relationships-render-as-svg-bezier-arrows-between-card-borders.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Arrow markers render in an overlay",
      "specId": "81557a54",
      "integrationPath": "./frontend/test/relationship/arrow-markers-render-in-an-overlay.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "relationship"
    },
    {
      "suiteName": "Arrows attach to the nearest card border side based on source and target geometry",
      "specId": "708a7bfc",
      "integrationPath": "./frontend/test/card/arrows-attach-to-the-nearest-card-border-side-based-on-source-and-target-geometr.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Multiple arrows sharing the same card side use deterministic spread ports instead of stacking",
      "specId": "53dc0295",
      "integrationPath": "./frontend/test/card/multiple-arrows-sharing-the-same-card-side-use-deterministic-spread-ports-instea.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Bidirectional links between the same cards use separated ports",
      "specId": "6f01b700",
      "integrationPath": "./frontend/test/card/bidirectional-links-between-the-same-cards-use-separated-ports.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Relationship labels render near arrow ports and preserve relationship source context",
      "specId": "47237c02",
      "integrationPath": "./frontend/test/relationship/relationship-labels-render-near-arrow-ports-and-preserve-relationship-source-con.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "relationship"
    },
    {
      "suiteName": "Arrows adapt and attach to the better suited card border",
      "specId": "5027f419",
      "integrationPath": "./frontend/test/card/arrows-adapt-and-attach-to-the-better-suited-card-border.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Arrow labels can be hidden per arrow with their own display state",
      "specId": "b200b57e",
      "integrationPath": "./frontend/test/relationship/arrow-labels-can-be-hidden-per-arrow-with-their-own-display-state.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "relationship"
    },
    {
      "suiteName": "card descriptions are parsed and rendered as markdown",
      "specId": "cd58fd49",
      "integrationPath": "./frontend/test/card/card-descriptions-are-parsed-and-rendered-as-markdown.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Arrows should try to avoid colliding with cards",
      "specId": "ba1544b0",
      "integrationPath": "./frontend/test/card/arrows-should-try-to-avoid-colliding-with-cards.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "card"
    },
    {
      "suiteName": "Node 24 native HTTP server",
      "specId": "10e09767",
      "integrationPath": "./backend/test/server/node-24-native-http-server.integration.test.ts",
      "rootBlock": "backend",
      "domain": "server"
    },
    {
      "suiteName": "Backend implementation is TypeScript",
      "specId": "bb69a6f4",
      "integrationPath": "./backend/test/canvas/backend-implementation-is-typescript.integration.test.ts",
      "rootBlock": "backend",
      "domain": "canvas"
    },
    {
      "suiteName": "Browser TypeScript client runtime",
      "specId": "c32e3e5c",
      "integrationPath": "./frontend/test/canvas/browser-typescript-client-runtime.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "Frontend implementation is TypeScript",
      "specId": "f4b6d2a8",
      "integrationPath": "./frontend/test/canvas/frontend-implementation-is-typescript.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "DOM-based canvas rendering",
      "specId": "a9ef20a7",
      "integrationPath": "./frontend/test/canvas/dom-based-canvas-rendering.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "SVG relationship arrow rendering",
      "specId": "f93e1bb7",
      "integrationPath": "./frontend/test/relationship/svg-relationship-arrow-rendering.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "relationship"
    },
    {
      "suiteName": "CSS stylesheet rendering system",
      "specId": "e9469688",
      "integrationPath": "./frontend/test/canvas/css-stylesheet-rendering-system.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "Fetch-based client/server API calls",
      "specId": "e4ed5372",
      "integrationPath": "./backend/test/server/fetch-based-client-server-api-calls.integration.test.ts",
      "rootBlock": "backend",
      "domain": "server"
    },
    {
      "suiteName": "Native fs.watch ledger hot-reload watcher",
      "specId": "94ab097a",
      "integrationPath": "./backend/test/refresh/native-fs-watch-ledger-hot-reload-watcher.integration.test.ts",
      "rootBlock": "backend",
      "domain": "refresh"
    },
    {
      "suiteName": "Node test runner for unit and browser-runtime tests",
      "specId": "ee77191d",
      "integrationPath": "./frontend/test/canvas/node-test-runner-for-unit-and-browser-runtime-tests.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "Playwright for real browser interaction tests",
      "specId": "cef65c97",
      "integrationPath": "./frontend/test/canvas/playwright-for-real-browser-interaction-tests.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "Frameworkless browser client runtime",
      "specId": "3f9dda8e",
      "integrationPath": "./frontend/test/canvas/frameworkless-browser-client-runtime.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "canvas"
    },
    {
      "suiteName": "No bundler-required runtime path",
      "specId": "aba21270",
      "integrationPath": "./frontend/test/navigation/no-bundler-required-runtime-path.integration.test.ts",
      "rootBlock": "frontend",
      "domain": "navigation"
    },
    {
      "suiteName": "OpenAI transcription API for voice note transcription",
      "specId": "31ef718a",
      "integrationPath": "./backend/test/thread/openai-transcription-api-for-voice-note-transcription.integration.test.ts",
      "rootBlock": "backend",
      "domain": "thread"
    },
    {
      "suiteName": "Server tab ledger JSON storage",
      "specId": "5835377e",
      "integrationPath": "./backend/test/navigation/server-tab-ledger-json-storage.integration.test.ts",
      "rootBlock": "backend",
      "domain": "navigation"
    }
  ]
}
```

Reflection:
- The scaffold follows the Root Blocks established in `executor-analysis-26-05-11-1.md`.
- Domain names are derived from Specs, Data Model, Runtime State, and stack output.
- `shared/` is kept as support and does not own controllers.

## A. Domains

```js
[
  { root_block: 'frontend', domain_name: 'boot', description: 'Browser runtime boot, correct surface opening, durable truth restore, transient selection clear, and first-launch modal flow.' },
  { root_block: 'frontend', domain_name: 'navigation', description: 'Route-addressable tabs, browser path derivation, tab registry rendering, tab switching, and navigation persistence.' },
  { root_block: 'frontend', domain_name: 'canvas', description: 'Canvas surface rendering, viewport, dark honeycomb background, pan, zoom, high-performance visible-region card rendering, and canvas continuity.' },
  { root_block: 'frontend', domain_name: 'selection', description: 'Card, zone, group, mixed selection, marquee selection, Ctrl-click selection, copy selection, paste selection, and selection clear.' },
  { root_block: 'frontend', domain_name: 'gesture', description: 'Pointer, keyboard, and wheel gesture interpretation for drag, resize, pan, zoom, selection box, Del, Escape, Enter, and Ctrl shortcuts.' },
  { root_block: 'frontend', domain_name: 'card', description: 'Card rendering, persistent card identity, card position, drag-and-drop, card tab system, markdown descriptions, hash labels, and connected-card highlighting.' },
  { root_block: 'frontend', domain_name: 'zone', description: 'Zone as first-class canvas object with persistent ID, name, color, geometry, notes button, edit panel, delete confirmation, movement, containment, and selected visual state.' },
  { root_block: 'frontend', domain_name: 'group', description: 'Group tool, grouped selection scope, group click precedence, transparent background, title sizing, border, z-order, and mixed-selection drag participation.' },
  { root_block: 'frontend', domain_name: 'relationship', description: 'Relationship SVG overlay rendering, bezier arrows, markers, ports, deterministic spreads, bidirectional links, labels, collision avoidance, and label visibility state.' },
  { root_block: 'frontend', domain_name: 'thread', description: 'Thread primary model UI, card and zone notes, conversation ledger aggregation, operator and assistant history, note creation, and note deletion marker.' },
  { root_block: 'frontend', domain_name: 'voice', description: 'Thread-scoped voice recording UI, duration and level status, optimistic upload, optional transcription status, draft fill, and operator failure surfacing.' },
  { root_block: 'frontend', domain_name: 'refresh', description: 'Server-side refresh event consumption, targeted or full surface refresh, client continuity preservation, and full reload when required.' },
  { root_block: 'frontend', domain_name: 'persistence', description: 'Frontend fetch JSON API boundary for ledger load, ledger edit commit, save status, and restored persisted card and zone geometry.' },
  { root_block: 'frontend', domain_name: 'toolbox', description: 'Core toolbar buttons, zone tool color picker, group tool arming, shortcut help, runbook, conversation ledger, refresh button, and toolbox hover styling.' },
  { root_block: 'backend', domain_name: 'server', description: 'Node 24 native HTTP server, TypeScript backend runtime, and native node:http request lifecycle.' },
  { root_block: 'backend', domain_name: 'routing', description: 'Direct URL slug routes, API route dispatch, route-addressable tab ledger serving, and new persisted ledger route.' },
  { root_block: 'backend', domain_name: 'ledger', description: 'Committed JSON ledger loading, tab registry state, valid ledger indexing, invalid ledger rejection, and server state saved in ./.blueprinttool.' },
  { root_block: 'backend', domain_name: 'persistence', description: 'Ledger edit API validation, JSON file writes, client-originated save tracking, and persisted event records.' },
  { root_block: 'backend', domain_name: 'refresh', description: 'Native fs.watch ledger hot-reload watcher, external edit detection, debounce/idempotence, server refresh event routing, and WebSocket refresh transport.' },
  { root_block: 'backend', domain_name: 'transcription', description: 'Optional configuration-gated voice transcription boundary using OpenAI audio transcription as external HTTP IO; completed transcription persists text and not audio.' }
]
```

Reflection:
- Durable Data Model entities are not copied mechanically into domains. Domains follow behavior ownership.
- `card`, `zone`, `group`, `relationship`, and `thread` overlap with Data Model lifecycles because each owns a coherent behavior family.
- Backend `ledger` and `persistence` are separated because reading/indexing truth and committing edits have different invariants.

## B. Test Suites

```js
[
  { suite_name: 'Core opens the correct surface restores durable truth clears transient selection and renders usable canvas', spec_id: '10000001', root_block: 'frontend', path: './frontend/test/boot/boot-surface.integration.test.ts', expected_telemetry: ['load-ledger-state', 'derive-route-state', 'clear-transient-selection', 'render-canvas-surface'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Switching tabs changes the active surface without corrupting other surface-local truth', spec_id: '10000002', root_block: 'frontend', path: './frontend/test/navigation/navigation-tab-switch.integration.test.ts', expected_telemetry: ['derive-route-state', 'load-ledger-state', 'render-tab-registry'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Zones are first-class canvas objects with persistent ID name color geometry and notes', spec_id: '20000001', root_block: 'frontend', path: './frontend/test/zone/zone-model.integration.test.ts', expected_telemetry: ['validate-zone-draft', 'commit-ledger-edit', 'render-zone-layer'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Zone creation naming color resizing moving containment deletion and persistence paths hold', spec_id: '20000002-20000018', root_block: 'frontend', path: './frontend/test/zone/zone-lifecycle.integration.test.ts', expected_telemetry: ['resolve-tool-mode', 'validate-zone-draft', 'calculate-zone-geometry', 'resolve-zone-selection-membership', 'confirm-zone-deletion', 'commit-ledger-edit', 'render-zone-layer'], input_lists: ['browser-zone-tool-input', 'browser-zone-delete-input'], prev_state: {}, controller_id: 'edit-zone-controller' },
  { suite_name: 'Zone and group browser inputs route commands through runtime controllers before effects', spec_id: '88d069d5-20000002-2000000f-20000010-3fd7a96a', root_block: 'frontend', path: './frontend/test/runtime/input-controller-routing.integration.test.ts', expected_telemetry: ['create-zone-controller', 'create-group-controller', 'confirm-zone-deletion-controller', 'delete-zone-controller', 'edit-region-controller', 'edit-region-color-controller'], input_lists: ['browser-pointer-input', 'browser-keyboard-input', 'browser-action-click-input', 'browser-color-input'], prev_state: {}, controller_id: 'runtime-input-controller-routing' },
  { suite_name: 'Canvas selection pan zoom and render performance paths hold', spec_id: '30000001-30000009', root_block: 'frontend', path: './frontend/test/canvas/canvas-interaction.integration.test.ts', expected_telemetry: ['derive-gesture-intent', 'calculate-marquee-selection', 'calculate-viewport-transform', 'render-canvas-surface', 'render-card-layer'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Invalid actions mixed selection selection clear tool mode and navigation persistence hold', spec_id: '40000002-40000012', root_block: 'frontend', path: './frontend/test/selection/selection-tool-safety.integration.test.ts', expected_telemetry: ['derive-gesture-intent', 'resolve-selection-target', 'clear-transient-selection', 'resolve-tool-mode'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Tab switch refresh marquee escape drawer note create note delete and copy selection hold', spec_id: '50000002-50000016', root_block: 'frontend', path: './frontend/test/thread/thread-and-selection-actions.integration.test.ts', expected_telemetry: ['derive-route-state', 'render-thread-panel', 'commit-ledger-edit', 'copy-selection-payload'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Card identity selection drag persistence tabs notes labels hash IDs and markdown hold', spec_id: '60000001-60000010', root_block: 'frontend', path: './frontend/test/card/card-lifecycle.integration.test.ts', expected_telemetry: ['resolve-selection-target', 'calculate-drag-delta', 'commit-ledger-edit', 'render-card-layer', 'parse-card-markdown'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Server routes serve ledgers accept edits persist JSON create ledgers and index .blueprinttool tabs', spec_id: '70000001-70000007', root_block: 'backend', path: './backend/test/routing/server-ledger-routing.integration.test.ts', expected_telemetry: ['parse-http-request', 'resolve-ledger-route', 'read-ledger-json-file', 'validate-ledger-edit-payload', 'write-ledger-json-file', 'write-blueprinttool-state'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Ledgers in .blueprinttool load as default tabs unless invalid', spec_id: '9c31f0a4', root_block: 'backend', path: './backend/test/ledger/blueprinttool-default-tabs.integration.test.ts', expected_telemetry: ['read-blueprinttool-state', 'read-ledger-json-file', 'validate-ledger-document', 'write-blueprinttool-state'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Zone click Ctrl-click card drag zone drag toolbox and route-addressable tab UI hold', spec_id: 'd5c8ece7-ce0c5d80-61261091-86e67c0e-e0b4d11a-33c20993-676c6a7a-7abd939e-cfed85d3-9f9279ff-93f778a8-3159faad-ac137fe2-51a6af83-12749dcd', root_block: 'frontend', path: './frontend/test/toolbox/toolbox-navigation-zone.integration.test.ts', expected_telemetry: ['resolve-selection-target', 'resolve-tool-mode', 'render-tab-registry', 'render-toolbox'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Threads notes voice recording voice transcription status and transient audio hold', spec_id: 'eaced0c9-667ae9a9-5f8c7152-cc7ed3b4-7984a4f3-d38927c1-747b461e-3d074416-8b1ff788-6cc37b58-040cef84-828e6225-c0c42d20-5c4e5c22-21b2b050-b5a783cd', root_block: 'frontend', path: './frontend/test/voice/voice-thread.integration.test.ts', expected_telemetry: ['render-thread-panel', 'resolve-voice-session', 'capture-voice-audio', 'upload-voice-audio', 'request-transcription', 'fill-thread-draft', 'render-voice-status'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Card hash label visibility and placement hold', spec_id: 'a946fbe0-aa42ff94-4dfbf38c-d0936729', root_block: 'frontend', path: './frontend/test/card/card-labels.integration.test.ts', expected_telemetry: ['render-card-layer'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'External ledger updates trigger server refresh and preserve client continuity when possible', spec_id: 'b7e4dfd1-2e4c6d2b-10f4a4c7-689842e0-929342ae-ac07dc1b-9d1b7c36-0f361538-be4ec9c2', root_block: 'backend', path: './backend/test/refresh/server-refresh.integration.test.ts', expected_telemetry: ['watch-ledger-directory', 'debounce-refresh-event', 'publish-refresh-event', 'read-ledger-json-file'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Client refresh consumes server events and preserves canvas continuity during operator work', spec_id: '10f4a4c7-689842e0-9d1b7c36-be4ec9c2', root_block: 'frontend', path: './frontend/test/refresh/client-refresh.integration.test.ts', expected_telemetry: ['subscribe-server-refresh', 'load-ledger-state', 'merge-refresh-state', 'render-canvas-surface'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Copy paste and group tool group rendering click precedence grouped selection and drag hold', spec_id: '6583c446-53d49146-90d84349-1d444573-796827d0-4801e6c7-85c81d67-0421d906-dff19657-d9d57c2c-2476bfa1-d2fbfa28-612afeda-8a05ef46-5b918cd3-d4f90f42-abad6dcb', root_block: 'frontend', path: './frontend/test/group/group-selection.integration.test.ts', expected_telemetry: ['resolve-tool-mode', 'resolve-group-membership', 'resolve-click-precedence', 'calculate-drag-delta', 'commit-ledger-edit', 'render-group-layer'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Relationship arrows SVG markers ports labels collision avoidance and markdown descriptions hold', spec_id: '61bea65c-81557a54-708a7bfc-53dc0295-6f01b700-47237c02-5027f419-b200b57e-cd58fd49-ba1544b0', root_block: 'frontend', path: './frontend/test/relationship/relationship-rendering.integration.test.ts', expected_telemetry: ['calculate-relationship-ports', 'route-relationship-path', 'render-relationship-overlay', 'parse-card-markdown'], input_lists: [], prev_state: {}, controller_id: '' },
  { suite_name: 'Frontend backend stack implementation directions hold', spec_id: '10e09767-bb69a6f4-c32e3e5c-f4b6d2a8-a9ef20a7-f93e1bb7-e9469688-e4ed5372-94ab097a-ee77191d-cef65c97-3f9dda8e-aba21270-31ef718a-5835377e', root_block: 'backend', path: './backend/test/server/front-back-stack-contracts.integration.test.ts', expected_telemetry: ['create-http-server', 'parse-http-request', 'read-ledger-json-file', 'publish-refresh-event'], input_lists: [], prev_state: {}, controller_id: '' }
]
```

Reflection:
- This scoped frontend/backend ledger groups strongly related Spec cards into executable suites where the same controller path proves multiple truth constraints.
- Archi-generator-only Spec cards are intentionally not remapped here because the existing `archi-generator` Master Ledger owns that Root Block.
- Every frontend/backend suite has at least one input path and observable telemetry.

## C. Inputs

```js
[
  { root_block: 'frontend', input_name: 'browser-load', input_type: 'browser:load' },
  { root_block: 'frontend', input_name: 'browser-route-change', input_type: 'browser:popstate' },
  { root_block: 'frontend', input_name: 'tab-click', input_type: 'operator:click' },
  { root_block: 'frontend', input_name: 'tool-button-click', input_type: 'operator:click' },
  { root_block: 'frontend', input_name: 'canvas-pointer-down', input_type: 'operator:pointer' },
  { root_block: 'frontend', input_name: 'canvas-pointer-move', input_type: 'operator:pointer' },
  { root_block: 'frontend', input_name: 'canvas-pointer-up', input_type: 'operator:pointer' },
  { root_block: 'frontend', input_name: 'canvas-wheel', input_type: 'operator:wheel' },
  { root_block: 'frontend', input_name: 'keyboard-shortcut', input_type: 'operator:keyboard' },
  { root_block: 'frontend', input_name: 'thread-panel-submit', input_type: 'operator:form' },
  { root_block: 'frontend', input_name: 'voice-record-start', input_type: 'operator:click' },
  { root_block: 'frontend', input_name: 'voice-record-stop', input_type: 'operator:click' },
  { root_block: 'frontend', input_name: 'server-refresh-message', input_type: 'server:websocket' },
  { root_block: 'backend', input_name: 'http-request', input_type: 'server:http' },
  { root_block: 'backend', input_name: 'ledger-file-watch-event', input_type: 'server:fs-watch' },
  { root_block: 'backend', input_name: 'transcription-provider-response', input_type: 'server:http-response' }
]
```

Reflection:
- Frontend inputs cover browser load, route, pointer, wheel, keyboard, toolbar, thread, voice, and server refresh paths.
- Backend inputs cover HTTP route/API, file watcher refresh, and optional transcription IO response.

## D. Operator Inputs

```js
{
  left_click: false,
  ctrl_key: false,
  shift_key: false,
  escape_key: false,
  enter_key: false,
  delete_key: false,
  wheel_delta_x: 0,
  wheel_delta_y: 0,
  pointer_x: 0,
  pointer_y: 0,
  active_tool: 'select',
  active_route_path: '/',
  active_thread_draft: '',
  voice_recording_requested: false
}
```

Reflection:
- Operator inputs are frontend-only runtime state seeds.
- Backend has no operator input state.

## E. Effects and I/O Helpers

```js
[
  { type: 'helper', root_block: 'frontend', domain: 'boot', name: 'load-ledger-state', description: 'Fetches the committed JSON ledger for the active route and normalizes Ledger, NavTab, Canvas, Card, Zone, Group, Relationship, Viewport, Thread, and Message data into frontend runtime state.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'navigation', name: 'derive-route-state', description: 'Reads browser path and tab registry state to derive RouteState activeNavTabId, activeCanvasId, availableNavTabIds, and pendingRoute.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'selection', name: 'clear-transient-selection', description: 'Resets SelectionState, GestureState, HoverState, ModalState, and temporary tool state without mutating durable ledger data.', return_type: 'unknown' },
  { type: 'effect', root_block: 'frontend', domain: 'canvas', name: 'render-canvas-surface', description: 'Patches the browser DOM canvas shell, background, viewport transform, card layer, zone layer, group layer, relationship overlay, toolbox, navbar, modals, and thread panel.', return_type: 'void' },
  { type: 'effect', root_block: 'frontend', domain: 'navigation', name: 'render-tab-registry', description: 'Patches the navbar DOM so all NavTab records from server state are visible and route-addressable.', return_type: 'void' },
  { type: 'helper', root_block: 'frontend', domain: 'gesture', name: 'derive-gesture-intent', description: 'Converts pointer, keyboard, wheel, and active ToolState input into a drag, resize, marquee, pan, zoom, delete, copy, paste, open-thread, voice, or no-op intent.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'selection', name: 'resolve-selection-target', description: 'Applies click precedence card to regular zone to group background and resolves selected cardIds, zoneIds, groupIds, anchorId, and selectionSource.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'selection', name: 'calculate-marquee-selection', description: 'Uses marqueeRect and graph geometry to collect cards, zones, and groups inside the selection region.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'canvas', name: 'calculate-viewport-transform', description: 'Computes Viewport scale and pan translation for naked canvas drag, unselected zone drag pan, wheel zoom, and Ctrl wheel viewport movement.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'gesture', name: 'calculate-drag-delta', description: 'Computes card, zone, group, and grouped-selection movement deltas from pointerStart and pointerCurrent.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'zone', name: 'validate-zone-draft', description: 'Validates zone title, color, geometry, target thread, and persistent hash identity before a zone ledger edit is committed.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'zone', name: 'calculate-zone-geometry', description: 'Computes zone position, width, height, resize corner behavior, containment intersections, and zoom-independent label presentation.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'zone', name: 'resolve-zone-selection-membership', description: 'Finds all cards intersecting a zone and applies normal-click replacement or Ctrl-click additive behavior.', return_type: 'unknown' },
  { type: 'effect', root_block: 'frontend', domain: 'persistence', name: 'commit-ledger-edit', description: 'Sends a JSON edit payload to backend ledger edit API with browser fetch and updates PersistenceState from the response.', return_type: 'void' },
  { type: 'effect', root_block: 'frontend', domain: 'zone', name: 'render-zone-layer', description: 'Patches DOM zones behind cards with selected white glow, resize handles, color, label, edit button, and notes button.', return_type: 'void' },
  { type: 'helper', root_block: 'frontend', domain: 'zone', name: 'confirm-zone-deletion', description: 'Reads ModalState and keyboard shortcut state to accept or cancel zone deletion without deleting intersecting Card records.', return_type: 'unknown' },
  { type: 'effect', root_block: 'frontend', domain: 'card', name: 'render-card-layer', description: 'Patches DOM cards, open-card z-index, hash ID labels, selected glow, markdown description content, and connected-card highlight classes.', return_type: 'void' },
  { type: 'helper', root_block: 'frontend', domain: 'card', name: 'parse-card-markdown', description: 'Parses Card description markdown into renderable safe DOM content for card bodies and descriptions.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'group', name: 'resolve-group-membership', description: 'Expands group selection into cards and zones inside the grouped selection scope and keeps the expanded membership as one unit for Ctrl-click and drag.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'group', name: 'resolve-click-precedence', description: 'Determines whether an overlapping pointer target is a card, regular zone, or exposed group background.', return_type: 'unknown' },
  { type: 'effect', root_block: 'frontend', domain: 'group', name: 'render-group-layer', description: 'Patches DOM groups behind regular zones and cards with transparent background, thicker border, and zone-like title structure.', return_type: 'void' },
  { type: 'helper', root_block: 'frontend', domain: 'relationship', name: 'calculate-relationship-ports', description: 'Computes sourceSide, targetSide, sourcePortSlot, targetPortSlot, and deterministic spread ports from Relationship endpoints and card/group/zone geometry.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'relationship', name: 'route-relationship-path', description: 'Computes SVG bezier path, marker attachment, labelPoint, side adaptation, and collision avoidance for relationship arrows.', return_type: 'unknown' },
  { type: 'effect', root_block: 'frontend', domain: 'relationship', name: 'render-relationship-overlay', description: 'Patches SVG overlay paths, markers, labels, ports, and per-arrow label visibility.', return_type: 'void' },
  { type: 'effect', root_block: 'frontend', domain: 'thread', name: 'render-thread-panel', description: 'Patches the right panel thread drawer, message history, note composer, deletion marker visibility, and conversation ledger aggregation.', return_type: 'void' },
  { type: 'helper', root_block: 'frontend', domain: 'thread', name: 'resolve-thread-target', description: 'Finds the Thread attached to the selected Card or Zone target and maps ThreadPanelState targetId and targetKind.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'voice', name: 'resolve-voice-session', description: 'Ensures voice recording is thread-scoped, only one recording is active, and status belongs to VoiceState for the active Thread.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'voice', name: 'capture-voice-audio', description: 'Uses browser recording APIs to collect transient audio, live duration, and level telemetry for one active thread.', return_type: 'unknown' },
  { type: 'effect', root_block: 'frontend', domain: 'voice', name: 'upload-voice-audio', description: 'Uploads transient audio through fetch for optional transcription and updates uploadStatus optimistically.', return_type: 'void' },
  { type: 'effect', root_block: 'frontend', domain: 'voice', name: 'request-transcription', description: 'Requests backend transcription status only when transcription is configured; otherwise renders a disabled grey control with tooltip text.', return_type: 'void' },
  { type: 'effect', root_block: 'frontend', domain: 'voice', name: 'fill-thread-draft', description: 'Writes completed transcribed text into DraftState for the active thread without durably storing voice audio.', return_type: 'void' },
  { type: 'effect', root_block: 'frontend', domain: 'voice', name: 'render-voice-status', description: 'Patches UI status for recording, duration, level, upload, transcription, failure, and configuration-gated disabled state.', return_type: 'void' },
  { type: 'effect', root_block: 'frontend', domain: 'refresh', name: 'subscribe-server-refresh', description: 'Subscribes to backend WebSocket refresh events and creates frontend refresh actions for target surface or all surfaces.', return_type: 'void' },
  { type: 'helper', root_block: 'frontend', domain: 'refresh', name: 'merge-refresh-state', description: 'Merges refreshed persisted ledger truth with live client interaction state when possible or selects full reload when required.', return_type: 'unknown' },
  { type: 'effect', root_block: 'frontend', domain: 'toolbox', name: 'render-toolbox', description: 'Patches toolbar buttons, zone drawing button, group tool, shortcut help, runbook button, conversation ledger button, refresh button, transparent background, hover animation, and color picker.', return_type: 'void' },
  { type: 'helper', root_block: 'frontend', domain: 'toolbox', name: 'resolve-tool-mode', description: 'Updates ToolState activeTool, zoneColor, and isColorPickerOpen from toolbar input and restores normal selection behavior after tool exit.', return_type: 'unknown' },
  { type: 'helper', root_block: 'frontend', domain: 'selection', name: 'copy-selection-payload', description: 'Serializes selected cards, zones, relationships, and sourceCanvasId into ClipboardState payload for Ctrl+C and paste.', return_type: 'unknown' },
  { type: 'helper', root_block: 'backend', domain: 'server', name: 'create-http-server', description: 'Creates a Node 24 native http.Server with node:http createServer and routes request events through Core server modules.', return_type: 'unknown' },
  { type: 'helper', root_block: 'backend', domain: 'routing', name: 'parse-http-request', description: 'Parses method, URL slug, JSON payload, route parameters, and request body from native HTTP requests.', return_type: 'unknown' },
  { type: 'helper', root_block: 'backend', domain: 'routing', name: 'resolve-ledger-route', description: 'Maps direct URL slug and API path to NavTab, Ledger, edit route, create route, voice upload route, or not-found branch.', return_type: 'unknown' },
  { type: 'helper', root_block: 'backend', domain: 'ledger', name: 'read-blueprinttool-state', description: 'Reads ./.blueprinttool server state and lists ledger files that should become default tabs.', return_type: 'unknown' },
  { type: 'helper', root_block: 'backend', domain: 'ledger', name: 'read-ledger-json-file', description: 'Reads committed JSON ledger files and decodes Ledger, NavTab, Canvas, Card, Zone, Group, Relationship, Viewport, Thread, Message, and Event records.', return_type: 'unknown' },
  { type: 'helper', root_block: 'backend', domain: 'ledger', name: 'validate-ledger-document', description: 'Validates durable ledger shape and rejects invalid ledgers without corrupting server state.', return_type: 'unknown' },
  { type: 'helper', root_block: 'backend', domain: 'persistence', name: 'validate-ledger-edit-payload', description: 'Validates JSON edit payloads for ledger mutations before writing any file.', return_type: 'unknown' },
  { type: 'effect', root_block: 'backend', domain: 'persistence', name: 'write-ledger-json-file', description: 'Writes committed JSON ledger edits to disk and persists updated ledger revision or event state.', return_type: 'void' },
  { type: 'effect', root_block: 'backend', domain: 'ledger', name: 'write-blueprinttool-state', description: 'Writes ./.blueprinttool tab registry server state after boot indexing or new ledger creation.', return_type: 'void' },
  { type: 'effect', root_block: 'backend', domain: 'routing', name: 'send-json-response', description: 'Sends HTTP JSON responses for ledger reads, edits, new ledger creation, errors, and transcription responses.', return_type: 'void' },
  { type: 'helper', root_block: 'backend', domain: 'refresh', name: 'watch-ledger-directory', description: 'Uses native fs.watch to observe ledger directory changes while tolerating duplicate, missing, or coarse-grained events.', return_type: 'unknown' },
  { type: 'helper', root_block: 'backend', domain: 'refresh', name: 'debounce-refresh-event', description: 'Coalesces watcher events and prevents redundant client refresh for client-originated ledger edits.', return_type: 'unknown' },
  { type: 'effect', root_block: 'backend', domain: 'refresh', name: 'publish-refresh-event', description: 'Publishes targeted or all-surface refresh messages over the backend WebSocket transport.', return_type: 'void' },
  { type: 'helper', root_block: 'backend', domain: 'transcription', name: 'resolve-transcription-config', description: 'Checks whether the optional OpenAI transcription API key and provider configuration are available.', return_type: 'unknown' },
  { type: 'effect', root_block: 'backend', domain: 'transcription', name: 'call-openai-transcription', description: 'Calls OpenAI audio transcription as optional external HTTP IO for voice note transcription only when configured.', return_type: 'void' },
  { type: 'effect', root_block: 'backend', domain: 'transcription', name: 'persist-transcribed-text', description: 'Persists completed transcription as thread text and prevents durable storage of the transient voice audio file.', return_type: 'void' }
]
```

Reflection:
- Every telemetry event in the test suites maps to a helper or effect here.
- Helpers contain implementation details; effects are final output calls.

## F. Screens || Pages

```js
[
  { root_block: 'frontend', screen_name: 'canvas', description: 'Primary operator surface showing navbar, toolbox, canvas graph, cards, zones, groups, relationships, modals, and thread panel.', components: ['navbar', 'toolbox', 'canvas-stage', 'card-node', 'zone-node', 'group-node', 'relationship-overlay', 'thread-panel', 'confirmation-modal', 'first-launch-modal', 'notification-region'] },
  { root_block: 'frontend', screen_name: 'thread-panel', description: 'Right panel surface for card or zone thread history, draft entry, note create/delete, voice recording controls, and transcription status.', components: ['thread-panel', 'message-list', 'draft-composer', 'voice-control', 'notification-region'] }
]
```

Reflection:
- `canvas` is the primary screen because Specs are canvas-first.
- `thread-panel` is listed as a screen surface because it owns a dense operator workflow, while still being rendered inside the canvas shell.

## G. Components

```js
[
  { root_block: 'frontend', screen_name: 'canvas', name: 'navbar', parent_component: null, description: 'Shows route-addressable NavTab records and active tab state.', local_state: [], runtime_state: ['RouteState'], helpers: ['derive-route-state'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'toolbox', parent_component: null, description: 'Shows zone, group, shortcut help, runbook, conversation ledger, refresh buttons, color picker, transparent background, and hover state.', local_state: ['hovered'], runtime_state: ['ToolState'], helpers: ['resolve-tool-mode'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'canvas-stage', parent_component: null, description: 'Shows dark honeycomb canvas background and viewport-transformed graph layers.', local_state: [], runtime_state: ['CanvasState', 'Viewport', 'GestureState', 'RefreshState'], helpers: ['calculate-viewport-transform'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'card-node', parent_component: null, description: 'Shows one Card with tabs, labels, markdown body, selected glow, connected-card highlight, and open-card z-index.', local_state: [], runtime_state: ['CardUIState', 'SelectionState', 'HoverState'], helpers: ['parse-card-markdown'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'zone-node', parent_component: null, description: 'Shows one Zone behind cards with color, label, notes button, edit button, selected glow, and resize handles.', local_state: [], runtime_state: ['SelectionState', 'ToolState', 'ModalState'], helpers: ['calculate-zone-geometry'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'group-node', parent_component: null, description: 'Shows one Group behind regular zones and cards with transparent background, thicker border, and title structure matching zones.', local_state: [], runtime_state: ['SelectionState'], helpers: ['resolve-group-membership'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'relationship-overlay', parent_component: null, description: 'Shows SVG bezier arrows, markers, spread ports, labels, and hidden-label state.', local_state: [], runtime_state: ['RelationshipRenderState', 'CanvasState'], helpers: ['calculate-relationship-ports', 'route-relationship-path'] },
  { root_block: 'frontend', screen_name: 'thread-panel', name: 'thread-panel', parent_component: null, description: 'Shows selected card or zone thread drawer and conversation ledger aggregation.', local_state: [], runtime_state: ['ThreadPanelState', 'DraftState', 'VoiceState'], helpers: ['resolve-thread-target'] },
  { root_block: 'frontend', screen_name: 'thread-panel', name: 'message-list', parent_component: null, description: 'Shows operator and assistant message history while hiding deleted messages marked by deletion events.', local_state: [], runtime_state: ['ThreadPanelState'], helpers: ['resolve-thread-target'] },
  { root_block: 'frontend', screen_name: 'thread-panel', name: 'draft-composer', parent_component: null, description: 'Shows active thread draft and note submit control.', local_state: ['draftInput'], runtime_state: ['DraftState'], helpers: ['resolve-thread-target'] },
  { root_block: 'frontend', screen_name: 'thread-panel', name: 'voice-control', parent_component: null, description: 'Shows voice recording start stop disabled state tooltip duration level upload transcription and failure status.', local_state: [], runtime_state: ['VoiceState'], helpers: ['resolve-voice-session'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'confirmation-modal', parent_component: null, description: 'Shows zone deletion confirmation and handles Escape and Enter keyboard decisions.', local_state: [], runtime_state: ['ModalState'], helpers: ['confirm-zone-deletion'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'first-launch-modal', parent_component: null, description: 'Shows default tab name input when ./.blueprinttool is missing or has zero valid ledgers.', local_state: ['tabNameDraft'], runtime_state: ['ModalState'], helpers: ['derive-route-state'] },
  { root_block: 'frontend', screen_name: 'canvas', name: 'notification-region', parent_component: null, description: 'Shows transient operator notifications for save, refresh, voice, route, and validation failures.', local_state: [], runtime_state: ['NotificationState'], helpers: [] }
]
```

Reflection:
- Components are presentation boundaries and do not own business logic.
- Shared repeated UI is factorized by component name instead of duplicated per Spec card.

## H. State

```js
[
  { root_block: 'frontend', name: 'ROOT', domain: 'boot', props: ['RouteState', 'CanvasState', 'SelectionState', 'GestureState', 'HoverState', 'CardUIState', 'ToolState', 'ThreadPanelState', 'DraftState', 'VoiceState', 'ModalState', 'NotificationState', 'RefreshState', 'PersistenceState', 'ClipboardState', 'RelationshipRenderState'] },
  { root_block: 'frontend', name: 'RouteState', domain: 'navigation', props: ['routePath', 'activeNavTabId', 'activeCanvasId', 'availableNavTabIds', 'pendingRoute'] },
  { root_block: 'frontend', name: 'CanvasState', domain: 'canvas', props: ['canvasId', 'cardIds', 'zoneIds', 'groupIds', 'relationshipIds', 'viewportId', 'revision'] },
  { root_block: 'frontend', name: 'SelectionState', domain: 'selection', props: ['cardIds', 'zoneIds', 'groupIds', 'anchorId', 'selectionSource'] },
  { root_block: 'frontend', name: 'GestureState', domain: 'gesture', props: ['intent', 'targetId', 'targetKind', 'pointerStart', 'pointerCurrent', 'marqueeRect', 'resizeHandle'] },
  { root_block: 'frontend', name: 'HoverState', domain: 'canvas', props: ['cardId', 'zoneId', 'groupId', 'relationshipId'] },
  { root_block: 'frontend', name: 'CardUIState', domain: 'card', props: ['openCardIds', 'topCardId', 'activeTabByCardId', 'hashIdVisibleCardId'] },
  { root_block: 'frontend', name: 'ToolState', domain: 'toolbox', props: ['activeTool', 'zoneColor', 'isColorPickerOpen'] },
  { root_block: 'frontend', name: 'ThreadPanelState', domain: 'thread', props: ['isOpen', 'threadId', 'targetId', 'targetKind'] },
  { root_block: 'frontend', name: 'DraftState', domain: 'thread', props: ['threadId', 'body', 'status'] },
  { root_block: 'frontend', name: 'VoiceState', domain: 'voice', props: ['threadId', 'voiceFileRef', 'recordingStatus', 'durationMs', 'level', 'uploadStatus', 'transcriptionStatus', 'localMessageId'] },
  { root_block: 'frontend', name: 'ModalState', domain: 'zone', props: ['modalKind', 'targetId', 'draftValue', 'confirmAction'] },
  { root_block: 'frontend', name: 'NotificationState', domain: 'boot', props: ['level', 'message', 'eventId'] },
  { root_block: 'frontend', name: 'RefreshState', domain: 'refresh', props: ['surfaceId', 'mode', 'updatedAt', 'source'] },
  { root_block: 'frontend', name: 'PersistenceState', domain: 'persistence', props: ['pendingSaveReason', 'pendingSurfaceId', 'lastSavedAt', 'lastSaveError'] },
  { root_block: 'frontend', name: 'ClipboardState', domain: 'selection', props: ['cardIds', 'zoneIds', 'relationshipIds', 'sourceCanvasId', 'payload', 'copiedAt'] },
  { root_block: 'frontend', name: 'RelationshipRenderState', domain: 'relationship', props: ['relationshipId', 'sourceSide', 'targetSide', 'sourcePortSlot', 'targetPortSlot', 'path', 'labelPoint', 'selected'] }
]
```

Reflection:
- Backend state is durable server data and not a frontend-style runtime state machine.
- Local-only component props such as `hovered`, `draftInput`, and `tabNameDraft` do not leak into global runtime state.

## I. Control-Flow Entries

```js
[
  {
    root_block: 'frontend',
    domain: 'boot',
    controller: 'boot-surface-controller',
    description: 'Open the correct route-addressable surface, restore durable truth, clear transient selection, and render the usable canvas.',
    action_payload: ['browser-load', 'active_route_path'],
    helpers: ['derive-route-state', 'load-ledger-state', 'clear-transient-selection'],
    effects: ['render-tab-registry', 'render-canvas-surface'],
    pseudoCode: `async function bootSurfaceController({ action_payload, runtime_state, data_model }: { action_payload: { browser_load: true; active_route_path: string }; runtime_state: { RouteState: object; SelectionState: object; ModalState: object }; data_model: { Ledger: object | null; NavTab: object[] } }) {
  telemetry('boot-surface-controller-started')
  // WHAT: Derive the route before loading ledger truth.
  // WHY: The active route chooses the surface and tab to restore.
  // HOW: RouteState is resolved from browser path and server tab registry.
  const route_state = deriveRouteState()
  if (!route_state.activeNavTabId) {
    telemetry('boot-surface-first-launch-required')
    renderCanvasSurface()
    return
  }
  const ledger_state = await loadLedgerState()
  if (!ledger_state.ok) {
    telemetry('boot-surface-ledger-load-failed')
    renderCanvasSurface()
    return
  }
  clearTransientSelection()
  renderTabRegistry()
  renderCanvasSurface()
  telemetry('boot-surface-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'navigation',
    controller: 'navigate-tab-controller',
    description: 'Switch route-addressable tabs while preserving each surface-local truth.',
    action_payload: ['tab-click', 'browser-route-change', 'routePath'],
    helpers: ['derive-route-state', 'load-ledger-state'],
    effects: ['render-tab-registry', 'render-canvas-surface'],
    pseudoCode: `async function navigateTabController({ action_payload, runtime_state, data_model }: { action_payload: { routePath: string }; runtime_state: { RouteState: object; CanvasState: object }; data_model: { NavTab: object[]; Ledger: object[] } }) {
  telemetry('navigate-tab-controller-started')
  // WHAT: Resolve the requested tab from the browser route.
  // WHY: Tabs are route-addressable and active tab is derived from path.
  // HOW: Load only the new active surface and leave other surface-local truth untouched.
  const route_state = deriveRouteState()
  if (!route_state.activeCanvasId) {
    telemetry('navigate-tab-route-missing')
    renderTabRegistry()
    return
  }
  await loadLedgerState()
  renderTabRegistry()
  renderCanvasSurface()
  telemetry('navigate-tab-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'gesture',
    controller: 'handle-canvas-gesture-controller',
    description: 'Route pointer, wheel, and keyboard gestures into selection, pan, zoom, drag, resize, delete, copy, paste, and tool behavior.',
    action_payload: ['canvas-pointer-down', 'canvas-pointer-move', 'canvas-pointer-up', 'canvas-wheel', 'keyboard-shortcut'],
    helpers: ['derive-gesture-intent', 'resolve-selection-target', 'calculate-marquee-selection', 'calculate-viewport-transform', 'calculate-drag-delta', 'copy-selection-payload'],
    effects: ['render-canvas-surface', 'commit-ledger-edit'],
    pseudoCode: `async function handleCanvasGestureController({ action_payload, runtime_state, data_model }: { action_payload: { inputName: string; pointer?: object; key?: string; wheel?: object }; runtime_state: { GestureState: object; SelectionState: object; ToolState: object; CanvasState: object }; data_model: { Card: object[]; Zone: object[]; Group: object[] } }) {
  telemetry('handle-canvas-gesture-controller-started')
  // WHAT: Interpret raw browser input as one canvas intent.
  // WHY: Invalid partial gestures must not create broken durable state.
  // HOW: Branch on derived intent and use helpers before effects.
  const intent = deriveGestureIntent()
  if (intent.kind === 'invalid') {
    telemetry('handle-canvas-gesture-invalid')
    renderCanvasSurface()
    return
  }
  if (intent.kind === 'select') resolveSelectionTarget()
  if (intent.kind === 'marquee') calculateMarqueeSelection()
  if (intent.kind === 'pan' || intent.kind === 'zoom') calculateViewportTransform()
  if (intent.kind === 'drag') {
    calculateDragDelta()
    await commitLedgerEdit()
  }
  if (intent.kind === 'copy' || intent.kind === 'paste') copySelectionPayload()
  renderCanvasSurface()
  telemetry('handle-canvas-gesture-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'zone',
    controller: 'edit-zone-controller',
    description: 'Create, draw, name, color, resize, move, select, persist, and delete zones without deleting intersecting cards.',
    action_payload: ['tool-button-click', 'canvas-pointer-down', 'canvas-pointer-move', 'canvas-pointer-up', 'keyboard-shortcut'],
    helpers: ['resolve-tool-mode', 'validate-zone-draft', 'calculate-zone-geometry', 'resolve-zone-selection-membership', 'confirm-zone-deletion'],
    effects: ['commit-ledger-edit', 'render-zone-layer', 'render-canvas-surface'],
    pseudoCode: `async function editZoneController({ action_payload, runtime_state, data_model }: { action_payload: { zoneIntent: string; targetId?: string }; runtime_state: { ToolState: object; ModalState: object; SelectionState: object }; data_model: { Zone: object[]; Card: object[] } }) {
  telemetry('edit-zone-controller-started')
  // WHAT: Protect the Zone lifecycle before committing edits.
  // WHY: Zones are primary models and deletion must not delete intersecting cards.
  // HOW: Validate draft, compute geometry, confirm destructive branches, then persist.
  const tool_mode = resolveToolMode()
  const zone_draft = validateZoneDraft()
  if (!zone_draft.ok) {
    telemetry('edit-zone-draft-rejected')
    renderZoneLayer()
    return
  }
  calculateZoneGeometry()
  resolveZoneSelectionMembership()
  if (action_payload.zoneIntent === 'delete') {
    const confirmed = confirmZoneDeletion()
    if (!confirmed) {
      telemetry('edit-zone-delete-cancelled')
      renderZoneLayer()
      return
    }
  }
  await commitLedgerEdit()
  renderZoneLayer()
  renderCanvasSurface()
  telemetry('edit-zone-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'card',
    controller: 'edit-card-controller',
    description: 'Select, drag, persist, render, open, tab, label, hash ID, markdown, and connected-card card behavior.',
    action_payload: ['canvas-pointer-down', 'canvas-pointer-move', 'canvas-pointer-up', 'keyboard-shortcut'],
    helpers: ['resolve-selection-target', 'calculate-drag-delta', 'parse-card-markdown'],
    effects: ['commit-ledger-edit', 'render-card-layer', 'render-canvas-surface'],
    pseudoCode: `async function editCardController({ action_payload, runtime_state, data_model }: { action_payload: { cardIntent: string; cardId?: string }; runtime_state: { CardUIState: object; SelectionState: object; GestureState: object }; data_model: { Card: object[]; Relationship: object[] } }) {
  telemetry('edit-card-controller-started')
  // WHAT: Route card UI and durable card edits through one operation family.
  // WHY: Card identity and position must remain persistent while UI state stays transient.
  // HOW: Select first, calculate drag when needed, parse markdown for render, then commit only durable edits.
  resolveSelectionTarget()
  if (action_payload.cardIntent === 'drag') {
    calculateDragDelta()
    await commitLedgerEdit()
  }
  parseCardMarkdown()
  renderCardLayer()
  renderCanvasSurface()
  telemetry('edit-card-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'group',
    controller: 'edit-group-controller',
    description: 'Arm group tool, target group background, expand group selection, Ctrl-toggle membership, and drag grouped selection.',
    action_payload: ['tool-button-click', 'canvas-pointer-down', 'canvas-pointer-move', 'canvas-pointer-up', 'keyboard-shortcut'],
    helpers: ['resolve-tool-mode', 'resolve-click-precedence', 'resolve-group-membership', 'calculate-drag-delta'],
    effects: ['commit-ledger-edit', 'render-group-layer', 'render-canvas-surface'],
    pseudoCode: `async function editGroupController({ action_payload, runtime_state, data_model }: { action_payload: { groupIntent: string }; runtime_state: { ToolState: object; SelectionState: object; GestureState: object }; data_model: { Group: object[]; Zone: object[]; Card: object[] } }) {
  telemetry('edit-group-controller-started')
  // WHAT: Keep group behavior compatible with mixed-selection drag.
  // WHY: Groups must not override card or regular zone click precedence.
  // HOW: Resolve click precedence, expand membership, then apply group action.
  resolveToolMode()
  const target = resolveClickPrecedence()
  if (target.kind !== 'group' && action_payload.groupIntent === 'select') {
    telemetry('edit-group-not-targeted')
    renderGroupLayer()
    return
  }
  resolveGroupMembership()
  if (action_payload.groupIntent === 'drag') {
    calculateDragDelta()
    await commitLedgerEdit()
  }
  renderGroupLayer()
  renderCanvasSurface()
  telemetry('edit-group-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'relationship',
    controller: 'render-relationship-controller',
    description: 'Compute and render SVG relationship arrows between graph object borders with ports, markers, labels, and collision avoidance.',
    action_payload: ['browser-load', 'canvas-pointer-move', 'server-refresh-message'],
    helpers: ['calculate-relationship-ports', 'route-relationship-path'],
    effects: ['render-relationship-overlay'],
    pseudoCode: `async function renderRelationshipController({ action_payload, runtime_state, data_model }: { action_payload: { renderReason: string }; runtime_state: { RelationshipRenderState: object; CanvasState: object; SelectionState: object }; data_model: { Relationship: object[]; Card: object[]; Zone: object[]; Group: object[] } }) {
  telemetry('render-relationship-controller-started')
  // WHAT: Recompute view-dependent arrow state from durable relationships.
  // WHY: RelationshipRenderState is runtime state and should not be persisted as authored truth.
  // HOW: Calculate ports and paths, then patch SVG overlay.
  calculateRelationshipPorts()
  routeRelationshipPath()
  renderRelationshipOverlay()
  telemetry('render-relationship-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'thread',
    controller: 'edit-thread-controller',
    description: 'Open card or zone threads, aggregate conversation ledger history, create notes, and append note deletion markers.',
    action_payload: ['thread-panel-submit', 'tool-button-click', 'keyboard-shortcut'],
    helpers: ['resolve-thread-target'],
    effects: ['commit-ledger-edit', 'render-thread-panel'],
    pseudoCode: `async function editThreadController({ action_payload, runtime_state, data_model }: { action_payload: { threadIntent: string; body?: string; messageId?: string }; runtime_state: { ThreadPanelState: object; DraftState: object }; data_model: { Thread: object[]; Message: object[] } }) {
  telemetry('edit-thread-controller-started')
  // WHAT: Attach notes to the selected card or zone target.
  // WHY: Threads are primary models and preserve operator and assistant history.
  // HOW: Resolve target thread, commit note or deletion marker, and render the panel.
  const thread = resolveThreadTarget()
  if (!thread) {
    telemetry('edit-thread-target-missing')
    renderThreadPanel()
    return
  }
  if (action_payload.threadIntent === 'create-note' || action_payload.threadIntent === 'delete-note') {
    await commitLedgerEdit()
  }
  renderThreadPanel()
  telemetry('edit-thread-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'voice',
    controller: 'record-voice-controller',
    description: 'Record one thread-scoped voice note, show live status, upload optimistically, request optional transcription, and fill the active draft.',
    action_payload: ['voice-record-start', 'voice-record-stop'],
    helpers: ['resolve-voice-session', 'capture-voice-audio'],
    effects: ['upload-voice-audio', 'request-transcription', 'fill-thread-draft', 'render-voice-status'],
    pseudoCode: `async function recordVoiceController({ action_payload, runtime_state, data_model }: { action_payload: { voiceIntent: 'start' | 'stop' }; runtime_state: { VoiceState: object; ThreadPanelState: object; DraftState: object }; data_model: { Thread: object[]; Message: object[] } }) {
  telemetry('record-voice-controller-started')
  // WHAT: Keep voice recording scoped to one active thread.
  // WHY: Only one voice recording is active and audio is transient until transcription completes.
  // HOW: Resolve session, capture audio, upload when stopped, then fill draft from completed transcript.
  const session = resolveVoiceSession()
  if (!session.ok) {
    telemetry('record-voice-session-rejected')
    renderVoiceStatus()
    return
  }
  captureVoiceAudio()
  if (action_payload.voiceIntent === 'stop') {
    uploadVoiceAudio()
    requestTranscription()
    fillThreadDraft()
  }
  renderVoiceStatus()
  telemetry('record-voice-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'refresh',
    controller: 'handle-client-refresh-controller',
    description: 'Consume backend refresh messages, target one or all surfaces, reload persisted truth, and preserve live interaction state when possible.',
    action_payload: ['server-refresh-message'],
    helpers: ['load-ledger-state', 'merge-refresh-state'],
    effects: ['subscribe-server-refresh', 'render-canvas-surface'],
    pseudoCode: `async function handleClientRefreshController({ action_payload, runtime_state, data_model }: { action_payload: { surfaceId?: string; mode: 'target' | 'all' | 'full-reload' }; runtime_state: { RefreshState: object; GestureState: object; CanvasState: object }; data_model: { Ledger: object[] } }) {
  telemetry('handle-client-refresh-controller-started')
  // WHAT: React to server refresh events without damaging operator work.
  // WHY: External ledger editing is first-class and can target one surface or all surfaces.
  // HOW: Load persisted truth, merge when possible, otherwise full reload.
  subscribeServerRefresh()
  await loadLedgerState()
  const merged = mergeRefreshState()
  if (!merged.ok) {
    telemetry('handle-client-refresh-full-reload-required')
  }
  renderCanvasSurface()
  telemetry('handle-client-refresh-controller-completed')
}`
  },
  {
    root_block: 'frontend',
    domain: 'toolbox',
    controller: 'operate-toolbox-controller',
    description: 'Operate toolbar buttons, zone and group tools, color picker, shortcut help, runbook, conversation ledger, refresh button, and hover styling.',
    action_payload: ['tool-button-click'],
    helpers: ['resolve-tool-mode'],
    effects: ['render-toolbox', 'render-canvas-surface'],
    pseudoCode: `async function operateToolboxController({ action_payload, runtime_state, data_model }: { action_payload: { toolName: string }; runtime_state: { ToolState: object }; data_model: { Knowledge: object | null } }) {
  telemetry('operate-toolbox-controller-started')
  // WHAT: Keep tool mode switching explicit.
  // WHY: Normal selection behavior must resume correctly after tool mode exit.
  // HOW: Resolve ToolState and patch toolbar/canvas presentation.
  resolveToolMode()
  renderToolbox()
  renderCanvasSurface()
  telemetry('operate-toolbox-controller-completed')
}`
  },
  {
    root_block: 'backend',
    domain: 'server',
    controller: 'start-http-server-controller',
    description: 'Start the Node 24 native HTTP server and connect route dispatch, ledger state, refresh watcher, and transcription boundary.',
    action_payload: ['http-request'],
    helpers: ['create-http-server', 'read-blueprinttool-state', 'watch-ledger-directory'],
    effects: ['send-json-response'],
    pseudoCode: `async function startHttpServerController({ action_payload, runtime_state, data_model }: { action_payload: { start_requested: true }; runtime_state: {}; data_model: { Server: object | null; Router: object[] } }) {
  telemetry('start-http-server-controller-started')
  // WHAT: Create the native Node HTTP server.
  // WHY: Specs require node:http without a server framework.
  // HOW: Load tab registry, install watcher, and route requests through Core server modules.
  readBlueprinttoolState()
  watchLedgerDirectory()
  createHttpServer()
  telemetry('start-http-server-controller-completed')
}`
  },
  {
    root_block: 'backend',
    domain: 'routing',
    controller: 'dispatch-route-controller',
    description: 'Dispatch direct URL slug, ledger read API, ledger edit API, new ledger route, and voice upload route.',
    action_payload: ['http-request'],
    helpers: ['parse-http-request', 'resolve-ledger-route', 'read-ledger-json-file'],
    effects: ['send-json-response'],
    pseudoCode: `async function dispatchRouteController({ action_payload, runtime_state, data_model }: { action_payload: { method: string; url: string; body?: object }; runtime_state: {}; data_model: { Router: object[]; NavTab: object[]; Ledger: object[] } }) {
  telemetry('dispatch-route-controller-started')
  // WHAT: Route native HTTP requests to server controllers.
  // WHY: Direct URL slugs and JSON APIs must share tab ledger truth.
  // HOW: Parse request, resolve route, load ledger when needed, and send JSON response.
  const request = parseHttpRequest()
  const route = resolveLedgerRoute()
  if (!route.ok) {
    telemetry('dispatch-route-not-found')
    sendJsonResponse()
    return
  }
  if (route.kind === 'ledger-read') readLedgerJsonFile()
  sendJsonResponse()
  telemetry('dispatch-route-controller-completed')
}`
  },
  {
    root_block: 'backend',
    domain: 'ledger',
    controller: 'load-tab-ledgers-controller',
    description: 'Load ledgers from ./.blueprinttool as default tabs and reject invalid ledgers without corrupting state.',
    action_payload: ['http-request'],
    helpers: ['read-blueprinttool-state', 'read-ledger-json-file', 'validate-ledger-document'],
    effects: ['write-blueprinttool-state', 'send-json-response'],
    pseudoCode: `async function loadTabLedgersController({ action_payload, runtime_state, data_model }: { action_payload: { boot_or_create: boolean }; runtime_state: {}; data_model: { Ledger: object[]; NavTab: object[] } }) {
  telemetry('load-tab-ledgers-controller-started')
  // WHAT: Build server tab registry from committed ledger files.
  // WHY: Navigation tabs represent all available ledgers in server state.
  // HOW: Read registry, validate each ledger, reject invalid ledgers, then persist server state.
  const registry = readBlueprinttoolState()
  const ledgers = readLedgerJsonFile()
  const valid = validateLedgerDocument()
  if (!valid.ok) {
    telemetry('load-tab-ledgers-invalid-ledger-rejected')
  }
  writeBlueprinttoolState()
  sendJsonResponse()
  telemetry('load-tab-ledgers-controller-completed')
}`
  },
  {
    root_block: 'backend',
    domain: 'persistence',
    controller: 'commit-ledger-edit-controller',
    description: 'Accept ledger edit API payloads, validate durable shape, write JSON files, and respond without triggering redundant client refresh for client-originated edits.',
    action_payload: ['http-request'],
    helpers: ['parse-http-request', 'validate-ledger-edit-payload'],
    effects: ['write-ledger-json-file', 'send-json-response'],
    pseudoCode: `async function commitLedgerEditController({ action_payload, runtime_state, data_model }: { action_payload: { method: string; body: object }; runtime_state: {}; data_model: { Ledger: object; Event: object[] } }) {
  telemetry('commit-ledger-edit-controller-started')
  // WHAT: Persist client ledger edits through the API boundary.
  // WHY: Ledger edits are durable JSON files and invalid payloads must not corrupt state.
  // HOW: Parse, validate, write, respond, and mark client-originated source.
  parseHttpRequest()
  const validation = validateLedgerEditPayload()
  if (!validation.ok) {
    telemetry('commit-ledger-edit-rejected')
    sendJsonResponse()
    return
  }
  writeLedgerJsonFile()
  sendJsonResponse()
  telemetry('commit-ledger-edit-controller-completed')
}`
  },
  {
    root_block: 'backend',
    domain: 'refresh',
    controller: 'publish-server-refresh-controller',
    description: 'Detect external ledger edits with fs.watch, debounce watcher events, and publish targeted or full refresh messages over WebSocket.',
    action_payload: ['ledger-file-watch-event'],
    helpers: ['watch-ledger-directory', 'debounce-refresh-event', 'read-ledger-json-file', 'validate-ledger-document'],
    effects: ['publish-refresh-event'],
    pseudoCode: `async function publishServerRefreshController({ action_payload, runtime_state, data_model }: { action_payload: { filename: string; source?: string }; runtime_state: {}; data_model: { Ledger: object[] } }) {
  telemetry('publish-server-refresh-controller-started')
  // WHAT: Turn external file changes into refresh events.
  // WHY: fs.watch is inconsistent and client-originated edits should not cause redundant refresh.
  // HOW: Debounce watcher event, reload ledger, validate, then publish target or all-surface event.
  watchLedgerDirectory()
  const event = debounceRefreshEvent()
  if (!event.ok) {
    telemetry('publish-server-refresh-suppressed')
    return
  }
  readLedgerJsonFile()
  validateLedgerDocument()
  publishRefreshEvent()
  telemetry('publish-server-refresh-controller-completed')
}`
  },
  {
    root_block: 'backend',
    domain: 'transcription',
    controller: 'transcribe-voice-controller',
    description: 'Route captured voice audio to optional OpenAI transcription only when configured and persist completed text without durable audio storage.',
    action_payload: ['http-request', 'transcription-provider-response'],
    helpers: ['parse-http-request', 'resolve-transcription-config'],
    effects: ['call-openai-transcription', 'persist-transcribed-text', 'send-json-response'],
    pseudoCode: `async function transcribeVoiceController({ action_payload, runtime_state, data_model }: { action_payload: { audioRef?: string; threadId: string }; runtime_state: {}; data_model: { Thread: object[]; Message: object[] } }) {
  telemetry('transcribe-voice-controller-started')
  // WHAT: Keep transcription behind the server provider boundary.
  // WHY: Voice transcription is optional and configuration-gated.
  // HOW: Reject unconfigured IO, call OpenAI when configured, persist text, not audio.
  parseHttpRequest()
  const config = resolveTranscriptionConfig()
  if (!config.ok) {
    telemetry('transcribe-voice-disabled')
    sendJsonResponse()
    return
  }
  callOpenaiTranscription()
  persistTranscribedText()
  sendJsonResponse()
  telemetry('transcribe-voice-controller-completed')
}`
  }
]
```

Reflection:
- Every control-flow entry is reachable from at least one input.
- Every helper and effect referenced by control-flow entries exists in section E.
- Pseudocode includes function signatures, branching, runtime state/data model usage, helper/effect calls, WHAT/WHY/HOW comments, and telemetry events.

## J. Consistency Pass

- Domains used by control-flow entries, screens, components, state, helpers, and effects exist in section A.
- Inputs used by control-flow entries exist in section C.
- Components listed by screens exist in section G.
- State props used by components and control-flow entries exist in section H.
- Helper/effect names used by control-flow entries exist in section E.
- Control-flow entries are reachable from `browser-load`, `browser-route-change`, pointer, wheel, keyboard, toolbar, thread, voice, server refresh, HTTP request, file watcher, or transcription provider input.
- Test suites map to frontend/backend scoped Spec cards. Archi-generator Spec cards remain mapped to the existing archi-generator ledger.

## K. Operator Questions And Unresolved Items

```js
[]
```

## L. New Spec And Anti-Spec Candidates

```js
[]
```

## M. Final Readiness Gate

- Required frontend/backend Specs are covered by suites.
- No control-flow entry is unreachable.
- No referenced helper, effect, component, state, or domain is missing.
- No unresolved item blocks generation.
- Suites have input, state, control-flow, helper, effect, and telemetry information.
- Controllers contain pseudocode with function signature, comments, branching, telemetry events, helper calls, and effect calls.

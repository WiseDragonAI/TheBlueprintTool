## A. Correct Existing Baseline

1. **Source system:** The relevant prior work is the commercial `Business OS Mock`, not DroidFactory and not GitLab issue automation.
2. **Primary workspace:** The canonical mock lives in `/home/jbb/dev/DroidFleet/commercial/business-os-mock/`.
3. **Primary routes:** The mock renders semantic cockpit routes such as `#/decisions`, `#/pipeline`, `#/pipeline/new`, `#/stages`, `#/stages/new`, `#/workspace`, `#/team`, `#/admin/prompts`, and `#/admin/pipeline-library`.
4. **Data model source:** The model behind this work is the `Content MCP Data Model`, represented by `business-os-mock/content-mcp-model-data.js` and the canvas page `business-os-mock/content-mcp-model.html`.
5. **CoreV2 mapping:** CoreV2’s `Data` ledger is conceptually adjacent because it represents durable ledger objects, state, routes, canvas, cards, threads, events, generated reports, runtime data, worktrees, and test runs. The commercial model is a product-specific Business OS task/data model, not a GitLab workflow model.

---

## B. Content MCP Model

1. **Gateway:** `MCP Gateway` is the single entry/exit for agents and operators. Clients use MCP methods only, writes require idempotency keys, writes emit outbox events, and capability gaps are explicitly represented.
2. **Identity:** `Accounts + Identity` models accounts, auth providers, token secrets, language profiles, lead profiles, and platform identities without silently merging unrelated sources.
3. **Content:** `Content Registry` models posts, labels, type definitions, assets, variants, publication targets, and publish attempts.
4. **Interaction:** `Interaction Core` normalizes comments, DMs, forms, calls, email replies, CRM webhooks, messages, translations, lead evidence, CRM entities, and CRM events.
5. **Tasking:** `Tasks + Scheduler` models `task_types`, `task_instances`, `task_entity_links`, `response_tasks`, `response_actions`, `task_claims`, `task_executions`, dead letters, alerts, circuit breakers, automation runs, checkpoints, job definitions, schedules, and runs.
6. **Delivery:** `Paid Delivery + KPIs` models campaigns, ad accounts, ad bindings, delivery events, KPI snapshots, KPI values, cost ledgers, budget policies, and budget alerts.
7. **Knowledge:** `Knowledge Evidence` separates company, offer, ICP, compliance, objection, and analysis context from tasks while linking evidence to interactions and tasking.
8. **Templates:** `Template Engine` compiles reusable automation behavior into concrete task instances with versioned templates, bindings, compilations, diagnostics, and failure policy.

---

## C. Commercial Cockpit UX

1. **Decision surface:** `#/decisions` shows a decision ledger, one focused decision card, an agent chat panel, and a delegation popover. The operator sees a specific next decision, not a generic dashboard.
2. **Task records:** Mock task instances include `task_instance_id`, `task_template_key`, `pipeline_type_key`, `pipeline_key`, `pipeline_name`, `task_kind`, `task_status`, `next_turn`, previous agent summary, chat summary, priority, markdown summary, draft output, actions, and chat lines.
3. **Pipeline library:** `#/pipeline` shows workspace-scoped scheduled automation such as `DM ingestion`, `Comment ingestion`, `Campaign monitor`, `Asset production`, `Creative testing`, and `Lead intake`.
4. **Pipeline composer:** `#/pipeline/new` defines pipeline identity, trigger, ordered stages, prompt/script artifacts, and a right-side agent chat that helps compose the runnable version.
5. **Stage library:** `#/stages` and `#/stages/new` define reusable stage contracts with type `Agent`, `Script`, or `Operator gate`, plus input and output contracts.
6. **Artifact inspection:** Pipeline stages can expose prompt editors, markdown previews, and script previews through artifact dialogs.
7. **Scope model:** The cockpit scopes work by team, workspace, client, accounts, API keys, permissions, prompt library records, and pipeline library records.

---

## D. Existing Flow Concepts

1. **Publish path:** `post.ingest -> post.plan -> post.schedule -> post.publish -> delivery_events -> kpi_snapshots`.
2. **Lead signal path:** `interaction.ingest -> lead_profiles -> lead_analysis_snapshots -> task.enqueue -> crm.event.ingest`.
3. **Reply path:** `social_messages -> message_translations -> response_tasks -> task.claim -> response_actions -> platform_reply_id`.
4. **Automation path:** `job_schedules -> task_templates -> task_template_compilations -> task_instances -> task_claims`.
5. **Message lifecycle:** `ingested -> queued_for_operator -> drafted_with_agent -> operator_approved -> replied -> closed`.
6. **Task lifecycle:** `open -> assigned -> in_progress -> blocked -> completed | canceled`, with audited operator override.
7. **Automation lifecycle:** `queued -> running -> success | partial_success | failed`, with auditability, retry awareness, and dead-letter safety.

---

## E. Source Evidence

1. **Business OS mock:** `/home/jbb/dev/DroidFleet/commercial/business-os-mock/README.md`.
2. **Cockpit routes:** `/home/jbb/dev/DroidFleet/commercial/business-os-mock/ux/pages/index.js`.
3. **Mock task instances:** `/home/jbb/dev/DroidFleet/commercial/business-os-mock/ux/services/mockData.js`.
4. **Pipeline data:** `/home/jbb/dev/DroidFleet/commercial/business-os-mock/ux/services/mockPipelineData.js`.
5. **Pipeline composer data:** `/home/jbb/dev/DroidFleet/commercial/business-os-mock/ux/services/mockPipelineCreateData.js`.
6. **Stage data:** `/home/jbb/dev/DroidFleet/commercial/business-os-mock/ux/services/mockStageData.js`.
7. **Content MCP model:** `/home/jbb/dev/DroidFleet/commercial/business-os-mock/content-mcp-model-data.js`.
8. **Content MCP canvas runbook:** `/home/jbb/dev/DroidFleet/commercial/documentation/runbook/CONTENT_MCP_UML_CANVAS_RUNBOOK.md`.

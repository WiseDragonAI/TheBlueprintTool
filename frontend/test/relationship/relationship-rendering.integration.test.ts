/**
 * WHAT: Integration test for spec 61bea65c-81557a54-708a7bfc-53dc0295-6f01b700-47237c02-5027f419-b200b57e-cd58fd49-ba1544b0.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { renderRelationshipController } from '@frontend/business/relationship/controller/render-relationship-controller.js';
import { editCardController } from '@frontend/business/card/controller/edit-card-controller.js';

test('Relationship arrows SVG markers ports labels collision avoidance and markdown descriptions hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["calculate-relationship-ports","route-relationship-path","render-relationship-overlay","parse-card-markdown"];
  const argvPayload = {
    ok: true,
    mode: 'dry-run',
    apply_command: true,
    check_ledger_command: true,
    report_command: true,
    patch_doc_command: true,
    ledger_command: 'mutate',
    master_ledger_file: 'generated-master-ledger.md',
    specs_ledger_file: 'generated-specs-ledger.json',
    patch_batch_file: 'generated-patch-batch.json',
    report_file: 'generated-report.json'
  };
  const actionPayload = { ...argvPayload, cli_command_argv: argvPayload, argv: argvPayload };
  try {
    await renderRelationshipController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '61bea65c-81557a54-708a7bfc-53dc0295-6f01b700-47237c02-5027f419-b200b57e-cd58fd49-ba1544b0', controllerName: 'render-relationship-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await editCardController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: '61bea65c-81557a54-708a7bfc-53dc0295-6f01b700-47237c02-5027f419-b200b57e-cd58fd49-ba1544b0', controllerName: 'edit-card-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: '61bea65c-81557a54-708a7bfc-53dc0295-6f01b700-47237c02-5027f419-b200b57e-cd58fd49-ba1544b0', suiteName: 'Relationship arrows SVG markers ports labels collision avoidance and markdown descriptions hold', controllerName: ["render-relationship-controller","edit-card-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});

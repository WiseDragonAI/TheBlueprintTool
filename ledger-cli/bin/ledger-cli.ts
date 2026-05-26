#!/usr/bin/env node
/**
 * WHAT: ledger-cli executable entrypoint.
 * WHY: operators need a dedicated TypeScript Node script for committed ledger JSON inspection and mutation.
 */
import { dispatchLedgerCliCommandController } from '../src/business/command/controller/dispatch-ledger-cli-command.js';

const result = await dispatchLedgerCliCommandController(process.argv.slice(2));

// WHY: failed commands must be visible to shell automation.
// WHAT: print the error and set a failing exit code.
if (!result.ok) {
  console.error(result.error);
  process.exitCode = 1;
}

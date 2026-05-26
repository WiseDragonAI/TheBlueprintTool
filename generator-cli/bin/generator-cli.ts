#!/usr/bin/env node
/**
 * WHAT: generator-cli executable entrypoint.
 * WHY: operators need a TypeScript Node script for scaffold generation, reports, patch docs, and ledger checks.
 */
import { dispatchCliCommandController } from '../src/business/command/controller/dispatch-cli-command.js';

const result = await dispatchCliCommandController(process.argv.slice(2));

// WHY: failed commands must be visible to shell automation.
// WHAT: print the error and set a failing exit code.
if (!result.ok) {
  console.error(result.error);
  process.exitCode = 1;
}

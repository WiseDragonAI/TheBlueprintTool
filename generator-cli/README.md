# generator-cli

`generator-cli` is the TypeScript Node CLI root block for reading canonical master ledgers, planning generated worktrees, writing generated source/tests/telemetry, producing reports, and applying canonical patch batches.

Commands:

```sh
npm run cli -- dry-run --master-ledger ../tmp/master-ledger-generator-cli-26-05-11-1.md --output ../.worktrees/example
npm run cli -- apply --master-ledger ../tmp/master-ledger-generator-cli-26-05-11-1.md --output ../.worktrees/example
npm run cli -- report --test-command "npm test" --report generated-report.json
npm run cli -- patch-doc --patch-batch patch-batch.json
npm run cli -- ledger inspect ../documentation/specs.json
```

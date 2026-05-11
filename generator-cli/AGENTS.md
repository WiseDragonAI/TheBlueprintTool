# generator-cli Guidance

This root block follows `tmp/master-ledger-generator-cli-26-05-11-1.md`.

Keep controller files limited to orchestration and branching. Put parsing, validation, IO, test execution, report construction, and graph work in helpers or effects under the owning domain.

/**
 * WHAT: MasterLedger structural analyzer for counts and problems.
 * WHY: agents need a command that proves the generator understands root blocks, functions, tests, specs, and ledger drift before generation.
 */
import type { MasterLedgerCheckReport, MasterLedgerDocument, SpecsLedger, SpecsLedgerCard, SpecsLedgerGroup } from '../../../lib/types.js';
import { createWorktreePlan } from '../../generate/helper/create-worktree-plan.js';
import type { FunctionBatch } from './parse-function-batch.js';

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function cardPosition(card: SpecsLedgerCard, specsLedger: SpecsLedger): { x: number; y: number } {
  const position = specsLedger.positions?.[card.id];
  return {
    x: position?.x ?? card.x ?? 0,
    y: position?.y ?? card.y ?? 0,
  };
}

function cardIsInsideGroup(card: SpecsLedgerCard, group: SpecsLedgerGroup, specsLedger: SpecsLedger): boolean {
  const position = cardPosition(card, specsLedger);
  return position.x >= group.x && position.x <= group.x + group.width && position.y >= group.y && position.y <= group.y + group.height;
}

function selectedSpecCards(specsLedger: SpecsLedger, groupNames: string[]): {
  allSpecCards: SpecsLedgerCard[];
  selectedSpecCards: SpecsLedgerCard[];
  selectedGroups: SpecsLedgerGroup[];
  unmatchedGroups: string[];
} {
  const allSpecCards = (specsLedger.cards ?? []).filter((card) => card.cardType === 'spec-brief');

  // WHY: no group target means the checker should validate against all spec cards in the SpecsLedger.
  // WHAT: return all spec cards and no group warnings.
  if (groupNames.length === 0) {
    return { allSpecCards, selectedSpecCards: allSpecCards, selectedGroups: [], unmatchedGroups: [] };
  }

  const annotations = specsLedger.annotations ?? [];
  const selectedGroups = annotations.filter((annotation) => groupNames.map(normalized).includes(normalized(annotation.label)));
  const matchedGroupNames = new Set(selectedGroups.map((group) => normalized(group.label)));
  const unmatchedGroups = groupNames.filter((groupName) => !matchedGroupNames.has(normalized(groupName)));
  const selectedIds = new Set<string>();

  for (const group of selectedGroups) {
    for (const card of allSpecCards) {
      // WHY: group membership is represented by cards positioned inside annotation bounds.
      // WHAT: include cards that fall inside any targeted group annotation.
      if (cardIsInsideGroup(card, group, specsLedger)) {
        selectedIds.add(card.id);
      }
    }
  }

  return {
    allSpecCards,
    selectedSpecCards: allSpecCards.filter((card) => selectedIds.has(card.id)),
    selectedGroups,
    unmatchedGroups,
  };
}

function duplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

export function analyzeMasterLedger(document: MasterLedgerDocument, batch: FunctionBatch, specsLedger: SpecsLedger, groupNames: string[] = []): MasterLedgerCheckReport {
  const rootBlocks = [...new Set([...document.text.matchAll(/root_block: '([^']+)'/g)].map((match) => match[1]))].sort();
  const domains = [...new Set([...document.text.matchAll(/domain_name: '([^']+)'/g)].map((match) => match[1]))].sort();
  const controllers = batch.functions.filter((generatedFunction) => generatedFunction.kind === 'controller');
  const helpers = batch.functions.filter((generatedFunction) => generatedFunction.kind === 'helper');
  const effects = batch.functions.filter((generatedFunction) => generatedFunction.kind === 'effect');
  const specIds = batch.suites.map((suite) => suite.specId);
  const uniqueSpecIds = [...new Set(specIds)];
  const scopedSpecCountMatch = document.text.match(/scoped_spec_count:\s*(\d+)/);
  const declaredScopedSpecCount = scopedSpecCountMatch ? Number(scopedSpecCountMatch[1]) : null;
  const problems: MasterLedgerCheckReport['problems'] = [];
  const specs = selectedSpecCards(specsLedger, groupNames);
  const selectedSpecIds = new Set(specs.selectedSpecCards.map((card) => card.id));
  const allSpecIds = new Set(specs.allSpecCards.map((card) => card.id));
  const suiteSpecIds = new Set(uniqueSpecIds);
  const missingSpecTests = groupNames.length > 0 ? specs.selectedSpecCards.filter((card) => !suiteSpecIds.has(card.id)).map((card) => card.id).sort() : [];
  const testSuitesOutsideSelectedSpecs = uniqueSpecIds.filter((specId) => !(groupNames.length > 0 ? selectedSpecIds : allSpecIds).has(specId)).sort();
  const worktreePlan = createWorktreePlan({ output: '.worktrees/check-ledger', functions: batch.functions, suites: batch.suites });
  const generatedTestFiles = [...worktreePlan.unitTestFiles, ...worktreePlan.integrationTestFiles];
  const nameCounts = new Map<string, number>();

  for (const generatedFunction of batch.functions) {
    nameCounts.set(generatedFunction.name, (nameCounts.get(generatedFunction.name) ?? 0) + 1);
  }

  const duplicateNames = [...nameCounts].filter(([, count]) => count > 1).map(([name, count]) => ({ name, count }));

  // WHY: duplicate function names make generated imports, unit tests, and reports ambiguous.
  // WHAT: add one blocking problem for duplicated generated function names.
  if (duplicateNames.length > 0) {
    problems.push({
      severity: 'error',
      code: 'duplicate-function-name',
      message: 'Generated function names must be globally unique.',
      details: duplicateNames,
    });
  }

  const specCounts = new Map<string, number>();

  for (const specId of specIds) {
    specCounts.set(specId, (specCounts.get(specId) ?? 0) + 1);
  }

  const duplicateSpecIds = [...specCounts].filter(([, count]) => count > 1).map(([specId, count]) => ({ specId, count }));

  // WHY: one Spec should map to one test suite in the MasterLedger.
  // WHAT: report duplicate test-suite mappings for the same Spec.
  if (duplicateSpecIds.length > 0) {
    problems.push({
      severity: 'error',
      code: 'duplicate-spec-test-suite',
      message: 'A Spec is mapped to more than one test suite.',
      details: duplicateSpecIds,
    });
  }

  // WHY: the declared scoped Spec count is the ledger readiness contract.
  // WHAT: report when unique suite Spec IDs do not match the declared count.
  if (declaredScopedSpecCount !== null && declaredScopedSpecCount !== uniqueSpecIds.length) {
    problems.push({
      severity: 'error',
      code: 'scoped-spec-count-mismatch',
      message: 'Declared scoped Spec count does not match unique test suite Spec IDs.',
      details: { declaredScopedSpecCount, uniqueSpecIds: uniqueSpecIds.length },
    });
  }

  // WHY: group names are operator input and must resolve to real SpecsLedger annotations.
  // WHAT: report group names that matched no group or zone label.
  if (specs.unmatchedGroups.length > 0) {
    problems.push({
      severity: 'error',
      code: 'unknown-ledger-group',
      message: 'One or more requested ledger groups were not found in the SpecsLedger annotations.',
      details: specs.unmatchedGroups,
    });
  }

  // WHY: selected spec cards must map to MasterLedger test suites.
  // WHAT: report cards in the selected group set that have no matching test suite.
  if (missingSpecTests.length > 0) {
    problems.push({
      severity: 'error',
      code: 'spec-card-without-test-suite',
      message: 'Selected SpecsLedger cards are not matched by MasterLedger test suites.',
      details: missingSpecTests,
    });
  }

  // WHY: suites must match real SpecsLedger cards, and targeted groups must constrain generation scope.
  // WHAT: report suite Spec IDs that are missing from the selected SpecsLedger card set.
  if (testSuitesOutsideSelectedSpecs.length > 0) {
    problems.push({
      severity: 'error',
      code: 'test-suite-outside-selected-groups',
      message: 'MasterLedger test suites include Spec IDs outside the selected SpecsLedger groups.',
      details: testSuitesOutsideSelectedSpecs,
    });
  }

  const duplicateSourcePaths = duplicateValues(worktreePlan.sourceFiles.map((file) => file.path));

  // WHY: one source file per generated function is a hard generator contract.
  // WHAT: report count mismatches or duplicate source paths.
  if (worktreePlan.sourceFiles.length !== batch.functions.length || duplicateSourcePaths.length > 0) {
    problems.push({
      severity: 'error',
      code: 'source-file-per-function-violation',
      message: 'Generated output must contain exactly one source file per generated function.',
      details: {
        generatedFunctions: batch.functions.length,
        sourceFiles: worktreePlan.sourceFiles.length,
        duplicateSourcePaths,
      },
    });
  }

  const duplicateUnitTestPaths = duplicateValues(worktreePlan.unitTestFiles.map((file) => file.path));

  // WHY: one unit test file per generated function is a hard generator contract.
  // WHAT: report count mismatches or duplicate unit test paths.
  if (worktreePlan.unitTestFiles.length !== batch.functions.length || duplicateUnitTestPaths.length > 0) {
    problems.push({
      severity: 'error',
      code: 'unit-test-file-per-function-violation',
      message: 'Generated output must contain exactly one unit test file per generated function.',
      details: {
        generatedFunctions: batch.functions.length,
        unitTestFiles: worktreePlan.unitTestFiles.length,
        duplicateUnitTestPaths,
      },
    });
  }

  const generatedTestsOutsideRootTestDirectory = generatedTestFiles.filter((file) => !file.path.startsWith('test/')).map((file) => file.path);

  // WHY: generated tests must live under the root block test directory, never under src.
  // WHAT: report generated unit or integration tests outside test/.
  if (generatedTestsOutsideRootTestDirectory.length > 0) {
    problems.push({
      severity: 'error',
      code: 'generated-test-outside-root-test-directory',
      message: 'Generated tests must be under the root block test directory.',
      details: generatedTestsOutsideRootTestDirectory,
    });
  }

  const testsOutsideTestDirectory = batch.suites.filter((suite) => !suite.path.startsWith('./generator-cli/test/')).map((suite) => suite.path);

  // WHY: tests must be written under the test directory.
  // WHAT: report suite paths outside generator-cli/test.
  if (testsOutsideTestDirectory.length > 0) {
    problems.push({
      severity: 'error',
      code: 'test-outside-test-directory',
      message: 'Test suite paths must be under ./generator-cli/test/.',
      details: testsOutsideTestDirectory,
    });
  }

  const functionNameSet = new Set(batch.functions.map((generatedFunction) => generatedFunction.name));
  const unresolvedTelemetry = [
    ...new Set(
      batch.suites
        .flatMap((suite) => suite.expectedTelemetry)
        .filter((telemetryName) => !functionNameSet.has(telemetryName)),
    ),
  ].sort();

  // WHY: expected telemetry must be backed by a generated helper, effect, or controller function.
  // WHAT: report telemetry names that cannot be resolved to generated functions.
  if (unresolvedTelemetry.length > 0) {
    problems.push({
      severity: 'warning',
      code: 'unresolved-expected-telemetry',
      message: 'Expected telemetry names do not resolve to generated function names.',
      details: unresolvedTelemetry,
    });
  }

  return {
    ok: problems.every((problem) => problem.severity !== 'error'),
    counts: {
      rootBlocks: rootBlocks.length,
      domains: domains.length,
      controllers: controllers.length,
      helpers: helpers.length,
      effects: effects.length,
      generatedFunctions: batch.functions.length,
      sourceFiles: worktreePlan.sourceFiles.length,
      unitTestFiles: worktreePlan.unitTestFiles.length,
      integrationTestFiles: worktreePlan.integrationTestFiles.length,
      testSuites: batch.suites.length,
      uniqueSpecIds: uniqueSpecIds.length,
      specsLedgerCards: specs.allSpecCards.length,
      selectedSpecCards: specs.selectedSpecCards.length,
      matchedSpecCards: groupNames.length > 0 ? specs.selectedSpecCards.length - missingSpecTests.length : uniqueSpecIds.length - testSuitesOutsideSelectedSpecs.length,
      declaredScopedSpecCount,
    },
    rootBlocks,
    domains,
    selectedGroups: specs.selectedGroups.map((group) => group.label).sort(),
    unmatchedGroups: specs.unmatchedGroups,
    missingSpecTests,
    testSuitesOutsideSelectedSpecs,
    problems,
  };
}

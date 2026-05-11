/**
 * WHAT: Generated suite telemetry evidence extractor.
 * WHY: apply mode must record what each generated controller suite emitted so agents can evaluate ledger alignment.
 */
import type { TestSuitePlan } from '../../../lib/types.js';

export type GeneratedSuiteTelemetryEvidence = {
  specId: string;
  suiteName: string;
  controllerName: unknown;
  executionEntry: unknown;
  expectedTelemetry: string[];
  actualTelemetry: string[];
  missingTelemetry: string[];
  observedIndexes: Record<string, number[]>;
  reportFound: boolean;
};

type SuiteSummary = {
  specId?: unknown;
  suiteName?: unknown;
  controllerName?: unknown;
  executionEntry?: unknown;
  expectedTelemetry?: unknown;
  actualTelemetry?: unknown;
};

function parseJsonLines(stdout: string): SuiteSummary[] {
  return stdout
    .split('\n')
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        return parsed && typeof parsed === 'object' && 'specId' in parsed ? [parsed as SuiteSummary] : [];
      } catch {
        return [];
      }
    });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function analyzeGeneratedSuiteTelemetry(stdout: string, suites: TestSuitePlan[]): GeneratedSuiteTelemetryEvidence[] {
  const summaries = parseJsonLines(stdout);

  return suites.map((suite) => {
    const summary = summaries.find((candidate) => candidate.specId === suite.specId && Array.isArray(candidate.actualTelemetry));
    const actualTelemetry = stringArray(summary?.actualTelemetry);
    const expectedTelemetry = stringArray(summary?.expectedTelemetry);
    const expected = expectedTelemetry.length > 0 ? expectedTelemetry : suite.expectedTelemetry;
    const observedIndexes = Object.fromEntries(
      expected.map((eventName) => [
        eventName,
        actualTelemetry.flatMap((actual, index) => (actual.includes(eventName) ? [index] : [])),
      ]),
    );

    return {
      specId: suite.specId,
      suiteName: suite.suiteName,
      controllerName: summary?.controllerName ?? null,
      executionEntry: summary?.executionEntry ?? null,
      expectedTelemetry: expected,
      actualTelemetry,
      missingTelemetry: expected.filter((eventName) => observedIndexes[eventName]?.length === 0),
      observedIndexes,
      reportFound: summary !== undefined,
    };
  });
}

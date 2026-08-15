#!/usr/bin/env node
/**
 * WHAT: Reports active execution time and token cost for durable Codex pipeline runs.
 * WHY: Operators need measured pipeline economics without counting idle calendar gaps.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const modelPricingPerMillion = Object.freeze({
  'gpt-5.6-luna': Object.freeze({ nonCachedInput: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 1.2 }),
  'gpt-5.6-sol': Object.freeze({ nonCachedInput: 5, cachedInput: 0.5, cacheWrite: 6.25, output: 30 }),
  'gpt-5.6-terra': Object.freeze({ nonCachedInput: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 12 }),
});

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function records(value) {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function timestamp(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function contained(root, candidate) {
  const normalizedRoot = resolve(root);
  const normalizedCandidate = resolve(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${sep}`);
}

function decisionOsRootFromWorkspace(workspace) {
  const normalized = resolve(workspace);
  return basename(normalized) === '.decision-os' ? normalized : resolve(normalized, '.decision-os');
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read valid JSON from ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function canonicalRunFile(decisionOsRoot, ledgerId, configuredFile, runId) {
  const fileName = basename(text(configuredFile)) || `${text(runId) || 'unknown-run'}.jsonl`;
  const localFile = resolve(decisionOsRoot, 'runs', 'codex-skills', text(ledgerId) || 'tasks', fileName);
  // WHAT: Prefer the workspace-owned run artifact when it exists.
  // WHY: Persisted absolute paths can become stale after a workspace is moved or copied.
  if (fileName && existsSync(localFile)) return localFile;
  const configured = text(configuredFile);
  const absoluteConfigured = isAbsolute(configured) ? resolve(configured) : resolve(decisionOsRoot, configured);
  // WHAT: Accept the configured fallback only when it remains inside this Decision OS root.
  // WHY: A diagnostic must not follow stale pipeline metadata into another workspace.
  if (configured && contained(decisionOsRoot, absoluteConfigured) && existsSync(absoluteConfigured)) return absoluteConfigured;
  return localFile;
}

function finalUsageFromRunFile(file) {
  // WHAT: Treat a missing run artifact as missing usage rather than an empty successful run.
  // WHY: Zero cost would conceal incomplete execution evidence.
  if (!existsSync(file)) return { usage: null, error: 'run_file_missing' };
  let finalUsage = null;
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const normalized = line.trim();
      // WHAT: Ignore the terminal empty JSONL line.
      // WHY: Append-only run files conventionally end with a newline.
      if (!normalized) continue;
      const event = record(JSON.parse(normalized));
      // WHAT: Retain the last terminal usage receipt in the run.
      // WHY: Codex reports cumulative session usage and the final receipt owns the complete run total.
      if (event.type === 'turn.completed') finalUsage = record(event.usage);
    }
  } catch (error) {
    return { usage: null, error: `run_file_invalid:${error instanceof Error ? error.message : String(error)}` };
  }
  // WHAT: Distinguish an interrupted run from a completed zero-token run.
  // WHY: Provider cost cannot be proven without a terminal usage receipt.
  if (!finalUsage) return { usage: null, error: 'usage_receipt_missing' };
  const inputTokens = finite(finalUsage.input_tokens);
  const cachedInputTokens = Math.min(inputTokens, finite(finalUsage.cached_input_tokens));
  return {
    usage: {
      inputTokens,
      cachedInputTokens,
      nonCachedInputTokens: inputTokens - cachedInputTokens,
      cacheWriteInputTokens: finite(finalUsage.cache_write_input_tokens),
      outputTokens: finite(finalUsage.output_tokens),
      reasoningOutputTokens: finite(finalUsage.reasoning_output_tokens),
    },
    error: '',
  };
}

function runTiming(file, explicitStartedAt, explicitFinishedAt) {
  const explicitStart = timestamp(explicitStartedAt);
  const explicitEnd = timestamp(explicitFinishedAt);
  // WHAT: Use durable lifecycle timestamps when both form a valid interval.
  // WHY: Explicit scheduler evidence is more portable than filesystem metadata.
  if (explicitStart !== null && explicitEnd !== null && explicitEnd >= explicitStart) {
    return { startedAtMs: explicitStart, finishedAtMs: explicitEnd, durationMs: explicitEnd - explicitStart, timingSource: 'manifest' };
  }
  // WHAT: Return unavailable timing when the run artifact is absent.
  // WHY: A missing file must not manufacture zero-duration execution evidence.
  if (!existsSync(file)) return { startedAtMs: null, finishedAtMs: null, durationMs: null, timingSource: 'unavailable' };
  const stats = statSync(file);
  const birth = Number(stats.birthtimeMs);
  const modified = Number(stats.mtimeMs);
  // WHAT: Admit filesystem timing only when creation precedes final write.
  // WHY: Copied files can preserve an old mtime while receiving a newer birth time.
  if (Number.isFinite(birth) && birth > 0 && Number.isFinite(modified) && modified >= birth) {
    return { startedAtMs: birth, finishedAtMs: modified, durationMs: modified - birth, timingSource: 'run-file' };
  }
  return { startedAtMs: null, finishedAtMs: null, durationMs: null, timingSource: 'unavailable' };
}

export function calculateCost(model, usage) {
  const pricing = modelPricingPerMillion[text(model)];
  // WHAT: Leave cost unresolved when usage or model pricing is unavailable.
  // WHY: A partial report must not present an invented zero as total provider cost.
  if (!usage || !pricing) return { costUsd: null, pricing: pricing ?? null };
  const costUsd = (
    usage.nonCachedInputTokens * pricing.nonCachedInput
    + usage.cachedInputTokens * pricing.cachedInput
    + usage.cacheWriteInputTokens * pricing.cacheWrite
    + usage.outputTokens * pricing.output
  ) / 1_000_000;
  return { costUsd, pricing };
}

function unionDuration(runs) {
  const intervals = runs
    .filter((run) => run.startedAtMs !== null && run.finishedAtMs !== null)
    .map((run) => [run.startedAtMs, run.finishedAtMs])
    .sort((left, right) => left[0] - right[0]);
  const merged = [];
  for (const [startedAt, finishedAt] of intervals) {
    const previous = merged.at(-1);
    // WHAT: Start a new active interval when no prior execution overlaps it.
    // WHY: Idle gaps must stay excluded from real execution time.
    if (!previous || startedAt > previous[1]) {
      merged.push([startedAt, finishedAt]);
      continue;
    }
    previous[1] = Math.max(previous[1], finishedAt);
  }
  return merged.reduce((total, [startedAt, finishedAt]) => total + finishedAt - startedAt, 0);
}

function aggregateRuns(runs) {
  const pricedRuns = runs.filter((run) => run.costUsd !== null);
  return {
    runCount: runs.length,
    activeDurationMs: unionDuration(runs),
    recordedCostUsd: pricedRuns.reduce((total, run) => total + run.costUsd, 0),
    usageReceiptCount: runs.filter((run) => run.usage !== null).length,
    missingUsageRunCount: runs.filter((run) => run.usage === null).length,
    unpricedRunCount: runs.filter((run) => run.usage !== null && run.costUsd === null).length,
    costComplete: runs.every((run) => run.usage !== null && run.costUsd !== null),
    inputTokens: runs.reduce((total, run) => total + finite(run.usage?.inputTokens), 0),
    cachedInputTokens: runs.reduce((total, run) => total + finite(run.usage?.cachedInputTokens), 0),
    nonCachedInputTokens: runs.reduce((total, run) => total + finite(run.usage?.nonCachedInputTokens), 0),
    cacheWriteInputTokens: runs.reduce((total, run) => total + finite(run.usage?.cacheWriteInputTokens), 0),
    outputTokens: runs.reduce((total, run) => total + finite(run.usage?.outputTokens), 0),
  };
}

function selectedRun(manifest, skill, filters) {
  const cardMatches = !filters.cardId || text(manifest.sourceCardId) === filters.cardId;
  const pipelineMatches = !filters.pipelineRunId || text(manifest.id) === filters.pipelineRunId;
  const codexMatches = !filters.codexRunId || text(skill.runId) === filters.codexRunId || text(skill.executionId) === filters.codexRunId;
  return cardMatches && pipelineMatches && codexMatches;
}

export function buildPipelineCostReport({ decisionOsRoot, cardId = '', pipelineRunId = '', codexRunId = '' }) {
  const root = decisionOsRootFromWorkspace(decisionOsRoot);
  const storeFile = resolve(root, 'codex-pipelines.json');
  const store = record(readJson(storeFile));
  // WHAT: Reject a structurally invalid durable store instead of treating it as empty.
  // WHY: Corrupt pipeline state must remain visible and byte-identical.
  if (!Array.isArray(store.runs)) throw new Error(`Invalid Codex pipeline store ${storeFile}: runs must be an array.`);
  const filters = { cardId: text(cardId), pipelineRunId: text(pipelineRunId), codexRunId: text(codexRunId) };
  const pipelines = [];
  const allRuns = [];
  for (const manifest of records(store.runs)) {
    const pipelineSteps = [];
    for (const step of records(manifest.steps)) {
      const stepRuns = [];
      for (const skill of records(step.skills)) {
        // WHAT: Exclude Codex runs outside the requested durable identity filters.
        // WHY: Cost and duration summaries must belong only to the selected card, pipeline, and run.
        if (!selectedRun(manifest, skill, filters)) continue;
        const runFile = canonicalRunFile(root, manifest.ledgerId, skill.stdoutFile, skill.runId);
        const usageResult = finalUsageFromRunFile(runFile);
        const timing = runTiming(
          runFile,
          skill.startedAt ?? step.startedAt ?? manifest.startedAt,
          skill.finishedAt ?? step.finishedAt ?? manifest.finishedAt,
        );
        const model = text(skill.codexModel);
        const cost = calculateCost(model, usageResult.usage);
        const run = {
          pipelineRunId: text(manifest.id),
          pipelineName: text(manifest.pipelineName),
          sourceCardId: text(manifest.sourceCardId),
          stepRunId: text(step.id),
          stepId: text(step.stepId),
          stepName: text(step.name),
          codexRunId: text(skill.runId),
          executionId: text(skill.executionId),
          skillName: text(skill.skillName),
          model,
          effort: text(skill.codexEffort),
          status: text(skill.status),
          runFile,
          usage: usageResult.usage,
          usageError: usageResult.error,
          pricing: cost.pricing,
          costUsd: cost.costUsd,
          ...timing,
        };
        stepRuns.push(run);
        allRuns.push(run);
      }
      // WHAT: Emit only pipeline steps containing a selected Codex run.
      // WHY: Empty steps would imply activity and cost outside the selected scope.
      if (stepRuns.length > 0) pipelineSteps.push({
        stepRunId: text(step.id),
        stepId: text(step.stepId),
        stepName: text(step.name),
        runs: stepRuns,
        summary: aggregateRuns(stepRuns),
      });
    }
    // WHAT: Emit only pipeline manifests containing a selected step.
    // WHY: The report must remain compact and selection-exact.
    if (pipelineSteps.length > 0) pipelines.push({
      pipelineRunId: text(manifest.id),
      pipelineName: text(manifest.pipelineName),
      sourceCardId: text(manifest.sourceCardId),
      steps: pipelineSteps,
      summary: aggregateRuns(pipelineSteps.flatMap((step) => step.runs)),
    });
  }
  return {
    decisionOsRoot: root,
    filters,
    pipelines,
    summary: {
      pipelineRunCount: pipelines.length,
      stepCount: pipelines.reduce((total, pipeline) => total + pipeline.steps.length, 0),
      ...aggregateRuns(allRuns),
    },
  };
}

function formatDuration(durationMs) {
  const seconds = Math.max(0, Math.round(finite(durationMs) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function formatCost(cost) {
  return cost === null ? 'unavailable' : `$${cost.toFixed(4)}`;
}

export function formatPipelineCostReport(report) {
  const lines = [];
  for (const pipeline of report.pipelines) {
    lines.push(`PIPELINE ${pipeline.pipelineRunId} name=${JSON.stringify(pipeline.pipelineName)} card=${pipeline.sourceCardId}`);
    for (const step of pipeline.steps) {
      lines.push(`  STEP ${step.stepRunId} name=${JSON.stringify(step.stepName)} runs=${step.summary.runCount} active=${formatDuration(step.summary.activeDurationMs)} recorded_cost=${formatCost(step.summary.recordedCostUsd)} cost_complete=${step.summary.costComplete}`);
      for (const run of step.runs) {
        lines.push(`    RUN ${run.codexRunId} skill=${run.skillName} model=${run.model} active=${formatDuration(run.durationMs)} cost=${formatCost(run.costUsd)} noncached=${finite(run.usage?.nonCachedInputTokens)} cached=${finite(run.usage?.cachedInputTokens)} output=${finite(run.usage?.outputTokens)} usage=${run.usage ? 'recorded' : run.usageError}`);
      }
    }
  }
  const summary = report.summary;
  lines.push(`SUMMARY pipelines=${summary.pipelineRunCount} steps=${summary.stepCount} runs=${summary.runCount} active=${formatDuration(summary.activeDurationMs)} recorded_cost=${formatCost(summary.recordedCostUsd)} noncached=${summary.nonCachedInputTokens} cached=${summary.cachedInputTokens} output=${summary.outputTokens} usage_receipts=${summary.usageReceiptCount} missing_usage=${summary.missingUsageRunCount} unpriced=${summary.unpricedRunCount} cost_complete=${summary.costComplete}`);
  return lines.join('\n');
}

function usage() {
  return [
    'Usage: node bin/decision-os-pipeline-cost.mjs [options]',
    '',
    'Options:',
    '  --workspace <path>         Workspace root or .decision-os directory (default: cwd)',
    '  --card-id <id>             Include pipeline runs sourced from one card',
    '  --pipeline-run-id <id>     Include one durable pipeline run manifest',
    '  --codex-run-id <id>        Include one Codex run ID or execution ID',
    '  --json                     Print the complete machine-readable report',
    '  --help                     Print this help',
  ].join('\n');
}

function parseArguments(argv) {
  const options = { workspace: process.cwd(), cardId: '', pipelineRunId: '', codexRunId: '', json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    // WHAT: Handle boolean flags without consuming a following value.
    // WHY: JSON and help flags must compose safely with identity filters.
    if (argument === '--json' || argument === '--help') {
      options[argument === '--json' ? 'json' : 'help'] = true;
      continue;
    }
    const optionNames = { '--workspace': 'workspace', '--card-id': 'cardId', '--pipeline-run-id': 'pipelineRunId', '--codex-run-id': 'codexRunId' };
    const property = optionNames[argument];
    // WHAT: Reject unknown options before reading a value.
    // WHY: A misspelled identity filter could otherwise produce an unbounded all-runs report.
    if (!property) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    // WHAT: Require one non-flag value for every valued option.
    // WHY: Empty selectors make the requested report scope ambiguous.
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    options[property] = value;
    index += 1;
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  // WHAT: Print help without reading workspace state.
  // WHY: CLI discovery must remain available when the durable store is unavailable.
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = buildPipelineCostReport({
    decisionOsRoot: options.workspace,
    cardId: options.cardId,
    pipelineRunId: options.pipelineRunId,
    codexRunId: options.codexRunId,
  });
  process.stdout.write(`${options.json ? JSON.stringify(report, null, 2) : formatPipelineCostReport(report)}\n`);
}

// WHAT: Execute the CLI only when this module is the process entrypoint.
// WHY: Tests import the report builder without reading live workspace state.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

/**
 * WHAT: Parses and executes the single fixed Decision OS bootstrap, promote, status, resume, and rollback CLI.
 * WHY: Delivery authority must expose stable JSON and exit codes without accepting arbitrary effect inputs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  deliveryExitCodeForStatus,
  type DeliveryRun,
} from '../../../shared/schemas/decision-os-delivery-types.js';
import { bootstrapDecisionOsNode } from '../business/delivery/controller/bootstrap-decision-os-node.js';
import type { NodeReleaseProcessRunner } from '../business/delivery/helper/node-release-store.js';
import { deliveryRunSummary } from '../business/delivery/helper/delivery-coordinator.js';
import { redactDeliveryText } from '../business/delivery/helper/delivery-redactor.js';

type AnyRecord = Record<string, unknown>;

export type DeliveryCliCommand =
  | { command: 'bootstrap-node'; json: true }
  | { command: 'candidate'; releaseTag: string; json: true }
  | { command: 'promote'; releaseTag: string; json: true }
  | { command: 'status' | 'resume' | 'rollback'; deliveryId: string; json: true };

export type DeliveryCliRuntime = {
  candidate?(releaseTag: string): Promise<{
    releaseSha: string;
    evidenceFile: string;
    marker: string;
    currentPointer: string;
  }>;
  promote(releaseTag: string): Promise<DeliveryRun>;
  status(deliveryId: string): Promise<DeliveryRun>;
  resume(deliveryId: string): Promise<DeliveryRun>;
  rollback(deliveryId: string): Promise<DeliveryRun>;
};

export class DeliveryCliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode: 2 | 3 | 4 = 3,
  ) {
    super(message);
    this.name = 'DeliveryCliError';
  }
}

const fixedProductionServer = 'http://127.0.0.1:50150';

function optionMap(argv: readonly string[]): Map<string, string | true> {
  const values = new Map<string, string | true>();
  for (let index = 1; index < argv.length; index += 1) {
    const argument = String(argv[index] ?? '');
    if (!argument.startsWith('--')) throw new DeliveryCliError('delivery_cli_usage', `Unsupported positional argument: ${argument}.`, 2);
    if (values.has(argument)) throw new DeliveryCliError('delivery_cli_usage', `Duplicate option: ${argument}.`, 2);
    if (argument === '--json') values.set(argument, true);
    else {
      const value = String(argv[++index] ?? '');
      if (!value || value.startsWith('--')) throw new DeliveryCliError('delivery_cli_usage', `${argument} requires a value.`, 2);
      values.set(argument, value);
    }
  }
  return values;
}

function exactOptions(values: Map<string, string | true>, allowed: readonly string[]): void {
  const unsupported = [...values.keys()].find((key) => !allowed.includes(key));
  if (unsupported) throw new DeliveryCliError('delivery_cli_usage', `Unsupported delivery option: ${unsupported}.`, 2);
  if (values.get('--json') !== true) throw new DeliveryCliError('delivery_cli_json_required', '--json is required.', 2);
}

function deliveryId(value: unknown): string {
  const result = String(value ?? '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(result)) {
    throw new DeliveryCliError('delivery_id_invalid', '--delivery-id must be a stable identifier.', 2);
  }
  return result;
}

function releaseTag(value: unknown): string {
  const result = String(value ?? '');
  // WHAT: Accept only canonical production release tags.
  // WHY: Deployment authority is the immutable rel/devrel pair created by the dev-to-main promotion tool.
  if (!/^rel-(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(result)) {
    throw new DeliveryCliError('delivery_release_tag_invalid', '--release-tag must use the canonical rel-X.Y.Z form.', 2);
  }
  return result;
}

export function parseDecisionOsDeliveryArguments(argv: readonly string[]): DeliveryCliCommand {
  const command = String(argv[0] ?? '');
  const values = optionMap(argv);
  // WHAT: Parse candidate with one canonical release tag selector.
  // WHY: Candidate evidence must bind to the same published tag pair used by production promotion.
  if (command === 'candidate') {
    exactOptions(values, ['--release-tag', '--json']);
    return { command, releaseTag: releaseTag(values.get('--release-tag')), json: true };
  }
  // WHAT: Parse production promotion with one canonical release tag and fixed local server.
  // WHY: Operators must not inject a raw commit identity or alternate production endpoint.
  if (command === 'promote') {
    exactOptions(values, ['--release-tag', '--server', '--json']);
    // WHAT: Reject every production server except the fixed local coordinator.
    // WHY: Remote endpoint selection would bypass settings-owned deployment authority.
    if (values.get('--server') !== fixedProductionServer) {
      throw new DeliveryCliError('delivery_server_invalid', `--server must equal ${fixedProductionServer}.`, 2);
    }
    return { command, releaseTag: releaseTag(values.get('--release-tag')), json: true };
  }
  if (command === 'status' || command === 'resume' || command === 'rollback') {
    exactOptions(values, ['--delivery-id', '--json']);
    return { command, deliveryId: deliveryId(values.get('--delivery-id')), json: true };
  }
  if (command === 'bootstrap-node') {
    exactOptions(values, ['--json']);
    return { command, json: true };
  }
  throw new DeliveryCliError(
    'delivery_cli_usage',
    'Command must be bootstrap-node, candidate, promote, status, resume, or rollback.',
    2,
  );
}

export const parseBootstrapNodeArguments = (argv: readonly string[]): { json: boolean } => {
  const parsed = parseDecisionOsDeliveryArguments(argv);
  if (parsed.command !== 'bootstrap-node') throw new DeliveryCliError('delivery_cli_usage', 'Command must be bootstrap-node.', 2);
  return { json: parsed.json };
};

export async function runBootstrapNodeCli(input: {
  argv: readonly string[];
  runner?: NodeReleaseProcessRunner;
  write?: (value: string) => void;
  catalogRoot?: string;
}): Promise<number> {
  parseBootstrapNodeArguments(input.argv);
  const configurationFile = resolve(
    input.catalogRoot ?? process.cwd(),
    '.decision-os',
    'delivery',
    'bootstrap-node.json',
  );
  if (!existsSync(configurationFile)) {
    throw new DeliveryCliError('delivery_bootstrap_configuration_missing', 'The node bootstrap configuration file is unavailable.', 3);
  }
  let configuration: AnyRecord;
  try {
    const parsed = JSON.parse(readFileSync(configurationFile, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype) {
      throw new Error('shape');
    }
    configuration = parsed as AnyRecord;
  } catch {
    throw new DeliveryCliError('delivery_bootstrap_configuration_invalid', 'The node bootstrap configuration is invalid.', 3);
  }
  const configurationKeys = [
    'nodeId', 'decisionOsRoot', 'repositoryRoot', 'releaseRoot', 'initialCommit', 'supervisorProfile',
  ];
  if (
    Object.keys(configuration).some((key) => !configurationKeys.includes(key))
    || configurationKeys.some((key) => !Object.hasOwn(configuration, key))
  ) throw new DeliveryCliError('delivery_bootstrap_configuration_invalid', 'The node bootstrap configuration shape is invalid.', 3);
  const decisionOsRoot = String(configuration.decisionOsRoot ?? '');
  const settingsFile = resolve(decisionOsRoot, '.settings.json');
  let settings: AnyRecord = {};
  if (existsSync(settingsFile)) {
    try {
      const parsed = JSON.parse(readFileSync(settingsFile, 'utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
      settings = parsed as AnyRecord;
    } catch {
      throw new DeliveryCliError('delivery_settings_invalid', 'The ignored Decision OS settings are invalid.', 3);
    }
  }
  const result = await bootstrapDecisionOsNode({
    nodeId: String(configuration.nodeId ?? ''),
    decisionOsRoot,
    repositoryRoot: String(configuration.repositoryRoot ?? ''),
    releaseRoot: String(configuration.releaseRoot ?? ''),
    initialCommit: String(configuration.initialCommit ?? ''),
    supervisorProfile: configuration.supervisorProfile,
    settings,
    runner: input.runner,
  });
  (input.write ?? ((value) => process.stdout.write(value)))(
    `${JSON.stringify({
      ok: true,
      command: 'bootstrap-node',
      nodeId: result.settings.deliveryNodeId,
      release: result.release,
      supervisorAdopted: true,
    })}\n`,
  );
  return 0;
}

export async function runDecisionOsDeliveryCli(input: {
  argv: readonly string[];
  runtime: DeliveryCliRuntime;
  bootstrapRunner?: NodeReleaseProcessRunner;
  write?: (value: string) => void;
}): Promise<number> {
  const write = input.write ?? ((value) => process.stdout.write(value));
  const parsed = parseDecisionOsDeliveryArguments(input.argv);
  if (parsed.command === 'bootstrap-node') {
    return await runBootstrapNodeCli({ argv: input.argv, runner: input.bootstrapRunner, write });
  }
  if (parsed.command === 'candidate') {
    if (!input.runtime.candidate) throw new DeliveryCliError('delivery_candidate_runtime_unavailable', 'Candidate runtime is unavailable.', 3);
    const candidate = await input.runtime.candidate(parsed.releaseTag);
    write(`${JSON.stringify({
      ok: true,
      command: parsed.command,
      releaseTag: parsed.releaseTag,
      releaseSha: candidate.releaseSha,
      evidenceWritten: true,
      releaseIdentityValidated: true,
    })}\n`);
    return 0;
  }
  const run = parsed.command === 'promote'
    ? await input.runtime.promote(parsed.releaseTag)
    : parsed.command === 'status'
      ? await input.runtime.status(parsed.deliveryId)
      : parsed.command === 'resume'
        ? await input.runtime.resume(parsed.deliveryId)
        : await input.runtime.rollback(parsed.deliveryId);
  const summary = deliveryRunSummary(run);
  write(`${JSON.stringify({ ok: run.status === 'complete', command: parsed.command, ...summary })}\n`);
  return deliveryExitCodeForStatus(run.status) ?? 3;
}

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);
    const parsed = parseDecisionOsDeliveryArguments(argv);
    const runtime: DeliveryCliRuntime = parsed.command === 'bootstrap-node'
      ? {
          candidate: async () => { throw new DeliveryCliError('delivery_cli_usage', 'Bootstrap does not prepare a candidate.', 2); },
          promote: async () => { throw new DeliveryCliError('delivery_cli_usage', 'Bootstrap does not promote.', 2); },
          status: async () => { throw new DeliveryCliError('delivery_cli_usage', 'Bootstrap does not read status.', 2); },
          resume: async () => { throw new DeliveryCliError('delivery_cli_usage', 'Bootstrap does not resume.', 2); },
          rollback: async () => { throw new DeliveryCliError('delivery_cli_usage', 'Bootstrap does not roll back.', 2); },
        }
      : await (await import('../business/delivery/helper/delivery-cli-runtime.js'))
          .createDefaultDeliveryCliRuntime({ catalogRoot: process.cwd() });
    process.exitCode = await runDecisionOsDeliveryCli({
      argv,
      runtime,
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : 'delivery_cli_failed';
    const requestedExit = error && typeof error === 'object' && 'exitCode' in error
      ? Number((error as { exitCode?: unknown }).exitCode)
      : Number.NaN;
    const exitCode = error instanceof DeliveryCliError
      ? error.exitCode
      : requestedExit === 2 || requestedExit === 3 || requestedExit === 4
        ? requestedExit
        : code.includes('candidate') || code.includes('release_ref') || code.includes('worktree_dirty')
          ? 2
          : code.includes('compensation') ? 4 : 3;
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error: code,
      message: redactDeliveryText(error instanceof Error ? error.message : error),
      exitCode,
    })}\n`);
    process.exitCode = exitCode;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();

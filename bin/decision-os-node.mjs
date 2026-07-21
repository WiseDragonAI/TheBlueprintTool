#!/usr/bin/env node
/**
 * WHAT: Lists federation nodes and sends one direct Codex-backed message to a selected node project.
 * WHY: Agents need a stable non-browser command for cross-node federation diagnostics.
 */
import { readFile } from 'node:fs/promises';

function usage() {
  process.stderr.write([
    'Usage:',
    '  decision-os-node nodes [--server URL] [--json]',
    '  decision-os-node ask --node NODE_ID --project PROJECT_ID --message TEXT [--model MODEL] [--effort EFFORT] [--server URL] [--json]',
    '  decision-os-node ask --node NODE_ID --project PROJECT_ID --message-file FILE [--server URL] [--json]',
    '  printf %s "QUESTION" | decision-os-node ask --node NODE_ID --project PROJECT_ID [--server URL] [--json]',
  ].join('\n') + '\n');
  process.exit(2);
}

function argumentsFor(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) usage();
    const key = value.slice(2);
    if (key === 'json') {
      options.json = true;
      continue;
    }
    const next = values[index + 1];
    if (!next || next.startsWith('--')) usage();
    options[key] = next;
    index += 1;
  }
  return options;
}

async function stdinText() {
  if (process.stdin.isTTY) return '';
  let value = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) value += chunk;
  return value.trim();
}

async function responseJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Decision OS returned invalid JSON (HTTP ${response.status}).`); }
}

const command = process.argv[2];
if (!command || !['nodes', 'ask'].includes(command)) usage();
const options = argumentsFor(process.argv.slice(3));
const server = String(options.server ?? process.env.DECISION_OS_URL ?? 'http://127.0.0.1:50150').replace(/\/$/, '');

try {
  if (command === 'nodes') {
    const response = await fetch(`${server}/api/federation/nodes`, { headers: { accept: 'application/json' } });
    const body = await responseJson(response);
    if (!response.ok || body.ok !== true) throw new Error(String(body.error ?? `Node discovery failed with HTTP ${response.status}.`));
    if (options.json) process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
    else {
      for (const node of body.nodes ?? []) {
        process.stdout.write(`${node.nodeId}\t${node.online ? 'online' : 'offline'}\t${node.nodeLabel}${node.local ? ' (local)' : ''}\n`);
        for (const project of node.projects ?? []) process.stdout.write(`  ${project.projectId}\t${project.available ? 'available' : 'unavailable'}\t${project.name}\n`);
      }
    }
  } else {
    const nodeId = String(options.node ?? '').trim();
    const projectId = String(options.project ?? '').trim();
    const inlineMessage = String(options.message ?? '').trim();
    const fileMessage = !inlineMessage && options['message-file'] ? (await readFile(String(options['message-file']), 'utf8')).trim() : '';
    const message = inlineMessage || fileMessage || await stdinText();
    if (!nodeId || !projectId || !message) usage();
    const controller = new AbortController();
    const onSignal = () => controller.abort();
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    const response = await fetch(`${server}/api/federation/nodes/${encodeURIComponent(nodeId)}/messages`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId,
        message,
        ...(options.model ? { codexModel: options.model } : {}),
        ...(options.effort ? { codexEffort: options.effort } : {}),
      }),
      signal: controller.signal,
    });
    const body = await responseJson(response);
    if (!response.ok || body.ok !== true) throw new Error(String(body.error ?? `Node message failed with HTTP ${response.status}.`));
    process.stdout.write(options.json ? `${JSON.stringify(body, null, 2)}\n` : `${body.answer}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

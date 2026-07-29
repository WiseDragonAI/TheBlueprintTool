#!/usr/bin/env node
/**
 * WHAT: Starts the decision-os backend from any workspace cwd.
 * WHY: Operators should not have to remember tsx loader, tsconfig, or frontend-root wiring.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLauncherEmergencyServer } from './decision-os-launcher-emergency.mjs';

const processStartedAt = new Date().toISOString();

function releaseMarker(path) {
  try {
    const marker = JSON.parse(readFileSync(resolve(path, '.decision-os-release.json'), 'utf8'));
    return marker?.protocol === 1 && /^[a-f0-9]{40}$/.test(String(marker.releaseSha ?? '')) ? String(marker.releaseSha) : '';
  } catch {
    return '';
  }
}

export function launcherReleaseIdentity(input = {}) {
  const repoRoot = resolve(input.repoRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const cwd = resolve(input.cwd ?? process.cwd());
  const startedAt = String(input.processStartedAt ?? processStartedAt);
  const releaseSha = releaseMarker(repoRoot);
  let pointerSha = '';
  try {
    const settings = JSON.parse(readFileSync(resolve(cwd, '.decision-os', '.settings.json'), 'utf8'));
    const currentPointer = settings.deliveryCandidateCurrentPointer ?? settings.deliveryCurrentPointer;
    if (typeof currentPointer === 'string' && existsSync(currentPointer)) {
      const target = resolve(dirname(currentPointer), readlinkSync(currentPointer));
      pointerSha = releaseMarker(target);
    }
  } catch {
    pointerSha = '';
  }
  return {
    releaseSha,
    processStartedAt: Number.isFinite(Date.parse(startedAt)) ? startedAt : processStartedAt,
    deliveryProtocol: releaseSha || pointerSha ? 1 : 0,
    activeReleasePointer: pointerSha ? `current:${pointerSha}` : 'unbootstrapped',
  };
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const releaseIdentity = launcherReleaseIdentity({ repoRoot, cwd: process.cwd(), processStartedAt });
  const loader = resolve(repoRoot, 'backend/node_modules/tsx/dist/loader.mjs');
  const server = resolve(repoRoot, 'backend/src/server.ts');
  const serverEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => (
    !key.startsWith('DECISION_OS_') || key === 'DECISION_OS_FRONTEND_ROOT'
  )));
  const env = {
    ...serverEnvironment,
    DECISION_OS_FRONTEND_ROOT: resolve(repoRoot, 'frontend'),
    DECISION_OS_REPOSITORY_SETTINGS_FILE: resolve(repoRoot, '.decision-os/.settings.json'),
    DECISION_OS_RELEASE_SHA: releaseIdentity.releaseSha,
    DECISION_OS_PROCESS_STARTED_AT: releaseIdentity.processStartedAt,
    DECISION_OS_DELIVERY_PROTOCOL: String(releaseIdentity.deliveryProtocol),
    DECISION_OS_ACTIVE_RELEASE_POINTER: releaseIdentity.activeReleasePointer,
    TSX_TSCONFIG_PATH: resolve(repoRoot, 'backend/tsconfig.json')
  };
  if (process.argv.includes('--print-command')) {
    console.log(JSON.stringify({
      node: process.execPath,
      args: ['--import', loader, server],
      env: {
        DECISION_OS_FRONTEND_ROOT: env.DECISION_OS_FRONTEND_ROOT,
        DECISION_OS_REPOSITORY_SETTINGS_FILE: env.DECISION_OS_REPOSITORY_SETTINGS_FILE,
        TSX_TSCONFIG_PATH: env.TSX_TSCONFIG_PATH
      },
      scopedDecisionOsKeys: Object.keys(env).filter((key) => key.startsWith('DECISION_OS_') && !['DECISION_OS_FRONTEND_ROOT', 'DECISION_OS_REPOSITORY_SETTINGS_FILE'].includes(key)),
      releaseIdentity,
      cwd: process.cwd()
    }));
    return;
  }
  const child = spawn(process.execPath, ['--import', loader, server, ...process.argv.slice(2)], { env, stdio: 'inherit' });
  let forwardedSignal = null;
  let emergency = null;
  let childSettled = false;
  const emergencyPort = Number.isInteger(Number(process.env.PORT)) && Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 4173;
  const emergencyHost = String(process.env.HOST ?? '127.0.0.1');
  const enterEmergency = (error, code, childExitCode = null, childSignal = '') => {
    if (forwardedSignal || emergency || childSettled) return;
    childSettled = true;
    try {
      emergency = startLauncherEmergencyServer({
        cwd: process.cwd(),
        host: emergencyHost,
        port: emergencyPort,
        error,
        code,
        childExitCode,
        childSignal,
        releaseIdentity: launcherReleaseIdentity({ repoRoot, cwd: process.cwd(), processStartedAt }),
      });
    } catch (emergencyError) {
      process.stderr.write(`${JSON.stringify({ server: 'launcher-emergency', ok: false, error: emergencyError instanceof Error ? emergencyError.message : String(emergencyError) })}\n`);
      process.exitCode = 1;
    }
  };
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.once(signal, () => {
      forwardedSignal = signal;
      if (!child.killed) child.kill(signal);
      if (emergency) emergency.server.close(() => { process.exitCode = 0; });
    });
  }
  child.once('error', (error) => {
    console.error(error);
    enterEmergency(error, 'server_child_spawn_failed');
  });
  child.once('exit', (code, signal) => {
    if (forwardedSignal) {
      process.exitCode = 0;
      return;
    }
    if (code === 0 && !signal) {
      childSettled = true;
      process.exitCode = 0;
      return;
    }
    enterEmergency(
      new Error(`Decision OS server child exited before shutdown (code ${code ?? 'null'}, signal ${signal ?? 'none'}).`),
      'server_child_exited',
      code,
      signal ?? '',
    );
  });
}

main();

#!/usr/bin/env node
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
  blueprinttoolRoot,
  copyLedgerBackup,
  optionValue,
  parseLedgerFiles,
} from './ledger-sidecar-common.mjs';

const ledgerFiles = parseLedgerFiles(process.argv.slice(2));
const label = optionValue(process.argv.slice(2), '--label') ?? new Date().toISOString().replace(/[:.]/g, '-');

if (ledgerFiles.length === 0) {
  console.error('Usage: backup-ledgers.mjs [--label <name>] <ledger.json>...');
  process.exit(1);
}

const backups = [];
for (const ledgerFile of ledgerFiles) {
  const backupDir = join(blueprinttoolRoot(ledgerFile), 'backups', label);
  backups.push(await copyLedgerBackup(ledgerFile, backupDir));
}

const manifests = new Map();
for (const backup of backups) {
  const manifestFile = join(backup.backup, '..', 'manifest.json');
  manifests.set(manifestFile, [...(manifests.get(manifestFile) ?? []), backup]);
}

for (const [manifestFile, entries] of manifests) {
  await writeFile(manifestFile, `${JSON.stringify({ label, entries }, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({ ok: true, label, backups }, null, 2));

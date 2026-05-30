#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import {
  cardBody,
  cardContentRef,
  hasFile,
  parseLedgerFiles,
  readLedger,
  resolveContentRef,
  writeTextFile,
} from './ledger-sidecar-common.mjs';

const ledgerFiles = parseLedgerFiles(process.argv.slice(2));
const force = process.argv.includes('--force');

if (ledgerFiles.length === 0) {
  console.error('Usage: create-card-md-files.mjs [--force] <ledger.json>...');
  process.exit(1);
}

const summaries = [];
for (const ledgerFile of ledgerFiles) {
  const ledger = await readLedger(ledgerFile);
  const cards = Array.isArray(ledger.cards) ? ledger.cards : [];
  let created = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const card of cards) {
    const body = cardBody(card);
    if (body === undefined) {
      skipped += 1;
      continue;
    }

    const ref = cardContentRef(ledgerFile, card);
    const outputFile = resolveContentRef(ledgerFile, ref);
    if (hasFile(outputFile)) {
      const existing = await readFile(outputFile, 'utf8');
      if (existing === body) {
        unchanged += 1;
        continue;
      }
      if (!force) {
        throw new Error(`Refusing to overwrite changed content file: ${outputFile}`);
      }
    }

    await writeTextFile(outputFile, body);
    created += 1;
  }

  summaries.push({ ledgerFile, cards: cards.length, created, unchanged, skipped });
}

console.log(JSON.stringify({ ok: true, summaries }, null, 2));

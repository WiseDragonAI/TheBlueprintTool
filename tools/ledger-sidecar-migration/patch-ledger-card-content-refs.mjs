#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import {
  cardBody,
  cardComment,
  cardContentRef,
  hasFile,
  parseLedgerFiles,
  readLedger,
  resolveContentRef,
  writeLedger,
} from './ledger-sidecar-common.mjs';

const ledgerFiles = parseLedgerFiles(process.argv.slice(2));

if (ledgerFiles.length === 0) {
  console.error('Usage: patch-ledger-card-content-refs.mjs <ledger.json>...');
  process.exit(1);
}

const summaries = [];
for (const ledgerFile of ledgerFiles) {
  const ledger = await readLedger(ledgerFile);
  const cards = Array.isArray(ledger.cards) ? ledger.cards : [];
  let patched = 0;
  let skipped = 0;

  for (const card of cards) {
    const body = cardBody(card);
    if (body === undefined) {
      skipped += 1;
      continue;
    }

    const ref = cardContentRef(ledgerFile, card);
    const contentFile = resolveContentRef(ledgerFile, ref);
    if (!hasFile(contentFile)) {
      throw new Error(`Missing extracted content file for ${card.id}: ${contentFile}`);
    }

    const extracted = await readFile(contentFile, 'utf8');
    if (extracted !== body) {
      throw new Error(`Extracted content mismatch for ${card.id}: ${contentFile}`);
    }

    const comment = { ...cardComment(card), contentFile: ref };
    delete comment.what;
    card.comment = comment;
    patched += 1;
  }

  await writeLedger(ledgerFile, ledger);
  summaries.push({ ledgerFile, cards: cards.length, patched, skipped });
}

console.log(JSON.stringify({ ok: true, summaries }, null, 2));

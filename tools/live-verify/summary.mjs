#!/usr/bin/env node
import { createLiveReport } from './function/create-live-report.mjs';
import { formatLiveSummary } from './function/format-live-summary.mjs';

const url = process.env.COREV2_URL ?? 'http://127.0.0.1:4173/';
const cdpJsonUrl = process.env.COREV2_CDP_JSON ?? 'http://127.0.0.1:9223/json';
const report = await createLiveReport(url, cdpJsonUrl);
console.log(formatLiveSummary(report));

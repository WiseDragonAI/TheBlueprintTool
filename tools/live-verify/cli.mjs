#!/usr/bin/env node
import { connectPage } from './function/connect-page.mjs';
import { readLiveAppState } from './function/read-live-app-state.mjs';

const url = process.env.COREV2_URL ?? 'http://127.0.0.1:4173/';
const cdpJsonUrl = process.env.COREV2_CDP_JSON ?? 'http://127.0.0.1:9223/json';
const { socket, send } = await connectPage(cdpJsonUrl);
const report = await readLiveAppState(send, url);
socket.close();
console.log(JSON.stringify(report, null, 2));

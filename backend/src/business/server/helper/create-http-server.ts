/**
 * WHAT: Implements the create-http-server helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { telemetry } from '@backend/telemetry/harness.js';
import { transcribeVoiceController } from '@backend/business/transcription/controller/transcribe-voice-controller.js';
import { persistUploadedVoiceAudio } from '@backend/business/transcription/effect/persist-uploaded-voice-audio.js';
import { resolveBlueprinttoolRoot } from './resolve-blueprinttool-root.js';
import { readRequestBuffer } from './read-request-buffer.js';
import { contentTypeFor } from './content-type-for.js';
import { normalizeLedgerNotes } from './normalize-ledger-notes.js';

type AnyRecord = Record<string, unknown>;

export function createHttpServer(input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {}): Record<string, unknown> {
  telemetry('create-http-server', { role: 'helper', action: 'create-http-server' });
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const port = Number(payload.port ?? runtime.port ?? 0);
  const configuredFrontendRoot = payload.corev2FrontendRoot ?? payload.frontendRoot ?? process.env.COREV2_FRONTEND_ROOT ?? runtime.corev2FrontendRoot;
  const frontendRoot = configuredFrontendRoot
    ? resolve(String(configuredFrontendRoot))
    : existsSync(resolve(process.cwd(), 'frontend'))
      ? resolve(process.cwd(), 'frontend')
      : resolve(process.cwd(), '..', 'frontend');
  const blueprinttoolRoot = resolveBlueprinttoolRoot({ action_payload: payload, runtime_state: runtime });
  runtime.blueprinttoolRoot = blueprinttoolRoot;
  if (payload.mode === 'dry-run') {
    return { ok: true, port, server: { listening: false, port } };
  }
  const server = createServer(async (request, response) => {
    const url = (request.url ?? '/').split('?')[0];
    if (url === '/api/transcribe' && request.method === 'POST') {
      const audioBuffer = await readRequestBuffer(request);
      await transcribeVoiceController({
        action_payload: {
          method: request.method,
          url,
          response,
          audioBuffer,
          mimeType: request.headers['content-type'] ?? 'audio/webm',
          threadId: request.headers['x-thread-id'] ?? ''
        },
        runtime_state: runtime
      });
      return;
    }
    if (url === '/api/voice-upload' && request.method === 'POST') {
      const audioBuffer = await readRequestBuffer(request);
      const upload = persistUploadedVoiceAudio({
        action_payload: {
          audioBuffer,
          mimeType: request.headers['content-type'] ?? 'audio/webm',
          threadId: request.headers['x-thread-id'] ?? ''
        },
        runtime_state: runtime
      });
      response.setHeader('content-type', 'application/json');
      response.statusCode = upload.ok === false ? 400 : 202;
      response.end(JSON.stringify({ body: { ok: upload.ok !== false, uploaded: upload.ok !== false, configured: true, voiceFileRef: upload.voiceFileRef ?? '', text: '', error: upload.error } }));
      return;
    }
    if (url === '/api/transcribe/retry' && request.method === 'POST') {
      const bodyBuffer = await readRequestBuffer(request);
      const retryPayload = (() => {
        try {
          return JSON.parse(bodyBuffer.toString('utf8') || '{}') as AnyRecord;
        } catch {
          return {};
        }
      })();
      await transcribeVoiceController({
        action_payload: {
          ...retryPayload,
          method: request.method,
          url,
          response,
          threadId: request.headers['x-thread-id'] ?? retryPayload.threadId ?? ''
        },
        runtime_state: runtime
      });
      return;
    }
    if (url.startsWith('/blueprinttool/')) {
      const tabId = url.split('/').filter(Boolean)[1] ?? 'state';
      const statePath = resolve(blueprinttoolRoot, 'state.json');
      const blueprintState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) as { tabs?: Array<{ id?: string; ledgerFile?: string }> } : { tabs: [] };
      const tab = tabId === 'state' ? undefined : blueprintState.tabs?.find((entry) => entry.id === tabId);
      const ledgerFile = tabId === 'state' ? 'state.json' : String(tab?.ledgerFile ?? '').replace(/^\.blueprinttool\//, '');
      const ledgerPath = resolve(blueprinttoolRoot, ledgerFile);
      response.setHeader('content-type', 'application/json');
      if (!ledgerFile) {
        response.statusCode = 404;
        response.end(JSON.stringify({ ok: false, missing: tabId }));
        return;
      }
      if (tabId !== 'state' && request.method !== 'GET' && existsSync(ledgerPath)) {
        const body = await new Promise<string>((resolveBody) => {
          let chunks = '';
          request.setEncoding('utf8');
          request.on('data', (chunk) => {
            chunks += chunk;
          });
          request.on('end', () => resolveBody(chunks));
          request.on('error', () => resolveBody(''));
        });
        const mutation = body ? JSON.parse(body) as {
          action?: string;
          card?: Record<string, unknown>;
          cardPatch?: { id?: string; title?: string; description?: string };
          annotation?: Record<string, unknown>;
          relationship?: Record<string, unknown>;
          zoneIds?: string[];
          relationshipIds?: string[];
          geometry?: Record<string, Record<string, { x: number; y: number; width: number; height: number }>>;
          region?: { id?: string; kind?: string; label?: string; color?: string };
          note?: { id?: string; threadId?: string; body?: string; voiceFileRef?: string; status?: string; source?: string; error?: string };
          selection?: { cardIds?: string[]; zoneIds?: string[]; groupIds?: string[] };
        } : {};
        const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
          cards?: Array<Record<string, unknown>>;
          annotations?: Array<Record<string, unknown>>;
          relationships?: Array<Record<string, unknown>>;
          notes?: Record<string, Array<Record<string, unknown>>>;
        };
        if ((mutation.action === 'create-zone' || mutation.action === 'create-group') && mutation.annotation?.id) {
          const id = String(mutation.annotation.id);
          ledger.annotations = (ledger.annotations ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.annotation);
        }
        if (mutation.action === 'create-card' && mutation.card?.id) {
          const id = String(mutation.card.id);
          ledger.cards = (ledger.cards ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.card);
        }
        if (mutation.action === 'create-relationship' && mutation.relationship?.id) {
          const id = String(mutation.relationship.id);
          ledger.relationships = (ledger.relationships ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.relationship);
        }
        if (mutation.action === 'patch-card' && mutation.cardPatch?.id) {
          const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === mutation.cardPatch?.id);
          if (card && typeof mutation.cardPatch.title === 'string') card.title = mutation.cardPatch.title;
          if (card && typeof mutation.cardPatch.description === 'string') {
            const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment) ? card.comment as Record<string, unknown> : {};
            comment.what = mutation.cardPatch.description;
            card.comment = comment;
          }
        }
        if (mutation.action === 'delete-zones') {
          const ids = new Set(mutation.zoneIds ?? []);
          ledger.annotations = (ledger.annotations ?? []).filter((entry) => entry.variant === 'group' || !ids.has(String(entry.id ?? '')));
        }
        if (mutation.action === 'delete-relationships') {
          const ids = new Set(mutation.relationshipIds ?? []);
          ledger.relationships = (ledger.relationships ?? []).filter((entry) => !ids.has(String((entry as Record<string, unknown>).id ?? '')));
        }
        if (mutation.action === 'patch-geometry') {
          const cardGeometry = mutation.geometry?.cards ?? {};
          const zoneGeometry = mutation.geometry?.zones ?? {};
          const groupGeometry = mutation.geometry?.groups ?? {};
          for (const card of ledger.cards ?? []) {
            const record = cardGeometry[String(card.id ?? '')];
            if (!record) continue;
            card.x = record.x;
            card.y = record.y;
            card.w = record.width;
            card.h = record.height;
          }
          for (const annotation of ledger.annotations ?? []) {
            const id = String(annotation.id ?? '');
            const record = zoneGeometry[id] ?? groupGeometry[id];
            if (!record) continue;
            annotation.x = record.x;
            annotation.y = record.y;
            annotation.width = record.width;
            annotation.height = record.height;
          }
        }
        if (mutation.action === 'patch-region' && mutation.region?.id) {
          const annotation = (ledger.annotations ?? []).find((entry) => String(entry.id ?? '') === mutation.region?.id);
          if (annotation && typeof mutation.region.label === 'string') annotation.label = mutation.region.label;
          if (annotation && mutation.region.kind === 'zone' && typeof mutation.region.color === 'string') annotation.color = mutation.region.color;
        }
        if (mutation.action === 'append-note' && mutation.note?.threadId) {
          const notesByThread = normalizeLedgerNotes(ledger);
          const notes = notesByThread[mutation.note.threadId] ?? [];
          const noteId = String(mutation.note.id ?? `note-${Date.now()}`);
          const existing = notes.find((entry) => String(entry.id ?? '') === noteId);
          const nextNote = { id: noteId, role: mutation.note.source === 'voice' ? 'voice' : 'operator', message: mutation.note.body ?? '', timestamp: new Date().toISOString(), voiceFileRef: mutation.note.voiceFileRef ?? '', status: mutation.note.status ?? '', error: mutation.note.error ?? '' };
          if (existing) {
            if (!existing.message && nextNote.message) existing.message = nextNote.message;
            if (!existing.voiceFileRef && nextNote.voiceFileRef) existing.voiceFileRef = nextNote.voiceFileRef;
            if (!existing.status && nextNote.status) existing.status = nextNote.status;
            if (!existing.error && nextNote.error) existing.error = nextNote.error;
            existing.updatedAt = new Date().toISOString();
          } else notes.push(nextNote);
          notesByThread[mutation.note.threadId] = notes;
        }
        if (mutation.action === 'update-note' && mutation.note?.threadId) {
          const notesByThread = normalizeLedgerNotes(ledger);
          const notes = notesByThread[mutation.note.threadId] ?? [];
          const noteId = String(mutation.note.id ?? '');
          let note = notes.find((entry) => String(entry.id ?? '') === noteId || String(entry.voiceFileRef ?? '') === mutation.note?.voiceFileRef);
          if (!note && noteId) {
            note = { id: noteId, role: mutation.note.source === 'voice' ? 'voice' : 'operator', message: mutation.note.body ?? '', timestamp: new Date().toISOString(), voiceFileRef: mutation.note.voiceFileRef ?? '', status: mutation.note.status ?? '', error: mutation.note.error ?? '' };
            notes.push(note);
          }
          if (note) {
            if (typeof mutation.note.body === 'string') note.message = mutation.note.body;
            if (typeof mutation.note.voiceFileRef === 'string') note.voiceFileRef = mutation.note.voiceFileRef;
            if (typeof mutation.note.status === 'string') note.status = mutation.note.status;
            if (typeof mutation.note.error === 'string') note.error = mutation.note.error;
            note.updatedAt = new Date().toISOString();
          }
          notesByThread[mutation.note.threadId] = notes;
        }
        if (mutation.action === 'delete-note' && mutation.note?.threadId) {
          const notesByThread = normalizeLedgerNotes(ledger);
          notesByThread[mutation.note.threadId] = (notesByThread[mutation.note.threadId] ?? []).slice(0, -1);
        }
        if (mutation.action === 'paste-selection' && mutation.selection) {
          const suffix = `copy-${Date.now()}`;
          const cardIds = new Set(mutation.selection.cardIds ?? []);
          const zoneIds = new Set(mutation.selection.zoneIds ?? []);
          const groupIds = new Set(mutation.selection.groupIds ?? []);
          const copiedCards = (ledger.cards ?? []).filter((card) => cardIds.has(String(card.id ?? ''))).map((card) => ({
            ...card,
            id: `${String(card.id ?? 'card')}-${suffix}`,
            x: Number(card.x ?? 0) + 48,
            y: Number(card.y ?? 0) + 48
          }));
          const copiedAnnotations = (ledger.annotations ?? []).filter((annotation) => zoneIds.has(String(annotation.id ?? '')) || groupIds.has(String(annotation.id ?? ''))).map((annotation) => ({
            ...annotation,
            id: `${String(annotation.id ?? 'region')}-${suffix}`,
            x: Number(annotation.x ?? 0) + 48,
            y: Number(annotation.y ?? 0) + 48
          }));
          ledger.cards = (ledger.cards ?? []).concat(copiedCards);
          ledger.annotations = (ledger.annotations ?? []).concat(copiedAnnotations);
        }
        writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
        response.end(JSON.stringify(ledger));
        return;
      }
      response.end(existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : JSON.stringify({ ok: false, missing: ledgerPath }));
      return;
    }
    const isAssetRoute = url.startsWith('/assets/') || url.startsWith('/src/');
    const statePath = resolve(blueprinttoolRoot, 'state.json');
    const blueprintState = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) as { tabs?: Array<{ id?: string }> } : { tabs: [] };
    const routeTabId = url.split('/').filter(Boolean)[0] ?? '';
    const isLedgerRoute = Boolean(routeTabId && blueprintState.tabs?.some((tab) => tab.id === routeTabId));
    const isAppRoute = url === '/' || isLedgerRoute;
    const requestedPath = isAssetRoute ? resolve(frontendRoot, url.slice(1)) : resolve(frontendRoot, 'index.html');
    const assetPath = existsSync(requestedPath) ? requestedPath : requestedPath.replace(/\.js$/, '.ts');
    if ((isAppRoute || isAssetRoute) && existsSync(assetPath)) {
      response.setHeader('content-type', contentTypeFor(assetPath));
      response.setHeader('cache-control', 'no-store');
      const source = readFileSync(assetPath, 'utf8');
      response.end(assetPath.endsWith('.ts') ? transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ES2022 } }).outputText : source);
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ ok: true, method: request.method, url }));
  });
  server.listen(port, String(payload.host ?? '127.0.0.1'));
  runtime.server = server;
  return { ok: true, port, server };
}

/**
 * WHAT: Implements the create-http-server helper from the front/back master ledger.
 * WHY: The generated scaffold needs executable behavior while preserving one function per file.
 */
import { createServer, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { telemetry } from '@backend/telemetry/harness.js';
import { transcribeVoiceController } from '@backend/business/transcription/controller/transcribe-voice-controller.js';
import { persistUploadedVoiceAudio } from '@backend/business/transcription/effect/persist-uploaded-voice-audio.js';
import { resolveBlueprinttoolRoot } from './resolve-blueprinttool-root.js';
import { readRequestBuffer } from './read-request-buffer.js';
import { contentTypeFor } from './content-type-for.js';
import { normalizeLedgerNotes } from './normalize-ledger-notes.js';
import { relationshipReferencesCard } from '../../ledger/helper/relationship-references-card.js';
import { duplicateCardContentSidecar, externalizeCardContent, hydrateLedgerCardContent, writeCardDescriptionSidecar } from '../../ledger/helper/card-content-sidecar.js';
import { watchCardContentFiles, type CardContentChange } from '../../refresh/helper/watch-card-content-files.js';

type AnyRecord = Record<string, unknown>;

const blueprinttoolAssetPrefix = '/.blueprinttool/';
const allowedBlueprinttoolAssetExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

function isAllowedBlueprinttoolAsset(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return allowedBlueprinttoolAssetExtensions.some((extension) => normalized.endsWith(extension));
}

function tryServeBlueprinttoolAsset(input: { url: string; blueprinttoolRoot: string; response: ServerResponse }): boolean {
  let decodedUrl = '';
  try {
    decodedUrl = decodeURIComponent(input.url);
  } catch {
    decodedUrl = input.url;
  }
  if (!decodedUrl.startsWith(blueprinttoolAssetPrefix)) return false;
  const assetPath = resolve(input.blueprinttoolRoot, decodedUrl.slice(blueprinttoolAssetPrefix.length));
  const relativeAssetPath = relative(input.blueprinttoolRoot, assetPath);
  const isInsideBlueprinttool = relativeAssetPath && !relativeAssetPath.startsWith('..') && !isAbsolute(relativeAssetPath);
  if (!isInsideBlueprinttool || !isAllowedBlueprinttoolAsset(assetPath) || !existsSync(assetPath)) {
    input.response.statusCode = 404;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: false, missing: decodedUrl }));
    return true;
  }
  input.response.setHeader('content-type', contentTypeFor(assetPath));
  input.response.setHeader('cache-control', 'no-store');
  input.response.end(readFileSync(assetPath));
  return true;
}

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
  const contentEventClients = new Set<ServerResponse>();
  const publishCardContentChange = (event: CardContentChange): void => {
    const message = `event: card-content-change\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of contentEventClients) client.write(message);
  };
  const cardContentWatcher = watchCardContentFiles({ blueprinttoolRoot, onChange: publishCardContentChange });
  const server = createServer(async (request, response) => {
    const url = (request.url ?? '/').split('?')[0];
    if (tryServeBlueprinttoolAsset({ url, blueprinttoolRoot, response })) return;
    if (url === '/api/ledger-content-events' && request.method === 'GET') {
      response.writeHead(200, {
        'cache-control': 'no-store',
        connection: 'keep-alive',
        'content-type': 'text/event-stream',
      });
      response.write(': connected\n\n');
      contentEventClients.add(response);
      request.on('close', () => contentEventClients.delete(response));
      return;
    }
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
          cardId?: string;
          cardPatch?: { id?: string; status?: string; title?: string; description?: string; imageSizes?: Record<string, { width?: number; height?: number }> };
          annotation?: Record<string, unknown>;
          relationship?: Record<string, unknown>;
          zoneIds?: string[];
          groupIds?: string[];
          relationshipIds?: string[];
          geometry?: Record<string, Record<string, { x: number; y: number; width: number; height: number }>>;
          region?: { id?: string; kind?: string; label?: string; color?: string };
          note?: { id?: string; threadId?: string; body?: string; voiceFileRef?: string; status?: string; transcriptionStartedAt?: string; source?: string; error?: string };
          selection?: { cardIds?: string[]; zoneIds?: string[]; groupIds?: string[] };
        } : {};
        const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
          cards?: Array<Record<string, unknown>>;
          annotations?: Array<Record<string, unknown>>;
          relationships?: Array<Record<string, unknown>>;
          notes?: Record<string, Array<Record<string, unknown>>>;
          deletedNoteIds?: Record<string, string[]>;
        };
        if ((mutation.action === 'create-zone' || mutation.action === 'create-group') && mutation.annotation?.id) {
          const id = String(mutation.annotation.id);
          ledger.annotations = (ledger.annotations ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.annotation);
        }
        if (mutation.action === 'create-card' && mutation.card?.id) {
          const id = String(mutation.card.id);
          externalizeCardContent({ blueprinttoolRoot, card: mutation.card, ledgerPath });
          ledger.cards = (ledger.cards ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.card);
        }
        if (mutation.action === 'create-relationship' && mutation.relationship?.id) {
          const id = String(mutation.relationship.id);
          ledger.relationships = (ledger.relationships ?? []).filter((entry) => String(entry.id ?? '') !== id).concat(mutation.relationship);
        }
        if (mutation.action === 'patch-card' && mutation.cardPatch?.id) {
          const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === mutation.cardPatch?.id);
          if (card && (mutation.cardPatch.status === 'todo' || mutation.cardPatch.status === 'done')) card.status = mutation.cardPatch.status;
          if (card && typeof mutation.cardPatch.title === 'string') card.title = mutation.cardPatch.title;
          if (card && typeof mutation.cardPatch.description === 'string') {
            writeCardDescriptionSidecar({ blueprinttoolRoot, card, description: mutation.cardPatch.description, ledgerPath });
          }
          if (card && mutation.cardPatch.imageSizes && typeof mutation.cardPatch.imageSizes === 'object') card.imageSizes = mutation.cardPatch.imageSizes;
        }
        if (mutation.action === 'delete-card' && mutation.cardId) {
          const cardId = String(mutation.cardId);
          ledger.cards = (ledger.cards ?? []).filter((entry) => String(entry.id ?? '') !== cardId);
          ledger.relationships = (ledger.relationships ?? []).filter((entry) => !relationshipReferencesCard(entry, cardId));
          const notesByThread = normalizeLedgerNotes(ledger);
          delete notesByThread[`thread-${cardId}`];
          ledger.notes = notesByThread;
        }
        if (mutation.action === 'delete-zones') {
          const zoneIds = new Set(mutation.zoneIds ?? []);
          const groupIds = new Set(mutation.groupIds ?? []);
          ledger.annotations = (ledger.annotations ?? []).filter((entry) => {
            const id = String(entry.id ?? '');
            return entry.variant === 'group' ? !groupIds.has(id) : !zoneIds.has(id);
          });
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
          const deletedNoteIds = ledger.deletedNoteIds?.[mutation.note.threadId] ?? [];
          if (deletedNoteIds.map((id) => String(id)).includes(noteId)) {
            notesByThread[mutation.note.threadId] = notes.filter((entry) => String(entry.id ?? '') !== noteId);
            ledger.notes = notesByThread;
            writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
            response.end(JSON.stringify(hydrateLedgerCardContent(ledger, blueprinttoolRoot)));
            return;
          }
          const existing = notes.find((entry) => String(entry.id ?? '') === noteId);
          const nextNote = { id: noteId, role: mutation.note.source === 'voice' ? 'voice' : 'operator', message: mutation.note.body ?? '', timestamp: new Date().toISOString(), voiceFileRef: mutation.note.voiceFileRef ?? '', status: mutation.note.status ?? '', transcriptionStartedAt: mutation.note.transcriptionStartedAt ?? '', error: mutation.note.error ?? '' };
          if (existing) {
            if (!existing.message && nextNote.message) existing.message = nextNote.message;
            if (!existing.voiceFileRef && nextNote.voiceFileRef) existing.voiceFileRef = nextNote.voiceFileRef;
            if (!existing.status && nextNote.status) existing.status = nextNote.status;
            if (!existing.transcriptionStartedAt && nextNote.transcriptionStartedAt) existing.transcriptionStartedAt = nextNote.transcriptionStartedAt;
            if (!existing.error && nextNote.error) existing.error = nextNote.error;
            existing.updatedAt = new Date().toISOString();
          } else notes.push(nextNote);
          notesByThread[mutation.note.threadId] = notes;
        }
        if (mutation.action === 'update-note' && mutation.note?.threadId) {
          const notesByThread = normalizeLedgerNotes(ledger);
          const notes = notesByThread[mutation.note.threadId] ?? [];
          const noteId = String(mutation.note.id ?? '');
          const deletedNoteIds = ledger.deletedNoteIds?.[mutation.note.threadId] ?? [];
          if (noteId && deletedNoteIds.map((id) => String(id)).includes(noteId)) {
            notesByThread[mutation.note.threadId] = notes.filter((entry) => String(entry.id ?? '') !== noteId);
            ledger.notes = notesByThread;
            writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
            response.end(JSON.stringify(hydrateLedgerCardContent(ledger, blueprinttoolRoot)));
            return;
          }
          let note = notes.find((entry) => String(entry.id ?? '') === noteId || String(entry.voiceFileRef ?? '') === mutation.note?.voiceFileRef);
          if (!note && noteId) {
            note = { id: noteId, role: mutation.note.source === 'voice' ? 'voice' : 'operator', message: mutation.note.body ?? '', timestamp: new Date().toISOString(), voiceFileRef: mutation.note.voiceFileRef ?? '', status: mutation.note.status ?? '', transcriptionStartedAt: mutation.note.transcriptionStartedAt ?? '', error: mutation.note.error ?? '' };
            notes.push(note);
          }
          if (note) {
            if (typeof mutation.note.body === 'string') note.message = mutation.note.body;
            if (typeof mutation.note.voiceFileRef === 'string') note.voiceFileRef = mutation.note.voiceFileRef;
            if (typeof mutation.note.status === 'string') note.status = mutation.note.status;
            if (typeof mutation.note.transcriptionStartedAt === 'string') note.transcriptionStartedAt = mutation.note.transcriptionStartedAt;
            if (typeof mutation.note.error === 'string') note.error = mutation.note.error;
            note.updatedAt = new Date().toISOString();
          }
          notesByThread[mutation.note.threadId] = notes;
        }
        if (mutation.action === 'delete-note' && mutation.note?.threadId) {
          const notesByThread = normalizeLedgerNotes(ledger);
          const notes = notesByThread[mutation.note.threadId] ?? [];
          const noteId = String(mutation.note.id ?? '');
          const tombstonedId = noteId || String(notes.at(-1)?.id ?? '');
          if (tombstonedId) {
            const deletedNoteIds = ledger.deletedNoteIds && typeof ledger.deletedNoteIds === 'object' ? ledger.deletedNoteIds : {};
            deletedNoteIds[mutation.note.threadId] = Array.from(new Set([...(deletedNoteIds[mutation.note.threadId] ?? []), tombstonedId]));
            ledger.deletedNoteIds = deletedNoteIds;
          }
          notesByThread[mutation.note.threadId] = noteId ? notes.filter((entry) => String(entry.id ?? '') !== noteId) : notes.slice(0, -1);
        }
        if (mutation.action === 'paste-selection' && mutation.selection) {
          const suffix = `copy-${Date.now()}`;
          const cardIds = new Set(mutation.selection.cardIds ?? []);
          const zoneIds = new Set(mutation.selection.zoneIds ?? []);
          const groupIds = new Set(mutation.selection.groupIds ?? []);
          const copiedCards = (ledger.cards ?? []).filter((card) => cardIds.has(String(card.id ?? ''))).map((card) => {
            const copiedCard = {
              ...card,
              id: `${String(card.id ?? 'card')}-${suffix}`,
              x: Number(card.x ?? 0) + 48,
              y: Number(card.y ?? 0) + 48
            };
            duplicateCardContentSidecar({ blueprinttoolRoot, ledgerPath, sourceCard: card, targetCard: copiedCard });
            return copiedCard;
          });
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
        response.end(JSON.stringify(hydrateLedgerCardContent(ledger, blueprinttoolRoot)));
        return;
      }
      if (existsSync(ledgerPath)) {
        const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord;
        response.end(JSON.stringify(hydrateLedgerCardContent(ledger, blueprinttoolRoot)));
      } else {
        response.end(JSON.stringify({ ok: false, missing: ledgerPath }));
      }
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
  server.on('close', () => {
    cardContentWatcher.close();
    contentEventClients.clear();
  });
  server.listen(port, String(payload.host ?? '127.0.0.1'));
  runtime.server = server;
  return { ok: true, port, server };
}

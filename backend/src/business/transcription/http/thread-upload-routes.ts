/**
 * WHAT: Installs thread image and file uploads and records task content contributions.
 * WHY: Upload transactions belong to the transcription/media boundary instead of server composition.
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskCurrentEntity } from '../../task-state/helper/task-current-state-types.js';
import type { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { createFederationContentScheduler } from '../../federation/helper/federation-content-scheduler.js';
import {
  materializeTaskResources,
  TaskContentMaterializationError,
} from '../../federation/helper/materialize-task-mutation-inputs.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

function safeAssetSegment(value: unknown): string {
  return String(value || 'untitled')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function imageExtension(mimeType: unknown): string {
  const normalized = String(mimeType ?? '').toLowerCase().split(';')[0]!.trim();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return '.jpg';
  if (normalized === 'image/webp') return '.webp';
  if (normalized === 'image/gif') return '.gif';
  if (normalized === 'image/svg+xml') return '.svg';
  return '.png';
}

function originalFileName(value: unknown): string {
  let decoded = String(value || 'attachment');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = String(value || 'attachment');
  }
  return (basename(decoded)
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'attachment').slice(0, 120);
}

function attachmentMarkdown(input: {
  fileRef: string;
  originalName: string;
  contentType: string;
}): string {
  const label = (input.originalName || 'Attachment').replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
  return input.contentType.startsWith('image/')
    ? `![${label}](${input.fileRef})`
    : `[${label}](${input.fileRef})`;
}

export async function handleThreadUploadRoutes(input: {
  contentDrain: ReturnType<typeof createFederationContentScheduler>['drain'] | null;
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  decisionOsRoot: string;
  invalidateProject: (projectId: string, entities: readonly TaskCurrentEntity[]) => void;
  localProject: DecisionOsProject | null;
  request: IncomingMessage;
  response: ServerResponse;
  taskStateForProject: (project: DecisionOsProject) => ProjectTaskState;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/thread-image-upload' && input.request.method === 'POST') {
    const imageBuffer = await readRequestBuffer(input.request);
    const mimeType = input.request.headers['content-type'] ?? 'image/png';
    const contentType = String(mimeType).toLowerCase().split(';')[0]!.trim();
    input.response.setHeader('content-type', 'application/json');
    if (!contentType.startsWith('image/') || imageBuffer.length === 0) {
      input.response.statusCode = 400;
      input.response.end(JSON.stringify({ ok: false, error: 'Expected a non-empty image upload.' }));
      return HTTP_ROUTE_HANDLED;
    }

    const threadId = safeAssetSegment(input.request.headers['x-thread-id'] ?? 'conversation-ledger');
    const ledgerId = String(input.request.headers['x-ledger-id'] ?? '');
    const cardId = threadId.startsWith('thread-') ? threadId.slice('thread-'.length) : '';
    let taskState: ProjectTaskState | null = null;
    let taskPreview: Buffer | null = null;
    if (ledgerId === 'tasks') {
      if (!input.localProject || !cardId) {
        input.response.statusCode = 400;
        input.response.end(JSON.stringify({
          ok: false,
          error: 'Task image upload requires an owned project thread.',
        }));
        return HTTP_ROUTE_HANDLED;
      }
      taskState = input.taskStateForProject(input.localProject);
      const projection = taskState.projection().ledger;
      const cardOwned = Array.isArray(projection.cards)
        && projection.cards.some((card) => (
          card
          && typeof card === 'object'
          && String((card as Record<string, unknown>).id ?? '') === cardId
        ));
      if (!cardOwned) {
        input.response.statusCode = 404;
        input.response.end(JSON.stringify({ ok: false, error: 'Task thread owner was not found.' }));
        return HTTP_ROUTE_HANDLED;
      }
      const refs = projection.threadFiles && typeof projection.threadFiles === 'object'
        ? projection.threadFiles as Record<string, unknown>
        : {};
      const threadResource = String(refs[threadId] ?? '');
      if (threadResource) {
        try {
          await materializeTaskResources({
            projectId: input.localProject.id,
            decisionOsRoot: input.localProject.decisionOsRoot,
            keys: [threadResource],
            store: taskState.store,
            contentStore: input.contentStore,
            drain: input.contentDrain,
          });
        } catch (error) {
          if (!(error instanceof TaskContentMaterializationError)) throw error;
          input.response.statusCode = error.statusCode;
          input.response.end(JSON.stringify({
            ok: false,
            error: error.code,
            contentFile: error.key,
          }));
          return HTTP_ROUTE_HANDLED;
        }
      }
      try {
        taskPreview = await sharp(imageBuffer, { failOn: 'error' })
          .rotate()
          .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 78, alphaQuality: 90, effort: 6, smartSubsample: true })
          .toBuffer();
      } catch (error) {
        input.response.statusCode = 422;
        input.response.end(JSON.stringify({
          ok: false,
          error: 'Image upload could not be decoded.',
          detail: error instanceof Error ? error.message : String(error),
        }));
        return HTTP_ROUTE_HANDLED;
      }
    }
    const extension = imageExtension(mimeType);
    const directory = resolve(input.decisionOsRoot, 'thread-images', threadId);
    mkdirSync(directory, { recursive: true });
    const fileName = `paste-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
    const filePath = resolve(directory, fileName);
    const imageFileRef = `/.decision-os/thread-images/${threadId}/${fileName}`;
    const originalTemporary = `${filePath}.upload-${process.pid}`;
    let previewFile = '';
    let previewFileRef = '';

    try {
      writeFileSync(originalTemporary, imageBuffer);
      renameSync(originalTemporary, filePath);
      if (taskState && input.localProject) {
        const previewName = `${fileName.slice(0, -extension.length)}.canvas-preview-v1.webp`;
        previewFile = resolve(directory, previewName);
        previewFileRef = `/.decision-os/thread-images/${threadId}/${previewName}`;
        const previewTemporary = `${previewFile}.upload-${process.pid}`;
        writeFileSync(previewTemporary, taskPreview!);
        renameSync(previewTemporary, previewFile);
        const delta = await taskState.recordContentContribution(
          cardId,
          [imageFileRef, previewFileRef],
        );
        input.invalidateProject(input.localProject.id, delta.entities);
      }
    } catch (error) {
      rmSync(originalTemporary, { force: true });
      rmSync(filePath, { force: true });
      if (previewFile) rmSync(previewFile, { force: true });
      input.response.statusCode = 422;
      input.response.end(JSON.stringify({
        ok: false,
        error: 'Image upload could not be installed transactionally.',
        detail: error instanceof Error ? error.message : String(error),
      }));
      return HTTP_ROUTE_HANDLED;
    }

    input.response.statusCode = 201;
    input.response.end(JSON.stringify({
      ok: true,
      imageFileRef,
      previewFileRef,
      previewProfile: previewFileRef ? 'canvas-preview-v1' : '',
      markdown: `![Pasted image](${imageFileRef})`,
    }));
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url === '/api/thread-file-upload' && input.request.method === 'POST') {
    const fileBuffer = await readRequestBuffer(input.request);
    const contentType = String(input.request.headers['content-type'] ?? 'application/octet-stream')
      .toLowerCase().split(';')[0]!.trim() || 'application/octet-stream';
    const originalName = originalFileName(input.request.headers['x-file-name']);
    input.response.setHeader('content-type', 'application/json');
    if (fileBuffer.length === 0) {
      input.response.statusCode = 400;
      input.response.end(JSON.stringify({ ok: false, error: 'Expected a non-empty file upload.' }));
      return HTTP_ROUTE_HANDLED;
    }

    const threadId = safeAssetSegment(input.request.headers['x-thread-id'] ?? 'conversation-ledger');
    const directory = resolve(input.decisionOsRoot, 'thread-files', threadId);
    mkdirSync(directory, { recursive: true });
    const fileName = `file-${Date.now()}-${Math.random().toString(16).slice(2)}-${safeAssetSegment(originalName)}`;
    const filePath = resolve(directory, fileName);
    writeFileSync(filePath, fileBuffer);
    const fileRef = `/.decision-os/thread-files/${threadId}/${fileName}`;
    input.response.statusCode = 201;
    input.response.end(JSON.stringify({
      ok: true,
      fileRef,
      originalName,
      contentType,
      markdown: attachmentMarkdown({ fileRef, originalName, contentType }),
    }));
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}

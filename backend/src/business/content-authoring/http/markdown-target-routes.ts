import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MarkdownEditorTargetError,
  markdownEditorTargetLocation,
  resolveMarkdownEditorTarget,
} from '../helper/resolve-markdown-editor-target.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';

type AnyRecord = Record<string, unknown>;

export function handleMarkdownTargetRoutes(input: {
  masterRoot: string;
  projectId?: string;
  projectRoot?: string;
  projects: readonly DecisionOsProject[];
  request: IncomingMessage;
  requestPath: string;
  response: ServerResponse;
  scopedPath?: string;
  taskLedger: (project: DecisionOsProject) => AnyRecord;
}): { handled: boolean } {
  if (input.request.method !== 'GET' && input.request.method !== 'HEAD') {
    return { handled: false };
  }
  let decodedMarkdownPath = '';
  try {
    const candidate = decodeURIComponent(input.scopedPath ?? input.requestPath);
    if (candidate.toLowerCase().endsWith('.md')) {
      decodedMarkdownPath = input.projectRoot && candidate.startsWith('/.decision-os/')
        ? resolve(input.projectRoot, candidate.slice('/.decision-os/'.length))
        : candidate;
    }
  } catch {
    return { handled: false };
  }
  if (!decodedMarkdownPath) return { handled: false };

  try {
    const target = resolveMarkdownEditorTarget({
      targetPath: decodedMarkdownPath,
      projects: input.projects,
      serverRoot: input.masterRoot,
      projectId: input.projectId,
      readLedger: (project, ledgerId, ledgerFile) => {
        try {
          if (ledgerId === 'tasks') return structuredClone(input.taskLedger(project));
          const file = resolve(
            project.decisionOsRoot,
            ledgerFile.replace(/^\.decision-os\//, ''),
          );
          return JSON.parse(readFileSync(file, 'utf8')) as AnyRecord;
        } catch {
          return null;
        }
      },
    });
    input.response.statusCode = 302;
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('location', markdownEditorTargetLocation(target));
    input.response.end();
  } catch (error) {
    const targetError = error instanceof MarkdownEditorTargetError
      ? error
      : new MarkdownEditorTargetError('markdown_editor_target_not_found', 404);
    input.response.statusCode = targetError.statusCode;
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(input.request.method === 'HEAD'
      ? undefined
      : JSON.stringify({ ok: false, error: targetError.code }));
  }
  return { handled: true };
}

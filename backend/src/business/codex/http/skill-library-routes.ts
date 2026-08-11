/**
 * WHAT: Adapts authored skill and pipeline-prompt catalogs, revisions, and metadata to HTTP.
 * WHY: Content authoring transport belongs to the Codex library capability.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { commitPipelinePromptWorkingCopyController } from '../controller/commit-pipeline-prompt-working-copy-controller.js';
import { createCodexSkillLibraryController } from '../controller/create-codex-skill-library-controller.js';
import { readCodexSkillLibraryController } from '../controller/read-codex-skill-library-controller.js';
import { retryCodexSkillRevisionController } from '../controller/retry-codex-skill-revision-controller.js';
import {
  readCodexSkillRevisionContentController,
  readCodexSkillRevisionHistoryController,
} from '../controller/read-codex-skill-revision-controller.js';
import { saveCodexSkillLibraryController } from '../controller/save-codex-skill-library-controller.js';
import {
  codexSkillTags,
  readCodexSkillCatalog,
  type CodexSkillCatalogEntry,
} from '../helper/codex-skill-library.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;
type PublicationOperation = 'create' | 'retry' | 'save';

async function readJsonObject(request: IncomingMessage): Promise<AnyRecord> {
  const body = await readRequestBuffer(request);
  try {
    return JSON.parse(body.toString('utf8') || '{}') as AnyRecord;
  } catch {
    return {};
  }
}

function sendResult(response: ServerResponse, result: AnyRecord, successStatus: number): void {
  response.setHeader('content-type', 'application/json');
  response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : successStatus));
  response.end(JSON.stringify(result));
}

export async function handleCodexSkillLibraryRoutes(input: {
  applyOwnedDetail: (result: AnyRecord) => AnyRecord;
  applyOwnedMetadata: (skills: CodexSkillCatalogEntry[]) => CodexSkillCatalogEntry[];
  masterDecisionOsRoot: string;
  publishAuthoredSkill: (
    skillName: string,
    operation: PublicationOperation,
  ) => void;
  recordRevisionFailure: (skillName: string, result: AnyRecord) => void;
  request: IncomingMessage;
  requestRuntime: AnyRecord;
  requestUrl: URL;
  response: ServerResponse;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/api/codex/skill-library' && input.request.method === 'POST') {
    const payload = await readJsonObject(input.request);
    const shared = payload.contentKind === 'federated-skill'
      || payload.contentKind === 'pipeline-prompt';
    const runtime = shared
      ? { ...input.requestRuntime, decisionOsRoot: input.masterDecisionOsRoot, projectId: '' }
      : input.requestRuntime;
    const result = input.applyOwnedDetail(await createCodexSkillLibraryController({
      action_payload: payload,
      runtime_state: runtime,
    }));
    const skill = result.skill as AnyRecord | undefined;
    const publishSkillName = result.ok === true && skill?.contentKind === 'federated-skill'
      ? String(skill.name ?? '')
      : '';
    sendResult(input.response, result, 201);
    if (publishSkillName) input.publishAuthoredSkill(publishSkillName, 'create');
    return HTTP_ROUTE_HANDLED;
  }

  const workingCopyCommitRoute = input.url.match(
    /^\/api\/codex\/(skill-library|server-skills)\/([^/]+)\/revisions\/commit$/,
  );
  // WHAT: commit one validated registered pipeline-prompt working copy without replacing its bytes.
  // WHY: direct prompt editing needs a focused server-owned Git transaction after the edit.
  if (workingCopyCommitRoute && input.request.method === 'POST') {
    const serverOwned = workingCopyCommitRoute[1] === 'server-skills';
    const skillName = decodeRouteSegment(workingCopyCommitRoute[2]);
    const runtime = serverOwned
      ? { ...input.requestRuntime, decisionOsRoot: input.masterDecisionOsRoot, projectId: '' }
      : input.requestRuntime;
    const result = input.applyOwnedDetail(await commitPipelinePromptWorkingCopyController({
      action_payload: { ...await readJsonObject(input.request), skillName },
      runtime_state: runtime,
    }));
    // WHAT: record only a recoverable Git failure emitted after validated working bytes.
    // WHY: commit recovery evidence must remain visible without failing unrelated routes.
    if (result.ok === false && result.recovery) input.recordRevisionFailure(skillName, result);
    input.response.setHeader('cache-control', 'no-store');
    sendResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  const retryRoute = input.url.match(
    /^\/api\/codex\/(skill-library|server-skills)\/([^/]+)\/revisions\/retry$/,
  );
  if (retryRoute && input.request.method === 'POST') {
    const serverOwned = retryRoute[1] === 'server-skills';
    const skillName = decodeRouteSegment(retryRoute[2]);
    const runtime = serverOwned
      ? { ...input.requestRuntime, decisionOsRoot: input.masterDecisionOsRoot, projectId: '' }
      : input.requestRuntime;
    const result = input.applyOwnedDetail(await retryCodexSkillRevisionController({
      action_payload: { ...await readJsonObject(input.request), skillName },
      runtime_state: runtime,
    }));
    const skill = result.skill as AnyRecord | undefined;
    const publish = result.ok === true && skill?.contentKind === 'federated-skill';
    input.response.setHeader('cache-control', 'no-store');
    sendResult(input.response, result, 200);
    if (publish) input.publishAuthoredSkill(skillName, 'retry');
    return HTTP_ROUTE_HANDLED;
  }

  const revisionRoute = input.url.match(
    /^\/api\/codex\/(skill-library|server-skills)\/([^/]+)\/revisions(?:\/([^/]+))?$/,
  );
  if (revisionRoute && input.request.method === 'GET') {
    const serverOwned = revisionRoute[1] === 'server-skills';
    const skillName = decodeRouteSegment(revisionRoute[2]);
    const commit = revisionRoute[3] ? decodeRouteSegment(revisionRoute[3]) : '';
    const runtime = serverOwned
      ? { ...input.requestRuntime, decisionOsRoot: input.masterDecisionOsRoot, projectId: '' }
      : input.requestRuntime;
    const result = commit
      ? await readCodexSkillRevisionContentController({
        action_payload: { skillName, commit },
        runtime_state: runtime,
      })
      : await readCodexSkillRevisionHistoryController({
        action_payload: {
          skillName,
          cursor: input.requestUrl.searchParams.get('cursor'),
          limit: input.requestUrl.searchParams.get('limit'),
        },
        runtime_state: runtime,
      });
    input.response.setHeader('cache-control', 'no-store');
    sendResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/server-skills/')
    && input.request.method === 'GET') {
    const skillName = decodeRouteSegment(input.url.slice('/api/codex/server-skills/'.length));
    const result = await readCodexSkillLibraryController({
      action_payload: { skillName },
      runtime_state: {
        ...input.requestRuntime,
        decisionOsRoot: input.masterDecisionOsRoot,
        projectId: '',
      },
    });
    sendResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/server-skills/')
    && input.request.method === 'PUT') {
    const skillName = decodeRouteSegment(input.url.slice('/api/codex/server-skills/'.length));
    const payload = await readJsonObject(input.request);
    const result = await saveCodexSkillLibraryController({
      action_payload: { ...payload, skillName },
      runtime_state: {
        ...input.requestRuntime,
        decisionOsRoot: input.masterDecisionOsRoot,
        projectId: '',
      },
    });
    const skill = result.skill as AnyRecord | undefined;
    if (result.ok === false && result.recovery) input.recordRevisionFailure(skillName, result);
    const publish = result.ok === true
      && Object.prototype.hasOwnProperty.call(payload, 'markdown')
      && skill?.contentKind === 'federated-skill';
    sendResult(input.response, result, 200);
    if (publish) input.publishAuthoredSkill(skillName, 'save');
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/skill-library/')
    && input.request.method === 'GET') {
    const skillName = decodeRouteSegment(input.url.slice('/api/codex/skill-library/'.length));
    const result = input.applyOwnedDetail(await readCodexSkillLibraryController({
      action_payload: { skillName },
      runtime_state: input.requestRuntime,
    }));
    sendResult(input.response, result, 200);
    return HTTP_ROUTE_HANDLED;
  }

  if (input.url.startsWith('/api/codex/skill-library/')
    && input.request.method === 'PUT') {
    const skillName = decodeRouteSegment(input.url.slice('/api/codex/skill-library/'.length));
    const payload = await readJsonObject(input.request);
    const metadataOnly = Object.keys(payload).length > 0
      && Object.keys(payload).every((key) => key === 'favorite' || key === 'tags');
    const runtime = metadataOnly
      ? { ...input.requestRuntime, decisionOsRoot: input.masterDecisionOsRoot, projectId: '' }
      : input.requestRuntime;
    const result = input.applyOwnedDetail(await saveCodexSkillLibraryController({
      action_payload: { ...payload, skillName },
      runtime_state: runtime,
    }));
    const skill = result.skill as AnyRecord | undefined;
    if (result.ok === false && result.recovery) input.recordRevisionFailure(skillName, result);
    const publish = result.ok === true
      && Object.prototype.hasOwnProperty.call(payload, 'markdown')
      && skill?.contentKind === 'federated-skill';
    sendResult(input.response, result, 200);
    if (publish) input.publishAuthoredSkill(skillName, 'save');
    return HTTP_ROUTE_HANDLED;
  }

  if ((input.url === '/api/codex/skills' || input.url === '/api/codex/server-skills')
    && input.request.method === 'GET') {
    const runtime = input.url === '/api/codex/server-skills'
      ? { ...input.requestRuntime, decisionOsRoot: input.masterDecisionOsRoot, projectId: '' }
      : input.requestRuntime;
    const catalog = readCodexSkillCatalog({
      decisionOsRoot: String(runtime.decisionOsRoot),
      runtime,
    }).skills;
    const skills = input.url === '/api/codex/server-skills'
      ? catalog
      : input.applyOwnedMetadata(catalog);
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = 200;
    input.response.end(JSON.stringify({ ok: true, skills, availableTags: codexSkillTags }));
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}

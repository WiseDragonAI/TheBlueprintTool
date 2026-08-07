/**
 * WHAT: Captures immutable ownership for responsive navigation and deferred UI work.
 * WHY: Delayed transitions must not act on a route or presentation that no longer owns them.
 */

import { cardPathForProject } from './project-route.js';

const navigationHistoryModes = new Set(['push', 'replace', 'back', 'none']);

export function createNavigationTransitionDescriptor({ owner, destination, historyMode = 'push', guard = 'none', presentation = '' }) {
  const normalizedOwner = String(owner ?? '').trim();
  const normalizedDestination = String(destination ?? '').trim();
  const normalizedGuard = String(guard ?? '').trim();
  const normalizedPresentation = String(presentation ?? '').trim();
  if (!normalizedOwner) throw new Error('Navigation transition requires an owner.');
  if (!normalizedDestination) throw new Error('Navigation transition requires a destination.');
  if (!navigationHistoryModes.has(historyMode)) throw new Error(`Unknown navigation history mode: ${historyMode}`);
  if (!normalizedGuard) throw new Error('Navigation transition requires a guard policy.');
  if (!normalizedPresentation) throw new Error('Navigation transition requires a presentation identity.');
  return Object.freeze({
    owner: normalizedOwner,
    destination: normalizedDestination,
    historyMode,
    guard: normalizedGuard,
    presentation: normalizedPresentation,
  });
}

function appendReplica(path, replicaNodeId) {
  const normalizedReplica = String(replicaNodeId ?? '').trim();
  if (!normalizedReplica) return path;
  const query = new URLSearchParams({ replica: normalizedReplica });
  return `${path}?${query}`;
}

export function resolveParentCardDestination({ projectId, ledgerId, parentCardId, zones = [], replicaNodeId = '' }) {
  const normalizedParentId = String(parentCardId ?? '').trim();
  if (!normalizedParentId) return null;
  const parentZone = zones.find((zone) => Array.isArray(zone?.cards)
    && zone.cards.some((card) => String(card?.id) === normalizedParentId));
  if (!parentZone?.id) return null;
  return Object.freeze({
    cardId: normalizedParentId,
    zoneId: String(parentZone.id),
    destination: appendReplica(cardPathForProject(projectId, ledgerId, parentZone.id, normalizedParentId), replicaNodeId),
  });
}

export function captureRouteSnapshot(locationLike, parseScope) {
  const pathname = String(locationLike.pathname || '/');
  const scope = parseScope(pathname);
  const [section = '', ledgerId = '', zoneMarker = '', zoneId = '', cardMarker = '', cardId = ''] = scope?.segments ?? [];
  const search = String(locationLike.search || '');
  return Object.freeze({
    pathname,
    search,
    hash: String(locationLike.hash || ''),
    projectId: String(scope?.projectId || ''),
    replicaNodeId: new URLSearchParams(search).get('replica')?.trim() || '',
    section,
    ledgerId,
    zoneId: zoneMarker === 'zones' ? zoneId : '',
    cardId: cardMarker === 'cards' ? cardId : '',
  });
}

export function sameRouteSnapshot(left, right) {
  return ['pathname', 'search', 'hash', 'projectId', 'section', 'ledgerId', 'zoneId', 'cardId']
    .every((key) => String(left?.[key] || '') === String(right?.[key] || ''));
}

export function cardPresentationIdentity(snapshot) {
  if (!snapshot?.projectId || !snapshot?.ledgerId || !snapshot?.cardId) return '';
  return [snapshot.projectId, snapshot.ledgerId, snapshot.zoneId, snapshot.cardId].join(':');
}

export function federationEventOwnsCard(payload, snapshot) {
  if (!snapshot?.cardId) return false;
  if (payload?.projectId && String(payload.projectId) !== snapshot.projectId) return false;
  if (payload?.ledgerId && String(payload.ledgerId) !== snapshot.ledgerId) return false;
  if (payload?.cardId && String(payload.cardId) !== snapshot.cardId) return false;
  return true;
}

export function acceptedRunOwnsRoute(detail, snapshot, threadPresentationGeneration) {
  return detail?.actionOwned === true
    && String(detail.projectId || '') === snapshot.projectId
    && String(detail.ledgerId || '') === snapshot.ledgerId
    && String(detail.cardId || '') === snapshot.cardId
    && String(detail.pathname || '') === snapshot.pathname
    && Number(detail.threadPresentationGeneration) === Number(threadPresentationGeneration);
}

/** WHAT: Captures immutable ownership for responsive navigation and deferred UI work. */

export function captureRouteSnapshot(locationLike, parseScope) {
  const pathname = String(locationLike.pathname || '/');
  const scope = parseScope(pathname);
  const [section = '', ledgerId = '', marker = '', third = '', cardMarker = '', legacyCardId = ''] = scope?.segments ?? [];
  const canonicalCard = marker === 'cards' ? third : '';
  const zoneId = marker === 'zones' ? third : '';
  const cardId = canonicalCard || (cardMarker === 'cards' ? legacyCardId : '');
  const search = String(locationLike.search || '');
  return Object.freeze({
    pathname,
    search,
    hash: String(locationLike.hash || ''),
    projectId: String(scope?.projectId || ''),
    replicaNodeId: new URLSearchParams(search).get('replica')?.trim() || '',
    section,
    ledgerId,
    zoneId,
    cardId,
  });
}

export function sameRouteSnapshot(left, right) {
  return ['pathname', 'search', 'hash', 'projectId', 'section', 'ledgerId', 'zoneId', 'cardId']
    .every((key) => String(left?.[key] || '') === String(right?.[key] || ''));
}

export function cardPresentationIdentity(snapshot) {
  if (!snapshot?.projectId || !snapshot?.ledgerId || !snapshot?.cardId) return '';
  return [snapshot.projectId, snapshot.ledgerId, snapshot.cardId].join(':');
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

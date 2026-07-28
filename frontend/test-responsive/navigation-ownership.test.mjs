import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptedRunOwnsRoute, captureRouteSnapshot, cardPresentationIdentity, federationEventOwnsCard, sameRouteSnapshot } from '../src/app/responsive/navigation-ownership.js';

const parseScope = (pathname) => {
  const match = pathname.match(/^\/p\/([^/]+)\/(.*)$/);
  return match ? { projectId: match[1], segments: match[2].split('/') } : null;
};

test('route ownership includes canonical project, ledger, card, and browser location', () => {
  const first = captureRouteSnapshot({ pathname: '/p/project-a/ledgers/specs/cards/card-a', search: '?replica=mobile', hash: '#note' }, parseScope);
  const same = captureRouteSnapshot({ pathname: '/p/project-a/ledgers/specs/cards/card-a', search: '?replica=mobile', hash: '#note' }, parseScope);
  const newer = captureRouteSnapshot({ pathname: '/p/project-a/ledgers/specs/cards/card-b', search: '?replica=mobile', hash: '#note' }, parseScope);
  assert.equal(sameRouteSnapshot(first, same), true);
  assert.equal(sameRouteSnapshot(first, newer), false);
  assert.equal(cardPresentationIdentity(first), 'project-a:specs:card-a');
  assert.equal(first.replicaNodeId, 'mobile');
});

test('federation reconciliation is scoped to the active project and card route', () => {
  const route = captureRouteSnapshot({ pathname: '/p/project-a/ledgers/specs/cards/card-a' }, parseScope);
  assert.equal(federationEventOwnsCard({ projectId: 'project-a' }, route), true);
  assert.equal(federationEventOwnsCard({ projectId: 'project-b' }, route), false);
  assert.equal(federationEventOwnsCard({ projectId: 'project-a', cardId: 'card-b' }, route), false);
});

test('accepted process navigation requires the initiating route and interaction generation', () => {
  const route = captureRouteSnapshot({ pathname: '/p/project-a/ledgers/specs/cards/card-a' }, parseScope);
  const detail = { actionOwned: true, projectId: 'project-a', ledgerId: 'specs', cardId: 'card-a', pathname: route.pathname, threadPresentationGeneration: 4 };
  assert.equal(acceptedRunOwnsRoute(detail, route, 4), true);
  assert.equal(acceptedRunOwnsRoute({ ...detail, cardId: 'card-b' }, route, 4), false);
  assert.equal(acceptedRunOwnsRoute(detail, route, 5), false);
  assert.equal(acceptedRunOwnsRoute({ ...detail, actionOwned: false }, route, 4), false);
});

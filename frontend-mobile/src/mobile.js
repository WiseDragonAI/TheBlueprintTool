const state = {
  projectName: 'decision-os',
  ledgers: [],
  ledger: null,
  activeLedgerId: '',
  activeCardId: '',
  query: '',
  type: 'all'
};

const elements = Object.fromEntries([
  'project-name', 'ledger-links', 'loading-view', 'error-view', 'error-message', 'empty-view',
  'ledger-view', 'ledger-title', 'ledger-summary', 'card-search', 'type-filters', 'card-list',
  'no-results', 'card-view', 'card-type', 'card-title', 'card-id', 'card-body'
].map((id) => [id, document.getElementById(id)]));

const asText = (value) => value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const cardSummary = (card) => asText(card?.comment?.what ?? card?.comment?.description ?? card?.description ?? '').trim();
const cardType = (card) => asText(card?.cardType ?? card?.type ?? 'Card').trim() || 'Card';
const routeParts = () => location.pathname.split('/').filter(Boolean).map(decodeURIComponent);

function setView(name) {
  for (const id of ['loading-view', 'error-view', 'empty-view', 'ledger-view', 'card-view']) {
    elements[id].hidden = id !== name;
  }
}

function closeMenu() {
  document.body.classList.remove('menu-open');
  document.querySelector('.menu-button').setAttribute('aria-expanded', 'false');
}

function openMenu() {
  document.body.classList.add('menu-open');
  document.querySelector('.menu-button').setAttribute('aria-expanded', 'true');
}

function ledgerPath(ledgerId) {
  return `/${encodeURIComponent(ledgerId)}`;
}

function cardPath(ledgerId, cardId) {
  return `${ledgerPath(ledgerId)}/card/${encodeURIComponent(cardId)}`;
}

function navigate(path, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  closeMenu();
  void loadRoute();
}

function renderLedgerLinks() {
  elements['ledger-links'].replaceChildren(...state.ledgers.map((ledger) => {
    const link = document.createElement('a');
    link.className = `ledger-link${ledger.id === state.activeLedgerId ? ' active' : ''}`;
    link.href = ledgerPath(ledger.id);
    link.textContent = ledger.title;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.getAttribute('href'));
    });
    return link;
  }));
}

function renderFilters(cards) {
  const types = [...new Set(cards.map(cardType))].sort((a, b) => a.localeCompare(b));
  if (state.type !== 'all' && !types.includes(state.type)) state.type = 'all';
  const options = [['all', 'All'], ...types.map((type) => [type, type])];
  elements['type-filters'].replaceChildren(...options.map(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-button${state.type === value ? ' active' : ''}`;
    button.textContent = label;
    button.setAttribute('aria-pressed', String(state.type === value));
    button.addEventListener('click', () => {
      state.type = value;
      renderFilters(cards);
      renderCards(cards);
    });
    return button;
  }));
}

function renderCards(cards) {
  const query = state.query.trim().toLocaleLowerCase();
  const filtered = cards.filter((card) => {
    if (state.type !== 'all' && cardType(card) !== state.type) return false;
    if (!query) return true;
    return [card.id, card.title, cardType(card), card.domainId, cardSummary(card)]
      .some((value) => asText(value).toLocaleLowerCase().includes(query));
  });
  const rows = filtered.map((card) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-row';
    const copy = document.createElement('span');
    const type = document.createElement('span');
    type.className = 'card-type';
    type.textContent = cardType(card);
    const title = document.createElement('h2');
    title.textContent = asText(card.title).trim() || `Card ${card.id}`;
    copy.append(type, title);
    const summary = cardSummary(card);
    if (summary) {
      const paragraph = document.createElement('p');
      paragraph.textContent = summary;
      copy.append(paragraph);
    }
    const arrow = document.createElement('span');
    arrow.className = 'card-row-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';
    button.append(copy, arrow);
    button.addEventListener('click', () => navigate(cardPath(state.activeLedgerId, card.id)));
    return button;
  });
  elements['card-list'].replaceChildren(...rows);
  elements['no-results'].hidden = rows.length > 0;
  elements['ledger-summary'].textContent = `${filtered.length === cards.length ? cards.length : `${filtered.length} of ${cards.length}`} cards`;
}

function appendSection(title, content) {
  if (content == null || content === '' || (Array.isArray(content) && content.length === 0)) return;
  const section = document.createElement('section');
  section.className = 'detail-section';
  const heading = document.createElement('h2');
  heading.textContent = title;
  section.append(heading);

  if (Array.isArray(content)) {
    const list = document.createElement('ul');
    for (const item of content) {
      const row = document.createElement('li');
      row.textContent = asText(item?.text ?? item?.value ?? item?.label ?? item);
      list.append(row);
    }
    section.append(list);
  } else if (typeof content === 'object') {
    const entries = Object.entries(content).filter(([key, value]) => key !== 'contentFile' && value != null && value !== '');
    if (!entries.length) return;
    const list = document.createElement('dl');
    for (const [key, value] of entries) {
      const term = document.createElement('dt');
      term.textContent = key.replace(/([a-z])([A-Z])/g, '$1 $2');
      const definition = document.createElement('dd');
      definition.textContent = asText(value);
      list.append(term, definition);
    }
    section.append(list);
  } else {
    const paragraph = document.createElement('p');
    paragraph.textContent = asText(content);
    section.append(paragraph);
    appendMarkdownImages(section, asText(content));
  }
  elements['card-body'].append(section);
}

function appendMarkdownImages(container, markdown) {
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    const image = document.createElement('img');
    image.className = 'card-image';
    image.alt = match[1] || 'Card image';
    image.loading = 'lazy';
    image.src = match[2].startsWith('.decision-os/') ? `/${match[2]}` : match[2];
    container.append(image);
  }
}

function renderCard(card) {
  state.activeCardId = asText(card.id);
  elements['card-type'].textContent = cardType(card);
  elements['card-title'].textContent = asText(card.title).trim() || `Card ${card.id}`;
  elements['card-id'].textContent = `#${card.id}${card.domainId ? ` · ${card.domainId}` : ''}`;
  elements['card-body'].replaceChildren();
  appendSection('Description', cardSummary(card));
  appendSection('Facts', card.facts);
  appendSection('Fields', card.fields);
  const extra = Object.fromEntries(Object.entries(card).filter(([key, value]) =>
    !['id', 'title', 'cardType', 'type', 'domainId', 'comment', 'facts', 'fields', 'x', 'y', 'w', 'h', 'width', 'height', 'imageSizes'].includes(key)
      && value != null && value !== '' && !(Array.isArray(value) && value.length === 0)
  ));
  appendSection('Additional details', extra);
  if (!elements['card-body'].childElementCount) appendSection('Details', 'This card has no text content.');
  setView('card-view');
  document.title = `${elements['card-title'].textContent} · ${state.projectName}`;
}

function renderLedger() {
  const cards = Array.isArray(state.ledger?.cards) ? state.ledger.cards : [];
  const active = state.ledgers.find((ledger) => ledger.id === state.activeLedgerId);
  elements['ledger-title'].textContent = active?.title ?? state.activeLedgerId;
  elements['card-search'].value = state.query;
  renderFilters(cards);
  renderCards(cards);
  setView('ledger-view');
  document.title = `${active?.title ?? state.activeLedgerId} · ${state.projectName}`;
}

async function loadLedger(ledgerId) {
  const response = await fetch(`/decision-os/${encodeURIComponent(ledgerId)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
  const ledger = await response.json();
  if (!ledger || !Array.isArray(ledger.cards)) throw new Error('The ledger response does not contain a card list.');
  state.ledger = ledger;
  state.activeLedgerId = ledgerId;
  renderLedgerLinks();
}

async function loadRoute() {
  setView('loading-view');
  try {
    const response = await fetch('/decision-os/state', { cache: 'no-store' });
    if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
    const project = await response.json();
    state.projectName = 'decision-os';
    state.ledgers = Array.isArray(project.ledgers) ? project.ledgers.filter((ledger) => ledger?.id && ledger?.title) : [];
    elements['project-name'].textContent = state.projectName;
    if (!state.ledgers.length) {
      renderLedgerLinks();
      setView('empty-view');
      return;
    }

    const [requestedLedger, marker, requestedCard] = routeParts();
    const ledgerId = state.ledgers.some((ledger) => ledger.id === requestedLedger) ? requestedLedger : state.ledgers[0].id;
    if (requestedLedger !== ledgerId) {
      navigate(ledgerPath(ledgerId), true);
      return;
    }
    if (state.activeLedgerId !== ledgerId || !state.ledger) await loadLedger(ledgerId);
    if (marker === 'card' && requestedCard) {
      const card = state.ledger.cards.find((entry) => String(entry.id) === requestedCard);
      if (card) renderCard(card);
      else navigate(ledgerPath(ledgerId), true);
    } else {
      state.activeCardId = '';
      renderLedger();
    }
  } catch (error) {
    elements['error-message'].textContent = error instanceof Error ? error.message : 'Unknown loading error.';
    setView('error-view');
  }
}

document.querySelector('.menu-button').addEventListener('click', openMenu);
document.querySelector('.close-menu-button').addEventListener('click', closeMenu);
document.querySelector('.nav-scrim').addEventListener('click', closeMenu);
document.querySelector('.refresh-button').addEventListener('click', () => {
  state.ledger = null;
  void loadRoute();
});
document.querySelector('.retry-button').addEventListener('click', () => loadRoute());
document.querySelector('.back-button').addEventListener('click', () => navigate(ledgerPath(state.activeLedgerId)));
elements['card-search'].addEventListener('input', (event) => {
  state.query = event.target.value;
  renderCards(state.ledger?.cards ?? []);
});
window.addEventListener('popstate', () => loadRoute());
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
});

void loadRoute();

const STATUS_LABELS = ['task-waiting', 'task-active', 'task-complete'];

export function parseMasterTaskMarkdown({ cardId, title, ledgerId, ledgerTitle, markdown, cardStatus = 'todo', cards = [] }) {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n');
  const labelLines = source.split('\n').filter((line) => /^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line));
  const labels = new Set(Array.from(labelLines.join('\n').matchAll(/#([a-z][a-z0-9-]*)\b/gi), (match) => match[1].toLowerCase()));
  const statuses = STATUS_LABELS.filter((status) => labels.has(status));
  const ledger = source.match(/^\s*(?:\*\*)?Ledger(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const waitingText = source.match(/^\s*(?:\*\*)?Waiting since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const waitingTime = Date.parse(waitingText);
  const activeText = source.match(/^\s*(?:\*\*)?Active since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const activeTime = Date.parse(activeText);
  const rankText = source.match(/^\s*(?:\*\*)?Queue rank(?:\*\*)?\s*:\s*(\d+)\s*$/im)?.[1] ?? '';
  const queueRank = rankText ? Number(rankText) : null;
  const diagnostics = [];
  if (!labels.has('master-task')) diagnostics.push('missing #master-task');
  if (statuses.length !== 1) diagnostics.push('expected exactly one task status label');
  if (!ledger) diagnostics.push('missing Ledger');
  if (!waitingText || !Number.isFinite(waitingTime)) diagnostics.push('invalid Waiting since');
  if (statuses[0] === 'task-active' && (!activeText || !Number.isFinite(activeTime))) diagnostics.push('invalid Active since');
  if (queueRank !== null && (!Number.isInteger(queueRank) || queueRank < 1)) diagnostics.push('invalid Queue rank');

  const subtasks = [];
  const subtaskHeading = /^##\s+(?:[A-Z]\.\s+)?Subtasks\s*$/im;
  const sectionStart = source.search(subtaskHeading);
  const afterHeading = sectionStart < 0 ? '' : source.slice(sectionStart).replace(subtaskHeading, '').replace(/^\n/, '');
  const section = afterHeading.split(/^##\s+/m, 1)[0];
  for (const line of section.split('\n')) {
    const match = line.match(/^\s*\d+[.)]\s+\[([^\]]+)]\(card:([^)]+)\)\s+[—-]\s+Status:\s*(.+?)\s*$/i);
    if (match) {
      const linked = cards.find((card) => String(card.id) === match[2].trim());
      subtasks.push({ title: match[1].trim(), cardId: match[2].trim(), status: linked?.status === 'done' ? 'complete' : 'waiting' });
      continue;
    }
    const link = line.match(/^\s*\d+[.)]\s+\[([^\]]+)]\(card:([^)]+)\)\s*$/i);
    if (link) {
      const linked = cards.find((card) => String(card.id) === link[2].trim());
      subtasks.push({ title: link[1].trim(), cardId: link[2].trim(), status: linked?.status === 'done' ? 'complete' : 'waiting' });
    }
  }
  const complete = subtasks.filter((task) => /^(?:complete|completed|done)$/i.test(task.status)).length;
  return {
    valid: diagnostics.length === 0,
    masterTask: labels.has('master-task'),
    diagnostics,
    cardId: String(cardId),
    title: String(title || `Card ${cardId}`),
    ledgerId: String(ledgerId),
    ledgerTitle: String(ledgerTitle),
    ledger,
    status: cardStatus === 'done' ? 'task-complete' : (labels.has('task-active') ? 'task-active' : 'task-waiting'),
    waitingSince: waitingText,
    waitingTime,
    activeSince: activeText,
    activeTime,
    queueRank,
    subtasks,
    complete,
    nextSubtask: subtasks.find((task) => !/^(?:complete|completed|done)$/i.test(task.status)) ?? null,
    markdown: source
  };
}

export function withActiveStatus(markdown, timestamp) {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const labelIndex = lines.findIndex((line) => /^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line) && /#master-task\b/i.test(line));
  if (labelIndex < 0) return source;
  lines[labelIndex] = lines[labelIndex].replace(/#task-(?:waiting|active|complete)\b/gi, '').replace(/\s+/g, ' ').trimEnd() + ' #task-active';
  const activeIndex = lines.findIndex((line) => /^\s*(?:\*\*)?Active since(?:\*\*)?\s*:/i.test(line));
  const activeLine = `Active since: ${timestamp}`;
  if (activeIndex >= 0) lines[activeIndex] = activeLine;
  else {
    const waitingIndex = lines.findIndex((line) => /^\s*(?:\*\*)?Waiting since(?:\*\*)?\s*:/i.test(line));
    lines.splice(waitingIndex >= 0 ? waitingIndex + 1 : labelIndex + 1, 0, activeLine);
  }
  return lines.join('\n');
}

export function deriveControlRoom(cards) {
  const parsed = cards.map(parseMasterTaskMarkdown);
  // Keep every master task visible, including completed and malformed cards.
  const eligible = parsed.filter((task) => task.masterTask);
  const compare = (left, right) => {
    if (left.queueRank !== null || right.queueRank !== null) {
      if (left.queueRank === null) return 1;
      if (right.queueRank === null) return -1;
      if (left.queueRank !== right.queueRank) return left.queueRank - right.queueRank;
    }
    const leftTime = Number.isFinite(left.waitingTime) ? left.waitingTime : Number.POSITIVE_INFINITY;
    const rightTime = Number.isFinite(right.waitingTime) ? right.waitingTime : Number.POSITIVE_INFINITY;
    return leftTime - rightTime || left.cardId.localeCompare(right.cardId);
  };
  return {
    queue: eligible.filter((task) => task.status === 'task-waiting').sort(compare),
    active: eligible.filter((task) => task.status === 'task-active').sort(compare),
    done: eligible.filter((task) => task.status === 'task-complete').sort(compare),
    ledgers: Array.from(new Set(eligible.map((task) => task.ledger))).sort((a, b) => a.localeCompare(b)),
    diagnostics: parsed.filter((task) => !task.valid && task.masterTask)
  };
}

export function visibleMasterTaskMarkdown(markdown) {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  if (/^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(lines[0] ?? '') && /#master-task\b/i.test(lines[0])) lines.shift();
  while (lines.length && (!lines[0].trim() || /^\s*(?:Ledger|Waiting since|Active since|Queue rank)\s*:/i.test(lines[0]))) lines.shift();
  const subtaskIndex = lines.findIndex((line) => /^##\s+(?:[A-Z]\.\s+)?Subtasks\s*$/i.test(line));
  if (subtaskIndex >= 0) {
    let start = subtaskIndex;
    while (start > 0 && !lines[start - 1].trim()) start -= 1;
    if (start > 0 && /^---\s*$/.test(lines[start - 1])) start -= 1;
    let end = lines.findIndex((line, index) => index > subtaskIndex && /^##\s+/.test(line));
    if (end < 0) end = lines.length;
    while (end > start && (!lines[end - 1].trim() || /^---\s*$/.test(lines[end - 1]))) end -= 1;
    lines.splice(start, end - start);
  }
  return lines.join('\n').trim();
}

export function withQueueRank(markdown, rank) {
  const line = `Queue rank: ${rank}`;
  if (/^\s*(?:\*\*)?Queue rank(?:\*\*)?\s*:/im.test(markdown)) {
    return markdown.replace(/^\s*(?:\*\*)?Queue rank(?:\*\*)?\s*:.*$/im, line);
  }
  const waiting = /^\s*(?:\*\*)?Waiting since(?:\*\*)?\s*:.*$/im;
  return waiting.test(markdown) ? markdown.replace(waiting, (value) => `${value}\n${line}`) : `${markdown.trimEnd()}\n\n${line}\n`;
}

export function waitingAge(timestamp, now = Date.now()) {
  const elapsed = Math.max(0, now - Date.parse(timestamp));
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h waiting`;
  return `${Math.floor(hours / 24)}d waiting`;
}

export function activeAge(timestamp, now = Date.now()) {
  return waitingAge(timestamp, now).replace(/ waiting$/, ' active');
}

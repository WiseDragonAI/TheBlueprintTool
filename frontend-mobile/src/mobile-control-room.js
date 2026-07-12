const STATUS_LABELS = ['task-waiting', 'task-active', 'task-complete'];

export function parseMasterTaskMarkdown({ cardId, title, ledgerId, ledgerTitle, markdown }) {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n');
  const labels = new Set(Array.from(source.matchAll(/(?:^|\s)#([a-z][a-z0-9-]*)\b/gim), (match) => match[1].toLowerCase()));
  const statuses = STATUS_LABELS.filter((status) => labels.has(status));
  const ledger = source.match(/^\s*(?:\*\*)?Ledger(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const waitingText = source.match(/^\s*(?:\*\*)?Waiting since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const waitingTime = Date.parse(waitingText);
  const rankText = source.match(/^\s*(?:\*\*)?Queue rank(?:\*\*)?\s*:\s*(\d+)\s*$/im)?.[1] ?? '';
  const queueRank = rankText ? Number(rankText) : null;
  const diagnostics = [];
  if (!labels.has('master-task')) diagnostics.push('missing #master-task');
  if (statuses.length !== 1) diagnostics.push('expected exactly one task status label');
  if (!ledger) diagnostics.push('missing Ledger');
  if (!waitingText || !Number.isFinite(waitingTime)) diagnostics.push('invalid Waiting since');
  if (queueRank !== null && (!Number.isInteger(queueRank) || queueRank < 1)) diagnostics.push('invalid Queue rank');

  const subtasks = [];
  const sectionStart = source.search(/^##\s+Subtasks\s*$/im);
  const afterHeading = sectionStart < 0 ? '' : source.slice(sectionStart).replace(/^##\s+Subtasks\s*\n?/i, '');
  const section = afterHeading.split(/^##\s+/m, 1)[0];
  for (const line of section.split('\n')) {
    const match = line.match(/^\s*\d+[.)]\s+\[([^\]]+)]\(card:([^)]+)\)\s+[—-]\s+Status:\s*(.+?)\s*$/i);
    if (match) subtasks.push({ title: match[1].trim(), cardId: match[2].trim(), status: match[3].trim() });
  }
  const complete = subtasks.filter((task) => /^(?:complete|completed|done)$/i.test(task.status)).length;
  return {
    valid: diagnostics.length === 0,
    diagnostics,
    cardId: String(cardId),
    title: String(title || `Card ${cardId}`),
    ledgerId: String(ledgerId),
    ledgerTitle: String(ledgerTitle),
    ledger,
    status: statuses[0] ?? '',
    waitingSince: waitingText,
    waitingTime,
    queueRank,
    subtasks,
    complete,
    nextSubtask: subtasks.find((task) => !/^(?:complete|completed|done)$/i.test(task.status)) ?? null,
    markdown: source
  };
}

export function deriveControlRoom(cards) {
  const parsed = cards.map(parseMasterTaskMarkdown);
  const eligible = parsed.filter((task) => task.valid && task.status !== 'task-complete');
  const compare = (left, right) => {
    if (left.queueRank !== null || right.queueRank !== null) {
      if (left.queueRank === null) return 1;
      if (right.queueRank === null) return -1;
      if (left.queueRank !== right.queueRank) return left.queueRank - right.queueRank;
    }
    return left.waitingTime - right.waitingTime || left.cardId.localeCompare(right.cardId);
  };
  return {
    queue: eligible.filter((task) => task.status === 'task-waiting').sort(compare),
    active: eligible.filter((task) => task.status === 'task-active').sort(compare),
    ledgers: Array.from(new Set(eligible.map((task) => task.ledger))).sort((a, b) => a.localeCompare(b)),
    diagnostics: parsed.filter((task) => !task.valid && task.markdown.includes('#master-task'))
  };
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

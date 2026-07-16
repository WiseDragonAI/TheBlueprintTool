/**
 * WHAT: Derives Control Room task state from canonical card Markdown and run state.
 * WHY: Responsive presentation must consume the same durable task model at every width.
 */
export function cardCodexRunId(card) {
  return String(card?.codexActiveRunId ?? '').trim()
    || String(card?.codexThreadRunId ?? '').trim()
    || String(card?.codexRunId ?? '').trim();
}

export function parseMasterTaskMarkdown({ cardId, title, labels: cardLabels = [], relationships = [], projectId = '', projectName = '', projectColor = '', ledgerId, ledgerTitle, markdown, cardStatus = 'todo', cards = [], threadNotes = [], codexRunId = '', codexPipelineRunId = '', codexStatus = '', codexStartedAt = '', codexQueuePosition = null }) {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n');
  const jsonLabels = Array.isArray(cardLabels) ? cardLabels.map(String) : [];
  const hasJsonTaskLabel = jsonLabels.some((label) => label === 'master-task' || label === 'subtask');
  const labelLines = source.split('\n').filter((line) => /^\s*(?:#[a-z][a-z0-9-]*\s*)+$/i.test(line));
  const labels = new Set(Array.from(labelLines.join('\n').matchAll(/#([a-z][a-z0-9-]*)\b/gi), (match) => match[1].toLowerCase()));
  const masterTask = jsonLabels.includes('master-task') || (!hasJsonTaskLabel && labels.has('master-task'));
  const legacyLedger = source.match(/^\s*(?:\*\*)?Ledger(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const ledger = jsonLabels.includes('master-task') ? String(ledgerTitle ?? '').trim() : legacyLedger;
  const waitingText = source.match(/^\s*(?:\*\*)?Waiting since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const latestThreadTime = threadNotes.reduce((latest, note) => {
    const timestamp = Date.parse(String(note?.timestamp ?? ''));
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, Number.NEGATIVE_INFINITY);
  // A waiting period restarts whenever either participant adds a thread message.
  // The card field remains the durable fallback for tasks without a timestamped thread.
  const waitingTime = Number.isFinite(latestThreadTime) ? latestThreadTime : Date.parse(waitingText);
  const activeText = source.match(/^\s*(?:\*\*)?Active since(?:\*\*)?\s*:\s*(.+?)\s*$/im)?.[1]?.replace(/`/g, '').trim() ?? '';
  const activeTime = Date.parse(activeText);
  const rankText = source.match(/^\s*(?:\*\*)?Queue rank(?:\*\*)?\s*:\s*(\d+)\s*$/im)?.[1] ?? '';
  const queueRank = rankText ? Number(rankText) : null;
  const diagnostics = [];
  if (!masterTask) diagnostics.push('missing master-task label');
  if (jsonLabels.includes('master-task') && jsonLabels.includes('subtask')) diagnostics.push('invalid_master_label');
  if (!ledger) diagnostics.push('missing Ledger');
  if (!Number.isFinite(waitingTime)) diagnostics.push('invalid Waiting since');
  if (queueRank !== null && (!Number.isInteger(queueRank) || queueRank < 1)) diagnostics.push('invalid Queue rank');

  const subtasks = [];
  if (jsonLabels.includes('master-task')) {
    for (const relationship of relationships.filter((entry) => String(entry?.from) === String(cardId) && String(entry?.label) === 'subtask')) {
      const linked = cards.find((card) => String(card.id) === String(relationship.to));
      subtasks.push({ title: String(linked?.title || `Card ${relationship.to}`), cardId: String(relationship.to), status: linked?.status === 'done' ? 'complete' : 'waiting' });
      if (!linked) diagnostics.push(`missing_subtask:${relationship.to}`);
      else if (!Array.isArray(linked.labels) || !linked.labels.map(String).includes('subtask') || linked.labels.map(String).includes('master-task')) diagnostics.push(`invalid_subtask_label:${relationship.to}`);
    }
  } else {
    const subtaskHeading = /^##\s+(?:[A-Z]\.\s+)?Subtasks\s*$/im;
    const sectionStart = source.search(subtaskHeading);
    const afterHeading = sectionStart < 0 ? '' : source.slice(sectionStart).replace(subtaskHeading, '').replace(/^\n/, '');
    const section = afterHeading.split(/^##\s+/m, 1)[0];
    for (const line of section.split('\n')) {
      const link = line.match(/^\s*\d+[.)]\s+\[([^\]]+)]\(card:([^)]+)\)(?:\s+[—-]\s+Status:\s*.+?)?\s*$/i);
      if (!link) continue;
      const linked = cards.find((card) => String(card.id) === link[2].trim());
      subtasks.push({ title: link[1].trim(), cardId: link[2].trim(), status: linked?.status === 'done' ? 'complete' : 'waiting' });
    }
  }
  const complete = subtasks.filter((task) => /^(?:complete|completed|done)$/i.test(task.status)).length;
  const normalizedCodexStatus = String(codexStatus).toLowerCase();
  const codexProcessing = ['processing', 'running', 'in_progress'].includes(normalizedCodexStatus);
  const codexQueued = normalizedCodexStatus === 'pending' && Number.isInteger(codexQueuePosition) && codexQueuePosition > 0;
  const currentRunStartedAt = String(codexStartedAt || '').trim();
  const currentRunStartedTime = Date.parse(currentRunStartedAt);
  const displayedActiveSince = codexProcessing && Number.isFinite(currentRunStartedTime) ? currentRunStartedAt : activeText;
  const displayedActiveTime = codexProcessing && Number.isFinite(currentRunStartedTime) ? currentRunStartedTime : activeTime;
  return {
    valid: diagnostics.length === 0,
    masterTask,
    diagnostics,
    cardId: String(cardId),
    title: String(title || `Card ${cardId}`),
    projectId: String(projectId),
    projectName: String(projectName),
    projectColor: String(projectColor),
    ledgerId: String(ledgerId),
    ledgerTitle: String(ledgerTitle),
    ledger,
    status: cardStatus === 'backlog' ? 'task-backlog' : cardStatus === 'done' ? 'task-complete' : ((codexQueued || codexProcessing) ? 'task-active' : 'task-waiting'),
    codexRunId: String(codexRunId),
    codexPipelineRunId: String(codexPipelineRunId),
    codexStatus: normalizedCodexStatus,
    codexProcessing,
    codexQueued,
    codexQueuePosition: codexQueued ? codexQueuePosition : null,
    waitingSince: Number.isFinite(latestThreadTime) ? new Date(latestThreadTime).toISOString() : waitingText,
    waitingTime,
    activeSince: displayedActiveSince,
    activeTime: displayedActiveTime,
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
    backlog: eligible.filter((task) => task.status === 'task-backlog').sort(compare),
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

export function activeStopwatch(timestamp, now = Date.now()) {
  const elapsedSeconds = Math.floor(Math.max(0, now - Date.parse(timestamp)) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

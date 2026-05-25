export type LedgerCodeToken = {
  kind: 'comment' | 'string' | 'number' | 'keyword' | 'macro' | 'type' | 'identifier' | 'plain';
  text: string;
};

const cppKeywords = new Set([
  'class', 'const', 'enum', 'float', 'int', 'private', 'protected', 'public', 'return', 'struct', 'void'
]);

export function highlightLedgerCode(code: string, language = ''): LedgerCodeToken[] {
  if (!/^(c\+\+|cpp|cxx|cc|h|hpp|unreal|ue)$/i.test(language)) return [{ kind: 'plain', text: code }];
  const tokens: LedgerCodeToken[] = [];
  const pattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d*)?f?\b|\b[A-Z][A-Z0-9_]+\b|\b[A-ZFUI][A-Za-z0-9_]*\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  let cursor = 0;
  for (const match of code.matchAll(pattern)) {
    const text = match[0];
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ kind: 'plain', text: code.slice(cursor, index) });
    if (text.startsWith('//') || text.startsWith('/*')) tokens.push({ kind: 'comment', text });
    else if (text.startsWith('"') || text.startsWith("'")) tokens.push({ kind: 'string', text });
    else if (/^\d/.test(text)) tokens.push({ kind: 'number', text });
    else if (/^[A-Z][A-Z0-9_]+$/.test(text)) tokens.push({ kind: 'macro', text });
    else if (cppKeywords.has(text)) tokens.push({ kind: 'keyword', text });
    else if (/^(F|U|I|A)[A-Z]/.test(text) || text === 'BlueprintType' || text === 'EditAnywhere' || text === 'BlueprintReadWrite') tokens.push({ kind: 'type', text });
    else tokens.push({ kind: 'identifier', text });
    cursor = index + text.length;
  }
  if (cursor < code.length) tokens.push({ kind: 'plain', text: code.slice(cursor) });
  return tokens;
}

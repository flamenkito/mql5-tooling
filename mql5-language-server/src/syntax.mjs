// Offsets are UTF-16 code units, matching the LSP's default position encoding.
import { catalog } from './catalog.mjs';
export const types = new Set(catalog.types);
export const keywords = new Set('break case class const continue default delete do dynamic_cast else enum extern false for group if input namespace new offsetof operator override pack private protected public return sinput sizeof static struct switch template this true typename union virtual while'.split(' '));
const modifiers = new Set('const static input sinput extern virtual override public private protected'.split(' '));
const lineCache = new Map();
function lineStarts(text) {
  if (lineCache.has(text)) return lineCache.get(text);
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  if (lineCache.size >= 32) lineCache.delete(lineCache.keys().next().value);
  lineCache.set(text, starts); return starts;
}
export function position(text, offset) {
  offset = Math.max(0, Math.min(offset, text.length));
  const starts = lineStarts(text); let low = 0, high = starts.length;
  while (low + 1 < high) { const middle = (low + high) >>> 1; if (starts[middle] <= offset) low = middle; else high = middle; }
  return { line: low, character: offset - starts[low] };
}
export function offset(text, pos) {
  const starts = lineStarts(text), start = starts[pos.line]; if (start === undefined) return text.length;
  const end = text.indexOf('\n', start);
  return Math.min(start + pos.character, end < 0 ? text.length : end);
}
export function range(text, start, end) { return { start: position(text, start), end: position(text, end) }; }
export function tokenize(text) {
  const tokens = [], includes = [], macros = [], errors = [];
  let i = 0;
  while (i < text.length) {
    const start = i, c = text[i];
    if (/\s|\uFEFF/.test(c)) { i++; continue; }
    if (text.startsWith('//', i)) { i = text.indexOf('\n', i); if (i < 0) i = text.length; continue; }
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) { errors.push({ start, end: start + 2, message: 'Unterminated block comment' }); i = text.length; }
      else i = end + 2;
      continue;
    }
    if (c === '#' && /^[\t \uFEFF]*$/.test(text.slice(text.lastIndexOf('\n', i - 1) + 1, i))) {
      i = text.indexOf('\n', i); if (i < 0) i = text.length;
      while (/\\\r?$/.test(text.slice(start, i)) && i < text.length) { i = text.indexOf('\n', i + 1); if (i < 0) i = text.length; }
      const directive = text.slice(start, i);
      const inc = /^#\s*include\s*(["<])([^">\r\n]+)[">]/.exec(directive);
      if (inc) { const at = start + directive.indexOf(inc[2]); includes.push({ name: inc[2], local: inc[1] === '"', start: at, end: at + inc[2].length }); }
      const macro = /^#\s*define\s+([\p{L}_][\p{L}\p{N}_]*)/u.exec(directive);
      if (macro) { const at = start + directive.indexOf(macro[1]); macros.push({ name: macro[1], start: at, end: at + macro[1].length, detail: directive.replace(/\\\r?\n/g, ' ').trim() }); }
      continue;
    }
    const literalPrefix = /[dDcC]/.test(c) && text[i + 1] === "'";
    if (c === '"' || c === "'" || literalPrefix) {
      if (literalPrefix) i++;
      const quote = text[i++]; let closed = false;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; if (text[i - 1] === '\r' && text[i] === '\n') i++; }
        else if (text[i++] === quote) { closed = true; break; }
        else if (text[i - 1] === '\n') break;
      }
      i = Math.min(i, text.length);
      if (!closed) errors.push({ start, end: start + 1, message: 'Unterminated literal' });
      tokens.push({ text: text.slice(start, i), kind: 'literal', start, end: i }); continue;
    }
    const word = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(text.slice(i));
    if (word) { i += word[0].length; tokens.push({ text: word[0], kind: 'id', start, end: i }); continue; }
    const numeric = /^(?:0[xX][\da-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)[uUlLfF]*/.exec(text.slice(i));
    if (numeric) { i += numeric[0].length; tokens.push({ text: numeric[0], kind: 'number', start, end: i }); continue; }
    const punct = ['::', '->', '==', '!=', '<=', '>=', '++', '--', '&&', '||'].find(value => text.startsWith(value, i)) ?? c;
    i += punct.length; tokens.push({ text: punct, kind: 'punct', start, end: i });
  }
  return { tokens, includes, macros, errors };
}
export function analyze(text, uri) {
  const doc = { text, uri, ...tokenize(text), symbols: [], scopes: [] };
  const t = doc.tokens, pairs = new Map(), stack = [];
  const closing = { ')': '(', '}': '{', ']': '[' };
  for (let i = 0; i < t.length; i++) {
    if (['(', '{', '['].includes(t[i].text)) stack.push(i);
    else if (closing[t[i].text]) {
      if (stack.length && t[stack.at(-1)].text === closing[t[i].text]) { const open = stack.pop(); pairs.set(open, i); pairs.set(i, open); }
      else doc.errors.push({ ...t[i], message: `Unmatched ${t[i].text}` });
    }
  }
  for (const i of stack) doc.errors.push({ ...t[i], message: `Unclosed ${t[i].text}` });
  const global = { start: 0, end: text.length + 1, parent: null, owner: null };
  doc.scopes.push(global);
  const scopeAt = pos => doc.scopes.filter(s => s.start <= pos && pos < s.end).at(-1) ?? global;
  for (let i = 0; i < t.length; i++) if (t[i].text === '{') {
    const parent = scopeAt(t[i].start);
    doc.scopes.push({ start: t[i].end, end: pairs.has(i) ? t[pairs.get(i)].start : text.length + 1, parent, owner: null, open: i });
  }
  // A for-initializer belongs to the loop, not the surrounding function.
  for (let i = 0; i < t.length; i++) if (t[i].text === 'for' && t[i + 1]?.text === '(' && pairs.has(i + 1)) {
    const bodyStart = pairs.get(i + 1) + 1;
    let last = bodyStart;
    if (t[last]?.text === '{' && pairs.has(last)) last = pairs.get(last);
    else while (last < t.length && t[last].text !== ';') {
      if (['(', '[', '{'].includes(t[last].text) && pairs.has(last)) last = pairs.get(last);
      last++;
    }
    const loop = { start: t[i].start, end: t[last]?.end ?? text.length + 1, parent: scopeAt(t[i].start), owner: null };
    const body = doc.scopes.find(s => s.open === bodyStart);
    if (body) body.parent = loop;
    doc.scopes.push(loop);
    doc.scopes.sort((a, b) => a.start - b.start || b.end - a.end);
  }
  doc.scopeAt = scopeAt; doc.pairs = pairs;
  const add = (token, kind, detail, scope, end, extra = {}) => {
    const symbol = { name: token.text, start: token.start, end: token.end, fullEnd: end ?? token.end,
      kind, detail, scope, uri, range: range(text, token.start, end ?? token.end),
      selectionRange: range(text, token.start, token.end), ...extra };
    doc.symbols.push(symbol); return symbol;
  };
  for (const macro of doc.macros) add({ ...macro, text: macro.name }, 14, macro.detail, global, macro.end);
  for (let i = 0; i < t.length - 1; i++) if (['class', 'struct', 'union', 'enum', 'namespace'].includes(t[i].text) && t[i + 1].kind === 'id') {
    let brace = i + 2; while (brace < t.length && !['{', ';'].includes(t[brace].text)) brace++;
    const scope = scopeAt(t[i].start), body = doc.scopes.find(s => s.open === brace);
    const symbol = add(t[i + 1], t[i].text === 'enum' ? 10 : t[i].text === 'namespace' ? 3 : t[i].text === 'struct' ? 23 : 5,
      text.slice(t[i].start, t[i + 1].end), scope, pairs.has(brace) ? t[pairs.get(brace)].end : body ? text.length : t[i + 1].end,
      { body, type: t[i + 1].text });
    if (body) body.owner = symbol;
    if (t[i].text === 'enum' && body) {
      const end = pairs.get(brace) ?? t.length;
      for (let j = brace + 1; j < end; j++) if (t[j].kind === 'id' && ['{', ','].includes(t[j - 1]?.text))
        add(t[j], 22, `${symbol.name}::${t[j].text}`, scope, t[j].end, { container: symbol.name, type: symbol.name, parentSymbol: symbol });
    }
  }
  const declarationNames = new Set(doc.symbols.map(s => s.start));
  const functionNames = new Set(), parameterNames = new Set();
  const forbidden = new Set([...keywords].filter(x => !modifiers.has(x)));
  const validPrefix = values => values.length && values.some(x => x.kind === 'id' && !modifiers.has(x.text)) &&
    !values.some(x => forbidden.has(x.text) || ['=', '.', '->', '+', '-', '/', '!', '(', ')', ',', '?'].includes(x.text));
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i].kind !== 'id' || keywords.has(t[i].text) || t[i + 1].text !== '(' || !pairs.has(i + 1)) continue;
    const close = pairs.get(i + 1); let after = close + 1;
    while (['const', 'override', 'final'].includes(t[after]?.text)) after++;
    if (!['{', ';'].includes(t[after]?.text)) continue;
    let begin = i - 1; while (begin >= 0 && ![';', '{', '}', ':'].includes(t[begin].text)) begin--;
    const prefix = t.slice(begin + 1, i), scope = scopeAt(t[i].start);
    const constructor = scope.owner && t[i].text === scope.owner.name && prefix.every(x => modifiers.has(x.text));
    if (!constructor && !validPrefix(prefix)) continue;
    const params = []; let first = i + 2;
    for (let j = first; j <= close; j++) {
      if (j !== close && pairs.has(j) && ['(', '['].includes(t[j].text)) { j = pairs.get(j); continue; }
      if (j === close || t[j].text === ',') {
        const part = t.slice(first, j), eq = part.findIndex(x => x.text === '='), header = eq < 0 ? part : part.slice(0, eq);
        const name = header.filter(x => x.kind === 'id' && !modifiers.has(x.text)).at(-1);
        if (part.length && !(part.length === 1 && part[0].text === 'void')) params.push({
          label: text.slice(part[0].start, part.at(-1).end), name: name?.text, token: name,
          type: name ? text.slice(part[0].start, name.start).trim().replace(/\bconst\b|[&*]/g, '').trim() : '', optional: eq >= 0 });
        first = j + 1;
      }
    }
    const body = doc.scopes.find(s => s.open === after), container = scope.owner?.name;
    const detail = text.slice(prefix[0]?.start ?? t[i].start, t[close].end).replace(/\s+/g, ' ').trim();
    const symbol = add(t[i], container ? 6 : 12, detail, scope, body ? (pairs.has(after) ? t[pairs.get(after)].end : text.length) : t[after].end,
      { params, body, container, type: prefix.filter(x => !modifiers.has(x.text)).map(x => x.text).join(' ') });
    if (body) body.owner = symbol;
    functionNames.add(t[i].start);
    for (const param of params) if (param.token) {
      parameterNames.add(param.token.start);
      if (body) add(param.token, 13, param.label, body, param.token.end, { type: param.type, parameter: true, local: true });
    }
  }
  for (let i = 1; i < t.length - 1; i++) {
    const token = t[i];
    if (token.kind !== 'id' || types.has(token.text) || keywords.has(token.text) || declarationNames.has(token.start) ||
        functionNames.has(token.start) || parameterNames.has(token.start) || !['=', ';', ',', '['].includes(t[i + 1].text)) continue;
    let begin = i - 1;
    while (begin >= 0 && (['&', '*'].includes(t[begin].text) || modifiers.has(t[begin].text))) begin--;
    if (begin < 0 || t[begin].kind !== 'id' || keywords.has(t[begin].text)) continue;
    const before = t[begin - 1];
    if (before && ![';', '{', '}', ':', '('].includes(before.text) && !modifiers.has(before.text)) continue;
    const scope = scopeAt(token.start);
    const type = t[begin].text, container = scope.owner && [5, 23].includes(scope.owner.kind) ? scope.owner.name : undefined;
    const local = scope !== global && !container && scope.owner?.kind !== 3;
    const symbol = add(token, container ? 8 : 13, `${type} ${token.text}`, scope, token.end, { type, container, local });
    // Additional names in a comma-separated declaration; skip initializer expressions.
    let j = i + 1;
    while (j < t.length && ![';', '{', '}'].includes(t[j].text)) {
      if (pairs.has(j) && ['(', '['].includes(t[j].text)) { j = pairs.get(j) + 1; continue; }
      if (t[j].text === ',' && t[j + 1]?.kind === 'id' && ['=', ';', ',', '['].includes(t[j + 2]?.text)) {
        add(t[j + 1], symbol.kind, `${type} ${t[j + 1].text}`, scope, t[j + 1].end, { type, container, local });
        declarationNames.add(t[j + 1].start);
      }
      j++;
    }
  }
  return doc;
}

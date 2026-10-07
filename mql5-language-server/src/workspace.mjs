import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyze, keywords, offset, position, range, types } from './syntax.mjs';
import { catalog, reference } from './catalog.mjs';

const ignored = new Set(['.git', 'node_modules', 'archive', 'state', 'state-mac', 'dist', 'build', 'mac-builds', 'mt5-include', '.idea']);
const fallbackSignatures = [
  ['Print', 'void Print(...)', 'Write values to the terminal journal.'],
  ['PrintFormat', 'void PrintFormat(string format, ...)', 'Write formatted values to the terminal journal.'],
  ['StringFormat', 'string StringFormat(string format, ...)', 'Return a formatted string.'],
  ['ArraySize', 'int ArraySize(const void &array[])', 'Return the number of array elements.'],
  ['ArrayResize', 'int ArrayResize(void &array[], int new_size, int reserve_size=0)', 'Resize the first dimension of a dynamic array.'],
  ['SymbolInfoDouble', 'double SymbolInfoDouble(string name, ENUM_SYMBOL_INFO_DOUBLE prop_id)', 'Read a numeric symbol property; other overloads may exist.'],
  ['GetLastError', 'int GetLastError()', 'Read the last error code.'],
  ['ResetLastError', 'void ResetLastError()', 'Reset the last error code.'],
  ['MathAbs', 'double MathAbs(double value)', 'Return the absolute value.'],
].map(([name, detail, documentation]) => ({ name, detail, signature: detail, documentation, kind: 12, builtin: true }));
const plainMarkdown = text => (text ?? '').replace(/[\\`*_{}\[\]<>#|]/g, '\\$&');
const functionDocumentation = record => [
  plainMarkdown(record.summary),
  Object.keys(record.parameterDocs ?? {}).length ? '**Parameters**\n\n'+Object.entries(record.parameterDocs)
    .map(([name,description])=>`- \`${name}\` — ${plainMarkdown(description)}`).join('\n') : '',
  record.returns ? '**Returns**\n\n'+plainMarkdown(record.returns) : '',
  record.note ? '**Note**\n\n'+plainMarkdown(record.note) : '',
].filter(Boolean).join('\n\n');
const signatures = Object.values(reference.functions).flat().map(r => ({
  name:r.name, detail:r.label, signature:r.label, params:r.parameters, type:r.returnType,
  documentation:functionDocumentation(r), topic:r.topic, kind:12, builtin:true,
}));
const signatureNames = new Set(signatures.map(s => s.name));
signatures.push(...fallbackSignatures.filter(s => !signatureNames.has(s.name)));
for (const s of signatures) signatureNames.add(s.name);
const apiMembers = new Map();
for (const records of Object.values(reference.methods)) for (const r of records) {
  const owner = r.qualifiedName.split('::').slice(0,-1).join('::').replace(/<[^>]*>/g,'');
  const member = {name:r.name, detail:r.label, signature:r.label, params:r.parameters, type:r.returnType,
    documentation:functionDocumentation(r), topic:r.topic, kind:6, container:owner, builtin:true};
  if (!apiMembers.has(owner)) apiMembers.set(owner,[]);
  apiMembers.get(owner).push(member);
}
for (const [type, record] of Object.entries(reference.structures)) {
  const fields = record.fields.map(field => ({name:field.name, detail:`${field.type} ${field.name}`, type:field.type,
    topic:record.topic, kind:8, container:type, builtin:true}));
  apiMembers.set(type,[...(apiMembers.get(type)??[]),...fields]);
}
const enumDocs = reference.enumDocs ?? {};
const enumConstants = new Map();
for (const [type,doc] of Object.entries(enumDocs)) for (const member of doc.members) {
  if (!enumConstants.has(member.name)) enumConstants.set(member.name,{topic:doc.topic,
    detail:`${type} ${member.name}`, type,
    documentation:[plainMarkdown(member.description), plainMarkdown(doc.summary),
      `Enumeration: \`${type}\``].filter(Boolean).join('\n\n')});
}
const enumDocumentation = name => {
  const doc = enumDocs[name]; if (!doc) return undefined;
  const limit = 40;
  return [plainMarkdown(doc.summary), '**Values**',
    doc.members.slice(0,limit).map(m=>`- \`${m.name}\` — ${plainMarkdown(m.description)}`).join('\n'),
    doc.members.length > limit ? `${doc.members.length-limit} more values are listed in the full reference.` : '']
    .filter(Boolean).join('\n\n');
};
export const builtins = [...signatures,
  ...catalog.functions.filter(name => !signatureNames.has(name)).map(name => ({name, detail: `MQL5 built-in function: ${name}`, kind: 12, builtin: true})),
  ...catalog.constants.map(name => ({name, detail: `MQL5 constant: ${name}`, kind: 14, builtin: true, ...enumConstants.get(name)})),
  ...catalog.predefined.map(name => ({name, detail: `MQL5 predefined variable: ${name}`, kind: 13, builtin: true})),
  ...catalog.types.map(name => ({name, detail: enumDocs[name] ? `enum ${name}` : `MQL5 built-in type: ${name}`, kind: 5, builtin: true, documentation:enumDocumentation(name), topic:enumDocs[name]?.topic ?? reference.structures[name]?.topic})),
];

export class Workspace {
  constructor() { this.roots = []; this.docs = new Map(); this.open = new Map(); this.generation = 0; this.options = {}; }
  initialize(params) {
    this.roots = (params.workspaceFolders?.map(x => x.uri) ?? (params.rootUri ? [params.rootUri] : []))
      .filter(x => x.startsWith('file:')).map(x => fileURLToPath(x));
    this.options = params.initializationOptions ?? {};
    const local = this.roots.map(root => path.join(root, '.mql5-lsp.json')).find(file => fs.existsSync(file));
    if (local) this.options = { ...JSON.parse(fs.readFileSync(local, 'utf8')), ...this.options };
    this.includeDirectories = (this.options.includeDirectories ?? []).map(file => path.resolve(this.roots[0] ?? '.', file));
    this.helpDirectory = this.options.helpDirectory ? path.resolve(this.roots[0] ?? '.',this.options.helpDirectory) : null;
    for (const root of this.roots) {
      for (let parent = root; ; parent = path.dirname(parent)) {
        const include = path.join(parent, 'mt5-include');
        if (fs.existsSync(include) && !this.includeDirectories.includes(include)) this.includeDirectories.push(include);
        for (const relative of ['mql5-language-server/reference/chm', 'mql5-tooling/mql5-language-server/reference/chm']) {
          const help = path.join(parent,relative);
          if (!this.helpDirectory && fs.existsSync(help)) this.helpDirectory = help;
        }
        if (parent === path.dirname(parent)) break;
      }
    }
    this.scan();
  }
  scan() {
    for (const [uri] of this.docs) if (!this.open.has(uri) && !fs.existsSync(fileURLToPath(uri))) this.docs.delete(uri);
    let count = 0;
    const visit = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (/\.mq[5h]$/i.test(entry.name) && count++ < 5000) this.load(pathToFileURL(file).href);
      }
    };
    for (const root of this.roots) if (fs.existsSync(root)) visit(root);
  }
  load(uri) {
    if (this.open.has(uri)) return this.docs.get(uri);
    try {
      const text = fs.readFileSync(fileURLToPath(uri), 'utf8');
      const existing = this.docs.get(uri);
      if (existing?.text === text) return existing;
      const doc = analyze(text, uri); this.docs.set(uri, doc); return doc;
    } catch { this.docs.delete(uri); return null; }
  }
  update(uri, text, version) {
    this.generation++;
    this.open.set(uri, { text, version });
    this.docs.set(uri, analyze(text, uri));
  }
  change(params) {
    const { uri, version } = params.textDocument;
    let text = this.open.get(uri)?.text ?? this.load(uri)?.text ?? '';
    for (const edit of params.contentChanges) {
      if (!edit.range) text = edit.text;
      else text = text.slice(0, offset(text, edit.range.start)) + edit.text + text.slice(offset(text, edit.range.end));
    }
    this.update(uri, text, version);
  }
  close(uri) { this.open.delete(uri); this.generation++; this.load(uri); }
  includeFile(doc, inc) {
    const name = inc.name.replaceAll('\\', '/');
    if (!/\.mq[5h]$/i.test(name)) return null;
    const dirs = inc.local ? [path.dirname(fileURLToPath(doc.uri)), ...this.includeDirectories] : this.includeDirectories;
    for (const dir of dirs) {
      const candidate = path.resolve(dir, name), uri = pathToFileURL(candidate).href;
      if (this.open.has(uri) || fs.existsSync(candidate)) return uri;
    }
    return null;
  }
  documents(uri, seen = new Set()) {
    if (seen.has(uri)) return [];
    seen.add(uri);
    const doc = this.open.has(uri) ? this.docs.get(uri) : this.load(uri);
    if (!doc) return [];
    return [doc, ...doc.includes.flatMap(inc => {
      const target = this.includeFile(doc, inc); return target ? this.documents(target, seen) : [];
    })];
  }
  context(uri, pos) {
    this.documents(uri);
    const doc = this.docs.get(uri);
    if (!doc) return null;
    const at = offset(doc.text, pos);
    const tokenIndex = doc.tokens.findIndex(t => t.start <= at && at < t.end);
    const token = doc.tokens[tokenIndex] ?? doc.tokens.findLast(t => t.end === at && t.kind === 'id');
    return { doc, at, token, index: doc.tokens.indexOf(token), scope: doc.scopeAt(at) };
  }
  visible(uri, at) {
    const docs = this.documents(uri), doc = this.docs.get(uri), ancestors = [];
    for (let scope = doc?.scopeAt(at); scope; scope = scope.parent) ancestors.push(scope);
    return docs.flatMap(d => d.symbols.filter(s => {
      if (d.uri !== uri) return !s.local && s.scope === d.scopes[0];
      return ancestors.includes(s.scope) && (!s.local || s.parameter || s.start <= at);
    })).sort((a, b) => {
      const rank = s => s.uri !== uri ? 1000 : ancestors.indexOf(s.scope);
      return rank(a) - rank(b) || b.start - a.start;
    });
  }
  members(uri, receiver, at) {
    if (typeof receiver !== 'string') return [];
    const all = this.documents(uri).flatMap(d => d.symbols);
    const variable = this.visible(uri, at).find(s => s.name === receiver);
    const type = (variable?.type ?? receiver).replace(/\bconst\b|[&*]/g, '').trim();
    const found = all.filter(s => s.container === type && !s.local);
    const sourceNames = new Set(found.map(s => s.name));
    return [...found,...(apiMembers.get(type)??[]).filter(s => !sourceNames.has(s.name))];
  }
  resolve(ctx) {
    if (!ctx?.token || ctx.token.kind !== 'id') return [];
    const { doc, index, token, at } = ctx;
    const declared = doc.symbols.filter(s => s.start === token.start);
    if (declared.length) return declared;
    const member = ['.', '->', '::'].includes(doc.tokens[index - 1]?.text);
    let candidates = member ? this.members(doc.uri, doc.tokens[index - 2]?.text, at) : this.visible(doc.uri, at);
    candidates = candidates.filter(s => s.name === token.text);
    if (candidates.length && !member) {
      const best = candidates[0];
      if (best.local || best.scope !== this.docs.get(best.uri)?.scopes[0]) candidates = candidates.filter(s => s.scope === best.scope);
    }
    const open = index + 1, close = doc.pairs.get(open);
    if (doc.tokens[open]?.text === '(' && close !== undefined && candidates.some(s => s.params)) {
      let argumentsCount = close === open + 1 ? 0 : 1;
      for (let i = open + 1; i < close; i++) {
        if (['(', '[', '{'].includes(doc.tokens[i].text) && doc.pairs.has(i)) { i = doc.pairs.get(i); continue; }
        if (doc.tokens[i].text === ',') argumentsCount++;
      }
      const matching = candidates.filter(s => s.params && s.params.filter(p => !p.optional).length <= argumentsCount && s.params.length >= argumentsCount);
      if (matching.length) candidates = matching;
    }
    if (!candidates.length && !member) candidates = builtins.filter(s => s.name === token.text);
    return candidates;
  }
  definition(params) {
    const ctx = this.context(params.textDocument.uri, params.position);
    if (!ctx) return [];
    const include = ctx.doc.includes.find(x => x.start <= ctx.at && ctx.at <= x.end);
    if (include) {
      const uri = this.includeFile(ctx.doc, include);
      return uri ? [{ uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } }] : [];
    }
    return this.resolve(ctx).filter(s => !s.builtin).map(s => ({ uri: s.uri, range: s.selectionRange }));
  }
  hover(params) {
    const ctx = this.context(params.textDocument.uri,params.position), found = this.resolve(ctx);
    if (!found.length) return null;
    const declaration = s => {
      if (s.detail.length <= 88 || !s.params?.length || !s.builtin) return s.detail;
      const open = s.detail.indexOf('('), close = s.detail.lastIndexOf(')');
      if (open < 0 || close < open) return s.detail;
      return s.detail.slice(0,open+1)+'\n'+s.params.map(p=>'    '+p.label).join(',\n')+'\n'+s.detail.slice(close);
    };
    const declarations = [...new Set(found.map(declaration))];
    const docs = [...new Set(found.map(s=>s.documentation).filter(Boolean))];
    const links = new Set();
    for (const s of found) {
      const known = s.topic ? s : reference.methods[`${s.container}::${s.name}`]?.[0] ?? reference.functions[s.name]?.[0];
      const topic = known?.topic;
      if (!topic) continue;
      const online = reference.topics?.[topic];
      if (online) links.add(`[Full MQL5 reference](${online})`);
      const local = this.helpDirectory ? path.join(this.helpDirectory,topic) : null;
      if (local && fs.existsSync(local)) {
        const file = pathToFileURL(local).href;
        const link = this.options.localHelpLinkScheme === 'mql5-help' ? 'mql5-help:' + file : file;
        links.add(`[Local HTML reference](${link})`);
      }
    }
    return {range:range(ctx.doc.text,ctx.token.start,ctx.token.end),contents:{kind:'markdown',value:[
      '```mql5\n'+declarations.join('\n')+'\n```', ...docs, [...links].join(' · '),
    ].filter(Boolean).join('\n\n')}};
  }

  completion(params) {
    const doc = this.documents(params.textDocument.uri)[0]; if (!doc) return [];
    const at = offset(doc.text, params.position), prefix = /[\p{L}\p{N}_]*$/u.exec(doc.text.slice(0, at))[0];
    const before = doc.tokens.filter(t => t.end <= at - prefix.length);
    const member = ['.', '->', '::'].includes(before.at(-1)?.text);
    const symbols = member ? this.members(doc.uri, before.at(-2)?.text, at)
      : [...this.visible(doc.uri, at), ...builtins, ...[...keywords, ...types].map(name => ({ name, detail: name, kind: 14, keyword: true }))];
    const seen = new Set();
    return symbols.filter(s => s.name.startsWith(prefix)).filter(s => {
      const key = s.name + ':' + (s.params ? s.detail : ''); if (seen.has(key)) return false; seen.add(key); return true;
    }).slice(0, 300).map(s => ({ label: s.name, detail: s.detail,
      kind: s.keyword ? 14 : [12, 6].includes(s.kind) ? 3 : [5, 23].includes(s.kind) ? 7 : s.kind === 10 ? 13 : s.kind === 14 ? 21 : s.kind === 8 ? 5 : 6,
      documentation: s.documentation, insertText: s.name,
      textEdit: { range: range(doc.text, at - prefix.length, at), newText: s.name } }));
  }
  signature(params) {
    const doc = this.documents(params.textDocument.uri)[0]; if (!doc) return null;
    const at = offset(doc.text, params.position), tokens = doc.tokens.filter(t => t.start < at), stack = [];
    for (let i = 0; i < tokens.length; i++) {
      if (['(', '[', '{'].includes(tokens[i].text)) stack.push({ i, commas: 0 });
      else if ([')', ']', '}'].includes(tokens[i].text)) stack.pop();
      else if (tokens[i].text === ',' && stack.length) stack.at(-1).commas++;
    }
    const call = stack.findLast(x => tokens[x.i].text === '(' && tokens[x.i - 1]?.kind === 'id');
    if (!call) return null;
    const name = tokens[call.i - 1];
    const found = this.resolve(this.context(doc.uri, position(doc.text, name.start))).filter(s => s.params || s.signature);
    if (!found.length) return null;
    let activeSignature = found.findIndex(s => s.params?.length > call.commas || s.params?.some(p => p.variadic));
    if (activeSignature < 0) activeSignature = 0;
    const variadic = found[activeSignature].params?.findIndex(p => p.variadic) ?? -1;
    return { signatures: found.map(s => ({ label: s.detail, documentation: {kind:'markdown',value:s.documentation ?? ''},
      parameters: s.params?.map(p => ({ label: p.label, ...(p.documentation ? {documentation:{kind:'markdown',value:plainMarkdown(p.documentation)}} : {}) })) ?? [] })), activeSignature, activeParameter:variadic>=0 ? Math.min(call.commas,variadic) : call.commas };
  }
  documentSymbols(uri) {
    const doc = this.documents(uri)[0]; if (!doc) return [];
    const visible = doc.symbols.filter(s => !s.local);
    const result = new Map(visible.map(s => [s, { name: s.name, detail: s.detail, kind: s.kind,
      range: s.range, selectionRange: s.selectionRange, children: [] }]));
    const roots = [];
    for (const s of visible) {
      const parent = s.parentSymbol ?? s.scope.owner;
      if (parent && result.has(parent)) result.get(parent).children.push(result.get(s));
      else roots.push(result.get(s));
    }
    return roots;
  }
  workspaceSymbols(query) {
    this.scan();
    return [...this.docs.values()].flatMap(d => d.symbols).filter(s => !s.local && s.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 500).map(s => ({ name: s.name, kind: s.kind, containerName: s.container, location: { uri: s.uri, range: s.selectionRange } }));
  }
  references(params) {
    const ctx = this.context(params.textDocument.uri, params.position), targets = this.resolve(ctx);
    const keys = new Set(targets.filter(s => !s.builtin).map(s => s.uri + ':' + s.start));
    if (!keys.size) return [];
    this.scan(); const locations = [];
    for (const doc of [...this.docs.values()]) for (const token of doc.tokens) if (token.kind === 'id' && token.text === ctx.token.text) {
      const resolved = this.resolve(this.context(doc.uri, position(doc.text, token.start)));
      if (resolved.some(s => keys.has(s.uri + ':' + s.start)) &&
          (params.context?.includeDeclaration || !keys.has(doc.uri + ':' + token.start)))
        locations.push({ uri: doc.uri, range: range(doc.text, token.start, token.end) });
    }
    return locations;
  }
  diagnostics(uri) {
    const doc = this.documents(uri)[0]; if (!doc) return [];
    const result = doc.errors.map(error => ({ range: range(doc.text, error.start, error.end), severity: 1, source: 'mql5-lsp', message: error.message }));
    for (const inc of doc.includes) if (!this.includeFile(doc, inc) && (inc.local || this.includeDirectories.length)) result.push({
      range: range(doc.text, inc.start, inc.end), severity: 2, source: 'mql5-lsp', message: `Include not found: ${inc.name}` });
    return result;
  }
}

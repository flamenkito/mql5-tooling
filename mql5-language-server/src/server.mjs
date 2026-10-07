#!/usr/bin/env node
import { Workspace } from './workspace.mjs';
import { compile } from './compiler.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const workspace = new Workspace();
let input = Buffer.alloc(0), length = null, initialized = false, shutdown = false, compiling = false;
const cancelled = new Set(), compilerDiagnostics = new Map();
function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`); process.stdout.write(body);
}
function notify(method, params) { send({ jsonrpc: '2.0', method, params }); }
function publish(uri) {
  const version = workspace.open.get(uri)?.version;
  const diagnostics = [...workspace.diagnostics(uri), ...(compilerDiagnostics.get(uri) ?? [])];
  notify('textDocument/publishDiagnostics', { uri, diagnostics, ...(version === undefined ? {} : { version }) });
}
async function dispatch(method, params = {}, requestId) {
  if (method === 'initialize') {
    workspace.initialize(params); initialized = true;
    return { serverInfo: { name: 'mql5-language-server', version: '0.3.3' }, capabilities: {
      positionEncoding: 'utf-16', textDocumentSync: { openClose: true, change: 2, save: { includeText: false } },
      definitionProvider: true, hoverProvider: true, documentSymbolProvider: true, workspaceSymbolProvider: true,
      completionProvider: { triggerCharacters: ['.', ':'] }, signatureHelpProvider: { triggerCharacters: ['(', ','] },
      referencesProvider: true, documentHighlightProvider: true,
      codeActionProvider: true, executeCommandProvider: { commands: ['mql5.compile'] },
      workspace: { workspaceFolders: { supported: true, changeNotifications: true } },
    } };
  }
  if (method === 'shutdown') { shutdown = true; return null; }
  if (method === 'exit') process.exit(shutdown ? 0 : 1);
  if (!initialized) throw Object.assign(new Error('Server not initialized'), { code: -32002 });
  if (shutdown) throw Object.assign(new Error('Server shut down'), { code: -32600 });
  if (['initialized', '$/setTrace'].includes(method)) return null;
  if (method === '$/cancelRequest') { cancelled.add(params.id); return null; }
  if (method === 'textDocument/didOpen') {
    const d = params.textDocument; workspace.update(d.uri, d.text, d.version);
    const affected = [...compilerDiagnostics.keys()]; compilerDiagnostics.clear();
    for (const uri of new Set([...affected, d.uri])) publish(uri); return null;
  }
  if (method === 'textDocument/didChange') {
    workspace.change(params); const affected = [...compilerDiagnostics.keys()]; compilerDiagnostics.clear();
    for (const uri of new Set([...affected, params.textDocument.uri])) publish(uri); return null;
  }
  if (method === 'textDocument/didClose') {
    workspace.close(params.textDocument.uri);
    const affected = [...compilerDiagnostics.keys()]; compilerDiagnostics.clear();
    for (const uri of affected) if (workspace.open.has(uri)) publish(uri);
    notify('textDocument/publishDiagnostics', { uri: params.textDocument.uri, diagnostics: [] }); return null;
  }
  if (method === 'textDocument/didSave') { if (workspace.options.compileOnSave) return dispatch('workspace/executeCommand', { command: 'mql5.compile', arguments: [params.textDocument.uri] }); return null; }
  if (method === 'workspace/didChangeWatchedFiles') {
    workspace.generation++; for (const item of params.changes) workspace.load(item.uri);
    compilerDiagnostics.clear(); for (const uri of workspace.open.keys()) publish(uri); return null;
  }
  if (method === 'workspace/didChangeWorkspaceFolders') {
    const current = workspace.roots.map(file => pathToFileURL(file).href);
    workspace.initialize({ workspaceFolders: [...current.filter(uri => !params.event.removed.some(x => x.uri === uri)).map(uri => ({ uri })), ...params.event.added], initializationOptions: workspace.options }); return null;
  }
  if (method === 'workspace/didChangeConfiguration') {
    workspace.options = { ...workspace.options, ...(params.settings?.mql5 ?? params.settings ?? {}) };
    workspace.includeDirectories = (workspace.options.includeDirectories ?? workspace.includeDirectories).map(x => path.resolve(workspace.roots[0] ?? '.', x));
    for (const uri of workspace.open.keys()) publish(uri); return null;
  }
  if (method === 'textDocument/definition') return workspace.definition(params);
  if (method === 'textDocument/hover') return workspace.hover(params);
  if (method === 'textDocument/completion') return workspace.completion(params);
  if (method === 'textDocument/signatureHelp') return workspace.signature(params);
  if (method === 'textDocument/documentSymbol') return workspace.documentSymbols(params.textDocument.uri);
  if (method === 'workspace/symbol') return workspace.workspaceSymbols(params.query ?? '');
  if (method === 'textDocument/references') return workspace.references(params);
  if (method === 'textDocument/documentHighlight') return workspace.references({ ...params, context: { includeDeclaration: true } })
    .filter(x => x.uri === params.textDocument.uri).map(x => ({ range: x.range, kind: 1 }));
  if (method === 'textDocument/codeAction') return [{ title: 'MQL5: Check compilation in UTM', kind: 'source',
    command: { title: 'Check compilation', command: 'mql5.compile', arguments: [params.textDocument.uri] } }];
  if (method === 'workspace/executeCommand') {
    if (params.command !== 'mql5.compile') throw Object.assign(new Error('Unknown command'), { code: -32602 });
    if (compiling) throw new Error('A compilation is already running');
    if (!params.arguments?.[0]) throw Object.assign(new Error('Source URI required'), { code: -32602 });
    compiling = true; const generation = workspace.generation;
    try {
      const result = await compile(workspace, params.arguments[0]);
      if (generation !== workspace.generation || cancelled.has(requestId)) return { ...result, stale: true };
      const previous = [...compilerDiagnostics.keys()]; compilerDiagnostics.clear();
      for (const [uri, diagnostics] of Object.entries(result.diagnostics)) compilerDiagnostics.set(uri, diagnostics);
      for (const uri of new Set([...previous, ...result.files])) publish(uri);
      return { ...result, stale: false };
    } finally { compiling = false; }
  }
  throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
}
async function receive(message) {
  if (!message || typeof message.method !== 'string') return;
  const request = Object.hasOwn(message, 'id');
  try {
    const result = await dispatch(message.method, message.params, message.id);
    if (request) {
      if (cancelled.delete(message.id)) send({ jsonrpc: '2.0', id: message.id, error: { code: -32800, message: 'Request cancelled' } });
      else send({ jsonrpc: '2.0', id: message.id, result: result ?? null });
    }
  } catch (error) {
    if (request) send({ jsonrpc: '2.0', id: message.id, error: { code: error.code ?? -32603, message: error.message } });
    else notify('window/logMessage', { type: 1, message: error.message });
  }
}
process.stdin.on('data', data => {
  input = Buffer.concat([input, data]);
  while (true) {
    if (length === null) {
      const end = input.indexOf('\r\n\r\n'); if (end < 0) { if (input.length > 8192) process.exit(1); break; }
      const match = /(?:^|\r\n)Content-Length:\s*(\d+)/i.exec(input.subarray(0, end).toString());
      if (!match || Number(match[1]) > 32 * 1024 * 1024) process.exit(1);
      length = Number(match[1]); input = input.subarray(end + 4);
    }
    if (input.length < length) break;
    const body = input.subarray(0, length); input = input.subarray(length); length = null;
    try { void receive(JSON.parse(body.toString())); }
    catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  }
});
process.stdin.on('end', () => process.exit(shutdown ? 0 : 1));

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Workspace } from '../src/workspace.mjs';
import { analyze, offset, position } from '../src/syntax.mjs';

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mql5-index-'));
  for (const [name, text] of Object.entries(files)) { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
  const ws = new Workspace(); ws.initialize({ rootUri: pathToFileURL(root).href });
  const uri = name => pathToFileURL(path.join(root, name)).href;
  return { root, ws, uri };
}
function at(text, word, occurrence = 0) {
  let start = -1; for (let i = 0; i <= occurrence; i++) start = text.indexOf(word, start + 1);
  assert.ok(start >= 0); return position(text, start);
}
test('UTF-16 positions, comments, literals and directives', () => {
  const text = '// 😀\r\nint x;';
  for (let i = 0; i < text.length; i++) assert.equal(offset(text, position(text, i)), i);
  const doc = analyze('/* class Fake {} */\nstring text="double falseName;";\n#define MACRO(x) (x)\nint Real() { return 1; }', 'file:///test.mq5');
  assert.deepEqual(doc.symbols.filter(s => !s.local).map(s => s.name), ['MACRO', 'Real', 'text']);
  assert.equal(doc.errors.length, 0);
  assert.equal(analyze('/* incomplete', 'file:///x.mq5').errors[0].message, 'Unterminated block comment');
});
test('include cycles, class members, overloads, globals and lexical shadowing', () => {
  const header = '#include "cycle.mqh"\nclass Box { public: double value; int Get(int count) { return count; } };\nint Add(int a,int b) { return a+b; }\nint Add(int a) { return a; }';
  const main = '#include "types.mqh"\nint value;\nBox box;\nint Main(int limit) { int value=2; box.value=value; return Add(limit, value); }';
  const { ws, uri } = fixture({ 'types.mqh':header, 'cycle.mqh':'#include "types.mqh"', 'main.mq5':main, 'unrelated.mq5':'int hidden;' });
  const query = (word, n = 0) => ({ textDocument:{uri:uri('main.mq5')}, position:at(main, word, n) });
  assert.equal(ws.documents(uri('main.mq5')).length, 3);
  const add = ws.definition(query('Add'));
  assert.equal(add.length, 1);
  assert.ok(add.every(x => x.uri === uri('types.mqh')));
  const member = ws.definition(query('value', 2));
  assert.equal(member.length, 1); assert.equal(member[0].uri, uri('types.mqh'));
  const local = ws.definition(query('value', 3));
  assert.equal(local.length, 1); assert.equal(local[0].range.start.character, main.split('\n').at(-1).indexOf('value'));
  assert.match(ws.hover(query('limit', 1)).contents.value, /int limit/);
  const completionPosition = position(main, main.indexOf('box.value') + 4);
  const labels = ws.completion({textDocument:{uri:uri('main.mq5')},position:completionPosition}).map(x=>x.label);
  assert.deepEqual(labels.sort(), ['Get','value']);
  assert.ok(!ws.completion(query('Main')).some(x=>x.label==='hidden'));
  const signatures = ws.signature({ textDocument:{uri:uri('main.mq5')}, position:position(main, main.indexOf('Add(limit,')+10) });
  assert.equal(signatures.signatures.length, 1); assert.equal(signatures.activeParameter, 1);
  assert.equal(ws.workspaceSymbols('Add').length, 2);
  assert.equal(ws.diagnostics(uri('main.mq5')).length, 0);
});
test('unsaved headers and incremental edits update cross-file navigation', () => {
  const main = '#include "api.mqh"\nint Main() { return Fresh(); }';
  const { ws, uri } = fixture({ 'api.mqh':'int Old(){return 1;}', 'main.mq5':main });
  ws.update(uri('api.mqh'), 'int Fresh(){return 2;}', 1);
  assert.equal(ws.definition({textDocument:{uri:uri('main.mq5')},position:at(main,'Fresh')}).length, 1);
  ws.change({ textDocument:{uri:uri('api.mqh'),version:2}, contentChanges:[{range:{start:{line:0,character:4},end:{line:0,character:9}},text:'New'}] });
  assert.equal(ws.workspaceSymbols('New').length, 1);
  assert.equal(ws.workspaceSymbols('Fresh').length, 0);
  ws.close(uri('api.mqh'));
  assert.equal(ws.workspaceSymbols('Old').length, 1);
});
test('block locals do not leak; references distinguish shadowed names', () => {
  const text = 'int x;\nvoid Run(){ int x=1; Print(x); { int x=2; Print(x); } Print(x); }\nvoid Other(){ Print(x); }';
  const { ws, uri } = fixture({'main.mq5':text});
  const refs = ws.references({textDocument:{uri:uri('main.mq5')},position:at(text,'x',1),context:{includeDeclaration:false}});
  assert.equal(refs.length, 2);
  const after = position(text,text.indexOf('void Other'));
  assert.ok(ws.visible(uri('main.mq5'), offset(text,after)).filter(s=>s.name==='x').every(s=>!s.local));
});
test('angle includes resolve configured standard headers, not arbitrary project globals', () => {
  const { ws, uri, root } = fixture({'main.mq5':'#include <Arrays/Array.mqh>\nvoid Run(){ Standard(); }','include/Arrays/Array.mqh':'void Standard();'});
  ws.includeDirectories=[path.join(root,'include')];
  assert.equal(ws.definition({textDocument:{uri:uri('main.mq5')},position:{line:1,character:12}})[0].uri, uri('include/Arrays/Array.mqh'));
  assert.equal(ws.diagnostics(uri('main.mq5')).length,0);
});
test('enum members, arrays and comma-separated variables', () => {
  const doc=analyze('enum Side { Buy=0, Sell=1 };\nint a,b;\ndouble values[2];', 'file:///x.mq5');
  assert.ok(['Side','Buy','Sell','a','b','values'].every(name=>doc.symbols.some(s=>s.name===name)));
});
test('standard library is lazy; broken classes keep valid symbol ranges', () => {
  const { ws, uri } = fixture({'mt5-include/Arrays/Array.mqh':'void Standard();','main.mq5':'#include <Arrays/Array.mqh>\nclass Open { int field;'});
  assert.equal(ws.docs.size,1);
  assert.equal(ws.documents(uri('main.mq5')).length,2);
  const root=ws.documentSymbols(uri('main.mq5'))[0];
  assert.equal(root.name,'Open');assert.equal(root.children[0].name,'field');
  assert.ok(root.range.end.character>=root.children[0].range.end.character);
});
test('for initializer is visible inside the loop and does not leak after it', () => {
  const text='void Run(){ for(int i=0;i<3;i++){ Print(i); } Print(i); }';
  const {ws,uri}=fixture({'main.mq5':text});
  const inside={textDocument:{uri:uri('main.mq5')},position:position(text,text.indexOf('Print(i)')+6)};
  const outside={textDocument:{uri:uri('main.mq5')},position:position(text,text.lastIndexOf('Print(i)')+6)};
  assert.equal(ws.definition(inside).length,1);assert.equal(ws.definition(outside).length,0);
});
test('official built-in catalog supplies completion and hover without invented signatures', () => {
  const {ws,uri}=fixture({'main.mq5':'void Run(){ ObjectSetInteger; MqlTick; CORNER_LEFT_UPPER; }'});
  for (const word of ['ObjectSetInteger','MqlTick','CORNER_LEFT_UPPER']) {
    const text=ws.docs.get(uri('main.mq5')).text;
    const query={textDocument:{uri:uri('main.mq5')},position:at(text,word)};
    assert.match(ws.hover(query).contents.value,new RegExp(word));
    const completions=ws.completion({...query,position:position(text,text.indexOf(word)+word.length)});
    assert.ok(completions.some(x=>x.label===word));
  }
  assert.equal(ws.signature({textDocument:{uri:uri('main.mq5')},position:{line:0,character:0}}),null);
});

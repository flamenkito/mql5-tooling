import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { reference } from '../src/catalog.mjs';
import { Workspace } from '../src/workspace.mjs';
import { position } from '../src/syntax.mjs';

function fixture(text) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mql5-help-'));
  const uri=pathToFileURL(path.join(root,'test.mq5')).href;
  const ws=new Workspace();ws.initialize({rootUri:pathToFileURL(root).href});ws.update(uri,text,1);
  const query=word=>({textDocument:{uri},position:position(text,text.indexOf(word))});
  return {ws,uri,query};
}
test('CHM declarations retain distinct overloads and array/reference parameters',()=>{
  assert.equal(reference.source.format,'CHM/HTML');
  assert.equal(reference.functions.ObjectSetInteger.length,2);
  assert.deepEqual(reference.functions.ObjectSetInteger.map(s=>s.parameters.length),[4,5]);
  assert.equal(reference.functions.SymbolInfoDouble.length,2);
  assert.ok(reference.functions.SymbolInfoDouble.some(s=>s.returnType==='bool'&&s.parameters[2].type==='double&'));
  assert.equal(reference.functions.CopyRates.length,3);
  assert.equal(reference.functions.OnCalculate.length,2);
  assert.ok(reference.functions.OnCalculate[1].parameters.some(p=>p.name==='price'||p.name==='close'));
  assert.ok(reference.functions.ArrayResize[0].parameters[0].label.includes('array[]'));
  assert.ok(reference.functions.ArrayResize[0].parameters[2].optional);
  assert.ok(reference.functions.CryptDecode[0].erratum);
  const object=reference.functions.ObjectCreate[0];
  assert.equal(object.parameters[3].type,'int');
  assert.equal(object.parameters.length,7);
  assert.ok(object.parameters[6].variadic);
  assert.equal(reference.functions.DatabaseBindArray[0].parameters[2].type,'const T&');
  assert.ok(!reference.functions.LUP);
  assert.ok(reference.unqualifiedMethods.LUP);

});
test('signature help exposes builtin overloads and selects the third argument variant',()=>{
  const text='void Run(){ SymbolInfoDouble(_Symbol, SYMBOL_ASK, value); }';
  const {ws,uri}=fixture(text);
  const info=ws.signature({textDocument:{uri},position:position(text,text.indexOf('value'))});
  assert.equal(info.signatures.length,2);assert.equal(info.activeParameter,2);
  assert.equal(info.signatures[info.activeSignature].parameters.length,3);
  assert.ok(info.signatures[info.activeSignature].label.startsWith('bool'));
});
test('MqlTick fields provide typed completion/hover and standard-library methods are available',()=>{
  const text='MqlTick tick; CTrade trade; void Run(){ tick.bid; trade.Buy(); }';
  const {ws,uri,query}=fixture(text);
  assert.match(ws.hover(query('bid')).contents.value,/double bid/);
  const fields=ws.completion({textDocument:{uri},position:position(text,text.indexOf('tick.bid')+5)});
  assert.ok(fields.some(x=>x.label==='bid'&&x.kind===5));
  assert.ok(fields.some(x=>x.label==='time_msc'));
  assert.ok(!fields.some(x=>x.label==='action'));
  const buy=ws.hover(query('Buy')).contents.value;
  assert.match(buy,/bool Buy\(/);assert.match(buy,/double volume/);
});
test('hover links an extracted HTML help page when configured locally',()=>{
  const {ws,query}=fixture('void Run(){ ObjectSetInteger; }');
  const help=fs.mkdtempSync(path.join(os.tmpdir(),'mql5-html-'));
  fs.writeFileSync(path.join(help,'objectsetinteger.htm'),'<html>MQL5</html>');
  ws.helpDirectory=help;
  assert.match(ws.hover(query('ObjectSetInteger')).contents.value,/file:.*objectsetinteger\.htm/);
  ws.options.localHelpLinkScheme='mql5-help';
  assert.match(ws.hover(query('ObjectSetInteger')).contents.value,/mql5-help:file:.*objectsetinteger\.htm/);
});

test('enum hover documents timeframes and individual members from their own table',()=>{
  const {ws,query}=fixture('ENUM_TIMEFRAMES timeframe = PERIOD_H1;');
  ws.helpDirectory=path.resolve('reference/chm');
  const doc=ws.hover(query('ENUM_TIMEFRAMES')).contents.value;
  assert.match(doc,/PERIOD_M1.*1 minute/);
  assert.match(doc,/PERIOD_H1.*1 hour/);
  assert.match(doc,/enum_timeframes/);
  assert.ok(!doc.includes('OBJPROP_'));
  assert.equal(reference.enumDocs.ENUM_TIMEFRAMES.members.length,22);
  assert.match(ws.hover(query('PERIOD_H1')).contents.value,/1 hour/);
});

test('documentation uses IntelliJ-compatible blocks with context and bounded enum lists',()=>{
  const {ws,query}=fixture('ENUM_BASE_CORNER corner; PERIOD_CURRENT; ObjectSetInteger;');
  const enumHover=ws.hover(query('ENUM_BASE_CORNER')).contents.value;
  assert.match(enumHover,/enum ENUM_BASE_CORNER/);
  assert.match(enumHover,/- `CORNER_LEFT_UPPER` — Center of coordinates/);
  assert.ok(!enumHover.includes('| Value |'));
  assert.match(enumHover,/coordinates are specified in pixels/);
  const constant=ws.hover(query('PERIOD_CURRENT')).contents.value;
  assert.match(constant,/ENUM_TIMEFRAMES PERIOD_CURRENT/);
  assert.match(constant,/current period of a chart/);
  const fn=ws.hover(query('ObjectSetInteger')).contents.value;
  assert.match(fn,/sets the value of the corresponding object property/);
  assert.ok(!fn.includes('�'));
});

test('reference links target the official topic and never offer a missing local file',()=>{
  const {ws,query}=fixture('ENUM_BASE_CORNER corner; PERIOD_CURRENT; ObjectSetInteger;');
  ws.helpDirectory='/nonexistent/mql5-help';
  for(const [name,route] of [['ENUM_BASE_CORNER','constants/objectconstants/enum_basecorner'],
    ['PERIOD_CURRENT','constants/chartconstants/enum_timeframes'],['ObjectSetInteger','objects/objectsetinteger']]){
    const doc=ws.hover(query(name)).contents.value;
    assert.ok(doc.includes(`https://www.mql5.com/en/docs/${route}`));
    assert.ok(!doc.includes('file:'));assert.ok(!doc.includes('mql5.chm'));
  }
  const fn=ws.hover(query('ObjectSetInteger')).contents.value;
  assert.equal(fn.split('sets the value of the corresponding object property').length-1,1);
  const code=fn.split('```')[1];
  assert.ok(code.split('\n').every(line=>line.length<=88),'Builtin signatures should fit a narrow documentation popup');
});

test('function documentation includes short summaries, parameters, returns and notes',()=>{
  const {ws,query}=fixture('MathIsValidNumber; ObjectSetInteger;');
  const math=ws.hover(query('MathIsValidNumber')).contents.value;
  assert.match(math,/checks the correctness of a real number/);
  assert.match(math,/Checked numeric value/);
  assert.match(math,/not a number.*NaN/);
  assert.match(math,/\*\*Returns\*\*/);
  assert.match(ws.hover(query('ObjectSetInteger')).contents.value,/asynchronous call/);
  assert.ok(reference.functions.MathIsValidNumber[0].parameters[0].documentation);
  for(const [name,records] of Object.entries(reference.functions)) {
    assert.ok(records.every(r=>r.summary),`${name} must have a CHM summary`);
  }
});

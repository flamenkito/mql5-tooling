import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { client } from './client.mjs';

test('stdio framing, capabilities, live buffers, diagnostics and shutdown',async()=>{
  const c=client(),root=fs.mkdtempSync(path.join(os.tmpdir(),'mql5-protocol-'));
  const uri=pathToFileURL(path.join(root,'test.mq5')).href;
  try{
    const result=await c.request('initialize',{rootUri:pathToFileURL(root).href},true);
    assert.equal(result.capabilities.positionEncoding,'utf-16');
    assert.ok(result.capabilities.signatureHelpProvider);
    c.notify('initialized',{});
    c.notify('textDocument/didOpen',{textDocument:{uri,languageId:'mql5',version:1,text:'// 😀\nint Counter;\nvoid Run(){ Print(Counter); }'}});
    const definitions=await c.request('textDocument/definition',{textDocument:{uri},position:{line:2,character:19}});
    assert.equal(definitions[0].range.start.line,1);
    c.notify('textDocument/didChange',{textDocument:{uri,version:2},contentChanges:[{text:'void Broken(){'}]});
    await c.request('textDocument/documentSymbol',{textDocument:{uri}});
    assert.ok(c.notifications.some(x=>x.method==='textDocument/publishDiagnostics'&&x.params.version===2&&x.params.diagnostics.some(d=>/Unclosed/.test(d.message))));
    await assert.rejects(c.request('unsupported/method',{}),/Method not found/);
    assert.equal(await c.request('shutdown',{}),null);
    assert.equal(c.errors,'');
  }finally{await c.close();}
});

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { client } from './client.mjs';

test('compiler snapshot uses unsaved buffers and discards stale results', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mql5-compiler-test-'));
  const project=path.join(root,'mt5-fibo-readout');fs.mkdirSync(project);
  const file=path.join(project,'mt5-fibo-readout.mq5'),uri=pathToFileURL(file).href;
  fs.writeFileSync(file,'void Run() {}');
  // A deterministic compiler fixture: exercises snapshot/report plumbing without UTM.
  const bridge=path.join(root,'mac-dev.py');
  fs.writeFileSync(bridge,`from pathlib import Path
import json, time
ROOT=Path(__file__).parent
PROJECTS=['mt5-fibo-readout']
def source_files(project):
    yield ROOT/project/'mt5-fibo-readout.mq5',Path(project)/'mt5-fibo-readout.mq5'
def build(projects,action,vm):
    time.sleep(0.2)
    out=ROOT/'mac-builds'/'fixture'
    out.mkdir(parents=True)
    source=(ROOT/'mt5-fibo-readout'/'mt5-fibo-readout.mq5').read_text()
    invalid='UNSAVED' in source
    log="C:\\\\isolated\\\\mt5-fibo-readout\\\\mt5-fibo-readout.mq5(1,6) : error 157: unsaved probe\\r\\n" if invalid else ''
    (out/'compile.log').write_bytes(log.encode('utf-16'))
    (out/'result.json').write_text(json.dumps({'ok':not invalid,'error':''}))
`);
  const c=client();
  try {
    await c.request('initialize',{rootUri:pathToFileURL(root).href,initializationOptions:{compilerBridge:bridge}});
    c.notify('textDocument/didOpen',{textDocument:{uri,version:1,text:'void UNSAVED() {}'}});
    const report=await c.request('workspace/executeCommand',{command:'mql5.compile',arguments:[uri]});
    assert.equal(report.stale,false);assert.equal(report.ok,false);
    assert.match(report.diagnostics[uri][0].message,/unsaved probe/);
    assert.ok(c.notifications.some(n=>n.method==='textDocument/publishDiagnostics'&&n.params.diagnostics.some(d=>d.source==='MetaEditor')));
    const pending=c.request('workspace/executeCommand',{command:'mql5.compile',arguments:[uri]});
    await new Promise(r=>setTimeout(r,40));
    c.notify('textDocument/didChange',{textDocument:{uri,version:2},contentChanges:[{text:'void Changed() {}'}]});
    const changed=await pending;assert.equal(changed.stale,true);
    assert.equal(fs.readFileSync(file,'utf8'),'void Run() {}');
    const last=c.notifications.filter(n=>n.method==='textDocument/publishDiagnostics'&&n.params.uri===uri).at(-1);
    assert.equal(last.params.version,2);assert.ok(last.params.diagnostics.every(d=>d.source!=='MetaEditor'));
    await c.request('shutdown',{});
  }finally{await c.close();}
});

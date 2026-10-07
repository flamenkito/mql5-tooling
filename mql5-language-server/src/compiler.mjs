import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function compile(workspace, uri) {
  let dir = path.dirname(fileURLToPath(uri)), bridge = workspace.options.compilerBridge;
  if (bridge) bridge = path.resolve(workspace.roots[0] ?? '.', bridge);
  while (!bridge) {
    const candidate = path.join(dir, 'mac-dev.py');
    if (fs.existsSync(candidate)) { bridge = candidate; break; }
    if (dir === path.dirname(dir)) break;
    dir = path.dirname(dir);
  }
  if (!bridge) throw new Error('Set compilerBridge in .mql5-lsp.json to windows-projects/mac-dev.py');
  const script = fileURLToPath(new URL('./compiler-bridge.py', import.meta.url));
  return await new Promise((resolve, reject) => {
    const child = spawn(workspace.options.pythonExecutable ?? 'python3', [script], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { errors += data; });
    child.on('error', error => { clearTimeout(deadline); reject(error); });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ uri, bridge, vm: workspace.options.vm ?? 'Windows',
      documents: [...workspace.open].map(([uri, doc]) => ({ uri, text: doc.text })) }));
    const deadline = setTimeout(() => { child.kill(); reject(new Error('Compilation timed out')); }, 300_000);
    child.on('exit', code => {
      clearTimeout(deadline);
      try { if (code) throw new Error(errors || `Compiler bridge exited ${code}`); resolve(JSON.parse(output)); }
      catch (error) { reject(error); }
    });
  });
}

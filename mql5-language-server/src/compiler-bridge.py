"""Build an isolated snapshot (including unsaved buffers) using the existing UTM helper."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import unquote, urlparse

def file_path(uri):
    parsed = urlparse(uri)
    if parsed.scheme != 'file' or parsed.netloc not in ('', 'localhost'):
        raise ValueError('Only local file URIs can be compiled')
    return Path(unquote(parsed.path)).resolve()

def main():
    request = json.load(sys.stdin)
    bridge = Path(request['bridge']).resolve()
    spec = importlib.util.spec_from_file_location('mql5_mac_dev', bridge)
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    source_root = runner.ROOT
    target = file_path(request['uri'])
    relative = target.relative_to(source_root)
    project = relative.parts[0]
    if project not in runner.PROJECTS or target.suffix.lower() not in ('.mq5', '.mqh'):
        raise ValueError('Select a source in one of the configured MT5 projects')
    aliases = {file_path(document['uri']): document['uri'] for document in request['documents']}
    aliases[target] = request['uri']
    snapshot = Path(tempfile.mkdtemp(prefix='mql5-diagnostics-'))
    texts = {}
    for file, name in runner.source_files(project):
        dest = snapshot / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        data = file.read_bytes()
        dest.write_bytes(data)
        if file.suffix.lower() in ('.mq5', '.mqh'):
            texts[aliases.get(file.resolve(), file.resolve().as_uri())] = data.decode('utf-8-sig')
    for document in request['documents']:
        file = file_path(document['uri'])
        if file.suffix.lower() not in ('.mq5', '.mqh'):
            continue
        try: name = file.relative_to(source_root / project)
        except ValueError: continue
        dest = snapshot / project / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(document['text'], encoding='utf-8')
        texts[document['uri']] = document['text']
    runner.ROOT = snapshot
    log = io.StringIO()
    failure = None
    with contextlib.redirect_stdout(log):
        try: runner.build([project], 'build', request['vm'])
        except Exception as error: failure = str(error)
    result_files = list((snapshot / 'mac-builds').glob('*/result.json'))
    if not result_files:
        raise RuntimeError(failure or 'No compiler report produced')
    output = result_files[0].parent
    diagnostics = {}
    pattern = re.compile(r"(?P<file>[^\r\n]+?\.mq[5h])\((?P<line>\d+),(?P<col>\d+)\)\s*:\s*(?P<kind>error|warning)\s*(?P<code>\d*)\s*:\s*(?P<message>.*)", re.I)
    for file in output.rglob('*.log'):
        data = file.read_bytes()
        text = data.decode('utf-16') if data.startswith((b'\xff\xfe', b'\xfe\xff')) else data.decode('utf-8-sig', errors='replace')
        for match in pattern.finditer(text):
            source = re.sub('/+', '/', match['file'].strip().strip("'\"").replace('\\', '/'))
            marker = '/' + project + '/'
            if marker not in source: continue
            original = source_root / project / source.split(marker, 1)[1]
            uri = aliases.get(original.resolve(), original.resolve().as_uri())
            if uri not in texts: continue
            lines = texts[uri].splitlines()
            line = max(0, min(int(match['line']) - 1, len(lines) - 1))
            # MetaEditor uses character columns; translate to UTF-16 for the LSP.
            content = lines[line] if lines else ''
            index = min(max(0, int(match['col']) - 1), len(content))
            character = len(content[:index].encode('utf-16-le')) // 2
            width = len(content[index:index+1].encode('utf-16-le')) // 2
            item = {'range':{'start':{'line':line,'character':character},'end':{'line':line,'character':character+width}},
                    'severity':1 if match['kind'].lower() == 'error' else 2,
                    'source':'MetaEditor', 'code':match['code'], 'message':match['message'].strip()}
            if item not in diagnostics.setdefault(uri, []): diagnostics[uri].append(item)
    report = json.loads(result_files[0].read_text())
    # Do not mistake a transport/configuration failure for a clean compile.
    if not report['ok'] and not diagnostics:
        raise RuntimeError(failure or report['error'])
    print(json.dumps({'ok':report['ok'], 'diagnostics':diagnostics, 'files':list(texts),
                      'artifacts':str(output), 'project':project}))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

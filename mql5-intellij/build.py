#!/usr/bin/env python3
"""Build and test against an installed IntelliJ SDK, without network downloads."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent

def write_entry(bundle, file, name):
    entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_DEFLATED
    entry.external_attr = 0o100644 << 16
    bundle.writestr(entry, file.read_bytes())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ide', default=os.environ.get('IDEA_HOME', '/Applications/IntelliJ IDEA.app/Contents'))
    parser.add_argument('--server', type=Path, default=ROOT.parent / 'mql5-language-server')
    parser.add_argument('--corpus', type=Path, default=ROOT.parent / 'windows-projects')
    args = parser.parse_args()
    server = args.server.resolve()
    ide = Path(args.ide).expanduser().resolve()
    if (ide / 'Contents').is_dir(): ide /= 'Contents'
    catalog = json.loads((server / 'data/builtins.json').read_text())
    resource = ROOT / 'src/main/resources/mql5-catalog.tsv'
    resource.write_text(''.join(f'{category}\t{name}\n' for category in ['types','functions','constants','events','indicators','predefined'] for name in catalog[category]))
    product_file = ide / 'Resources/product-info.json'
    if not product_file.is_file(): product_file = ide / 'product-info.json'
    product = json.loads(product_file.read_text())
    descriptor = ET.parse(ROOT / 'src/main/resources/META-INF/plugin.xml').getroot()
    version = descriptor.findtext('version')
    assert int(product['buildNumber'].split('.')[0]) >= int(descriptor.find('idea-version').attrib['since-build'])
    jdk = ide / 'jbr/Contents/Home/bin'
    if not (jdk / 'javac').is_file(): jdk = ide / 'jbr/bin'
    if not (jdk / 'javac').is_file():
        raise SystemExit('Installed IDEA JBR must include javac. Specify an IDEA installation with a JDK.')
    cp = os.pathsep.join(str(p) for p in sorted((ide / 'lib').glob('*.jar')))
    work = Path(tempfile.mkdtemp(prefix='mql5-plugin-build-'))
    classes = work / 'classes'
    classes.mkdir()
    sources = sorted((ROOT / 'src/main/java').rglob('*.java'))
    subprocess.run([str(jdk / 'javac'), '--release', '21', '-encoding', 'UTF-8', '-cp', cp,
                    '-d', str(classes), *map(str, sources)], check=True)
    tests = sorted((ROOT / 'src/test/java').rglob('*.java'))
    test_classes = work / 'test-classes'
    test_classes.mkdir()
    subprocess.run([str(jdk / 'javac'), '--release', '21', '-encoding', 'UTF-8',
                    '-cp', str(classes) + os.pathsep + cp, '-d', str(test_classes), *map(str, tests)], check=True)
    subprocess.run([str(jdk / 'java'), '-ea', '-Djava.awt.headless=true', '-cp',
                    os.pathsep.join([str(test_classes), str(classes), str(ROOT / 'src/main/resources'), cp]),
                    'local.fxpro.mql5.MqlLexerTest', str(args.corpus.resolve())], check=True)
    # Check all main and optional extension descriptors.
    for xml in (ROOT / 'src/main/resources/META-INF').glob('*.xml'):
        for entry in ET.parse(xml).getroot().iter():
            name = next((entry.attrib[k] for k in ['implementationClass', 'implementation', 'serviceImplementation', 'instance'] if k in entry.attrib), None)
            if name:
                assert (classes / (name.replace('.', '/') + '.class')).exists(), name
    output = ROOT / 'dist'
    output.mkdir(exist_ok=True)
    jar = work / 'mql5-intellij.jar'
    with zipfile.ZipFile(jar, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for file in sorted(classes.rglob('*.class')):
            write_entry(bundle, file, file.relative_to(classes).as_posix())
        resources = ROOT / 'src/main/resources'
        for file in sorted(resources.rglob('*')):
            if file.is_file(): write_entry(bundle, file, file.relative_to(resources).as_posix())
    artifact = output / f'mql5-intellij-{version}.zip'
    subprocess.run(['python3', str(server / 'scripts/test_declarations.py')], check=True)
    subprocess.run(['node', '--test', *map(str, sorted((server / 'test').glob('*.test.mjs')))], cwd=server, check=True)
    with zipfile.ZipFile(artifact, 'w', zipfile.ZIP_DEFLATED) as bundle:
        write_entry(bundle, jar, 'mql5-intellij/lib/mql5-intellij.jar')
        for file in sorted((server / 'src').glob('*')):
            if file.suffix in {'.mjs', '.py'}:
                write_entry(bundle, file, 'mql5-intellij/server/src/' + file.name)
        write_entry(bundle, server / 'package.json', 'mql5-intellij/server/package.json')
        write_entry(bundle, server / 'data/builtins.json', 'mql5-intellij/server/data/builtins.json')
        write_entry(bundle, server / 'data/reference.json', 'mql5-intellij/server/data/reference.json')
        for name in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
            write_entry(bundle, ROOT / name, 'mql5-intellij/' + name)
            write_entry(bundle, server / name, 'mql5-intellij/server/' + name)
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    (output / (artifact.name + '.sha256')).write_text(f'{digest}  {artifact.name}\n')
    (output / 'build-report.json').write_text(json.dumps({
        'plugin':'local.fxpro.mql5', 'version':version, 'ide_version':product['version'],
        'ide_build':product['buildNumber'], 'artifact':artifact.name, 'sha256':digest,
        'tests':'lexer fixtures, incremental restart, fuzz coverage, extension smoke checks, Python declaration tests, Node LSP tests',
        'corpus_available':args.corpus.is_dir(),
        'ui_tested':False,
    }, indent=2)+'\n')
    print(f'Built for IntelliJ {product["version"]} ({product["buildNumber"]})')
    print(artifact)
    print(f'SHA256 {digest}')

if __name__ == '__main__': main()

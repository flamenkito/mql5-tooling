"""Package this standalone repository using an explicit public-source allowlist."""
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOP = ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md', 'PUBLISHING.md', 'RELEASE_REPORT.json', '.gitignore']
TREES = {
    'mql5-intellij': ['src', 'build.py', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', '.gitignore'],
    'mql5-language-server': ['src', 'data/builtins.json', 'test', 'scripts', 'package.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', '.gitignore'],
    '.github': ['workflows'],
    'scripts': ['package-source.py', 'check-verifier.py'],
}

def files():
    for name in TOP:
        yield ROOT / name
    for tree, paths in TREES.items():
        for name in paths:
            path = ROOT / tree / name
            for file in sorted(path.rglob('*')) if path.is_dir() else [path]:
                if file.is_file() and '__pycache__' not in file.parts:
                    yield file

if __name__ == '__main__':
    output = ROOT / 'dist'
    output.mkdir(exist_ok=True)
    artifact = output / 'mql5-intellij-source-0.4.3.zip'
    with zipfile.ZipFile(artifact, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for file in files():
            assert file.is_file(), file
            assert not file.is_symlink(), file
            entry = zipfile.ZipInfo('mql5-intellij/' + file.relative_to(ROOT).as_posix(), (2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            bundle.writestr(entry, file.read_bytes())
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    artifact.with_suffix('.zip.sha256').write_text(f'{digest}  {artifact.name}\n')
    print(f'{artifact.name}: {digest}')

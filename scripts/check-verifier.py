"""Fail CI if Plugin Verifier did not verify compatibility or found API problems."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
files = list(root.rglob('*.txt'))
if not files:
    raise SystemExit('Plugin Verifier did not produce text reports')
for file in files:
    if file.name in {'compatibility-problems.txt', 'plugin-structure-errors.txt', 'verification-failure.txt'} and file.read_text().strip():
        raise SystemExit(f'Plugin verification failed: {file.relative_to(root)}\n{file.read_text()}')
verdicts = [file for file in files if file.name == 'verification-verdict.txt']
if not verdicts or any('Compatible' not in file.read_text() for file in verdicts):
    raise SystemExit('Plugin Verifier did not report Compatible for every target')
print('Plugin Verifier: compatible')

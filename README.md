# MQL5 IntelliJ

A single repository for the MQL5 IntelliJ plugin and its bundled language server.
The public product is the plugin; the server ships inside its ZIP.

- [Installation, features, and build](mql5-intellij/README.md)
- [Language server and reference importer](mql5-language-server/README.md)
- [Release preparation](PUBLISHING.md)

## Local reference setup

The generated `mql5-language-server/data/reference.json` is excluded from Git and
the public source archive. Obtain the official MQL5 CHM reference independently
and generate this file locally before running the server, tests, or plugin build.
See [reference import instructions](mql5-language-server/README.md#update-the-chm-reference).
The importer requires Python and 7-Zip; the CHM and extracted HTML remain local.

## Build

```sh
python3 mql5-intellij/build.py --ide '/Applications/IntelliJ IDEA.app'
python3 scripts/package-source.py
```

The first command creates the installable ZIP; the second packages the public
sources with a checksum. The CI workflow targets Linux/macOS and IDEA 2025.3.1,
but currently requires the generated reference data and will fail on a fresh
checkout until reference-independent tests and builds are implemented.
Requirements: Node.js 22+, Python 3.9+, and a local IDEA SDK
with a JDK. See the component READMEs for details.

The current plugin build still embeds the locally generated reference JSON.
Do not publish its ZIP until packaging and runtime loading support a separate
local reference. Git exclusion alone does not exclude files from release artifacts.

The code is licensed under MIT. See LICENSE and THIRD_PARTY_NOTICES.md for API sources.

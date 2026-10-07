# MQL5 IntelliJ

A single repository for the MQL5 IntelliJ plugin and its bundled language server.
The public product is the plugin; the server ships inside its ZIP.

- [Installation, features, and build](mql5-intellij/README.md)
- [Language server and reference importer](mql5-language-server/README.md)
- [Release preparation](PUBLISHING.md)

```sh
python3 mql5-intellij/build.py --ide '/Applications/IntelliJ IDEA.app'
python3 scripts/package-source.py
```

The first command creates the installable ZIP; the second packages the public
sources with a checksum. CI tests the server on Linux/macOS and builds the plugin
against IDEA 2025.3.1. Requirements: Node.js 22+, Python 3.9+, and a local IDEA SDK
with a JDK. See the component READMEs for details.

The code is licensed under MIT. See LICENSE and THIRD_PARTY_NOTICES.md for API sources.

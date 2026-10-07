# MQL5 language server

An LSP server bundled with the MQL5 IntelliJ plugin. It ships inside the plugin
ZIP and is not published separately to npm. Requires Node.js 22+; no runtime dependencies.

## Run and test

Generate `data/reference.json` locally before running these commands; it is not
included in Git or the public source archive. See
[Update the CHM reference](#update-the-chm-reference).
The current server requires this file at startup; a reference-free mode and
external reference location are not implemented yet.

```sh
node src/server.mjs
npm test
python3 scripts/test_declarations.py
```

The server uses stdin/stdout with LSP Content-Length framing. It does not accept
interactive shell commands. It can also be connected to another LSP client for development.

## Features

Definitions, references with lexical scope analysis, symbols, completion, hover,
and signature help. Includes are loaded lazily and cycles are handled. Supports
unsaved buffers, incremental edits, and UTF-16 positions. Lexical diagnostics
check strings, comments, and braces.

The API index contains 559 functions / 647 signatures, 12 structures, 106 ENUM types,
and 1828 qualified method names. There are value descriptions for 93 enums.
Hover includes context, function parameters/returns/notes, value lists, and full
reference links. Large enum lists show the first 40 values. Full MQL5 reference
links target the corresponding online topic. Local HTML reference links are
shown only when the local page exists. Documentation is in English.

This is an indexer, not a compiler. Complex types, inheritance, templates,
conditional compilation, and macro expansion are limited. The FileRead signature
is not present in the imported CHM. Reference corrections are recorded as erratum.

## Configuration

An optional `.mql5-lsp.json` at the project root:

```json
{
  "includeDirectories": ["../mt5-include"],
  "helpDirectory": "../mql5-language-server/reference/chm",
  "compileOnSave": false
}
```

Paths are relative to the project root. `mt5-include` and local
`mql5-language-server/reference/chm` directories are also discovered in parent
folders. A nested `mql5-tooling/mql5-language-server/reference/chm` monorepo path
is supported. MT5 headers and the full manual are not bundled in the ZIP.

## Optional compilation

**MQL5: Check compilation in UTM** invokes `mql5.compile`. This is a separate
macOS/Windows UTM integration requiring an external mac-dev.py helper. The helper
must provide ROOT, PROJECTS, source_files(project), and build(projects, action, vm),
which produces mac-builds/*/result.json and compiler logs. It is not part of this
repository. Configure compilerBridge, pythonExecutable, and vm. Normal editor
features do not require UTM or MetaEditor.

Compilation uses an isolated snapshot containing unsaved buffers. Stale results
are discarded. Programs are not run in MT5. Without a helper, the action reports
that compiler configuration is unavailable. MetaEditor positions were verified
on ASCII sources; tabs and non-BMP characters have not been separately validated.

## Update the CHM reference

Obtain the official MQL5 CHM reference independently and place it at
`reference/mql5.chm`. From the server root (requires 7-Zip):

```sh
mkdir -p reference
7zz x -y -oreference/chm reference/mql5.chm
python3 scripts/import-chm.py
python3 scripts/test_declarations.py
npm test
```

The importer uses only the Python standard library. `data/reference.json`, the
CHM, and extracted HTML are local generated data and must not be committed.
The importer also updates the tracked `data/builtins.json`; review that change
before committing it. Source metadata and SHA-256
are stored in data/reference.json. Declarations, short context, enum values,
parameter descriptions, returns, and notes provide documentation. Examples and
the full manual are not bundled. The current plugin build includes the updated
JSON files, so its ZIP must remain local until reference packaging is separated.

The code is MIT licensed; see THIRD_PARTY_NOTICES.md for reference sources.
Protocol: [LSP 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/).

Release 0.4.3 opens local HTML links through the plugin's browser handler. Other
LSP clients receive file links; IntelliJ sends localHelpLinkScheme=mql5-help
during initialization. Server 0.3.3 includes CHM descriptions for every imported function.

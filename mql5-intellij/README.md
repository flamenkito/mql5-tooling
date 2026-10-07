# MQL5 for IntelliJ IDEA

Syntax highlighting and a bundled language server for `.mq5` and `.mqh`.
Plugin 0.4.3, server 0.3.3. Verified against IntelliJ IDEA 2025.3.1;
compatibility is limited to platform branch 253 (2025.3).

## Installation

Open **Settings → Plugins → ⚙ → Install Plugin from Disk…**, select
`dist/mql5-intellij-0.4.3.zip`, and restart IDEA.
If another plugin owns these extensions, assign them to MQL5 under
**Editor → File Types**. Disable the older MQL plugin if it conflicts.

Language-server features require Node.js 22+ and an IDE with the IntelliJ LSP module.
Highlighting is available without LSP. The server is bundled; npm install is not required.
Settings: **Languages & Frameworks → MQL5**. Colors: **Editor → Color Scheme → MQL5**.

## Features

- Highlight keywords, types, functions, constants, indicators, entry points,
  predefined variables, input/sinput variables, and macros.
- Comments, strings, date/color literals, directives, and matching braces.
- Completion, hover, signatures and overloads, definitions, references,
  file/workspace symbols, and standard includes.
- Signatures for 559 functions, fields of 12 structures, and standard-library methods.
- CHM documentation: function descriptions, parameters, returns, notes, and enum values.
- Optional MetaEditor diagnostics through an external compiler bridge.

The server is a declaration indexer. Full type checking, inheritance, conditional
compilation, and macro expansion are not implemented. Input-variable and macro
colors use file-local declarations without include expansion or shadowing analysis.
Debugging, formatting, and rename are not available.

## Build

First generate the local reference JSON using the
[server import instructions](../mql5-language-server/README.md#update-the-chm-reference).
It is excluded from Git and public source archives. The current builder requires
it and embeds it in the plugin ZIP; do not publish that ZIP until reference data
can be loaded separately from a local installation.

```sh
python3 build.py --ide '/Applications/IntelliJ IDEA.app'
```

Requirements: Python 3.9+, Node.js 22+, and an installed IDEA SDK with javac (JDK 21+).
On Linux: `python3 build.py --ide /path/to/idea`.
The server is expected in `../mql5-language-server`; use `--server` for another location.
Use `--corpus` to test additional local MQL5 projects. Public builds do not require trading projects.
The build runs Java, Python, and LSP tests and creates a ZIP and SHA-256 in `dist/`.
It does not download dependencies or bundle SDK libraries.

The plugin and server are released from one repository. See the root PUBLISHING.md,
the server README, and THIRD_PARTY_NOTICES.md. The code is licensed under MIT.
This is an independent project, not affiliated with JetBrains or MetaQuotes.

Release 0.4.3 opens local HTML links through the plugin's browser handler. Server
0.3.3 imports descriptions, parameters, returns, and the first note from CHM.
Other LSP clients receive ordinary file links; IntelliJ sends
localHelpLinkScheme=mql5-help during initialization.

# Publishing the plugin

One GitHub repository contains the plugin and bundled language server. The server
remains a private npm package; do not run npm publish.

## Release materials

- Both components' sources, MIT licenses, and MetaQuotes source notices.
- README, CHANGELOG, Marketplace descriptor, and CI workflow.
- Installable ZIP and SHA-256: `mql5-intellij/dist/`.
- Public source archive and SHA-256: `dist/`.

The public source archive excludes trading projects, terminal state, the full
reference manual, personal settings, tokens, and SDK libraries. A GitHub remote
has not been assigned. Before publishing, add the public repository URL to the
plugin descriptor's vendor entry. The ID `local.fxpro.mql5` is retained for
compatibility with existing installations. Keep it unchanged after the first publication.

## Build and validation

Generate `mql5-language-server/data/reference.json` locally using the server
README before building or running tests. This file is excluded from Git and the
public source archive, along with the CHM and extracted HTML.

The current plugin ZIP still embeds `reference.json`; do not publish it as a
release asset. Before binary publication, implement external local-reference
loading and remove the generated reference from plugin packaging. The CI
workflow also requires adaptation: a clean checkout has no reference JSON,
and its current server tests and plugin build depend on that file. Do not add
an automatic CHM download to public CI as a substitute for this separation.

Review the tracked `data/builtins.json` separately; excluding `reference.json`
does not establish redistribution permission for other generated data.

```sh
python3 mql5-intellij/build.py --ide '/Applications/IntelliJ IDEA.app'
python3 scripts/package-source.py
```

Run the official Plugin Verifier against the target SDK:

```sh
java -jar /path/to/verifier-cli-1.410-all.jar check-plugin \
  mql5-intellij/dist/mql5-intellij-0.4.3.zip /path/to/idea \
  -verification-reports-dir /path/to/reports
python3 scripts/check-verifier.py /path/to/reports
```

The build supports macOS and Linux. CI downloads the pinned IDEA SDK 2025.3.1
and Verifier 1.410 and requires network access. Local builds use the installed IDEA.
For a new release, update plugin.xml, CHANGELOG, and the ZIP version in the workflow
and package-source.py. Update the server version when the server changes.
Verify highlighting and hover in a clean IDE: ENUM_BASE_CORNER, PERIOD_CURRENT,
ObjectSetInteger overloads, includes, and definition navigation. Verify another
IDE branch before extending until-build.

## JetBrains Marketplace

Follow the [official publishing instructions](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html).
The first upload is manual through a JetBrains Marketplace account. Use MQL5 as
the name, the description from plugin.xml, MIT as the license, and CHANGELOG for
release notes. Before submitting, add the public repository link and actual IDEA
screenshots of highlighting and documentation. This preparation does not create
a public repository or upload the plugin automatically.

The current ZIP is not signed with an author certificate. If using author signing,
sign the final ZIP with Marketplace ZIP Signer, verify the signature, and generate
a new checksum. Keep private keys and tokens outside the repository.
See [plugin signing](https://plugins.jetbrains.com/docs/intellij/plugin-signing.html).

CI has only contents: read permission and saves verification artifacts. It does
not publish releases or upload packages to Marketplace. Publication is a separate action.

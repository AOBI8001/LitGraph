# Third-party notices

The repository's MIT license covers original LitGraph code and documentation, not third-party dependencies or user research materials.

Direct runtime dependencies include:

| Package | Declared license |
| --- | --- |
| d3 | ISC |
| 3d-force-graph | MIT |
| three | MIT |
| three-spritetext | MIT |
| pdfjs-dist | Apache-2.0 |
| vite (development tooling) | MIT |
| Electron | MIT; Chromium and bundled components have additional notices |
| electron-builder (packaging tooling) | MIT |
| png-to-ico (packaging tooling) | MIT |

The lockfile records exact resolved dependencies, including transitive packages. Their bundled LICENSE / NOTICE files remain authoritative. Preserve applicable notices when distributing a compiled application.

The Windows distribution retains Electron's `LICENSE.electron.txt` and `LICENSES.chromium.html`. `scripts/prepare-desktop.mjs` copies bundled frontend dependency license / notice texts into `dist/third-party-licenses/` inside the application archive. Packaging dependencies are build tools rather than application runtime dependencies. The optional statistics service uses Cloudflare Workers and D1, subject to Cloudflare's terms and limits; this project does not promise perpetual free hosting.

The optional 50-paper sample contains public bibliographic metadata and abstracts, plus AI-generated summaries and graph relations. The MIT license applies to the software, not to third-party abstracts or publications, which retain their owners' rights. Private PDF / Markdown corpora, downloaded images and personal datasets are excluded from this source publication. Brand assets supplied for LitGraph identify this product; this document does not grant trademark rights or imply endorsement.

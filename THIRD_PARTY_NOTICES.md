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
| marked | MIT |
| dompurify | MPL-2.0 OR Apache-2.0 |
| @huggingface/transformers (Transformers.js) | Apache-2.0 |
| onnxruntime-node | MIT |
| vite (development tooling) | MIT |
| Electron | MIT; Chromium and bundled components have additional notices |
| electron-builder (packaging tooling) | MIT |
| png-to-ico (packaging tooling) | MIT |
| scansci-pdf WebVPN registry and adapted URL-routing logic | Apache-2.0; included subset described below |

The lockfile records exact resolved dependencies, including transitive packages. Their bundled LICENSE / NOTICE files remain authoritative. Preserve applicable notices when distributing a compiled application.

PDF conversion includes unmodified PDF.js character maps, standard fonts and decoder resources under `dist/pdfjs/`. Their accompanying license files are retained in the same subdirectories, including `LICENSE_LIBERATION`, `LICENSE_FOXIT` and decoder notices. These resource licenses are separate from LitGraph's MIT license; the exact installed `pdfjs-dist` package recorded by the lockfile is their upstream distribution.

Local dense retrieval uses the quantized [Xenova/multilingual-e5-small](https://huggingface.co/Xenova/multilingual-e5-small) ONNX conversion of [intfloat/multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small), whose upstream model card declares MIT. The conversion is pinned to revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`; the preparation manifest records artifact hashes. Model weights are separate from LitGraph's original code and are not committed to the source repository.

LitGraph retains the school WebVPN registry and adapts the required URL-routing logic from [Rimagination/scansci-pdf](https://github.com/Rimagination/scansci-pdf), revision `c7022a8000d266442c260623cf8b12b63b10c1e3`. The included files and modifications are documented in `vendor/scansci/SOURCE.md`; the original upstream license is retained in `vendor/scansci/LICENSE`. The upstream Python package, bundled browsers, optional PDF converters and proprietary compiled `_core` components are not part of this integration or installer. Original LitGraph code remains MIT; that does not relicense retained upstream material as MIT.

The Windows distribution retains Electron's `LICENSE.electron.txt` and `LICENSES.chromium.html`. `scripts/prepare-desktop.mjs` copies bundled frontend dependency license / notice texts and the retained ScanSci license/provenance into `dist/third-party-licenses/` inside the application archive. The original vendor files are also included under `vendor/scansci/`. Packaging dependencies are build tools rather than application runtime dependencies. The optional statistics service uses Cloudflare Workers and D1, subject to Cloudflare's terms and limits; this project does not promise perpetual free hosting.

The optional 50-paper sample contains public bibliographic metadata and abstracts, plus AI-generated summaries and graph relations. The MIT license applies to the software, not to third-party abstracts or publications, which retain their owners' rights. Private PDF / Markdown corpora, downloaded images and personal datasets are excluded from this source publication. Brand assets supplied for LitGraph identify this product; this document does not grant trademark rights or imply endorsement.

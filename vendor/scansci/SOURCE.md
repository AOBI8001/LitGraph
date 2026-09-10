# ScanSci public core attribution

- Upstream: https://github.com/Rimagination/scansci-pdf
- Revision: `c7022a8000d266442c260623cf8b12b63b10c1e3`
- License: Apache-2.0; verbatim upstream license retained in `LICENSE`.
- `webvpn.json`: copied public institution gateway registry from `src/scansci_pdf/data/webvpn.json`.
- `scripts/institution-routing.js`: WebVPN AES-CFB conversion ported from `sources/instsci.py` to Node.js. Modified to validate addresses, detect exact gateway hosts, avoid double wrapping and support encoded EZProxy target parameters.
- `desktop/browser-pdf.mjs`: independently implemented Electron adaptation of the browser acquisition pattern described by upstream `src/scansci_pdf/browser_engine.py` (shared session, PDF responses, authenticated navigation and PDF controls). No upstream browser binary, fingerprint patches, CAPTCHA solver or cookie-export worker is included. Upstream source: https://github.com/Rimagination/scansci-pdf/blob/main/src/scansci_pdf/browser_engine.py .
- `desktop/publisher-routes.mjs`: small JavaScript adaptation of the public `src/scansci_pdf/publisher_pdf_router.py` and `src/scansci_pdf/publisher_profiles.py` at revision `5bce70619ae1392f48f3d8e58b6af18e3bf31550`, retaining Apache-2.0 terms. The adapted rules cover Elsevier PII, IEEE article numbers, Springer/Nature article paths, Wiley/ACS DOI routes, declared PDF metadata and PDF viewer URLs. LitGraph adds SAGE/Taylor & Francis DOI routes, stricter cross-article identity and supplementary/preview rejection, metadata-first ordering, and preservation of the observed institution gateway origin/path. This module neither creates a browser nor accesses cookies; LitGraph executes candidate routes in its existing authenticated browser.

No upstream compiled/proprietary core or general Python source orchestrator is bundled. The registry is routing configuration, not a guarantee of institutional subscription or current compatibility. No individual user's credentials or cookies are included. LitGraph's own MIT license is unchanged; this component retains its upstream terms.

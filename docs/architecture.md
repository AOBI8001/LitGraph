# Current architecture

LitGraph 1.0. This document describes the Windows desktop build and the separate developer web preview.

## Components

- `desktop/main.mjs`: sandboxed Electron window, loopback HTTP service, authenticated IPC, encrypted model configuration, native model transport and persistent workspace state.
- `desktop/preload.cjs` / `src/desktop-bridge.js`: narrow renderer bridge; no Node access is exposed to page scripts. The renderer uses an in-memory browser partition; application state is restored from disk independently of its random loopback port.
- `desktop/metrics.mjs`: bounded offline queue for minimal launch/use events; disabled in development and automated tests.
- `cloudflare/metrics/`: optional operator-deployed Workers + D1 collector, HMAC installation IDs, idempotent events and private aggregate dashboard.
- `src/main.js`: application state, project library, graph rendering, windows and model requests.
- `src/model-rotation.js`: 3D pointer controller; viewpoint model rotation and year-tree camera navigation remain separate.
- `src/timeline-navigation.js`: fixed-heading year-tree panning and bounded upright orbit.
- `src/canvas-backgrounds.js`: cached procedural background artwork, used by Canvas 2D and a Three.js background texture.
- `src/discovery-contract.js`: provider-independent search planning, relevance assessment, counts and strict filters.
- `scripts/scholarly-service.js`: paginated OpenAlex / Europe PMC / Crossref retrieval and metadata enrichment.
- `scripts/public-fetch.js`: bounded HTTPS downloads with public-address validation, pinned DNS and redirect checks.
- `src/research-evidence.js`: Markdown chunks, lexical ranking and optional citation-ID validation.
- `src/research-agent.js`: source-grounded answer and follow-up-question contract.
- `src/summary-language.js`: language-specific summaries and faithful translation instructions.
- `scripts/local-service.js`: loopback-only authenticated search, PDF / Markdown storage, import snapshots and external Agent task queue.
- `scripts/litgraph-mcp.mjs`: STDIO MCP adapter to the local service.
- `vite.config.js`: development / preview middleware and public-versus-private sample resolution.

## Data flow

Discovery: conditions and target count → configured model / Agent plans queries → local service retrieves real scholarly records → strict filtering / deduplication → model assesses relevance in batches → user confirms → metadata enrichment → lawful PDF download → disk save → PDF.js text extraction → Markdown save → node original-file binding → source-backed citation edges between imported nodes. No model-native search tool is required.

Research: freeze the selected paper scope → load source text / Markdown → chunk and rank relevant excerpts → send excerpts, per-paper coverage and question → validate response → display answer and three specific follow-up questions.

A summary alone is not full text. No source text is fabricated when a download fails. PDF retrieval goes through the authenticated local service, not a cross-origin browser fetch. Authentication, unavailable URLs, download restrictions or scanned files can still require manual import / OCR.

## Storage

| Content | Current location |
| --- | --- |
| Project library, settings, conversation state | Desktop: `workspace-state.json` mirrored from renderer storage; web preview: browser localStorage |
| Uploaded original files / cached documents | Session IndexedDB cache; successfully indexed originals also saved on disk |
| Acquired PDFs, Markdown and source metadata | `projects/local-fulltext-index/<hash>.{pdf,md,json}` under desktop userData, or the web preview repository root |
| Discovery import project snapshots | `projects/local-projects/<project-hash>.json` under the same data root |
| API configuration | Desktop: Electron safeStorage / Windows encryption in `model-config.encrypted`; web preview: browser localStorage |
| Basic telemetry | Desktop `metrics-state.json`; remote HMAC installation records and daily aggregates, no research content |
| External Agent tasks and tokens | Local service memory; page/session scoped |
| Public sample | `src/public-sample.js` and `src/sample-project.json`, 50 public bibliographic records |

The desktop root is the current user's Electron userData directory (normally `%APPDATA%\litgraph`), not the read-only installation directory or ASAR archive. Main-process workspace persistence restores projects on restart even when the loopback port changes. API configuration is excluded from workspace snapshots. Encryption failure does not fall back to plaintext. Indexed documents use relative fulltextKey references, so copying the index directory preserves their paths. Project JSON alone does not include originals; back up the entire data root with the application closed. Encrypted credentials may require reconfiguration on another Windows account or computer.

For the web preview only, a different origin, port or cleared browser storage may hide projects; restore a JSON export when necessary. Import snapshots are not a complete backup of every later project edit.

## Desktop and external Agent boundary

The main window has context isolation, sandboxing and no Node integration. IPC checks the sending window, main frame and local origin. Model transport accepts HTTPS and loopback HTTP, rejects embedded credentials and redirects, limits request/response sizes, and supports cancellation. Original files are displayed as signature-checked PDF or plain text rather than accepting active HTML MIME types. Document popups are sandboxed without the application preload; web links open externally. Chromium's PDF viewer retains its own scripting capability. The local file/download service retains browser/Agent token separation and public-address checks.

MCP uses the installed runtime in Node mode (`ELECTRON_RUN_AS_NODE=1`) with an adapter copied into `agent-guide/`. The connection instructions provide the actual executable, environment, endpoint and per-session token. The external Agent must perform a handshake and keep polling/fulfilling tasks. Installed users do not need a separate Node runtime. Model API calls do not trigger the external Agent confirmation dialog.

## Release boundary

All `projects/` content is private and ignored. Development and production use the same sanitized 50-paper sample. A fresh installation opens a blank project; the sample is optional. No full-text originals, personal paths, model credentials or local preferences are bundled. Optional local full-text fallback uses `projects/local-sample/graph.json` and is never published.

The unsigned NSIS installer packages the app, renderer, local service and Agent contracts. Private profiles, originals, tests, keys and operator Cloudflare secrets are excluded through a packaging allowlist. See `PRIVACY.md` and `docs/metrics.md` for telemetry and its opt-out. No embedding-vector store, OCR pipeline, publisher login proxy, automatic updates or automatic browser-cookie sharing is implemented. Graph semantic layout must not be confused with vector retrieval for research answers.

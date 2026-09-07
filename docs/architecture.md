# Current architecture

Updated: 2026-09-08. This document describes implemented behavior, not a desktop packaging roadmap.

## Components

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
| Project library, settings, conversation state | Browser localStorage |
| Uploaded original files / cached documents | Browser IndexedDB; successfully indexed PDFs also saved on disk |
| Acquired PDFs, Markdown and source metadata | Local `projects/local-fulltext-index/<hash>.{pdf,md,json}` |
| Discovery import project snapshots | Local `projects/local-projects/<project-hash>.json` |
| API configuration | Browser localStorage; not an OS key vault |
| External Agent tasks and tokens | Local service memory; page/session scoped |
| Public sample | `src/public-sample.js` and `src/sample-project.json`, 50 public bibliographic records |

A different browser origin, port, profile or cleared storage may not see the same project; import a project JSON backup when necessary. The local service resolves fulltextKey under the current application directory, so new PDF / MD records survive directory relocation when their index directory is copied too. JSON alone does not copy the original files. Disk snapshots currently cover discovery imports, not every later project edit. API keys are never included in these snapshots.

## Release boundary

All `projects/` content is private and ignored. Development and production use the same sanitized 50-paper sample. A fresh installation opens a blank project; the sample is optional. No full-text originals, personal paths, model credentials or local preferences are bundled. Optional local full-text fallback uses `projects/local-sample/graph.json` and is never published.

No backend telemetry, SQLite database, embedding-vector store, OCR pipeline, publisher login proxy or packaged native application is implemented. The graph's semantic layout must not be confused with semantic-vector retrieval for research answers.

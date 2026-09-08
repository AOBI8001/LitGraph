# LitGraph

_1.0 · Local-first literature graphs and evidence-grounded research_

[简体中文](README.md) · [Download](https://github.com/AOBI8001/LitGraph/releases/latest) · [Website](https://litgraph.aobi.qzz.io/) · [MIT](LICENSE)

Discover papers, organize originals, explore relationships, and ask questions in one workspace. LitGraph provides viewpoint graphs and year trees, theory-based and semantic layouts, 2D / 3D views, and research conversations scoped to one paper, selected papers, or a whole project.

Projects and originals stay on your computer by default. Remote AI features require your own model API or external Agent; no model credits are included. Local-first does not mean every operation is offline.

## 📥 Download and install

1. Open [GitHub Releases](https://github.com/AOBI8001/LitGraph/releases/latest) and download **LitGraph-Setup-1.0.0-x64.exe**. The source-code archives are not installers.
2. Run the installer on Windows 10 / 11 x64, choose a directory, then launch LitGraph. No separate Node.js or Python installation is needed.
3. A fresh installation opens a blank project. Connect a model or load the optional 50-paper sample.

This build is **unsigned**. Windows or your browser may show an unknown-publisher or security warning. Only download from this repository, verify the source before deciding to run it, and do not disable system protection. Compare the file hash with the Release's `SHA256SUMS.txt`:

```powershell
Get-FileHash .\LitGraph-Setup-1.0.0-x64.exe -Algorithm SHA256
```

Checksums verify file integrity, not publisher identity. Uninstall through Windows Installed Apps; normal uninstallation preserves user data. Automatic updates are not included: download a newer installer to upgrade.

## 🔌 Connect AI

### Method 1: External Agent

In Settings → Model connection, copy the external Agent instructions and send them to a local tool-capable Agent such as Codex or Claude Code. They include the working directory, contract documents, and session-specific MCP connection details.

The Agent must start the adapter, perform the handshake, and keep processing tasks. LitGraph then shows a connection confirmation and the model name reported by the Agent. The desktop application provides the adapter runtime; a separate Node.js installation is unnecessary.

MCP configuration differs between Agent products. Pasting the instructions into a plain chatbot without tool execution does not connect it. Connection text contains temporary credentials: never publish it. Reconnecting or closing the application can invalidate the session. A green indicator reports recent activity, not verified Agent identity.

### Method 2: Model API

Enter the endpoint, API key and model, then test and save. Supported protocols include OpenAI-compatible Chat Completions / Responses and Anthropic Messages. For DeepSeek, Qwen, Kimi or another provider, use an endpoint and model actually supported by that service.

The desktop application encrypts saved configuration and sends model requests from its local process, avoiding browser CORS restrictions. Confirm image support against the model's capabilities. A successful connection test does not guarantee web browsing, vision or unlimited context. LitGraph supplies scholarly search and download tools; provider charges, rate limits and regional availability still apply.

## 🧭 Workflow

### 1. Create a project

The top-left menu creates, renames, switches and deletes projects. Start with the sample, discover literature or import your own papers. The sample contains 50 public bibliographic records and abstracts, with AI-organized summaries and some relationships. It is not a set of independently validated research claims and includes no private PDF / Markdown originals. Third-party abstracts and papers are not covered by the software's MIT license.

### 2. Discover and import literature

1. Describe your topic and set years, language, publication type, access preference and sorting.
2. Search count presets are **5 / 10 / 20 / 50 / 100**, with custom integers from 5 to 100.
3. AI plans queries; LitGraph retrieves real records from **OpenAlex, Europe PMC and Crossref**, applies filters and deduplication, then asks AI to assess relevance.
4. Review the results and confirm selected records.
5. The software enriches available titles, authors, DOIs, years, abstracts, references and citation counts, attempts lawful PDF acquisition, extracts text to local Markdown and binds the node's original-document action.

Open access is an access restriction, not a separate search engine. Institution login opens the library entry supplied by the user; it **does not read browser cookies, bypass paywalls or override institutional limits**. Import legally obtained originals manually when automatic acquisition is unavailable.

The requested count is a target, not a guarantee of results or full texts. Citation counts come from available source metadata, not from counting PDF text; missing values remain unknown. Platforms may report different counts and coverage.

### 3. Explore the graph

| Feature | Behavior |
| --- | --- |
| Viewpoint graph | Organize papers by theory or semantic similarity and inspect support, opposition and relatedness |
| Year tree | Explore publication timing and relationships with adjustable year spacing |
| 2D / 3D | In viewpoint 3D, blank-canvas dragging rotates the model; year-tree 3D emphasizes camera panning |
| 3D navigation | Arrow keys / WASD move the camera; the wheel zooms; the canvas provides a hint |
| Nodes | Hover for information; click for selection, details and related links; click the same node to deselect |
| Multiple / box selection | Select papers for research; leaving selection mode clears the selection |
| Filters / data | Filter, inspect statistics and edit table data |
| Appearance | Chinese / English, light / dark themes and eight canvas-only backgrounds; theme switching resets to white / black |

Theory colors remain visible even without full text. Switching view, layout or graph type clears selection. Graph relatedness is not evidence of causation.

### 4. Ask questions grounded in originals

Research tabs can cover all papers, one paper or selected papers. **Enter sends; Shift+Enter inserts a line break.** Windows can be dragged and resized; files can be dropped into the composer.

Quick favors shorter answers and lower latency; Expert favors depth. These are response preferences rather than fixed model names or guaranteed timings. Elapsed time appears while waiting. Pause cancels the request; resubmitting starts a new request, not a continuation of interrupted provider-internal reasoning.

LitGraph retrieves relevant local Markdown / source excerpts and requires evidence-grounded answers, with AI inferences identified separately. Long explicit citations are not mandatory by default. Up to three concise, context-specific follow-up questions can continue the discussion. Missing full text must be disclosed rather than treated as a fully read paper.

## 🔐 Storage and privacy

Desktop data is stored under `%APPDATA%\litgraph`, independently of the installation directory:

| Content | Location |
| --- | --- |
| Projects, preferences and conversations | `workspace-state.json` |
| OS-encrypted model configuration | `model-config.encrypted` |
| PDFs, Markdown and source records | `projects/local-fulltext-index/` |
| Discovery import snapshots | `projects/local-projects/` |
| Agent contracts and adapter | `agent-guide/` |
| Random installation ID and pending basic events | `metrics-state.json` |

Close the app before backing up the complete data directory. Project JSON alone does not include every original. Encrypted credentials may not decrypt on another computer; configure them again after migration. Never publish this directory, your API key or Agent connection text.

The official desktop build sends a random installation ID, event ID, launch/use type and timestamp to count first use, daily active installations, launches and core operations. It does not send paper content, conversations, keys, file paths, hardware IDs or individual action names. Disable it under Settings → About LitGraph. See [Privacy](PRIVACY.md) and the [maintainer's metrics guide](docs/metrics.md).

## 🧠 Algorithms and optimization

- **Theory layout:** force-directed positions reflect theory membership and relationships, with adjustable visual parameters.
- **Semantic layout:** local term features and similarity drive layout; this is not a paid model embedding service.
- **Year tree:** combines chronology and relationships without assuming temporal order establishes citation or causation.
- **Research RAG:** local chunking, lexical matching and excerpt ranking augment generation. This is not vector-database retrieval and does not guarantee every paper fits into a single request.
- **Rendering:** effective-pixel-ratio rendering, on-demand 3D loading and cached background textures support clarity and performance.
- **Requests:** batch processing, cancellation and stale-result isolation help avoid outdated answers replacing current state.
- **Local service:** session credentials distinguish browser and Agent roles; downloads validate public addresses, redirects and size limits.

Built-in OCR is not available. Scanned documents, complex columns, formulas and tables may need manual preparation. Network restrictions, model context limits, permissions and rate limits can affect results. Verify important academic claims; tests cannot establish that every computer, provider and document is bug-free.

## 🛠️ Develop and build

Install Node.js **22.12+** and pnpm:

```sh
git clone https://github.com/AOBI8001/LitGraph.git
cd LitGraph
pnpm install --frozen-lockfile
pnpm dev
```

The development page usually opens at [http://127.0.0.1:4320/](http://127.0.0.1:4320/); use the actual terminal URL if the port changes. Do not expose the development service to the public network.

```sh
pnpm test
pnpm build
pnpm test:desktop
pnpm check:release
pnpm dist:win
```

Windows artifacts appear in `release/` and are not automatically uploaded. Desktop tests use isolated profiles and synthetic credentials, with production metrics disabled. Browser development previews use browser storage and do not provide the desktop's OS-encrypted credential persistence.

## 📚 Documentation

- [Architecture](docs/architecture.md) · [Data contract](docs/agent-data-contract.md)
- [Discovery AI contract](docs/literature-discovery-agent-spec.md) · [Research AI / RAG contract](docs/research-space-rag-agent-spec.md)
- [External Agent / MCP guide](docs/LITGRAPH_AGENT_GUIDE.md) · [Research behavior](docs/research-space-current-behavior.md)
- [Backgrounds, language and interaction](docs/canvas-backgrounds-and-language.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

Report reproducible problems in [GitHub Issues](https://github.com/AOBI8001/LitGraph/issues), redacting credentials, private documents and personal paths. Original code and documentation use MIT; third-party dependencies and papers retain their own rights.

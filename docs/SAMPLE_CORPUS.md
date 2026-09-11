# Sample full-text corpus

The sample graph has 50 nodes representing 49 distinct papers. Nodes `paper-045` and `paper-046` refer to the same stop-signal review and share one Markdown source. They remain separate graph nodes; evaluations must report deduplicated document counts.

## Markdown and PDF availability

An optional local corpus provides the papers' extracted full text in Markdown. Research Space uses the same source-loading and evidence-selection path for API and external Agent connections. No PDF is included in this corpus. A Markdown-only sample disables the PDF action and explains that the original text is available for questions.

Files live in `public/sample-fulltext/`, with an identity and SHA-256 manifest in `index.json`. Vite copies these assets to `dist/sample-fulltext/`; the desktop package includes the built assets. At runtime, the local service can copy the text into the user's categorized Markdown folder. No source-author machine paths are needed.

The corpus is intentionally excluded from Git. Owning a local copy does not establish public redistribution rights. Review each paper's license or permission before publishing full text in a repository, website or installer; LitGraph's MIT license does not relicense third-party articles. Source-only checkouts without the optional corpus must not claim to include original text.

## Source preparation

`scripts/prepare-sample-corpus.mjs` accepts an explicit local source manifest. It uses existing extracted text, normalizes existing page markers, removes recognized website navigation and local extraction prefaces, and writes Markdown plus hashes. It does not invent text, translate findings, generate summaries, or reconstruct uncertain statistical symbols. Web extractions without physical page boundaries retain line provenance rather than invented PDF pages.

An audit found `paper-028` had unrelated bibliographic metadata attached to the correct social-evaluation graph node. Its title, authors, year, DOI and abstract have been restored from the original article: *How does social evaluation influence Hot and Cool inhibitory control in adolescence?*, DOI `10.1371/journal.pone.0257753`. The unrelated citation count and OpenAlex identifier were removed; the citation count is unknown, not a newly measured zero.

## Verification and evaluation boundary

The corpus loader requires sample identity, matching title and DOI, a safe manifest file name, and a matching content hash. Missing or corrupt expected Markdown must not silently become an abstract-only answer. User-provided original files retain precedence.

`tests/sample-corpus-smoke.mjs` checks all 50 nodes against a fresh data directory, PDF absence, original-text evidence and the shared Research Space message builder. These are integration checks, not retrieval quality or answer accuracy measurements.

A RAG benchmark must separately define questions, independently verified gold passages and expected answer facts. Freeze the corpus and retrieval configuration before running it. Report evidence recall and precision separately from factual answer accuracy, include insufficient-evidence questions, and disclose duplicates, extraction artifacts and unresolved bad cases. Existing AI summaries are not ground-truth answers.

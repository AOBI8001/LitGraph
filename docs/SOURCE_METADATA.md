# Source bibliographic metadata

The filename is an identity hint, never source proof. The deterministic extractor inspects a bounded opening (up to four PDF pages / 32,000 characters), locates the source title, and binds author evidence to that article. Whitespace and punctuation normalization support wrapped text; an ellipsis hint requires literal prefix/suffix matches. Multiple unbound article blocks remain ambiguous. A single explicitly labelled bibliographic fragment may provide authors/date without inventing a title.

Local bylines handle Chinese and Latin-script names, affiliation markers, spaced Chinese names, explicit thesis labels and bylines immediately preceding a title in extracted reading order. Unmapped glyphs may separate intact names, but never reconstruct missing characters. Column labels, affiliations, supervisors, reference sections and date strings are rejected as names. Publication/thesis dates require explicit source patterns; a received date, grant year or system date is not a publication year.

`sourceMetadataVersion` tracks the implementation attempt. `sourceMetadataState.status` and `missing` separately track field completeness, with a source fingerprint. An unsuccessful attempt is not proof that fields are complete. Version-1 records are migrated locally when their project opens; hidden unfinished imports are left to their normal resume workflow. Source identity/lookup caches follow corrected title/DOI rather than stale filenames. Startup migration never invokes a model or makes scholarly requests.

During explicit import analysis or metadata-only retry, a reliable DOI or recovered title can be resolved through the existing exact scholarly lookup. If title/authors remain missing and the target region is unambiguous, an optional bounded model extraction returns field-level quotations. Quotations must occur in that target region; unknown/foreign names are rejected, and a partial model list cannot replace a complete locally identified byline. The transport has a 45-second ceiling and a 1,600-token output budget. Valid attempts are cached per source, implementation version and model identity; transient failures remain retryable. The model identity is hashed and excludes API keys. The retry button explicitly permits another attempt. Bibliography failure does not discard a valid summary/classification.

`metadataOverrides` preserves explicit user edits, including intentionally empty fields. Changes since a recorded automatic fill are also detected. Existing nonempty fields without a reliable automatic provenance are retained conservatively; ambiguous historical manual edits cannot be perfectly reconstructed. Trusted scholarly fields are preserved and missing fields may be filled from confirmed source evidence. Unknown citation counts remain unknown.

Workspace state and project snapshots are saved after migration/retry. This repair changes bibliographic fields and completeness state; it does not require regenerating unchanged chunk vectors or paper summaries.

## Validation

- `node --test src/*.test.js scripts/*.test.js`: includes split/ordinary Chinese and English bylines, same-page article isolation, supervisor/column/date rejection, target-only model quotes, partial-list protection, references, opaque/truncated filenames, unreadable glyphs, failed lookups/model calls, provider changes and manual overrides.
- `node tests/desktop-metadata.mjs`: synthetic originals, isolated profile and mocked scholarly endpoint; verifies v1 migration, source-bound author lists, explicit incomplete state, metadata-only retry, Chinese/English UI, fresh Markdown import, workspace/project consistency and reload persistence.
- `node tests/desktop-124.mjs`: legacy metadata repair and existing desktop/UI regression.
- `node tests/desktop-smoke.mjs`: fresh/sample startup, sandbox/transport, original-file persistence and restart regression.

All committed fixtures are synthetic. Local corpus checks operate on copies in memory and are not uploaded. Passing these regressions demonstrates coverage of the named cases, not perfect accuracy for arbitrary PDFs, scripts, OCR quality or scholarly databases. Ambiguous/missing information stays pending for source replacement or human verification. Source updates alone do not change an already installed executable or published Release assets.

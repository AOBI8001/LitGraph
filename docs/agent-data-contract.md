# LitGraph project data contract

Updated: 2026-09-08. Graph format remains schemaVersion 0.1; application version is independent.

Import / export project JSON through the LitGraph project controls. External Agent tasks normally return results through the local API, not by modifying project files directly.

## Minimal valid fictional project

```json
{
  "meta": {"schemaVersion": "0.1", "title": "Example", "mock": true},
  "theories": [
    {"id": "theory-a", "label": "示例理论", "labelEn": "Example theory", "color": "#7658b8"}
  ],
  "nodes": [
    {
      "id": "paper-001",
      "title": "Fictional example — not an actual paper",
      "authors": ["Example Author"],
      "year": 2024,
      "month": 6,
      "language": "en",
      "primaryTheory": "theory-a",
      "secondaryTheories": [],
      "citations": null,
      "theoryStrength": 0.5,
      "hasPdf": false,
      "doi": "",
      "abstract": "Fictional demonstration only.",
      "aiSummaryZh": "仅为虚构演示，不得用于学术引用。",
      "aiSummaryEn": "Fictional demonstration only; not academic evidence.",
      "isMock": true
    }
  ],
  "semanticLinks": [],
  "citationLinks": []
}
```

## Nodes

IDs must be unique and stable. Preserve every author's full available name and order. Compact canvas labels may abbreviate names; that does not justify truncating the stored author array.

Use actual title, year, publication language, journal, abstract and DOI. Unknown data remains absent, null or empty as appropriate; never invent it. Keep original abstracts separate from summaries and full text.

Optional fields include month, keywords, claimLabel / claimLabelEn, citationPercentile, theoryStrength, summary, aiSummaryZh / aiSummaryEn, sourceUrl / url, pdfUrl, and local full-text references. Month defaults are a display fallback, not verified publication metadata.

citationPercentile, when verified, is 0–100. theoryStrength is 0–1 and controls visual encoding; it is not an established academic quality measure. A model-generated relation or strength is interpretation, not independently verified fact.

Language-specific summary fields are preferred by the details UI. Legacy summary is used only when its language matches. A missing translation requires a connected model or an honest unavailable notice.

hasPdf must reflect actual available original text/file status, not merely the presence of a DOI. A remote link is not proof of successful local download. A JSON export containing local paths does not copy the referenced PDF / Markdown files.

Discovery adds source provenance: metadataSource / metadataSources, metadataApiUrl (keys redacted), metadataRetrievedAt, abstractSource, citationSource, citationRetrievedAt, volume, issue and pages. Unknown citations are null; do not replace them with zero. Counts from different indexes are not interchangeable.

Source reference lists use referenceOpenAlexIds, referenceDois and referenceRecords. The last field preserves available DOI, unstructured text, author, year and title, not a guarantee that every reference is complete. These fields are distinct from a formatted citation for the node itself.

New durable full-text bindings use fulltextKey, originalRelativePath, markdownRelativePath, fulltextStatus, fulltextPersistence and conversionQuality. Paths resolve beneath projects/local-fulltext-index in the current application directory. fulltextStorageKey refers to an optional IndexedDB cache. fulltextError explains failed acquisition or extraction. indexed means available extracted text, not guaranteed OCR of all pages or verified table/formula reconstruction. See the discovery contract for state meanings and backup requirements.

## Relations

semanticLinks entries contain id, source, target, relation (support / oppose / related), strength and optional rationale. Both endpoints must exist in nodes. Do not fabricate support/conflict evidence.

citationLinks entries contain id, source and target: source cites target. A publication being older is not proof of a citation. Only verified references justify real citation edges.

Theory IDs referenced by nodes must exist in theories. label and labelEn support bilingual interface labels without altering the original paper title.

## Release safety

Private paths, original full text and user projects must not be committed to the public repository. MIT does not relicense imported papers. The bundled public fixture is produced by src/public-sample.js; it has no real DOI, download URL or private source path.

For AI request / response formats, use the separate [discovery](literature-discovery-agent-spec.md) and [research](research-space-rag-agent-spec.md) contracts; they are not interchangeable with graph JSON.

// The sample corpus is optional in source checkouts and contains text, never PDFs.
// Bind by both sample identity and bibliographic identity, not a reusable node ID.
const titleKey = value => String(value || '').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]/g, '');
const doiKey = value => String(value || '').toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '').trim();
export function sampleEntry(node, catalog) {
  if (!node?.isSample || catalog?.schemaVersion !== 1) return null;
  const entry = catalog.documents?.find(item => item.id === node.id);
  if (!entry || !/^paper-\d{3}\.md$/.test(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256)) return null;
  if (titleKey(entry.title) !== titleKey(node.title) || doiKey(entry.doi) !== doiKey(node.doi)) return null;
  return entry;
}
export function withSampleCorpus(project, catalog) {
  const sample = structuredClone(project);
  let count = 0;
  for (const node of sample.nodes) {
    const entry = sampleEntry(node, catalog);
    if (entry) {
      node.sampleMarkdown = { file: entry.file, sha256: entry.sha256, canonicalId: entry.canonicalId };
      node.fulltextStatus = 'bundled_markdown';
      count++;
    }
  }
  sample.meta.fullTextCount = count;
  sample.meta.bundledPdfCount = 0;
  sample.meta.note = count
    ? 'Sample includes extracted full-text Markdown for research questions. PDF files are not included. Extraction artifacts and AI-generated summaries require verification.'
    : 'Sample graph contains bibliographic metadata. The optional full-text Markdown corpus is not installed.';
  return sample;
}
export function refreshSampleNodes(project, template) {
  if (!Array.isArray(project?.nodes)) return project;
  const result = structuredClone(project);
  for (const node of result.nodes) {
    if (!node.isSample) continue;
    const current = template.nodes.find(item => item.id === node.id);
    if (!current) continue;
    // Repair only the known erroneous enrichment, never a user-supplied document
    // or a user's renamed/edited title. Keep graph positions, notes and selection.
    if (!node.fulltextKey && !node.fulltextStorageKey && node.id === 'paper-028' && node.doi === '10.1371/j'
      && node.title === 'A 38-year-old woman with zosteriform skin lesions') {
      for (const field of ['title', 'authors', 'year', 'month', 'journal', 'doi', 'abstract', 'citations',
        'citationMetricStatus', 'citationPercentile', 'citationSource', 'openAlexId', 'citationUpdatedAt',
        'abstractSource', 'abstractRetrievedAt', 'referenceOpenAlexIds', 'url', 'sourceUrl', 'abstractSourceUrl']) node[field] = structuredClone(current[field]);
    }
    if (current.sampleMarkdown && titleKey(current.title) === titleKey(node.title) && doiKey(current.doi) === doiKey(node.doi)) {
      node.sampleMarkdown = structuredClone(current.sampleMarkdown);
      if (!node.fulltextKey && !node.fulltextStorageKey) node.fulltextStatus = 'bundled_markdown';
    } else if (!current.sampleMarkdown && node.sampleMarkdown) {
      delete node.sampleMarkdown;
      if (node.fulltextStatus === 'bundled_markdown') node.fulltextStatus = 'missing';
    }
  }
  if (result.meta?.sample) {
    result.meta.fullTextCount = result.nodes.filter(node => node.sampleMarkdown || node.fulltextStatus?.startsWith('indexed')).length;
  }
  return result;
}
export async function loadSampleDocument(node, read) {
  if (!node?.isSample) return null;
  const raw = await read('index.json');
  if (!raw) return null;
  const catalog = JSON.parse(raw);
  const entry = sampleEntry(node, catalog);
  if (!entry) {
    if (catalog.documents?.some(item => item.id === node.id)) throw new Error('Sample identity does not match the original text. / 样例元数据与原文不匹配，请重新载入样例项目。');
    return null;
  }
  const markdown = await read(entry.file);
  if (!markdown?.trim()) throw new Error('Sample Markdown is missing. / 样例 MD 文件缺失。');
  const bytes = new TextEncoder().encode(markdown);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== entry.sha256) throw new Error('Sample Markdown integrity check failed. / 样例 MD 完整性检查失败。');
  return { markdown, fileName: entry.file, sourceKind: entry.sourceKind, pageCount: entry.pageCount,
    title: entry.title, doi: entry.doi, sampleCanonicalId: entry.canonicalId, corpusHash: hash,
    conversionQuality: 'existing_text_extraction', bundledMarkdown: true };
}

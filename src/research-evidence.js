// Local, deterministic lexical retrieval. No embedding / semantic-search claim.
const words = value => String(value).toLowerCase().match(/[a-z0-9]{2,}|[\u3400-\u9fff]/g) || [];
export function chunkDocument(document) {
  const lines = document.markdown.replace(/\r\n/g, '\n').split('\n');
  const chunks = [];
  let buffer = [], start = 1, size = 0, page = null;
  const flush = end => {
    const text = buffer.join('\n').trim();
    if (text) chunks.push({ text, lineStart: start, lineEnd: end, page, fileName: document.fileName, localMarkdownPath: document.localMarkdownPath, sourceKind: document.sourceKind || 'markdown' });
    buffer = []; size = 0;
  };
  lines.forEach((line, i) => {
    const pageMatch = line.match(/^## PDF Page (\d+)$/);
    if (pageMatch) { flush(i); page = Number(pageMatch[1]); start = i + 1; }
    if (size > 1800) { flush(i); start = i + 1; }
    buffer.push(line); size += line.length;
  });
  flush(lines.length);
  return chunks;
}
export function selectEvidence(documents, question, budget = 42000) {
  const expanded = `${question} ${Object.entries({ '方法': 'method methods participants procedure task', '样本': 'sample participants patients controls', '结果': 'results findings significant', '统计': 'statistical analysis effect confidence interval', '局限': 'limitations discussion', '抑制': 'inhibition inhibitory stopping SSRT', '结论': 'conclusion discussion', '观察': 'observation observed audience', '差异': 'difference comparison group' }).filter(([term]) => question.includes(term)).map(([, terms]) => terms).join(' ')}`;
  const stop = new Set(['the', 'and', 'of', 'to', 'in', 'is', 'are', 'with', 'for', 'this', 'that', '的', '了', '是', '请']);
  const query = new Set(words(expanded).filter(w => !stop.has(w)));
  const candidates = documents.flatMap(({ node, document }) => {
    if (!document?.markdown?.trim()) return node.abstract?.trim() ? [{ documentId: node.id, title: node.title, year: node.year, text: node.abstract, sourceKind: 'abstract', fileName: '元数据摘要', score: 0 }] : [];
    return chunkDocument(document).map((chunk, i) => {
      const terms = new Set(words(chunk.text));
      const score = [...query].reduce((n, term) => n + (terms.has(term) ? 1 : 0), 0);
      return { ...chunk, documentId: node.id, title: node.title, year: node.year, score, order: i };
    });
  });
  const ranked = candidates.sort((a, b) => b.score - a.score || (a.order || 0) - (b.order || 0));
  const selected = [], seen = new Set();
  let used = 0;
  // One best passage per paper first, then fill remaining context by relevance.
  const add = (c, limit = 5000) => { if (seen.has(c) || used >= budget) return; const remaining = budget - used; if (remaining < 300) return; const text = c.text.slice(0, Math.min(limit, remaining)); selected.push({ ...c, text, truncated: text.length < c.text.length }); seen.add(c); used += text.length; };
  const represented = new Set(ranked.map(c => c.documentId)).size;
  const fairShare = Math.max(300, Math.floor(budget * .65 / Math.max(1, represented)));
  for (const { node } of documents) { const best = ranked.find(c => c.documentId === node.id); if (best) add(best, fairShare); }
  ranked.forEach(c => add(c));
  return selected.map(({ score, order, ...c }, i) => ({ ...c, id: `E${i + 1}` }));
}
export function validateEvidenceAnswer(answer, evidence) {
  const ids = [...new Set([...answer.matchAll(/\[(E\d+)\]/g)].map(m => m[1]))];
  const known = new Map(evidence.map(e => [e.id, e]));
  if (ids.some(id => !known.has(id))) throw new Error('模型引用了不存在的证据编号，请重试。');
  // Citations are optional; validate IDs only when the answer includes them.
  return ids.map(id => known.get(id));
}

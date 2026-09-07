import { localRequest } from './external-agent.js';
import { selectEvidence } from './research-evidence.js';
let dbPromise;
const sourceCache = new Map();
function database() {
  return dbPromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('litgraph-fulltext', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storage(key, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', value === undefined ? 'readonly' : 'readwrite');
    const request = value === undefined ? tx.objectStore('documents').get(key) : tx.objectStore('documents').put(value, key);
    tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error);
  });
}
export async function extractFile(file) {
  if (file.size > 40 * 1024 * 1024) throw new Error('单个文档请小于 40 MB。');
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
    const pdf = await loadingTask.promise;
    let markdown = `# ${file.name}\n`, characterCount = 0;
    try {
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p), content = await page.getTextContent();
        let text = '', lastY;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform?.[5];
          if (lastY !== undefined && Math.abs(y - lastY) > 3 && !text.endsWith('\n')) text += '\n';
          text += item.str + (item.hasEOL ? '\n' : ' '); lastY = y;
        }
        characterCount += text.trim().length;
        markdown += `\n## PDF Page ${p}\n\n${text.trim()}\n`; page.cleanup();
      }
    } finally { await loadingTask.destroy(); }
    if (characterCount < 40) throw new Error('PDF 没有足够的可提取文字，可能是扫描件。请先 OCR，再上传 PDF 或 MD。');
    return { markdown, fileName: file.name.replace(/\.pdf$/i, '.md'), sourceKind: 'pdf_text', conversionQuality:'text_extraction', pageCount:pdf.numPages, original: file };
  }
  if (!['md', 'txt', 'csv', 'json', 'tex'].includes(ext)) throw new Error('研究材料支持 PDF、MD、TXT、CSV、JSON、TeX。请先将其他格式转换为 PDF 或 MD。');
  const markdown = (await file.text()).replace(/\r\n/g, '\n').replace(/\u0000/g, '');
  if (!markdown.trim()) throw new Error('文件没有可读取的文字。');
  return { markdown, fileName: file.name, sourceKind: ext === 'md' ? 'markdown' : 'text', original: file };
}
export async function saveFulltext(projectId, node, document) {
  const key = `${projectId}:${node.id}`;
  let browserSaved = false;
  try { await storage(key, document); browserSaved = true; node.fulltextStorageKey = key; } catch { /* The local disk remains usable when browser storage is full. */ }
  node.fulltextStatus = 'indexed';
  node.fulltextError = '';
  sourceCache.delete(node.fulltextKey || `${node.id}:${node.doi}:${node.title}`);
  const { original, ...plain } = document;
  try {
    const originalData=original?.name?.toLowerCase().endsWith('.pdf')&&!document.originalAlreadySaved?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(original);}):undefined;
    const saved = await localRequest('document', { ...plain, originalData, projectId, nodeId: node.id });
    node.fulltextKey = saved.key; document.localMarkdownPath = saved.localMarkdownPath;
    node.markdownRelativePath=saved.markdownRelativePath;node.originalRelativePath=saved.originalRelativePath;node.fulltextPersistence='disk';node.conversionQuality=document.conversionQuality||'text';
    if (saved.originalRelativePath) node.hasPdf = true;
    if (browserSaved) await storage(key, document).catch(() => {});
  } catch (error) {
    if (!browserSaved) { node.fulltextStatus = 'storage_failed'; throw error; }
    node.fulltextStatus = 'indexed_browser_only';node.fulltextPersistence='browser';
  }
  return document;
}
export async function getFulltext(node) {
  if (node.fulltextStorageKey) { const cached = await storage(node.fulltextStorageKey).catch(() => null); if (cached) return cached; }
  const cacheKey = node.fulltextKey || `${node.id}:${node.doi}:${node.title}`;
  if (sourceCache.has(cacheKey)) return sourceCache.get(cacheKey);
  const document = await localRequest('document', node.fulltextKey ? { key: node.fulltextKey } : { node: { id: node.id, doi: node.doi, title: node.title } }).catch(() => null);
  if (document) sourceCache.set(cacheKey, document);
  return document;
}
export async function prepareEvidence(nodes, question, attachments = [], signal, budget = 42000) {
  const documents = [];
  for (const node of nodes) { signal?.throwIfAborted(); documents.push({ node, document: await getFulltext(node) }); }
  for (const item of attachments.filter(a => a.document)) documents.push({ node: { id: item.id, title: item.name }, document: item.document });
  signal?.throwIfAborted();
  const evidence = selectEvidence(documents, question, budget);
  return { evidence, coverage: documents.map(({ node, document }) => ({ id: node.id, title: node.title, status: document ? 'fulltext_indexed_excerpts_only' : node.abstract ? 'abstract_only' : 'no_source_text', suppliedEvidenceIds: evidence.filter(e => e.documentId === node.id).map(e => e.id) })) };
}
export async function originalBlob(node) {
  if (node.fulltextStorageKey) {
    const cached = await storage(node.fulltextStorageKey).catch(() => null);
    if (cached?.original) return cached.original;
  }
  const result = await localRequest('original', { key:node.fulltextKey, id: node.id, title: node.title }).catch(() => null);
  if (!result) return null;
  return new Blob([Uint8Array.from(atob(result.data), c => c.charCodeAt(0))], { type: result.type });
}
export async function imageAttachment(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('图片支持 PNG、JPEG、WebP。');
  if (file.size > 5 * 1024 * 1024) throw new Error('单张图片请小于 5 MB。');
  const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
  return { id: crypto.randomUUID(), name: file.name, image: data };
}
export function withImages(messages, images, protocol) {
  if (!images.length) return messages;
  const result = messages.map(m => ({ ...m }));
  const last = result.findLast(m => m.role === 'user');
  if (protocol === 'anthropic-messages') last.content = [{ type: 'text', text: last.content }, ...images.map(url => ({ type: 'image', source: { type: 'base64', media_type: url.slice(5, url.indexOf(';')), data: url.split(',')[1] } }))];
  else if (protocol === 'openai-responses') last.content = [{ type: 'input_text', text: last.content }, ...images.map(url => ({ type: 'input_image', image_url: url }))];
  else last.content = [{ type: 'text', text: last.content }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))];
  return result;
}

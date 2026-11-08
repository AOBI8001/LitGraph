import { localRequest } from './external-agent.js';
import { selectEvidence } from './research-evidence.js';
import { retrieveInWorker } from './research-worker-client.js';
import { assessPdfTextQuality, readablePdfPage } from './pdf-text-quality.js';
import { loadSampleDocument } from './sample-corpus.js';
import {buildPaperCard,validPaperCard} from './research-card.js';
import {bibliographyPage,bibliographyInfo,ocrBibliographyPage,PDF_BIBLIOGRAPHY_VERSION,BIBLIOGRAPHY_PAGES} from './pdf-bibliography.js';
import {extractSourceMetadata} from './local-metadata.js';
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
async function loadPdf(bytes){
  const pdfjs=await import('pdfjs-dist'),worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const base=`${import.meta.env.BASE_URL}pdfjs/`;
  return pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/'});
}
async function completeBibliography(pdf,bibliography,fileName,signal){
  if(bibliography.ocr?.attempted)return;
  const found=extractSourceMetadata('',{fileName},{bibliography});
  if(found.title&&found.authors.length&&found.year)return;
  const front=bibliography.pages.slice(0,3).flatMap(page=>page.lines.map(line=>line.text)).join('\n');
  if(!/[\p{Script=Han}]/u.test(front)||!(/\[unmapped PDF symbol\]/.test(front)||/学\s*位\s*论\s*文/.test(front)))return;
  bibliography.ocr={attempted:true,supported:false};bibliography.ocrPages=[];
  for(let p=1;p<=Math.min(3,pdf.numPages);p++){
    signal?.throwIfAborted();const page=await pdf.getPage(p),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(3,2400/Math.max(base.width,base.height))});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    try{
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      const result=await localRequest('document-ocr',{image:canvas.toDataURL('image/png').split(',')[1]},{signal});
      if(!result.supported)break;
      bibliography.ocr.supported=true;
      bibliography.ocrPages.push(ocrBibliographyPage(result.lines,canvas.width,canvas.height,p));
      // Large logos/colored covers can make Windows OCR miss a small title.
      // Retry its content area once, retaining the original image coordinates.
      const ocrOnly=extractSourceMetadata('',{fileName},{bibliography:{...bibliography,pages:bibliography.ocrPages,ocrPages:undefined}});
      if(p===1&&!ocrOnly.title&&/中\s*文\s*论\s*文\s*题\s*目/.test(front)){
        const top=Math.round(canvas.height*.38),factor=Math.min(1.4,2400/Math.max(canvas.width,canvas.height-top)),crop=document.createElement('canvas');crop.width=Math.ceil(canvas.width*factor);crop.height=Math.ceil((canvas.height-top)*factor);
        try{
          crop.getContext('2d').drawImage(canvas,0,top,canvas.width,canvas.height-top,0,0,crop.width,crop.height);
          const retry=await localRequest('document-ocr',{image:crop.toDataURL('image/png').split(',')[1]},{signal});
          if(retry.supported)bibliography.ocrPages[0].lines.push(...ocrBibliographyPage(retry.lines.map(line=>({...line,x:line.x/factor,y:line.y/factor+top,width:line.width/factor,height:line.height/factor})),canvas.width,canvas.height,p).lines);
        }finally{crop.width=crop.height=0;}
      }
      const repaired=extractSourceMetadata('',{fileName},{bibliography});
      if(repaired.title&&repaired.authors.length&&repaired.year)break;
    }finally{canvas.width=canvas.height=0;page.cleanup();}
  }
}
export async function extractFile(file, { signal, onProgress } = {}) {
  signal?.throwIfAborted();
  if (file.size > 40 * 1024 * 1024) throw new Error('单个文档请小于 40 MB。');
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    const loadingTask = await loadPdf(await file.arrayBuffer());
    let markdown = `# ${file.name}\n`, characterCount = 0;
    const pageTexts=[];
    const bibliography={version:PDF_BIBLIOGRAPHY_VERSION,pages:[]};
    let pageCount = 0;
    const abort = () => { void loadingTask.destroy().catch(() => {}); };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const pdf = await loadingTask.promise;
      bibliography.info=bibliographyInfo(await pdf.getMetadata().catch(()=>({})));
      pageCount = pdf.numPages;
      for (let p = 1; p <= pdf.numPages; p++) {
        signal?.throwIfAborted();
        const page = await pdf.getPage(p), content = await page.getTextContent();
        if(p<=BIBLIOGRAPHY_PAGES)bibliography.pages.push(bibliographyPage(page,content.items,p));
        let text = '', lastY;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform?.[5];
          if (lastY !== undefined && Math.abs(y - lastY) > 3 && !text.endsWith('\n')) text += '\n';
          text += item.str + (item.hasEOL ? '\n' : ' '); lastY = y;
        }
        characterCount += text.trim().length;
        pageTexts.push(text);
        page.cleanup();
        onProgress?.(p, pdf.numPages);
      }
      await completeBibliography(pdf,bibliography,file.name,signal);
    } finally { signal?.removeEventListener('abort', abort); await loadingTask.destroy(); }
    if (characterCount < 40) throw Object.assign(new Error('PDF 没有足够的可提取文字，可能是扫描件。请先 OCR，再上传 PDF 或 MD。'),{permanent:true,bibliography});
    const textQuality=assessPdfTextQuality(pageTexts);
    if(!textQuality.usable)throw Object.assign(new Error('PDF 的文字编码异常，提取结果不可靠。原文已保留，请先 OCR 或补充可读的 PDF / MD 后继续。'),{permanent:true,code:'pdf_text_unreliable',bibliography});
    markdown += pageTexts.map((text,index)=>`\n## PDF Page ${index+1}\n\n${textQuality.uncertainPages.includes(index+1)?'> Extraction note: [unmapped PDF symbol] marks a glyph that could not be decoded. Do not infer missing operators or use affected expressions as numerical evidence; consult the original PDF.\n\n':''}${readablePdfPage(text.trim())}\n`).join('');
    return { markdown, fileName: file.name.replace(/\.pdf$/i, '.md'), sourceKind: 'pdf_text', conversionQuality:'text_extraction', textQuality, bibliography, pageCount, original: file };
  }
  if (!['md', 'txt', 'csv', 'json', 'tex'].includes(ext)) throw new Error('研究材料支持 PDF、MD、TXT、CSV、JSON、TeX。请先将其他格式转换为 PDF 或 MD。');
  const markdown = (await file.text()).replace(/\r\n/g, '\n').replace(/\u0000/g, '');
  if (!markdown.trim()) throw new Error('文件没有可读取的文字。');
  return { markdown, fileName: file.name, sourceKind: ext === 'md' ? 'markdown' : 'text', original: file };
}

// Repair old converted documents from the retained PDF without reconverting the
// body, changing evidence line numbers, or rebuilding the vector index.
export async function ensureBibliography(node,document,{signal}={}){
  if(!document&&node?.importedLocally&&node.fulltextKey){
    const saved=await localRequest('document-bibliography',{key:node.fulltextKey},{signal});
    document={markdown:'',fileName:node.fileName,bibliography:saved?.bibliography||undefined};
  }
  if(!document||document.bibliography?.version===PDF_BIBLIOGRAPHY_VERSION||!node.importedLocally
    ||!(node.hasPdf||node.originalRelativePath||/\.pdf$/i.test(node.fileName||'')))return document;
  signal?.throwIfAborted();
  const blob=await originalBlob(node);if(!blob)return document;
  const task=await loadPdf(await blob.arrayBuffer()),abort=()=>{void task.destroy().catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try{
    const pdf=await task.promise,bibliography={version:PDF_BIBLIOGRAPHY_VERSION,info:bibliographyInfo(await pdf.getMetadata().catch(()=>({}))),pages:[]};
    for(let p=1;p<=Math.min(BIBLIOGRAPHY_PAGES,pdf.numPages);p++){
      signal?.throwIfAborted();const page=await pdf.getPage(p),content=await page.getTextContent();
      bibliography.pages.push(bibliographyPage(page,content.items,p));page.cleanup();
    }
    await completeBibliography(pdf,bibliography,node.fileName,signal);
    document.bibliography=bibliography;
    if(node.fulltextKey)await localRequest('document-bibliography',{key:node.fulltextKey,bibliography},{signal});
    if(node.fulltextStorageKey){const cached=await storage(node.fulltextStorageKey).catch(()=>null);await storage(node.fulltextStorageKey,{...cached,...document}).catch(()=>{});}
    return document;
  }finally{signal?.removeEventListener('abort',abort);await task.destroy();}
}
// Commit the source before conversion. A failed worker must never lose the user's PDF.
export async function saveOriginalFile(projectId, node, file) {
  const key = `${projectId}:${node.id}`;
  sourceCache.delete(node.fulltextKey || `${node.id}:${node.doi}:${node.title}`);
  await storage(key, { original: file, fileName: file.name }).then(() => { node.fulltextStorageKey = key; }).catch(() => {});
  if (/\.pdf$/i.test(file.name)) {
    if (file.size > 40 * 1024 * 1024) throw Error('单个文档请小于 40 MB。');
    const originalData = await new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result.split(',')[1]); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(file); });
    const saved = await localRequest('document', { projectId, nodeId:node.id, fileName:file.name, originalData, replaceOriginal:true });
    Object.assign(node, { fulltextKey:saved.key, originalRelativePath:saved.originalRelativePath, markdownRelativePath:'', hasPdf:true, fulltextStatus:'downloaded', fulltextPersistence:'disk' });
  } else {
    await saveFulltext(projectId,node,await extractFile(file));
    if (node.fulltextPersistence !== 'disk') throw Error('原文尚未保存到磁盘，请检查可用空间。');
  }
}
export async function saveFulltext(projectId, node, document) {
  document.paperCard=buildPaperCard(node,document);
  node.researchCard=document.paperCard;
  const key = `${projectId}:${node.id}`;
  let browserSaved = false;
  try { await storage(key, document); browserSaved = true; node.fulltextStorageKey = key; } catch { /* The local disk remains usable when browser storage is full. */ }
  node.fulltextStatus = 'indexed';
  node.fulltextError = '';
  sourceCache.delete(node.fulltextKey || `${node.id}:${node.doi}:${node.title}`);
  const { original, ...plain } = document;
  try {
    const originalData=original?.name?.toLowerCase().endsWith('.pdf')&&!document.originalAlreadySaved?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(original);}):undefined;
    const saved = await localRequest('document', { ...plain, originalData, projectId, nodeId: node.id, paperMetadata:{title:node.title,authors:node.authors,year:node.year,doi:node.doi} });
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
async function readFulltext(node) {
  if (node.fulltextStorageKey) { const cached = await storage(node.fulltextStorageKey).catch(() => null); if (cached?.markdown) return cached; }
  const cacheKey = node.fulltextKey || `${node.id}:${node.doi}:${node.title}`;
  if (sourceCache.has(cacheKey)) return sourceCache.get(cacheKey);
  let document = await localRequest('document', node.fulltextKey ? { key: node.fulltextKey } : { node: { id: node.id, doi: node.doi, title: node.title, isSample: node.isSample } }).catch(() => null);
  if (!document?.markdown && node.isSample) document = await loadSampleDocument(node, async file => {
    const response = await fetch(`${import.meta.env?.BASE_URL || '/'}sample-fulltext/${file}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Unable to read sample Markdown. / 无法读取样例 MD。');
    // Static hosts sometimes return their HTML shell instead of a missing file.
    if (response.headers.get('content-type')?.includes('text/html')) return null;
    return response.text();
  });
  if (!document?.markdown && node.sampleMarkdown) throw new Error('Sample Markdown unavailable; the question was not sent using only the abstract. / 样例 MD 不可用，未降级为仅凭摘要回答。');
  if (document) sourceCache.set(cacheKey, document);
  return document;
}
export async function getFulltext(node){
 const document=await readFulltext(node);
 if(!document?.markdown)return document;
 if(validPaperCard(node.researchCard,document,node))document.paperCard=node.researchCard;
 if(!validPaperCard(document.paperCard,document,node)){
  const key='paper-card:'+ (node.fulltextStorageKey||node.fulltextKey||`${node.id}:${node.doi}:${node.title}`);
  const saved=await storage(key).catch(()=>null);
  document.paperCard=validPaperCard(saved,document,node)?saved:buildPaperCard(node,document);
  if(saved!==document.paperCard)await storage(key,document.paperCard).catch(()=>{});
 }
 return document;
}
import {sourceCoverage} from './research-overview.js';
export async function prepareEvidence(nodes, question, attachments = [], signal, budget = 42000, plan = null, options = {}) {
  const {onStage = () => {}, ...retrievalOptions}=options;
  onStage('loading');
  const documents = Array(nodes.length); let cursor=0;
  await Promise.all(Array.from({length:Math.min(6,nodes.length)},async()=>{
    while(cursor<nodes.length){signal?.throwIfAborted();const i=cursor++,node=nodes[i];documents[i]={node,document:await getFulltext(node)};}
  }));
  for (const item of attachments.filter(a => a.document)) documents.push({ node: { id: item.id, title: item.name }, document: item.document });
  signal?.throwIfAborted();
  onStage('retrieving');
  const result = plan ? await retrieveInWorker(documents.map(({node,document})=>({node,document:document?{...document,original:undefined}:null})), question, plan, {signal,budget,...retrievalOptions}) : {evidence:selectEvidence(documents,question,budget)};
  const {evidence}=result;
  return { ...result, coverage: result.coverage || sourceCoverage(documents,evidence) };
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

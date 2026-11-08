import { cleanDoi } from './discovery-contract.js';

export const SOURCE_METADATA_VERSION = 2;
const compact = text => String(text || '').normalize('NFKC').replace(/\s/g, '');
const identity = text => compact(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const validYear = value => Number.isInteger(Number(value)) && Number(value) >= 1800 && Number(value) <= new Date().getFullYear() + 1;
const blockedName = /大学|学院|论文|教授|作者|研究|摘要|姓名|心理|教育|学报|栏目|专栏|基金|课题|关键词|通讯|指导|导师|编辑|收稿|版权|引言|结论|目录|品德|参考文献|Journal|University|School|Department|Abstract|Copyright|Introduction|Conclusion|Review|Study|Research|Published|Received|Accepted|Supervisor|Editor|Institute|Faculty|College|Science|Psychology|Keywords|Article|Volume|Methods|Results|References/i;
const cleanName = text => String(text).normalize('NFKC')
  .replace(/\((?:通讯作者|corresponding author)\)/gi, '')
  .replace(/[\d¹²³⁴⁵⁶⁷⁸⁹*†‡]/g, '').replace(/^[●•,，;；\s]+|[,，;；\s]+$/g, '').trim();
function personalName(text) {
  if (/(?:\d\s*年|\d\s*月|日期|时间)/.test(String(text).normalize('NFKC'))) return '';
  const name = cleanName(text);
  if (blockedName.test(name)) return '';
  if (/^[\p{Script=Han}·]{2,5}$/u.test(name.replace(/\s/g, ''))) return name.replace(/\s/g, '');
  if (/^(?:[A-ZÀ-ÖØ-Þ][\p{L}'’.-]*|[A-Z]\.)(?:\s+(?:(?:de|van|von|del|da|der|la)\s+)?(?:[A-ZÀ-ÖØ-Þ][\p{L}'’.-]*|[A-Z]\.)){1,5}$/u.test(name)) return name;
  return '';
}
const marker = text => /^[\d¹²³⁴⁵⁶⁷⁸⁹*†‡●•,，;；\s]+$/.test(text);
const affiliation = text => /大学|学院|研究所|实验室|University|Department|School|Institute|College|Faculty|Laboratory/i.test(text);
const abstract = text => /^(?:#{1,6}\s*)?[【\[]?\s*(?:摘\s*要|Abstract\b)/i.test(text);
function namesInLine(line) {
  if (/导师|指导|Supervisor|Editor|E-?mail|@|通讯作者\s*[:：]/i.test(line)) return [];
  const labelled = line.match(/^([^:：]+)[:：]\s*(.*)$/);
  const labelledName = labelled && /^(?:作者|论文作者|姓名|研究生(?:姓名)?|学位申请人|Authors?|By)$/i.test(compact(labelled[1]));
  const stripped = (labelledName ? labelled[2] : line).replace(/\((?:通讯作者|corresponding author)\)/gi, '').replace(/\[unmapped PDF symbol\]/g, ',');
  let parts = stripped.split(/\s*[,，、;；&]\s*|\s+and\s+|\s{2,}/i).filter(Boolean);
  if (parts.length === 1 && /^[\p{Script=Han}\s\d*†‡]+$/u.test(stripped)) {
    const split = stripped.trim().split(/\s+/).filter(Boolean);
    if (split.length > 1 && split.every(part => personalName(part))) parts = split;
  }
  if (parts.length && parts.every(part => marker(part) || personalName(part))) return parts.filter(part => !marker(part)).map(personalName);
  const single = personalName(stripped);
  return single ? [single] : [];
}
function fileTitle(value) {
  return String(value || '').replace(/^.*[\\/]/, '').replace(/\.(?:pdf|md|txt)$/i, '')
    .replace(/#br#/gi, ' ').replace(/(?:\s*[_ ]\(?\d+\)?|\s*\(\d+\))$/, '')
    .replace(/^[（(](?:用了|用作|自尊中介范文|范文|笔记|已读)[^）)]*[）)]\s*/, '')
    .replace(/_([\p{Script=Han}·]{2,5})$/u, '').replace(/_/g, ' ').trim();
}
export function metadataLookupIdentity(node) {
  return `${cleanDoi(node?.doi).toLowerCase()}|${identity(node?.title)}`;
}
export function sourceMetadataFingerprint(markdown) {
  let hash = 2166136261;
  const text = String(markdown || '');
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}
function sourceLines(markdown) {
  const lines = String(markdown || '').replace(/^# [^\n]+\.(?:pdf|md|txt)\s*\n/i, '')
    .split(/## PDF Page 5\b/)[0].slice(0, 32000).split('\n')
    .map(line => line.normalize('NFKC').trim()).filter(line => line && !/^## PDF Page\b|^> Extraction note:/i.test(line));
  const references = lines.findIndex(line => /^(?:#{1,6}\s*)?(?:\d+[.)]?\s*)?(?:References|参考文献)\s*$/i.test(line));
  return references < 0 ? lines : lines.slice(0, references);
}
function plausibleTitle(line) {
  return line.length >= (/[\p{Script=Han}]/u.test(line) ? 4 : 8) && line.length <= 240 && !/^(?:摘\s*要|Abstract|关键词|Keywords|References|参考文献|第\s*\d|收稿|基金|通讯作者|DOI|https?:|©|Copyright|Vol\.|Journal|Studies of|\d{4}\s*年|\d+(?:\.\d+)*\s*$)/i.test(line)
    && !affiliation(line) && !/[。.!]$/.test(line) && !line.includes('[unmapped PDF symbol]');
}
function bylineAfter(lines, start) {
  const names = [], quotes = [];
  let end = start, separated = false;
  for (; end < Math.min(lines.length, start + 24); end++) {
    const line = lines[end];
    if (abstract(line) || affiliation(line)) return { names: [...new Set(names)], quote: quotes.join('\n'), end, confirmed: true };
    if (marker(line)) { separated = true; quotes.push(line); continue; }
    if (/^(?:By|Authors?)$/i.test(line)) { separated = true; continue; }
    if (names.length && /^(?:指导|导师|Supervis|答辩日期|提交日期|学位授予|论文完成)/i.test(compact(line))) continue;
    const found = namesInLine(line);
    if (!found.length) break;
    names.push(...found); quotes.push(line);
    if (/^(?:作者|论文作者|姓名|研究生(?:姓名)?|学位申请人|Authors?|By)[:：]/i.test(compact(line))) separated = true;
  }
  return { names: [...new Set(names)], quote: quotes.join('\n'), end, confirmed: separated || names.length > 1 };
}
function locatePaper(markdown, node = {}) {
  const lines = sourceLines(markdown);
  const hints = [...new Set([fileTitle(node.fileName), fileTitle(node.title)].filter(Boolean))];
  // A filename is only an identity hint. The title must occur in the source.
  let anchor;
  for (let i = 0; i < lines.length; i++) {
    if (!plausibleTitle(lines[i])) continue;
    for (let width = 1; width <= 4 && i + width <= lines.length; width++) {
      const slice = lines.slice(i, i + width);
      if (slice.some((line, j) => j && (namesInLine(line).length || abstract(line) || affiliation(line)))) break;
      const title = slice.join(' '), key = identity(title);
      const matches = hint => {
        if (identity(hint) === key) return true;
        const pieces=hint.split(/\.{3}|…+/).map(identity).filter(Boolean);
        return pieces.length===2 && pieces.every(piece=>piece.length>=6) && key.startsWith(pieces[0]) && key.endsWith(pieces[1]);
      };
      if (key.length >= 4 && hints.some(matches)) { anchor = { index: i, width, title }; break; }
    }
    if (anchor) break;
  }
  if (!anchor && !(node.openAlexId || node.metadataApiUrl || node.metadataRetrievedAt)) {
    // Multiple article blocks require a title match, never "first wins".
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      if (!plausibleTitle(lines[i])) continue;
      const authors = bylineAfter(lines, i + 1);
      if (authors.names.length && authors.confirmed) candidates.push({ index: i, width: 1, title: lines[i] });
    }
    if (candidates.length === 1) anchor = candidates[0];
  }
  if (!anchor && !hints.length && /^(?:作者|姓名|Authors?)[:：]/i.test(compact(lines[0]))) {
    // A standalone, explicitly labelled bibliography fragment has no title to
    // infer, but may safely supply its own byline/date (e.g. a legacy source).
    return {lines,anchor:{index:0,width:0,title:''},authors:bylineAfter(lines,0),source:lines.join('\n'),ambiguous:false};
  }
  if (!anchor) return { lines, source: '', ambiguous: true };
  let before = anchor.index;
  // Some two-column PDFs emit the byline immediately BEFORE their own title.
  while (before > 0 && anchor.index - before < 8 && (marker(lines[before - 1]) || namesInLine(lines[before - 1]).length)) before--;
  const following = bylineAfter(lines, anchor.index + anchor.width);
  const preceding = bylineAfter([...lines.slice(before, anchor.index), 'Abstract'], 0);
  const authors = following.names.length && following.confirmed ? following : preceding;
  let end = lines.findIndex((line, i) => i >= anchor.index + anchor.width && abstract(line));
  if (end < 0) end = Math.min(lines.length, anchor.index + anchor.width + 20);
  const selected = lines.slice(before, end + 1).join('\n');
  return { lines, anchor, authors, source: selected, ambiguous: false };
}
export function metadataFrontmatter(markdown, node = {}) {
  return locatePaper(markdown, node).source;
}
export function extractSourceMetadata(markdown, node = {}) {
  const paper = locatePaper(markdown, node);
  const result = { authors: [], year: null, doi: '', evidence: {}, sourceFingerprint: sourceMetadataFingerprint(markdown), identityResolved: !paper.ambiguous };
  if (!paper.anchor) {
    // A unique header DOI can resolve a hash filename even when no byline was
    // decoded. Ambiguous multi-article pages cannot donate their first DOI.
    const head = paper.lines.join('\n').split(/(?:^|\n)(?:References|参考文献)/i)[0];
    const dois = [...head.matchAll(/(?:\bdoi\s*[:：]?\s*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[^\s<>]+)/gi)];
    if (paper.lines.filter(abstract).length <= 1 && new Set(dois.map(hit => cleanDoi(hit[1]))).size === 1) {
      result.doi = cleanDoi(dois[0][1]); result.evidence.doi = dois[0][0];
    }
    return result;
  }
  if(paper.anchor.title){result.title = paper.anchor.title.replace(/^#{1,6}\s*/, ''); result.evidence.title = paper.anchor.title;}
  const oldQuote=node.sourceMetadataEvidence?.authors;
  result.invalidateAuthors=Boolean(oldQuote && (!compact(paper.source).includes(compact(oldQuote)) || blockedName.test((node.authors || []).join(' '))));
  if (paper.authors?.names.length && paper.authors.confirmed) {
    result.authors = paper.authors.names; result.evidence.authors = paper.authors.quote;
  }
  // Do not borrow dates/DOIs from another article sharing this PDF page.
  const abstracts = paper.lines.filter(abstract).length;
  const dateLines = (abstracts <= 1 ? paper.lines : paper.source.split('\n'))
    .filter(line => !/(基金|课题|项目|收稿|Received|Accepted|参考|引用|通讯)/i.test(line));
  const patterns = [/(?:出版|发表|Published|Publication)[^\n]{0,45}?((?:18|19|20)\d{2})/i,
    /(?:答辩日期|答辩时间|提交日期|提交论文日期|学位授予|论文完成|完成时间)[^\n]{0,20}?((?:18|19|20)\d{2})/,
    /^((?:18|19|20)\d{2})年\d{1,2}月/, /(?:©|Copyright)[^\n]{0,45}?((?:18|19|20)\d{2})/i,
    /(?:Vol\.?\d+[^\n]*|No\.?\d+[,，])((?:18|19|20)\d{2})/i,
    /(?:学报|研究|Journal|Psychology|Behavior)[^\n]{0,25}?((?:18|19|20)\d{2})[,，]\d+[（(]\d+[）)]/i];
  for (const pattern of patterns) {
    const hit = dateLines.map(line => ({ line, match: compact(line).match(pattern) })).find(item => item.match && validYear(item.match[1]));
    if (hit) { result.year = Number(hit.match[1]); result.evidence.year = hit.line; break; }
  }
  const doiSource = abstracts <= 1 ? paper.lines.join('\n').split(/(?:^|\n)(?:References|参考文献)/i)[0] : paper.source;
  const doi = doiSource.match(/(?:\bdoi\s*[:：]?\s*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[^\s<>]+)/i);
  if (doi) { result.doi = cleanDoi(doi[1]); result.evidence.doi = doi[0]; }
  return result;
}
export function verifiedModelMetadata(candidate, markdown, node = {}) {
  const paper = locatePaper(markdown, node), source = compact(paper.source);
  const result = { authors: [], year: null, evidence: {} };
  const supported = (value, quote) => typeof quote === 'string' && source.includes(compact(quote)) && compact(quote).includes(compact(value));
  if (!paper.anchor) return result;
  for (const author of Array.isArray(candidate?.authors) ? candidate.authors : []) {
    if (author && personalName(author.name) && supported(author.name, author.quote)
      && !/导师|指导教师|Supervis|Correspondence|通讯作者\s*[:：]/i.test(author.quote)
      && author.quote.split('\n').flatMap(namesInLine).some(name => identity(name) === identity(author.name))) {
      result.authors.push(personalName(author.name)); result.evidence.authors = (result.evidence.authors || '') + author.quote + '\n';
    }
  }
  if (paper.authors?.confirmed && paper.authors.names.length
    && (result.authors.length !== paper.authors.names.length || paper.authors.names.some(name => !result.authors.includes(name)))) {
    // A summarizing model must not truncate an already identified full byline.
    result.authors = []; delete result.evidence.authors;
  }
  if (validYear(candidate?.year?.value) && supported(candidate.year.value, candidate.year.quote)
    && !/(基金|课题|收稿|Received|Accepted|参考文献)/i.test(candidate.year.quote)) {
    result.year = Number(candidate.year.value); result.evidence.year = candidate.year.quote;
  }
  if (candidate?.title?.value && identity(candidate.title.value) === identity(paper.anchor.title)
    && supported(candidate.title.value, candidate.title.quote)) {
    result.title = candidate.title.value.trim(); result.evidence.title = candidate.title.quote;
  }
  return result;
}
const remoteVerified = node => Boolean(node.openAlexId || node.metadataApiUrl || node.metadataRetrievedAt);
export function updateMetadataState(node) {
  const previous = node.sourceMetadataState || {};
  const missing = ['title', 'authors', 'year'].filter(field => field === 'authors' ? !node.authors?.length
    : field === 'title' ? !node.title || (!remoteVerified(node) && !node.sourceMetadataEvidence?.title && !node.metadataOverrides?.title)
    : !validYear(node.year));
  node.sourceMetadataState = { ...previous, version: SOURCE_METADATA_VERSION, status: missing.length ? 'incomplete' : 'complete', missing };
  return node;
}
export function applySourceMetadata(node, metadata) {
  const verifiedRemote = remoteVerified(node), previous = node.sourceMetadataApplied || {};
  node.metadataOverrides ||= {};
  // Detect manual edits since an earlier automatic fill; user edits always win.
  for (const field of ['title', 'authors', 'year', 'doi']) {
    if (Object.hasOwn(previous, field) && JSON.stringify(previous[field]) !== JSON.stringify(node[field])) node.metadataOverrides[field] = true;
  }
  const automatic = field => Object.hasOwn(previous, field) || Boolean(node.sourceMetadataEvidence?.[field]);
  if(metadata.invalidateAuthors && !verifiedRemote && !node.metadataOverrides.authors){
    node.authors=[];delete node.sourceMetadataEvidence?.authors;previous.authors=[];
  }
  const legacyTitle = identity(node.title) === identity(String(node.fileName || '').replace(/\.[^.]+$/, '').replace(/_/g, ' '));
  const legacyYear = (node.sourceMetadataVersion || 0) < SOURCE_METADATA_VERSION && !verifiedRemote && (!node.authors?.length || node.metadataWarning);
  const apply = (field, value, allowed) => {
    if (value == null || value === '' || node.metadataOverrides[field] || !allowed) return;
    node[field] = value; previous[field] = structuredClone(value);
    if (metadata.evidence?.[field]) node.sourceMetadataEvidence = { ...node.sourceMetadataEvidence, [field]: metadata.evidence[field] };
  };
  apply('authors', metadata.authors?.length ? [...new Set(metadata.authors)] : null, !node.authors?.length || !verifiedRemote && automatic('authors'));
  apply('title', metadata.title, !node.title || !verifiedRemote && (legacyTitle || automatic('title') || identity(node.title) === identity(metadata.title) || /^(?:未命名|未知|untitled|unknown)/i.test(node.title)));
  apply('year', metadata.year, !node.year || !verifiedRemote && (legacyYear || automatic('year')));
  if (!metadata.year && legacyYear && !node.metadataOverrides.year && !node.sourceMetadataEvidence?.year) node.year = null;
  apply('doi', metadata.doi, !node.doi);
  node.sourceMetadataApplied = previous;
  node.sourceMetadataVersion = SOURCE_METADATA_VERSION;
  if (metadata.sourceFingerprint) node.sourceMetadataState = { ...node.sourceMetadataState, sourceFingerprint: metadata.sourceFingerprint, identityResolved: metadata.identityResolved };
  if (!node.citationSource) node.citations = null;
  return updateMetadataState(node);
}
export function shouldRepairSourceMetadata(node, markdown) {
  if (!node?.importedLocally || node.importCanvasHidden) return false;
  return node.sourceMetadataVersion !== SOURCE_METADATA_VERSION || !node.sourceMetadataState
    || (markdown !== undefined && node.sourceMetadataState.sourceFingerprint !== sourceMetadataFingerprint(markdown))
    || node.sourceMetadataState.status === 'incomplete';
}
export function shouldRefreshLocalMetadata(node) {
  if (!node?.importedLocally) return false;
  return !node.metadataChecked || Boolean(node.metadataWarning)
    || cleanDoi(node.doi) !== String(node.doi || '').trim()
    || Boolean(node.metadataLookupIdentity && node.metadataLookupIdentity !== metadataLookupIdentity(node))
    || remoteVerified(node) && (!node.authors?.length || !node.title || !validYear(node.year));
}

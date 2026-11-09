import { cleanDoi } from './discovery-contract.js';
import { bibliographyText } from './pdf-bibliography.js';

export const SOURCE_METADATA_VERSION = 3;
const compact = text => String(text || '').normalize('NFKC').replace(/\s/g, '');
const identity = text => compact(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const validYear = value => Number.isInteger(Number(value)) && Number(value) >= 1800 && Number(value) <= new Date().getFullYear() + 1;
const blockedName = /大学|学院|论文|教授|作者|研究|摘要|姓名|心理|教育|学报|栏目|专栏|专论|论著|基金|课题|关键词|通讯|指导|导师|编辑|收稿|版权|引言|结论|目录|品德|参考文献|评阅|隐名|讨论|实验|第卷第期|Journal|University|School|Department|Abstract|Copyright|Introduction|Conclusion|Review|Study|Research|Published|Received|Accepted|Supervisor|Editor|Institute|Faculty|College|Science|Psychology|Keywords|Article|Volume|Methods|Results|References|Original Papers|Short Paper|^Vol\.?$|^No\.?$/i;
const cleanName = text => String(text).normalize('NFKC')
  .replace(/\((?:通讯作者|corresponding author)\)/gi, '')
  .replace(/[\d¹²³⁴⁵⁶⁷⁸⁹*†‡△▲■□①②③④⑤⑥⑦⑧⑨]/g, '').replace(/^[●•&,，;；\s]+|[,，;；\s]+$/g, '').trim();
function personalName(text) {
  if (/(?:\d\s*年|\d\s*月|日期|时间)/.test(String(text).normalize('NFKC'))) return '';
  const name = cleanName(text);
  if (blockedName.test(compact(name)) || /签名|日期|^(?:年月|委员|系|教桴|教育系|行为科学系)$/.test(compact(name)) || /^[·•●□]|[·•●□]$/.test(name) || /^[A-Z\s]+$/.test(name)&&name.split(/\s+/).length>3 || /SEE PROFILE|PUBLICATIONS|CITATIONS|READS/i.test(name)) return '';
  if (/^[\p{Script=Han}·]{2,5}$/u.test(name.replace(/\s/g, ''))) return name.replace(/\s/g, '');
  if(/^[A-Z][\p{L}'’.-]{2,30}[\d*]+$/u.test(String(text).replace(/\s/g,'')))return name;
  if (/^(?:[A-ZÀ-ÖØ-Þ][\p{L}'’.-]*|[A-Z]\.)(?:\s+(?:(?:de|van|von|del|da|der|la)\s+)?(?:[A-ZÀ-ÖØ-Þ][\p{L}'’.-]*|[A-Z]\.)){1,5}$/u.test(name)) return name;
  return '';
}
const marker = text => /^(?:[\d¹²³⁴⁵⁶⁷⁸⁹*†‡●•△▲■□①②③④⑤⑥⑦⑧⑨()&:：,，;；\s]|\[unmapped PDF symbol\])+$/.test(text)||/^[a-z](?:,[a-z]){1,3}$/i.test(text);
const affiliation = text => /大学(?!生|新生|毕业生|本科生|研究生|英语)|学院|研究所|实验室|University|Universidad|Universiti|Department|School|Institute|College|Faculty|Laboratory/i.test(compact(text));
const abstract = text => /^(?:#{1,6}\s*)?[【\[〔［]?\s*(?:摘\s*要|提\s*要|Abstract\b|Background\s*:)/i.test(text);
const documentType=text=>/^(?:Short Paper|Original Papers?|Research (?:Article|Paper)|Clinical Case Study|Case Report|硕\s*士\s*学\s*位\s*论\s*文|博\s*士\s*学\s*位\s*论\s*文)$/i.test(text);
const titleLabel=/^(?:中\s*文\s*)?(?:论\s*文\s*)?(?:题\s*目|题\s*名|Title)\s*[:：]?\s*/i;
const authorLabel=/^(?:作\s*者(?:\s*姓\s*名)?|论\s*文\s*作\s*者|姓\s*名|研\s*究\s*生(?:\s*姓\s*名)?|(?:学\s*位\s*)?申\s*请\s*人(?:\s*姓\s*名)?|Authors?|By)\s*[:：]?\s*/i;
function namesInLine(line) {
  if (/导师|指导|Supervisor|Editor|E-?mail|@|通讯作者\s*[:：]/i.test(line)) return [];
  if(line.includes('[unmapped PDF symbol]')&&line.split('[unmapped PDF symbol]').some(part=>/^[\p{Script=Han}]$/u.test(compact(part))))return [];
  const stripped = line.replace(authorLabel,'').replace(/^[■□●•]\s*/, '').replace(/\((?:通讯作者|corresponding author)\)/gi, '')
    .replace(/\b(?:Ph\.?\s?D\.?|Psy\.?\s?D\.?|M\.?\s?D\.?|M\.?\s?Sc\.?)\b\.?/gi,'')
    .replace(/^\s*(?:and|&)\s+/i,'').replace(/,\s*(?:and|&)\s+/gi,', ')
    .replace(/\[unmapped PDF symbol\]/g, ',');
  let parts = stripped.split(/\s*[,，、;；&]\s*|\s+and\s+|\s{2,}/i).filter(Boolean);
  if(/^[\p{Script=Han}\s\d*†‡△,，、;；]+$/u.test(stripped)){
    const tokens=stripped.replace(/[\d*†‡△]/g,'').split(/\s+|[,，、;；]+/).filter(Boolean),names=[];let singles='';
    const flush=()=>{if(singles.length<=3)names.push(singles);else if(singles.length%2===0)for(let j=0;j<singles.length;j+=2)names.push(singles.slice(j,j+2));singles='';};
    for(const token of tokens){if(token.length===1)singles+=token;else{if(singles)flush();names.push(token);}}
    if(singles)flush();
    if(names.length&&names.every(personalName))return names.map(personalName);
  }
  if (parts.length === 1 && /^[\p{Script=Han}\s\d*†‡]+$/u.test(stripped)) {
    const split = stripped.trim().split(/\s+/).filter(Boolean);
    if (split.length > 1 && split.every(part => personalName(part))) parts = split;
    else if(split.every(part=>/^[\p{Script=Han}\d*†‡△]+$/u.test(part))){
      const joined=[];let singles='';
      for(const part of split){const clean=cleanName(part);if(clean.length===1)singles+=clean;else {if(singles){joined.push(singles);singles='';}joined.push(clean);}}
      if(singles)joined.push(...(singles.length===4?[singles.slice(0,2),singles.slice(2)]:[singles]));
      if(joined.length&&joined.every(personalName))parts=joined;
    }
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
// A descriptive filename can seed an exact catalogue lookup even when the PDF
// text layer is damaged. It is a query, never proof of the returned identity.
export function metadataLookupCandidate(node) {
  if (node.doi || node.sourceMetadataEvidence?.title) return { doi: node.doi || '', title: node.title || '', fromFilename: false };
  const title = fileTitle(node.fileName);
  const author = String(node.fileName || '').match(/_\s*([\p{Script=Han}·]{2,5})(?:\s*\(\d+\))?\.(?:pdf|md|txt)$/u)?.[1];
  if (!author || !plausibleTitle(title) || identity(title).length < 8 || /^[\da-f -]+$/i.test(title)) return null;
  return { doi: '', title, authors: [author], fromFilename: true };
}
export function matchesMetadataCandidate(candidate, metadata) {
  if (!metadata) return false;
  if (candidate.doi) return cleanDoi(candidate.doi) === cleanDoi(metadata.doi);
  if (identity(candidate.title) !== identity(metadata.title)) return false;
  // A filename-only match must also agree on its explicitly named author.
  return !candidate.fromFilename || candidate.authors.some(name => (metadata.authors || []).some(author => identity(author) === identity(name)));
}
export function metadataDocumentFingerprint(markdown, document) {
  return sourceMetadataFingerprint(String(markdown || '') + '\n' + bibliographyText(document?.bibliography));
}
export function sourceMetadataFingerprint(markdown) {
  let hash = 2166136261;
  const text = String(markdown || '');
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}
function sourceLines(markdown, document) {
  const lines = String(bibliographyText(document?.bibliography)||markdown || '').replace(/^# [^\n]+\.(?:pdf|md|txt)\s*\n/i, '')
    .split(/## PDF Page 9\b/)[0].slice(0, 64000).split('\n')
    .map(normalizeLine)
    .filter(line => line && !/^## PDF Page\b|^> Extraction note:/i.test(line)
      && !(titleLabel.test(line) && !line.replace(titleLabel,'').trim()));
  const references = lines.findIndex(line => /^(?:#{1,6}\s*)?(?:\d+[.)]?\s*)?(?:References|参考文献)\s*$/i.test(line));
  return references < 0 ? lines : lines.slice(0, references);
}
function normalizeLine(line){return line.normalize('NFKC').replace(/([a-zı])\s*([´\u0300-\u0308])\s*/gi,(_,letter,accent)=>(letter==='ı'?'i':letter)+(accent==='´'?'\u0301':accent)).normalize('NFC').trim();}
function plausibleTitle(line) {
  return line.length >= (/[\p{Script=Han}]/u.test(line) ? 4 : 8) && line.length <= 300 && !/^(?:摘\s*要|Abstract|关键词|Keywords|References|参考文献|第\s*\d|收稿|基金|通讯作者|DOI|https?:|©|Copyright|Vol\.|Journal|Studies of|\d{4}\s*年|\d+(?:\.\d+)*\s*$)/i.test(line)
    && !/PUBLICATIONS|CITATIONS|SEE PROFILE|https?:|Research Article|Open Access|答辩委员会|指导教师|评阅人|Original Papers|Reprints|permission|\.(?:com|org|net)\b|The Author\(s\)/i.test(line)
    && !affiliation(line) && !documentType(line) && !/^[·●■【].*(?:专论|论著|方法|栏目|研究|心理).*[·】]$/.test(compact(line))
    && !/[。.!]$/.test(line) && !line.includes('[unmapped PDF symbol]');
}
function bylineAfter(lines, start) {
  const names = [], quotes = [];
  let end = start, separated = false;
  let confirmed=false,labelMode=false;
  for (; end < Math.min(lines.length, start + 48); end++) {
    const line = lines[end];
    if (abstract(line)) return { names: [...new Set(names)], quote: quotes.join('\n'), end, confirmed: true };
    if(documentType(line))continue;
    if(/^(?:Reprints?|Permissions?|DOI\b|https?:|\S+\.(?:com|org|net)\b)/i.test(line))continue;
    if(authorLabel.test(line)&&!line.replace(authorLabel,'').trim()){labelMode=true;separated=true;continue;}
    if (affiliation(line)) {
      const embedded=line.match(/[)）]\s*([\p{Script=Han}]{2,5})\s*$/u);
      if(embedded&&personalName(embedded[1])){names.push(embedded[1]);quotes.push(line);confirmed=true;}
      if(names.length){confirmed=true;continue;}return {names:[],quote:'',end,confirmed:false};
    }
    if(names.length && /@|\b(?:Germany|China|USA|Spain|Switzerland|Malaysia|Costa Rica)\b|^\d+\s+[A-Z]|^(?:Received|Accepted|Revised|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)|\d{4}\s*年)/i.test(line))continue;
    if (marker(line)) { separated = true; quotes.push(line); continue; }
    if (/^(?:By|Authors?)$/i.test(line)) { separated = true; continue; }
    if (names.length && /^(?:指导|导师|Supervis|答辩日期|提交日期|学位授予|论文完成)/i.test(compact(line))) continue;
    let found = namesInLine(line);
    if(!found.length&&/^[A-Z][\p{L}'’.-]{2,30}[\d*]*\s*[,，]?$/u.test(line)&&affiliation(lines[end+1]||''))found=[cleanName(line.replace(/[,，]$/,''))];
    if (!found.length) break;
    names.push(...found); quotes.push(line);
    if(authorLabel.test(line)||labelMode)return {names:[...new Set(names)],quote:quotes.join('\n'),end:end+1,confirmed:true};
    if (/^(?:作者|论文作者|姓名|研究生(?:姓名)?|学位申请人|Authors?|By)[:：]/i.test(compact(line))) separated = true;
  }
  return { names: [...new Set(names)], quote: quotes.join('\n'), end, confirmed: confirmed || separated || names.length > 1 };
}
function labelledByline(lines,node){
  const candidates=[];
  for(let i=0;i<lines.length;i++){
    if(!authorLabel.test(lines[i]))continue;
    const byline=bylineAfter(lines,i);
    if(byline.names.length&&byline.confirmed)candidates.push({...byline,index:i});
  }
  const suffix=String(node.fileName||'').match(/_\s*([\p{Script=Han}·]{2,5})(?:\s*\(\d+\))?\.(?:pdf|md|txt)$/u)?.[1];
  const matched=suffix?candidates.filter(candidate=>candidate.names.includes(suffix)):[];
  const choices=matched.length?matched:candidates,distinct=[...new Map(choices.map(candidate=>[candidate.names.join('|'),candidate])).values()];
  return distinct.length===1?distinct[0]:null;
}
function sourcePageAt(document,lines,index){
  const text=lines[index],prior=lines.slice(0,index).filter(line=>line===text).length;
  const matches=document?.bibliography?.pages?.flatMap(page=>page.lines.filter(line=>normalizeLine(line.text)===text).map(()=>page))||[];
  return matches[prior]||matches[0];
}
function locatePaper(markdown, node = {}, document) {
  const lines = sourceLines(markdown,document);
  const layoutLines=document?.bibliography?.pages?.flatMap(page=>page.lines.map(line=>({...line,text:normalizeLine(line.text)})))||[];
  const headers=new Set(document?.bibliography?.pages?.flatMap(page=>{const firstAbstract=page.lines.findIndex(line=>abstract(normalizeLine(line.text)));return (firstAbstract>=0?page.lines.slice(0,firstAbstract):[]).map(line=>normalizeLine(line.text));})||[]);
  const basicHints=[fileTitle(node.fileName),fileTitle(node.title),document?.bibliography?.info?.title].filter(Boolean);
  const hints = [...new Set([...basicHints,...basicHints.filter(hint=>/[\p{Script=Han}]/u.test(hint)).map(hint=>hint.replace(/[（(][A-Z]{2,6}[）)]/g,''))])];
  // A filename is only an identity hint. The title must occur in the source.
  let anchor,competing=false;const anchors=[];
  for (let i = 0; i < lines.length; i++) {
    if (!plausibleTitle(lines[i])) continue;
    for (let width = 1; width <= 6 && i + width <= lines.length; width++) {
      const slice = lines.slice(i, i + width).filter(line=>!marker(line));
      if (slice.some((line, j) => j && (abstract(line) || affiliation(line)||authorLabel.test(line)))) break;
      const title = slice.join(' ').replace(titleLabel,''), key = identity(title);
      const matches = hint => {
        if (identity(hint) === key) return true;
        if(/[\p{Script=Han}]/u.test(hint)&&identity(hint).length>=8&&key.startsWith(identity(hint))&&key.length<identity(hint).length+80
          &&lines.slice(Math.max(0,i-3),i+1).some(line=>titleLabel.test(line)))return true;
        const pieces=hint.split(/\.{3}|…+/).map(identity).filter(Boolean);
        return pieces.length===2 && pieces.every(piece=>piece.length>=6) && key.startsWith(pieces[0]) && key.endsWith(pieces[1]);
      };
      if (key.length >= 4 && hints.some(matches)) { anchors.push({ index: i, width, title }); break; }
    }
  }
  if(anchors.length)anchor=anchors.sort((a,b)=>{
    // A duplicated thesis cover may contain a damaged copy of a name. Prefer a
    // byline corroborated by the filename, but never turn its hint into proof.
    const filenameAuthor=String(node.fileName||'').match(/_\s*([\p{Script=Han}·]{2,5})(?:\s*\(\d+\))?\.(?:pdf|md|txt)$/u)?.[1];
    const score=c=>{const byline=bylineAfter(lines,c.index+c.width);return (byline.names.length&&byline.confirmed?100:0)+(headers.has(lines[c.index])?20:0)+(filenameAuthor&&byline.names.includes(filenameAuthor)?30:0);};
    return score(b)-score(a)||a.index-b.index;
  })[0];
  if (!anchor && !(node.openAlexId || node.metadataApiUrl || node.metadataRetrievedAt)) {
    // Multiple article blocks require a title match, never "first wins".
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      if (!plausibleTitle(lines[i])) continue;
      if(layoutLines.length&&!headers.has(lines[i]))continue;
      for(let width=1;width<=6&&i+width<=lines.length;width++){
        const slice=lines.slice(i,i+width).filter(line=>!marker(line));
        if(slice.some(line=>abstract(line)||affiliation(line)||documentType(line)||authorLabel.test(line)||!plausibleTitle(line)&&!(/^[\p{L} -]{2,20}$/u.test(line)&&!namesInLine(line).length)))break;
        const title=slice.join(' '),authors=bylineAfter(lines,i+width);
        const sizes=slice.map(line=>layoutLines.find(row=>row.text===line)?.size||0).filter(Boolean),titleSize=Math.min(...sizes),authorLine=lines.slice(i+width,i+width+8).find(line=>!marker(line)&&!documentType(line)),authorSize=layoutLines.find(row=>row.text===authorLine)?.size||0;
        const prominent=!layoutLines.length||sizes.length&&titleSize>=authorSize*1.08;
        const titleLike=!namesInLine(lines[i]).length||layoutLines.length&&titleSize>=authorSize*1.25&&/\b(?:and|of|for|in|to|with)\b/i.test(title);
        if(authors.names.length&&authors.confirmed&&titleLike&&prominent)candidates.push({index:i,width,title,authors});
        if(width>1&&namesInLine(lines[i+width-1]).length)break;
      }
      // A byline may precede the title, even with an opaque PDF filename.
      if(abstract(lines[i+1]||'')&&!namesInLine(lines[i]).length){
        let before=i;while(before>0&&i-before<8&&(marker(lines[before-1])||namesInLine(lines[before-1]).length))before--;
        const authors=bylineAfter([...lines.slice(before,i),'Abstract'],0);
        if(authors.names.length&&authors.confirmed&&(!layoutLines.length||headers.has(lines[i])))candidates.push({index:i,width:1,title:lines[i],authors});
      }
    }
    // Wrapped titles create overlapping candidates, not separate papers.
    const groups=[];
    for(const candidate of candidates){
      const group=groups.find(g=>g.some(c=>c.index+c.width===candidate.index+candidate.width||identity(c.title)===identity(candidate.title)));
      if(group)group.push(candidate);else groups.push([candidate]);
    }
    if(groups.length===1)anchor=groups[0].sort((a,b)=>b.width-a.width)[0];
    competing=groups.length>1;
  }
  if (!anchor && !hints.length && /^(?:作者|姓名|Authors?)[:：]/i.test(compact(lines[0]))) {
    // A standalone, explicitly labelled bibliography fragment has no title to
    // infer, but may safely supply its own byline/date (e.g. a legacy source).
    return {lines,anchor:{index:0,width:0,title:''},authors:bylineAfter(lines,0),source:lines.join('\n'),ambiguous:false};
  }
  const labelled=labelledByline(lines,node);
  if(!anchor&&labelled&&!competing){
    const page=sourcePageAt(document,lines,labelled.index);
    return {lines,anchor:{index:labelled.index,width:0,title:''},authors:labelled,source:lines.slice(Math.max(0,labelled.index-6),labelled.end).join('\n'),pageLines:page?.lines.map(line=>normalizeLine(line.text)),ambiguous:false};
  }
  if (!anchor) {
    // "No deterministic match" is not "two different papers". The former may
    // use a literal-evidence model fallback; the latter requires user identity.
    const firstAbstract=lines.findIndex(abstract);
    return { lines,source:competing?'':lines.slice(0,firstAbstract<0?100:firstAbstract+1).join('\n').slice(0,12000),ambiguous:competing };
  }
  let before = anchor.index;
  // Some two-column PDFs emit the byline immediately BEFORE their own title.
  while (before > 0 && anchor.index - before < 8 && (marker(lines[before - 1]) || namesInLine(lines[before - 1]).length)) before--;
  const following = bylineAfter(lines, anchor.index + anchor.width);
  const preceding = bylineAfter([...lines.slice(before, anchor.index), 'Abstract'], 0);
  const authors = following.names.length && following.confirmed ? following : preceding.names.length?preceding:labelled||preceding;
  let end = lines.findIndex((line, i) => i >= anchor.index + anchor.width && abstract(line));
  if (end < 0) end = Math.min(lines.length, anchor.index + anchor.width + 20);
  const selected = lines.slice(before, end + 1).join('\n')+(authors===labelled?'\n'+labelled.quote:'');
  const page=sourcePageAt(document,lines,anchor.index);
  const pageLines=page?.lines.map(line=>normalizeLine(line.text));
  return { lines, anchor, authors, source: selected, pageLines, ambiguous: false };
}
export function metadataFrontmatter(markdown, node = {}, document) {
  return locatePaper(markdown, node,document).source;
}
function extractSourceMetadataFromText(markdown, node = {}, document) {
  const paper = locatePaper(markdown, node,document);
  const result = { authors: [], year: null, doi: '', evidence: {}, sourceFingerprint: sourceMetadataFingerprint(markdown), identityResolved: Boolean(paper.anchor?.title),ambiguous:paper.ambiguous };
  if (!paper.anchor) {
    // A unique header DOI can resolve a hash filename even when no byline was
    // decoded. Ambiguous multi-article pages cannot donate their first DOI.
    const head = paper.lines.join('\n').split(/(?:^|\n)(?:References|参考文献)/i)[0];
    const dois = [...head.matchAll(/(?:\bdoi\s*[:：\-–—]?\s*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[^\s<>]+)/gi)];
    if (paper.lines.filter(abstract).length <= 1 && new Set(dois.map(hit => cleanDoi(hit[1]))).size === 1) {
      result.doi = cleanDoi(dois[0][1]); result.evidence.doi = dois[0][0];
    }
    return result;
  }
  if(paper.anchor.title){result.title = paper.anchor.title.replace(/^#{1,6}\s*/, '').replace(/(?<=[\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu,'').replace(/(?:—\s*){3,}/g,'——'); result.evidence.title = paper.anchor.title;}
  const oldQuote=node.sourceMetadataEvidence?.authors;
  result.invalidateAuthors=Boolean(oldQuote && (!compact(paper.source).includes(compact(oldQuote)) || blockedName.test((node.authors || []).join(' '))));
  if (paper.authors?.names.length && paper.authors.confirmed) {
    result.authors = paper.authors.names; result.evidence.authors = paper.authors.quote;
  }
  // Do not borrow dates/DOIs from another article sharing this PDF page.
  const abstracts = paper.lines.filter(abstract).length;
  const dateLines = (paper.pageLines || (abstracts <= 1 ? paper.lines : paper.source.split('\n')))
    .filter(line => !/(基金|课题|项目|收稿|参考|通讯|Received|Accepted)/i.test(line)||/Published\s*(?:online|date|:)/i.test(line));
  // Prefer issue/citation dates to copyright/online dates. Never search prose for
  // the first word "published" or greedily consume a volume/page range as a year.
  const patterns = [
    /(?:文章编号|ArticleID)[^\n]{0,40}?[（(]((?:18|19|20)\d{2})[）)]/i,
    /((?:18|19|20)\d{2})[,，](?:Vol\.?|Volume)\d/i,
    /(?:Vol\.?|Volume)\d+(?:No\.?\d+)?[,;:]((?:18|19|20)\d{2})(?:[,;:]|$)/i,
    /(?:Vol\.?|Volume)\d+[,;:]?\(?((?:18|19|20)\d{2})\)?(?:[,;:]|$)/i,
    /(?:学报|期刊|Journal|Psychiatry)[^\n]{0,35}?((?:18|19|20)\d{2})(?:年|[;,，:]\d|$)/i,
    /^[A-Z&:,.\d–—\-()]+[（(]((?:18|19|20)\d{2})[）)]$/,
    /^(?:网络首发日期|出版日期|发表日期|PublicationDate|Published(?:online|date)?:)[^\n]{0,45}?((?:18|19|20)\d{2})/i,
    /(?:答辩日期|答辩时间|提交日期|提交论文日期|论文提交日期|学位授予|论文完成|完成时间)[^\n]{0,20}?((?:18|19|20)\d{2})/,
    /^((?:18|19|20)\d{2})年(?:\d{1,2}月|第\d+期)/,
    /^((?:18|19|20)\d{2})年$/,
    /(?:学报|Journal|Conference|Proceedings)[^\n]{0,80}?((?:18|19|20)\d{2})(?:[,，]|$)/i,
    /(?:©|Copyright)[^\n]{0,35}?((?:18|19|20)\d{2})/i,
    /^(?:[a-z©])?TheAuthor\(s\)((?:18|19|20)\d{2})$/i,
  ];
  for (const pattern of patterns) {
    const hit = dateLines.map(line => ({ line, match: compact(line).match(pattern) })).find(item => item.match && validYear(item.match[1]));
    if (hit) { result.year = Number(hit.match[1]); result.evidence.year = hit.line; break; }
  }
  const doiLines = paper.pageLines || (abstracts <= 1 ? paper.lines : paper.source.split('\n'));
  for(const line of doiLines){
    if(line.length>400||!/(?:\bdoi\b|doi\.org)/i.test(line))continue;
    const pattern=/(?:doi\s*[:：\-–—]?\s*(?:https?:\/\/(?:dx\.)?doi\.org\/)?|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[^\s<>]+)/i;
    const doi=line.match(pattern)||(/^doi\b/i.test(line)&&compact(line).match(pattern));
    if(doi){result.doi=cleanDoi(doi[1]);result.evidence.doi=line;break;}
  }
  return result;
}
export function extractSourceMetadata(markdown,node={},document){
  const result=extractSourceMetadataFromText(markdown,node,document);
  if(!document?.bibliography?.ocrPages?.length||result.ambiguous)return result;
  const ocr=extractSourceMetadataFromText(markdown,node,{bibliography:{...document.bibliography,pages:document.bibliography.ocrPages,ocrPages:undefined}});
  const withoutAcronyms=text=>identity(text.replace(/[（(]\s*[A-Z]{2,6}\s*[）)]/g,''));
  if(result.title&&ocr.title&&identity(ocr.title).length>identity(result.title).length
    &&(identity(ocr.title).startsWith(identity(result.title))&&identity(ocr.title).length>identity(result.title).length+4||withoutAcronyms(ocr.title)===identity(result.title))){
    result.title=ocr.title.replace(/一{2,3}(?=来自)/g,'——');result.evidence.title=ocr.evidence.title;result.ocrUsed=true;
  }
  for(const field of ['title','authors','year','doi']){
    const present=field==='authors'?result.authors.length:result[field];
    if(!present&&(field==='authors'?ocr.authors.length:ocr[field])){result[field]=ocr[field];result.evidence[field]=ocr.evidence[field];result.ocrUsed=true;}
  }
  if(!result.year&&result.identityResolved){
    const dates=document.bibliography.ocrPages.flatMap(page=>page.lines.map(line=>({quote:line.text,hit:compact(line.text).match(/(?:论文提交日期|提交日期|答辩日期|论文答辩年月)[^\n]{0,15}?((?:18|19|20)\d{2})/)}))).filter(item=>item.hit&&validYear(item.hit[1]));
    if(new Set(dates.map(item=>item.hit[1])).size===1){result.year=Number(dates[0].hit[1]);result.evidence.year=dates[0].quote;result.ocrUsed=true;}
  }
  result.identityResolved ||= ocr.identityResolved;
  return result;
}
export function verifiedModelMetadata(candidate, markdown, node = {}, document) {
  let paper = locatePaper(markdown, node,document);
  if(!paper.anchor&&!paper.ambiguous&&candidate?.title?.value&&plausibleTitle(candidate.title.value)
    &&typeof candidate.title.quote==='string'&&compact(paper.source).includes(compact(candidate.title.quote))
    &&compact(candidate.title.quote).includes(compact(candidate.title.value))){
    paper=locatePaper(markdown,{...node,title:candidate.title.value},document);
  }
  const source = compact(paper.source);
  const result = { authors: [], year: null, evidence: {} };
  const supported = (value, quote) => typeof quote === 'string' && source.includes(compact(quote)) && compact(quote).includes(compact(value));
  if (!paper.anchor) return result;
  result.identityResolved=true;result.ambiguous=false;result.sourceFingerprint=sourceMetadataFingerprint(markdown);
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
  const upgradingOriginal=node.importedLocally&&(node.sourceMetadataVersion||0)<SOURCE_METADATA_VERSION&&verifiedRemote&&metadata.doi&&cleanDoi(metadata.doi)===cleanDoi(node.doi);
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
    if(upgradingOriginal&&node[field]&&JSON.stringify(node[field])!==JSON.stringify(value))node.metadataAliases={...node.metadataAliases,[field]:structuredClone(node[field])};
    node[field] = value; previous[field] = structuredClone(value);
    if (metadata.evidence?.[field]) node.sourceMetadataEvidence = { ...node.sourceMetadataEvidence, [field]: metadata.evidence[field] };
  };
  apply('authors', metadata.authors?.length ? [...new Set(metadata.authors)] : null, upgradingOriginal||!node.authors?.length || !verifiedRemote && automatic('authors'));
  apply('title', metadata.title, upgradingOriginal||!node.title || !verifiedRemote && (legacyTitle || automatic('title') || identity(node.title) === identity(metadata.title) || /^(?:未命名|未知|untitled|unknown)/i.test(node.title)));
  apply('year', metadata.year, upgradingOriginal||!node.year || !verifiedRemote && (legacyYear || automatic('year')));
  if (!metadata.year && legacyYear && !node.metadataOverrides.year && !node.sourceMetadataEvidence?.year) node.year = null;
  apply('doi', metadata.doi, !node.doi);
  node.sourceMetadataApplied = previous;
  node.sourceMetadataVersion = SOURCE_METADATA_VERSION;
  if (metadata.sourceFingerprint) node.sourceMetadataState = { ...node.sourceMetadataState, sourceFingerprint: metadata.sourceFingerprint, identityResolved: metadata.identityResolved,ambiguous:metadata.ambiguous };
  if (!node.citationSource) node.citations = null;
  return updateMetadataState(node);
}

// Scholarly services enrich the record; a translated/romanized alias must not
// overwrite a byline/title verified on the user's original PDF.
export function applyScholarlyIdentity(node,metadata){
  const samePaper=!node.doi||!metadata.doi||cleanDoi(node.doi)===cleanDoi(metadata.doi);
  for(const field of ['title','authors','year','doi']){
    const value=metadata[field];if(value==null||value===''||Array.isArray(value)&&!value.length||node.metadataOverrides?.[field])continue;
    if(samePaper&&node.sourceMetadataEvidence?.[field]&&node[field]){
      if(JSON.stringify(node[field])!==JSON.stringify(value))node.metadataAliases={...node.metadataAliases,[field]:structuredClone(value)};
    }else node[field]=structuredClone(value);
  }
  return node;
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

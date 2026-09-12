import { cleanDoi } from './discovery-contract.js';

export const SOURCE_METADATA_VERSION=1;
export function metadataFrontmatter(markdown) {
  return String(markdown||'').replace(/^# [^\n]+\.(?:pdf|md|txt)\s*\n/i,'')
    .split(/## PDF Page 3\b|(?:^|\n)\s*#{0,6}\s*(?:References|参考文献)\s*(?:\n|$)/i)[0].slice(0,14000);
}
const compact=s=>String(s||'').normalize('NFKC').replace(/\s/g,'');
const validYear=y=>Number.isInteger(Number(y))&&Number(y)>=1800&&Number(y)<=new Date().getFullYear()+1;
const cleanName=s=>s.replace(/[\d¹²³⁴⁵⁶⁷⁸⁹*†‡]/g,'').trim();
const chineseName=s=>/^[\p{Script=Han}·]{2,5}$/u.test(s)&&!/(大学|学院|论文|教授|作者|研究|摘要|姓名)/.test(s);
export function extractSourceMetadata(markdown) {
  const source=metadataFrontmatter(markdown),lines=source.split('\n').map(s=>s.trim()).filter(Boolean);
  const result={authors:[],year:null,doi:'',evidence:{}};
  const beforeAbstract=source.split(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:Abstract\b|摘\s*要)/i)[0];
  const authorLine=beforeAbstract.match(/(?:^|\n)\s*(?:姓\s*名|作\s*者|研究生(?:姓名)?|学位申请人)\s*[:：]\s*([^\n]+)/);
  if(authorLine){result.authors=authorLine[1].split(/[,，、;；]|\s{2,}/).map(s=>s.replace(/\s/g,'')).filter(chineseName);if(result.authors.length)result.evidence.authors=authorLine[0].trim();}
  // Journal bylines often use a bullet and OCR spaces inside Chinese names.
  if(!result.authors.length){const line=lines.find(s=>/^[●•]/.test(s));if(line){result.authors=line.replace(/^[●•]\s*/,'').split(/\s{2,}|[,，、]/).map(s=>s.replace(/\s/g,'')).filter(chineseName);if(result.authors.length)result.evidence.authors=line;}}
  if(!result.authors.length){
    const by=beforeAbstract.match(/(?:^|\n)\s*By\s*\n\s*([^\n]+)/i);
    if(by&&!/supervis|professor|university/i.test(by[1])){result.authors=[cleanName(by[1])];result.evidence.authors=by[0].trim();}
  }
  // Standalone personal-name lines followed by affiliation markers. Require
  // multiple names or a marker, rather than mistaking a title for an author.
  if(!result.authors.length){const head=beforeAbstract.split('\n').map(s=>s.trim()).filter(Boolean);const found=[];
    for(let i=0;i<head.length;i++){const name=cleanName(head[i]);if(/^[A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){1,3}$/u.test(name)&&/^\d(?:[,\s]\d)*$/.test(head[i+1]||'')&&!/Journal|University|School|Department|Volume|Copyright|Abstract|Studies/.test(name))found.push({name,line:head[i]});}
    if(found.length){result.authors=found.map(v=>v.name);result.evidence.authors=found.map(v=>v.line).join('\n');}
  }
  // Never use a grant year, received date, a reference year or the system date.
  const dateLines=lines.filter(s=>!/(基金|课题|项目|收稿|Received|Accepted|参考|引用)/i.test(s));
  for(const pattern of [/(?:出版|发表|Published|Publication)[^\n]{0,45}?((?:18|19|20)\d{2})/i,/(?:答辩日期|提交日期|学位授予|论文完成)[^\n]{0,20}?((?:18|19|20)\d{2})/,/^((?:18|19|20)\d{2})年\d{1,2}月/,/(?:©|Copyright)[^\n]{0,45}?((?:18|19|20)\d{2})/i,/(?:Vol\.?\s*\d+[^\n]*|No\.?\s*\d+[,，])\s*((?:18|19|20)\d{2})/i]){
    const hit=dateLines.map(line=>({line,match:compact(line).match(pattern)})).find(x=>x.match&&validYear(x.match[1]));
    if(hit){result.year=Number(hit.match[1]);result.evidence.year=hit.line;break;}
  }
  const doi=beforeAbstract.match(/(?:\bdoi\s*[:：]?\s*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[^\s<>]+)/i);
  if(doi){result.doi=cleanDoi(doi[1]);result.evidence.doi=doi[0];}
  return result;
}
export function verifiedModelMetadata(candidate,markdown) {
  const source=compact(metadataFrontmatter(markdown)),result={authors:[],year:null,evidence:{}};
  const supported=(value,quote)=>typeof quote==='string'&&compact(quote).length>=compact(value).length&&source.includes(compact(quote))&&compact(quote).includes(compact(value));
  for(const author of Array.isArray(candidate?.authors)?candidate.authors:[]){
    if(typeof author.name==='string'&&author.name.length>=2&&author.name.length<100&&supported(author.name,author.quote)&&!/(导师|指导教师|Supervis)/i.test(author.quote)){result.authors.push(author.name.trim());result.evidence.authors=(result.evidence.authors||'')+author.quote+'\n';}
  }
  if(validYear(candidate?.year?.value)&&supported(candidate.year.value,candidate.year.quote)&&!/(基金|课题|收稿|Received|Accepted|参考文献)/i.test(candidate.year.quote)){result.year=Number(candidate.year.value);result.evidence.year=candidate.year.quote;}
  if(typeof candidate?.title?.value==='string'&&candidate.title.value.length>8&&supported(candidate.title.value,candidate.title.quote)){result.title=candidate.title.value.trim();result.evidence.title=candidate.title.quote;}
  return result;
}
export function applySourceMetadata(node,metadata) {
  const verifiedRemote=Boolean(node.openAlexId||node.metadataApiUrl||node.metadataRetrievedAt);
  const legacyPlaceholder=!verifiedRemote&&!node.sourceMetadataVersion&&(!node.authors?.length||node.metadataWarning);
  if(metadata.authors?.length&&(!verifiedRemote||!node.authors?.length))node.authors=[...new Set(metadata.authors)];
  if(metadata.year&&(!verifiedRemote||!node.year))node.year=metadata.year;
  else if(legacyPlaceholder&&!node.sourceMetadataEvidence?.year)node.year=null;
  if(metadata.title&&!verifiedRemote)node.title=metadata.title;
  if(metadata.doi&&!node.doi)node.doi=metadata.doi;
  node.sourceMetadataEvidence={...node.sourceMetadataEvidence,...metadata.evidence};
  node.sourceMetadataVersion=SOURCE_METADATA_VERSION;
  if(!node.citationSource)node.citations=null;
  return node;
}

export function shouldRefreshLocalMetadata(node) {
  if (!node?.importedLocally) return false;
  // A failed lookup is not a successful cache entry. Older saved jobs may also
  // contain a DOI with trailing punctuation from a PDF sentence.
  return !node.metadataChecked || Boolean(node.metadataWarning)
    || cleanDoi(node.doi) !== String(node.doi || '').trim();
}

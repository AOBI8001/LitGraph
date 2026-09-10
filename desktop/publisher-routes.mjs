// SPDX-License-Identifier: Apache-2.0
// Adapted from ScanSci-PDF's public publisher_pdf_router.py / publisher_profiles.py
// (5bce70619ae1392f48f3d8e58b6af18e3bf31550). See vendor/scansci/SOURCE.md.
// This module only describes routes. LitGraph owns the authenticated browser,
// navigation, download budget and human verification; no separate client is used.

const PROFILES = [
  {name:'elsevier',domains:['sciencedirect.com','linkinghub.elsevier.com','sciencedirectassets.com'],prefixes:['10.1016']},
  {name:'springer',domains:['link.springer.com','link.springernature.com'],prefixes:['10.1007']},
  {name:'nature',domains:['nature.com'],prefixes:['10.1038']},
  {name:'wiley',domains:['onlinelibrary.wiley.com'],prefixes:['10.1002','10.1111']},
  {name:'taylor-francis',domains:['tandfonline.com'],prefixes:['10.1080']},
  {name:'sage',domains:['journals.sagepub.com'],prefixes:['10.1177']},
  {name:'acs',domains:['pubs.acs.org'],prefixes:['10.1021']},
  {name:'ieee',domains:['ieeexplore.ieee.org'],prefixes:['10.1109']},
];
const NON_ARTICLE = /supplement(?:ary|al)?|suppinfo|suppdata|suppl[_-]?file|supporting[ _-]?information|\/content\/image\/|[._-]mmc\d*|[._-](?:si|s\d+)\.pdf|[\/_-]preview(?:[\/_.?&=-]|$)|[?&](?:preview|ispreview)=|(?:^|[\s/_-])(?:table|figure)[ _-]?s\d+/i;
const PDF_LABEL = /^(?:(?:download|view|read|open|get|下载|查看|阅读|获取)\s*)?(?:(?:full[ -]?text|全文)\s*)?\(?PDF\)?(?:\s*(?:full[ -]?text|全文|下载|查看|阅读))?(?:\s*[[(]?\s*[\d.,]+\s*[kmg]?b\s*[\])]?)*$/i;
const decode = value => {try{return decodeURIComponent(String(value));}catch{return String(value);}};
const entities = value => String(value || '').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(?:x([\da-f]+)|(\d+));/gi,(_m,hex,dec)=>{const n=parseInt(hex||dec,hex?16:10);return n<=0x10ffff?String.fromCodePoint(n):'';});
const cleanDoi = value => decode(value || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').toLowerCase();
const parse = (value,base) => {try{const u=new URL(entities(value),base);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}};
const attrs = text => Object.fromEntries([...String(text).matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>[m[1].toLowerCase(),entities(m[2]??m[3]??m[4])]));
const pii = value => decode(value).match(/(?:\/pii\/|[?&]pii=|1-s2\.0-)([a-z0-9]+)/i)?.[1]?.toLowerCase() || '';
const ieeeNumber = value => decode(value).match(/(?:\/document\/|[?&]arnumber=)(\d+)/i)?.[1] || '';
const embeddedTargets = url => ['file','pdf','src','url'].flatMap(key=>url.searchParams.getAll(key)).map(value=>parse(value,url.href)).filter(Boolean);
function doiInUrl(value) {
  const u=parse(value);if(!u)return '';
  for(const key of ['doi','id']){const v=u.searchParams.get(key);if(/^10\.\d{4,9}\//i.test(v||''))return cleanDoi(v);}
  const path=decode(u.pathname);
  const match=path.match(/(?:^|\/)(10\.\d{4,9}\/[^?#\s]+)$/i);
  return match?cleanDoi(match[1]).replace(/\.pdf$/i,'').replace(/\/(?:pdf|epdf|pdfdirect)$/i,''):'';
}

export function detectPublisher(url,doi='') {
  const host=parse(url)?.hostname.toLowerCase()||'';
  const known=PROFILES.find(p=>p.domains.some(d=>host===d||host.endsWith('.'+d)));
  return known?.name || PROFILES.find(p=>p.prefixes.some(prefix=>cleanDoi(doi).startsWith(prefix+'/')))?.name || '';
}

// A positive result means no contradictory identity was found, not proof of
// entitlement or content identity. The caller must still validate PDF bytes and
// bind opaque response URLs to its current navigation / explicit PDF control.
export function isArticlePdfCandidate(candidate,{sourceUrl='',doi=''}={},depth=0) {
  const source=parse(sourceUrl), target=parse(candidate,sourceUrl);
  if(!target||NON_ARTICLE.test(decode(target.pathname+target.search)))return false;
  const expectedDoi=cleanDoi(doi)||doiInUrl(sourceUrl), candidateDoi=doiInUrl(target.href);
  if(expectedDoi&&candidateDoi&&expectedDoi!==candidateDoi)return false;
  const sourceDoi=doiInUrl(sourceUrl);
  if(expectedDoi&&sourceDoi&&expectedDoi!==sourceDoi)return false;
  const sourcePii=pii(sourceUrl),targetPii=pii(target.href);
  if(sourcePii&&targetPii&&sourcePii!==targetPii)return false;
  const sourceNumber=ieeeNumber(sourceUrl),targetNumber=ieeeNumber(target.href);
  if(sourceNumber&&targetNumber&&sourceNumber!==targetNumber)return false;
  // PDF.js and publisher viewers may put the real document in a URL query.
  // Check that document as well, so a wrapper cannot hide a different paper.
  if(depth<2&&embeddedTargets(target).some(value=>!isArticlePdfCandidate(value.href,{sourceUrl,doi},depth+1)))return false;
  if(source&&detectPublisher(source.href)==='nature'){
    const a=decode(source.pathname).match(/\/articles\/([^/]+?)(?:\.pdf)?$/i)?.[1];
    const b=decode(target.pathname).match(/\/articles\/([^/]+?)(?:\.pdf)?$/i)?.[1];
    if(a&&b&&a.toLowerCase()!==b.toLowerCase())return false;
    if(expectedDoi.startsWith('10.1038/')&&b&&b.toLowerCase()!==expectedDoi.slice(8))return false;
  }
  return true;
}

function routes(source,doi,publisher) {
  // Replace only an observed article path and keep its origin plus gateway
  // prefix. Never unwrap an institution gateway or guess a direct host.
  const p=source.pathname, out=[];
  const add=pathname=>{const u=new URL(source);u.pathname=pathname;u.search='';u.hash='';out.push(u.href);};
  if(publisher==='elsevier'&&/\/science\/article\/(?:abs\/)?pii\/[a-z0-9]+\/?$/i.test(p)){
    add(p.replace(/\/science\/article\/(?:abs\/)?pii\/([a-z0-9]+)\/?$/i,'/science/article/pii/$1/pdfft'));
  }else if(publisher==='ieee'&&/\/document\/\d+\/?$/i.test(p)){
    const prefix=p.slice(0,p.lastIndexOf('/document/')),number=ieeeNumber(source.href);
    for(const endpoint of ['/stampPDF/getPDF.jsp','/stamp/stamp.jsp']){
      const u=new URL(source);u.pathname=prefix+endpoint;u.search='';u.hash='';u.searchParams.set('arnumber',number);out.push(u.href);
    }
  }else if(publisher==='springer'&&/\/article\/10\./i.test(decode(p))){
    const at=p.lastIndexOf('/article/');if(at>=0)add(p.slice(0,at)+'/content/pdf/'+p.slice(at+9).replace(/\/$/,'')+'.pdf');
  }else if(publisher==='nature'&&/\/articles\/[^/]+\/?$/i.test(p)&&!/\.pdf$/i.test(p)){
    add(p.replace(/\/$/,'')+'.pdf');
  }else if(['wiley','taylor-francis','sage','acs'].includes(publisher)){
    const match=p.match(/^(.*\/doi\/)(?:(?:abs|full|epdf|pdf|pdfdirect)\/)?(10\..+)$/i);
    if(match){
      const suffix=match[2].replace(/\/$/,'');
      for(const mode of publisher==='wiley'?['pdfdirect','pdf','epdf']:['pdf','epdf'])add(match[1]+mode+'/'+suffix);
    }
  }
  return out.filter(candidate=>candidate!==source.href&&isArticlePdfCandidate(candidate,{sourceUrl:source.href,doi}));
}

export function publisherPdfCandidates({url,doi='',html='',normalize=value=>value}={}) {
  const source=parse(url);if(!source)return [];
  const documentText=String(html), metadata=[], observed=[], fallback=[], result=[];
  const metadataTags=[...documentText.matchAll(/<meta\b([^>]*)>/gi)].map(m=>attrs(m[1]));
  const declaredDoi=metadataTags.find(a=>/^(?:citation_doi|dc\.identifier|dc\.identifier\.doi)$/i.test(a.name||a.property||'')&&/^10\.|^https?:\/\/(?:dx\.)?doi\.org\//i.test(a.content||''))?.content;
  const expected=cleanDoi(doi)||cleanDoi(declaredDoi)||doiInUrl(source.href);
  if(doi&&declaredDoi&&cleanDoi(doi)!==cleanDoi(declaredDoi))return [];
  const accepts=value=>isArticlePdfCandidate(value,{sourceUrl:source.href,doi:expected});
  for(const a of metadataTags){
    if(/^(?:citation_pdf_url|pdf_url|eprints\.document_url)$/i.test(a.name||a.property||a.itemprop||'')&&a.content)metadata.push(a.content);
  }
  // Visible PDF controls with an encoded article identity are safe to rank;
  // anonymous generic controls are only used when unambiguous on the page.
  for(const m of documentText.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const a=attrs(m[1]),label=(a['aria-label']||a.title||m[2].replace(/<[^>]*>/g,' ')).replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
    if(!a.href||!PDF_LABEL.test(label)||NON_ARTICLE.test(label)||/\bhidden(?:\s|=|$)/i.test(m[1])||a['aria-hidden']==='true'||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(a.style||''))continue;
    const target=parse(a.href,source.href);if(!target||!accepts(target.href))continue;
    const hasIdentity=doiInUrl(target.href)||pii(target.href)||ieeeNumber(target.href);
    (hasIdentity?observed:fallback).push(target.href);
  }
  for(const m of documentText.matchAll(/<(?:iframe|embed|object|link)\b([^>]*)>/gi)){
    const a=attrs(m[1]),value=a.src||a.data||a.href;
    if(!value||(!/pdf/i.test(a.type||'')&&!/\.pdf(?:[?#]|$)|\/(?:epdf|pdfdirect|pdfft)(?:[/?#]|$)/i.test(value)))continue;
    if(/alternate/i.test(a.rel||'')||/application\/pdf/i.test(a.type||'')||doiInUrl(parse(value,source.href)?.href||''))observed.push(value);
  }
  // Read a literal public PDF.js document declaration without executing scripts.
  for(const m of documentText.matchAll(/PDFViewerApplicationOptions\.set\(\s*['"]defaultUrl['"]\s*,\s*['"]([^'"\r\n]+)['"]/gi))observed.push(m[1]);
  const anonymous=[...new Set(fallback)];if(anonymous.length===1)observed.push(anonymous[0]);
  for(const raw of [...metadata,...observed,...routes(source,expected,detectPublisher(source.href,expected))]){
    const target=parse(raw,source.href);if(!target||target.href===source.href||!accepts(target.href))continue;
    for(const value of [target,...embeddedTargets(target)]){
      if(value.href===source.href||!accepts(value.href))continue;
      try{const safe=normalize(value.href);if(safe&&!result.includes(safe))result.push(safe);}catch{/* caller owns address policy */}
    }
  }
  return result;
}

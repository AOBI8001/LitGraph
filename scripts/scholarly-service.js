import {randomUUID} from 'node:crypto';
import {publicJson,publicFetch} from './public-fetch.js';
import {cleanDoi,paperKey,matchesDiscovery,discoveryCount,titleKey,MAX_SEARCH_QUERIES,rankDiscovery,topicMatch} from '../src/discovery-contract.js';
const fields='id,doi,title,publication_year,cited_by_count,authorships,referenced_works,abstract_inverted_index,primary_location,best_oa_location,locations,open_access,type,language,biblio';
const count=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.floor(v):null;
const strip=s=>String(s||'').replace(/<\/(?:p|jats:p)>/gi,'\n\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
const url=s=>{try{const u=new URL(s);if(u.protocol==='http:')u.protocol='https:';return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
function abstract(index){const words=[];for(const [word,positions]of Object.entries(index||{}))for(const p of positions)if(Number.isInteger(p)&&p>=0&&p<100000)words[p]=word;return words.join(' ').trim();}
function kind(type,title=''){if(/meta[ -]analysis|meta[ -]analys[ei]s|元分析|荟萃分析/i.test(title))return 'meta';return /review/i.test(type)?'review':/conference|proceeding/i.test(type)?'conference':/article|research|journal/i.test(type)?'research':'unknown';}
function stamp(p,source,api){return {...p,metadataSource:source,metadataRetrievedAt:new Date().toISOString(),metadataApiUrl:api,citationSource:p.citations===null?'':source,citationRetrievedAt:p.citations===null?null:new Date().toISOString(),referenceDois:p.referenceDois||[],references:p.references||[],referenceRecords:p.referenceRecords||[]};}
export function fromOpenAlex(w,api=''){
 const locations=[w.best_oa_location,...(w.locations||[]),w.primary_location].filter(Boolean),oa=locations.filter(l=>l.is_oa===true),doi=cleanDoi(w.doi);
 const pdfUrls=[...new Set(oa.map(l=>url(l.pdf_url)).filter(Boolean))];
 const oaLandingUrls=[...new Set([...oa.map(l=>url(l.landing_page_url)),url(w.open_access?.oa_url)].filter(Boolean))];
 return stamp({openAlexId:w.id,doi,title:w.title||'',year:Number(w.publication_year),authors:(w.authorships||[]).map(a=>a.author?.display_name).filter(Boolean),language:w.language||'unknown',articleType:kind(w.type,w.title),abstract:abstract(w.abstract_inverted_index),citations:count(w.cited_by_count),references:w.referenced_works||[],journal:w.primary_location?.source?.display_name||'',volume:w.biblio?.volume||'',issue:w.biblio?.issue||'',pages:[w.biblio?.first_page,w.biblio?.last_page].filter(Boolean).join('-'),sourceUrl:url(w.primary_location?.landing_page_url)|| (doi?`https://doi.org/${doi}`:url(w.id)),pdfUrl:pdfUrls[0]||'',pdfUrls,oaLandingUrls,isOpenAccess:w.open_access?.is_oa===true},'OpenAlex',api);
}
export function fromCrossref(w,api=''){
 const doi=cleanDoi(w.DOI),title=w.title?.[0]||'',referenceRecords=(w.reference||[]).map(r=>({doi:cleanDoi(r.DOI),text:r.unstructured||'',author:r.author||'',year:r.year||'',title:r['article-title']||''}));
 const licenses=(w.license||[]).filter(l=>/^https?:\/\/(?:www\.)?creativecommons\.org\/(?:licenses|publicdomain)\//i.test(l.URL||'')&&(!l.start?.timestamp||l.start.timestamp<=Date.now()));
 const pdfUrls=licenses.length?(w.link||[]).filter(l=>l['intended-application']!=='similarity-checking'&&(/application\/pdf/i.test(l['content-type']||'')||/\.pdf(?:[?#]|$)/i.test(l.URL||''))).map(l=>url(l.URL)).filter(Boolean):[];
 const oaLandingUrls=licenses.length?[url(w.resource?.primary?.URL),doi?`https://doi.org/${doi}`:url(w.URL)].filter(Boolean):[];
 return stamp({doi,title,year:Number((w.published||w.issued)?.['date-parts']?.[0]?.[0]),authors:(w.author||[]).map(a=>a.name||[a.given,a.family].filter(Boolean).join(' ')).filter(Boolean),language:w.language||'unknown',articleType:kind(w.type,title),abstract:strip(w.abstract),citations:count(w['is-referenced-by-count']),referenceDois:referenceRecords.map(r=>r.doi).filter(Boolean),referenceRecords,journal:w['container-title']?.[0]||'',volume:w.volume||'',issue:w.issue||'',pages:w.page||'',sourceUrl:doi?`https://doi.org/${doi}`:url(w.URL),pdfUrl:pdfUrls[0]||'',pdfUrls,oaLandingUrls,isOpenAccess:licenses.length>0,fulltextLicense:licenses[0]?.URL},'Crossref',api);
}
export function fromEuropePMC(w,api=''){
 const links=w.fullTextUrlList?.fullTextUrl||[],pdfUrls=links.filter(l=>l.availability==='Open access'&&l.documentStyle==='pdf').map(l=>url(l.url)).filter(Boolean);
 return stamp({doi:cleanDoi(w.doi),pmcid:w.pmcid||'',title:w.title||'',year:Number(w.pubYear),authors:(w.authorList?.author||[]).map(a=>a.fullName).filter(Boolean),language:({eng:'en',chi:'zh',zho:'zh'})[w.language]||w.language||'unknown',articleType:kind((w.pubTypeList?.pubType||[]).join(' '),w.title),abstract:strip(w.abstractText),citations:count(w.citedByCount),journal:w.journalInfo?.journal?.title||'',volume:w.journalInfo?.volume||'',issue:w.journalInfo?.issue||'',pages:w.pageInfo||'',sourceUrl:w.pmcid?`https://europepmc.org/articles/${w.pmcid}`:`https://europepmc.org/article/${w.source}/${w.id}`,pdfUrl:pdfUrls[0]||'',pdfUrls,oaLandingUrls:links.filter(l=>l.availability==='Open access').map(l=>url(l.url)).filter(Boolean),isOpenAccess:w.isOpenAccess==='Y'},'Europe PMC',api);
}
export function mergeMetadata(a,b){
 // Never replace a source-specific citation count with a count from another index.
 return {...a,pmcid:a.pmcid||b.pmcid,authors:a.authors?.length>=b.authors?.length?a.authors:b.authors,abstract:a.abstract||b.abstract,abstractSource:a.abstract?(a.abstractSource||a.metadataSource):b.metadataSource,volume:a.volume||b.volume,issue:a.issue||b.issue,pages:a.pages||b.pages,referenceDois:[...new Set([...(a.referenceDois||[]),...(b.referenceDois||[])])],referenceRecords:b.referenceRecords?.length?b.referenceRecords:a.referenceRecords,references:[...new Set([...(a.references||[]),...(b.references||[])])],pdfUrls:[...new Set([...(a.pdfUrls||[]),...(b.pdfUrls||[])])],oaLandingUrls:[...new Set([...(a.oaLandingUrls||[]),...(b.oaLandingUrls||[])])],pdfUrl:a.pdfUrl||b.pdfUrl,isOpenAccess:a.isOpenAccess||b.isOpenAccess,metadataSources:[...new Set([...(a.metadataSources||[a.metadataSource]),b.metadataSource])],citations:a.citations??b.citations,citationSource:a.citations==null?b.citationSource:a.citationSource,citationRetrievedAt:a.citations==null?b.citationRetrievedAt:a.citationRetrievedAt};
}
export function pdfLinksFromHtml(html,address,normalize=url) {
 const primary=[],secondary=[],decode=s=>String(s||'').replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(match,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):match);
 const attr=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1].toLowerCase(),decode(m[2]??m[3])]));
 for(const match of String(html).matchAll(/<(?:meta|link|a)\b[^>]*>/gi)) {
  const tag=match[0],a=attr(tag);let value='',preferred=true;
  if(/^<meta/i.test(tag)&&/^(citation_pdf_url|wkhealth_pdf_url)$/i.test(a.name||a.property||''))value=a.content;
  else if(/^<link/i.test(tag)&&/application\/pdf/i.test(a.type||''))value=a.href;
  else if(/^<a/i.test(tag)&&a.href&&/pdf|full.?text|全文|download/i.test([a.class,a.title,a['aria-label'],a['data-track-action']].join(' '))){value=a.href;preferred=false;}
  if(value&&!/supplement|suppinfo|supporting|(?:[._-])s\d+\.pdf/i.test(value))try{const resolved=normalize(new URL(value,address).href);if(resolved)(preferred?primary:secondary).push(resolved);}catch{}
 }
 // Citation metadata identifies this article's PDF. Do not select a PDF from
 // a references list when a landing page has several ambiguous download links.
 const unique=[...new Set(primary.length?primary:secondary)];
 return primary.length?unique.slice(0,5):unique.length===1?unique:[];
}
export function acquisitionError(error,address='') {
 const status=Number(error.status)||Number(String(error.message).match(/Source HTTP (\d+)/)?.[1]);
 let code='network_error',message=String(error.message||'Download failed.');
 if(status===403){code='access_denied';message='Source HTTP 403: this site denied automated access. Use an available repository or add the original manually.';}
 else if(status===404||status===410){code='not_found';message=`Source HTTP ${status}: this full-text link is missing or has moved.`;}
 else if(status===429){code='rate_limited';message='Source HTTP 429: the source rate limit was reached. Try again later.';}
 else if(error.name==='AbortError'||error.name==='TimeoutError'||/timed? ?out|ETIMEDOUT|operation was aborted/i.test(message)){code='timeout';message='Source timed out before a complete response was received. Saved work is retained.';}
 else if(/instead of a PDF|HTML|sign in|verification/i.test(message))code='not_pdf';
 return {code,message,...(address?{url:address}:{})};
}
export function scholarlyService({json=publicJson,fetchSource=publicFetch,searchBudgetMs=45000,searchRequestMs=12000}={}){
 const options={};if(process.env.LITGRAPH_CONTACT_EMAIL)options.mailto=process.env.LITGRAPH_CONTACT_EMAIL;
 async function search(input,signal) {
  signal?.throwIfAborted();
  const deadline=AbortSignal.any([AbortSignal.timeout(searchBudgetMs),...(signal?[signal]:[])]);
  const original=String(input.originalQuery||'').trim();
  let exact=null;const lookupReports=[];
  if(original)try{exact=await lookup({title:original,fast:true,onSource:(source,status)=>lookupReports.push({source,query:original,status,purpose:'exact-title lookup'})},AbortSignal.any([deadline,AbortSignal.timeout(searchRequestMs)]));}catch{signal?.throwIfAborted();}
  const terms=[...new Set([original,...(input.queries||[])].filter(Boolean))];
  let result;
  try{result=await searchSources({...input,queries:terms},deadline,signal);}catch(error){
    signal?.throwIfAborted();if(!exact)throw error;
    result={papers:[],sources:[],warnings:[error.message],incomplete:true,requested:discoveryCount(input.filters.resultCount)};
  }
  if(exact){
    const excluded=new Set(input.exclude||[]);
    if(excluded.has(exact.doi)||excluded.has(exact.openAlexId)||excluded.has(titleKey(exact.title)))result.warnings.unshift('The exact-title paper is already in the current project.');
    else if(matchesDiscovery(exact,input.filters)){
      result.papers=[{...exact,recordId:randomUUID(),exactTitleMatch:true},...result.papers.filter(p=>paperKey(p)!==paperKey(exact))];
      result.sources=[...new Set([exact.metadataSource,...result.sources])];result.incomplete=result.papers.length<discoveryCount(input.filters.resultCount);
    }else result.warnings.unshift(input.filters.source==='open'&&!exact.isOpenAccess?'An exact-title record was found, but it is not verified open access. Use institution access to search for restricted papers.':'An exact-title record was found outside the selected year, language or article-type filters.');
  }
  result.queryReports=[...lookupReports,...(result.queryReports||[])];
  result.sources=[...new Set([...result.sources,...lookupReports.filter(r=>r.status==='completed').map(r=>r.source)])];
  result.incomplete ||= result.queryReports.some(r=>r.status!=='completed');
  result.papers=rankDiscovery(result.papers,input.filters,original,input.subjectTerms).slice(0,discoveryCount(input.filters.resultCount));
  return result;
 }
 async function searchSources({queries,filters,exclude=[],englishFirst=true,subjectTerms=[],originalQuery=''},signal,cancelSignal){
  if (filters.language === 'any' && englishFirst) {
   const primary = await searchSources({ queries, subjectTerms, originalQuery, filters: { ...filters, language: 'en' }, exclude }, signal, cancelSignal);
   if (primary.papers.length >= discoveryCount(filters.resultCount) || signal.aborted) return primary;
   let extra;
   try { extra = await searchSources({ queries, subjectTerms, originalQuery, filters, exclude: [...exclude, ...primary.papers.map(paperKey)], englishFirst: false }, signal, cancelSignal); }
   catch(error) {
    cancelSignal?.throwIfAborted();
    if(!primary.papers.length)throw error;
    return {...primary,incomplete:true,warnings:[...new Set([...primary.warnings,error.message])]};
   }
   const papers = [...primary.papers, ...extra.papers];
   return { ...extra, papers, queryReports:[...(primary.queryReports||[]),...(extra.queryReports||[])], sources: [...new Set([...primary.sources, ...extra.sources])], warnings: [...new Set([...primary.warnings, ...extra.warnings])], incomplete: papers.length < discoveryCount(filters.resultCount) };
  }
  const requested=discoveryCount(filters.resultCount),from=Number(filters.yearStart),to=Number(filters.yearEnd);
  const candidateLimit=Math.min(1000,requested<=100?Math.max(5,requested*2):requested),pageSize=Math.min(100,Math.max(20,requested));
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1900||to<from||to>new Date().getFullYear())throw new Error('Invalid publication year range.');
  if(!['any','en','zh'].includes(filters.language)||!['any','research','review','meta','conference'].includes(filters.articleType)||!['open','institution'].includes(filters.source))throw new Error('Invalid discovery filters.');
  const terms=[...new Set((queries||[]).filter(q=>typeof q==='string'&&q.trim()).map(q=>q.trim().slice(0,500)))].slice(0,MAX_SEARCH_QUERIES);if(!terms.length)throw new Error('Empty search terms.');
  const found=new Map(),excluded=new Set(exclude),warnings=[],sources=new Set(),queryReports=[];let inspected=0,offTopic=0;
  const add=(p,match)=>{inspected++;if(subjectTerms.length&&!topicMatch(p,subjectTerms)&&titleKey(p.title)!==titleKey(originalQuery)){offTopic++;return;}if(!matchesDiscovery(p,filters)||excluded.has(p.doi)||excluded.has(p.openAlexId)||excluded.has(titleKey(p.title)))return;const key=paperKey(p),previous=found.get(key);found.set(key,{...(previous?mergeMetadata(previous,p):{...p,recordId:randomUUID()}),searchMatches:[...(previous?.searchMatches||[]),...(match?[match]:[])]});};
  const cursors=new Map();
  async function openAlexPage(q,cursor,page){
    cancelSignal?.throwIfAborted();
    if(signal.aborted){queryReports.push({source:'OpenAlex',query:q,status:'not_run'});return;}
    const f=[`from_publication_date:${from}-01-01`,`to_publication_date:${to}-12-31`];if(filters.language!=='any')f.push(`language:${filters.language}`);if(filters.source==='open')f.push('is_oa:true');
    const params=new URLSearchParams({...options,search:q,filter:f.join(','),per_page:String(pageSize),cursor,select:fields,sort:'relevance_score:desc'});if(process.env.OPENALEX_API_KEY)params.set('api_key',process.env.OPENALEX_API_KEY);if(filters.sort==='newest')params.set('sort','publication_date:desc');if(filters.sort==='cited')params.set('sort','cited_by_count:desc');
    const address=`https://api.openalex.org/works?${params}`;
    try{
      const data=await json(address,{signal:AbortSignal.any([signal,AbortSignal.timeout(searchRequestMs)])});sources.add('OpenAlex');
      (data.results||[]).forEach((w,i)=>add(fromOpenAlex(w,address.replace(/api_key=[^&]*/,'api_key=REDACTED')),{source:'OpenAlex',query:q,rank:page*pageSize+i+1}));
      queryReports.push({source:'OpenAlex',query:q,status:'completed',count:data.results?.length||0});
      const next=data.meta?.next_cursor;if(next&&next!==cursor&&data.results?.length)cursors.set(q,next);else cursors.delete(q);
    }catch(e){cancelSignal?.throwIfAborted();warnings.push(`OpenAlex: ${e.message}`);queryReports.push({source:'OpenAlex',query:q,status:'failed',error:e.message});cursors.delete(q);}
  }
  // Give every bilingual combination a first page before spending the budget
  // on deeper pages of any one query. Small batches keep request concurrency low.
  for(let i=0;i<terms.length;i+=2)await Promise.all(terms.slice(i,i+2).map(q=>openAlexPage(q,'*',0)));
  for(let page=1;page<Math.ceil(requested/pageSize)+2&&found.size<requested&&!signal.aborted;page++){
    if(!cursors.size)break;
    for(const [q,cursor]of [...cursors]){await openAlexPage(q,cursor,page);if(found.size>=requested)break;}
  }
  // Independent scholarly records, not model-generated fallbacks.
  for(const provider of ['Europe PMC','Crossref']){
   if(signal.aborted)break;
   if(found.size>=requested)break;
   for(const q of terms){
   if(signal.aborted)break;
    let cursor='*';
    for(let page=0;page<Math.ceil(requested/100)+1&&found.size<requested;page++){
     cancelSignal?.throwIfAborted();if(signal.aborted)break;let address;
     if(provider==='Europe PMC'){
      const query=`(${q.replace(/[():]/g,' ')}) FIRST_PDATE:[${from}-01-01 TO ${to}-12-31]${filters.source==='open'?' OPEN_ACCESS:Y':''}${filters.language==='en'?' LANG:eng':filters.language==='zh'?' LANG:chi':''}`;
      address='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+new URLSearchParams({query,format:'json',resultType:'core',pageSize:'100',cursorMark:cursor});
     }else address='https://api.crossref.org/works?'+new URLSearchParams({...options,query:q,filter:`from-pub-date:${from}-01-01,until-pub-date:${to}-12-31`,rows:'100',cursor});
     try{const d=await json(address,{signal:AbortSignal.any([signal,AbortSignal.timeout(searchRequestMs)])});sources.add(provider);const items=provider==='Europe PMC'?d.resultList?.result:d.message?.items;(items||[]).forEach((w,i)=>add(provider==='Europe PMC'?fromEuropePMC(w,address):fromCrossref(w,address),{source:provider,query:q,rank:page*100+i+1}));queryReports.push({source:provider,query:q,status:'completed',count:items?.length||0});const next=provider==='Europe PMC'?d.nextCursorMark:d.message?.['next-cursor'];if(!items?.length||!next||next===cursor)break;cursor=next;}catch(e){cancelSignal?.throwIfAborted();warnings.push(`${provider}: ${e.message}`);queryReports.push({source:provider,query:q,status:'failed',error:e.message});break;}
    }
    if(found.size>=requested)break;
   }
  }
  cancelSignal?.throwIfAborted();
  if(signal.aborted)warnings.push('Search time limit reached. Verified results are retained; refine the query for more records.');
  if(!sources.size&&warnings.length)throw new Error(warnings.join('; '));
  if(offTopic)warnings.push('Excluded '+offTopic+' source matches without the core subject in their title or abstract.');
  const papers=rankDiscovery([...found.values()],filters,originalQuery,subjectTerms);
  return {papers:papers.slice(0,candidateLimit),requested,inspected,sources:[...sources],queryReports,warnings:[...new Set(warnings)],incomplete:papers.length<requested};
 }
 async function enrich(p,signal){
  let result=p;
  if(p.doi)try{const address=`https://api.crossref.org/works/${encodeURIComponent(p.doi)}`;const d=await json(address,{signal});if(cleanDoi(d.message?.DOI)===cleanDoi(p.doi)){const source=fromCrossref(d.message,address);result=result.metadataSource?mergeMetadata(result,source):source;}}catch(e){signal?.throwIfAborted();result={...result,metadataWarning:`Crossref: ${e.message}`};}
  if(!result.pmcid&&p.doi)try{const address='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+new URLSearchParams({query:`DOI:"${p.doi.replace(/"/g,'')}"`,format:'json',resultType:'core',pageSize:'5'});const data=await json(address,{signal});const w=data.resultList?.result?.find(w=>cleanDoi(w.doi)===cleanDoi(p.doi));if(w)result=mergeMetadata(result,fromEuropePMC(w,address));}catch(e){signal?.throwIfAborted();}
  return result;
 }
 async function resolveOpenAccess(p,signal) {
  const pmcid=p.pmcid||[p.sourceUrl,...(p.oaLandingUrls||[]),...(p.pdfUrls||[])].join(' ').match(/\bPMC\d+\b/)?.[0];
  if(!/^PMC\d+$/.test(pmcid||''))return p;
  // NLM's current public cloud API lists real article versions. Never guess a
  // legacy FTP URL or scrape a PMC challenge page to bypass access controls.
  try {
   const listing='https://pmc-oa-opendata.s3.amazonaws.com/?'+new URLSearchParams({'list-type':'2',prefix:`metadata/${pmcid}.`,'max-keys':'20'});
   const xml=(await fetchSource(listing,{signal,limit:128000})).bytes.toString('utf8');
   const keys=[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m=>m[1]).filter(key=>new RegExp(`^metadata/${pmcid}\\.\\d+\\.json$`).test(key));
   const records=[];
   for(const key of keys.slice(0,4)) {
    const record=await json('https://pmc-oa-opendata.s3.amazonaws.com/'+key,{signal});
    if(record.pmcid!==pmcid||p.doi&&cleanDoi(record.doi)!==cleanDoi(p.doi)||!record.pdf_url)continue;
    const pdf=url(String(record.pdf_url).replace(/^s3:\/\/pmc-oa-opendata\//,'https://pmc-oa-opendata.s3.amazonaws.com/'));
    if(pdf)records.push({pdf,version:record.version,license:record.license_code,isManuscript:Boolean(record.is_manuscript)});
   }
   records.sort((a,b)=>Number(a.isManuscript)-Number(b.isManuscript));
   if(records.length)return {...p,pmcid,isOpenAccess:true,pdfUrl:records[0].pdf,pdfUrls:[...new Set([...records.map(r=>r.pdf),...(p.pdfUrls||[])])],fulltextRepository:'NLM PubMed Central (PMC) Cloud Service',fulltextLicense:records[0].license,fulltextVersion:records[0].version};
  }catch(error){signal?.throwIfAborted();return {...p,downloadResolverWarning:acquisitionError(error).message};}
  return p;
 }
 async function lookup({doi='',title='',fast=false,onSource=()=>{}},signal) {
  const cleaned=cleanDoi(doi);let found=null;
  const address=cleaned?'https://api.openalex.org/works/https://doi.org/'+encodeURIComponent(cleaned):'https://api.openalex.org/works?'+new URLSearchParams({search:title,'per-page':'3'});
  if(cleaned || title?.trim()) try {
   const data=await json(address,{signal});onSource('OpenAlex','completed');
   const titleId=t=>String(t||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
   const work=cleaned?data:data.results?.find(w=>titleId(w.title)===titleId(title));
   if(work?.id && (!cleaned || cleanDoi(work.doi)===cleaned)) found=fromOpenAlex(work,address);
  } catch { signal?.throwIfAborted();onSource('OpenAlex','failed'); }
  if(!cleaned&&!found&&title?.trim())try{
    const endpoint='https://api.crossref.org/works?'+new URLSearchParams({'query.title':title,rows:'8'});
    const data=await json(endpoint,{signal});onSource('Crossref','completed');
    const work=data.message?.items?.find(w=>titleKey(w.title?.[0])===titleKey(title));
    if(work)found=fromCrossref(work,endpoint);
  }catch{signal?.throwIfAborted();onSource('Crossref','failed');}
  if(fast&&found)return found;
  if(cleaned || found?.doi) {
   const seed=found||{doi:cleaned,title,authors:[],citations:null,referenceDois:[],references:[]};
   const result=await enrich(seed,signal);
   if(result.metadataSource) return result;
  }
  return found;
 }
 return {search,enrich,lookup,resolveOpenAccess};
}
